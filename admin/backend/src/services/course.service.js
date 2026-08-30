import { env } from '../config/env.js';
import { Course } from '../models/Course.js';
import { Teacher } from '../models/Teacher.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, buildPaginationMeta, parseSort } from '../utils/pagination.js';
import { withIds } from '../utils/serialize.js';
import { recordAuditLog } from './auditLog.service.js';
import { notifyAllAdmins } from './notification.service.js';
import { emitEvent } from '../sockets/index.js';
import { publishCourseToStudents, unpublishCourseFromStudents } from './studentCourseBridge.service.js';
import { pushCourseAssignment, removeCourseAssignment } from './teacherBridge.service.js';

const SORTABLE_FIELDS = ['title', 'code', 'department', 'status', 'rating', 'completionRate', 'createdAt'];

/** One feature per line from the multipart text field — see validators/course.validator.js. */
function parseFeatures(raw) {
  if (raw === undefined) return undefined;
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function uniqueSlugFor(title, excludeId) {
  const base = slugify(title) || 'course';
  let slug = base;
  let suffix = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await Course.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
  return slug;
}

/** Publishes to the real student catalog when a course is APPROVED with a real price - never silently claims success. */
async function syncToStudentCatalog(course) {
  const result = await publishCourseToStudents(course);
  course.catalogSyncedAt = new Date();
  course.catalogSyncStatus = result.synced ? 'synced' : 'failed';
  await course.save();
  return result;
}

/**
 * Pushes the current course state into its assigned teacher's Teacher
 * Portal — best-effort, called on every create/update/status-change while
 * an instructor is set (not gated on governance status: the teacher needs
 * to see a course is assigned to them, even in DRAFT/PENDING_REVIEW,
 * independent of whether it is yet publicly purchasable — that gate only
 * applies to the student catalog bridge above).
 */
async function syncToAssignedTeacher(course) {
  if (!course.instructor) return undefined;
  const teacher = await Teacher.findById(course.instructor).select('email').lean();
  if (!teacher) return undefined;
  return pushCourseAssignment({
    sourceId: String(course._id),
    teacherEmail: teacher.email,
    title: course.title,
    courseCode: course.code,
    description: course.description,
    // Resolved to an absolute URL here, same as studentCourseBridge.service.js
    // does for the student-catalog leg — sending the bare relative path left
    // Teacher Portal's assigned-course image broken (course.service.js audit).
    image: course.image ? `${env.serverUrl}${course.image}` : null,
    priceInPaise: course.priceInPaise,
    status: course.status,
  });
}

export async function listCourses(query) {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query.sort, SORTABLE_FIELDS);

  const filter = { deletedAt: null };
  if (query.status) filter.status = query.status;
  if (query.department) filter.department = new RegExp(escapeRegex(query.department), 'i');
  if (query.instructor) filter.instructor = query.instructor;
  if (query.search) filter.$text = { $search: query.search };

  const [items, total] = await Promise.all([
    Course.find(filter).sort(sort).skip(skip).limit(limit).populate('instructor', 'name email').lean(),
    Course.countDocuments(filter),
  ]);

  return { items: withIds(items), meta: buildPaginationMeta({ page, limit, total }) };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function getCourseById(id) {
  const course = await Course.findOne({ _id: id, deletedAt: null }).populate('instructor', 'name email department');
  if (!course) throw ApiError.notFound('Course not found', 'COURSE_NOT_FOUND');
  return course;
}

export async function createCourse(data, actor, req) {
  const existing = await Course.findOne({ code: data.code.toUpperCase() });
  if (existing) throw ApiError.conflict('A course with this code already exists', 'COURSE_CODE_EXISTS');

  if (data.instructor) {
    const teacher = await Teacher.findOne({ _id: data.instructor, deletedAt: null }).select('status').lean();
    if (!teacher) throw ApiError.badRequest('Invalid instructor reference', 'INVALID_TEACHER_REF');
    if (teacher.status !== 'ACTIVE') throw ApiError.badRequest('Assigned teacher is not an active faculty account', 'TEACHER_NOT_ACTIVE');
  }

  const slug = await uniqueSlugFor(data.title);
  const course = await Course.create({
    ...data,
    features: parseFeatures(data.features) || [],
    slug,
    status: 'PENDING_REVIEW',
    submittedAt: new Date(),
  });
  if (data.instructor) await Teacher.updateOne({ _id: data.instructor }, { $inc: { coursesCount: 1 } });

  await recordAuditLog({ actor, action: 'course.created', entityType: 'Course', entityId: course._id, req });
  if (course.image) {
    await recordAuditLog({ actor, action: 'course.imageUploaded', entityType: 'Course', entityId: course._id, metadata: { image: course.image }, req });
  }
  await notifyAllAdmins({
    excludeAdminId: actor._id,
    type: 'COURSE_SUBMITTED',
    title: 'New course awaiting review',
    message: `"${course.title}" (${course.code}) was submitted for governance approval.`,
    relatedEntityType: 'Course',
    relatedEntityId: course._id,
  });
  emitEvent.courseCreated(course);

  const teacherAssignment = await syncToAssignedTeacher(course);
  if (data.instructor && !teacherAssignment?.assigned) {
    await recordAuditLog({
      actor,
      action: 'course.teacherAssigned',
      entityType: 'Course',
      entityId: course._id,
      metadata: { reason: teacherAssignment?.reason || 'UNKNOWN' },
      result: 'FAILURE',
      req,
    });
  } else if (teacherAssignment?.assigned) {
    await recordAuditLog({ actor, action: 'course.teacherAssigned', entityType: 'Course', entityId: course._id, req });
  }

  return { course, teacherAssignment };
}

export async function updateCourse(id, data, actor, req) {
  const course = await Course.findOne({ _id: id, deletedAt: null });
  if (!course) throw ApiError.notFound('Course not found', 'COURSE_NOT_FOUND');

  const instructorRemoved = data.instructor !== undefined && !data.instructor && course.instructor;
  if (data.instructor !== undefined && String(data.instructor) !== String(course.instructor || '')) {
    if (data.instructor) {
      const teacher = await Teacher.findOne({ _id: data.instructor, deletedAt: null }).select('status').lean();
      if (!teacher) throw ApiError.badRequest('Invalid instructor reference', 'INVALID_TEACHER_REF');
      if (teacher.status !== 'ACTIVE') throw ApiError.badRequest('Assigned teacher is not an active faculty account', 'TEACHER_NOT_ACTIVE');
      await Teacher.updateOne({ _id: data.instructor }, { $inc: { coursesCount: 1 } });
    }
    if (course.instructor) await Teacher.updateOne({ _id: course.instructor }, { $inc: { coursesCount: -1 } });
  }

  const { features, ...rest } = data;
  const imageChanged = data.image !== undefined && data.image !== course.image;
  Object.assign(course, rest);
  if (features !== undefined) course.features = parseFeatures(features);
  await course.save();

  await recordAuditLog({ actor, action: 'course.updated', entityType: 'Course', entityId: course._id, metadata: { fields: Object.keys(data) }, req });
  if (imageChanged) {
    await recordAuditLog({ actor, action: 'course.imageUploaded', entityType: 'Course', entityId: course._id, metadata: { image: course.image }, req });
  }
  emitEvent.courseUpdated(course);

  // Keep an already-live catalog listing in sync (price/description/image
  // edits after approval) - a no-op if it was never approved/synced.
  if (course.status === 'APPROVED' && course.catalogSyncStatus === 'synced') {
    await syncToStudentCatalog(course);
  }

  // Keep the assigned teacher's Teacher Portal view in sync — either a
  // fresh/updated assignment (new teacher or unchanged teacher with edited
  // fields), or an explicit removal when the instructor was cleared.
  //
  // The result is RETURNED, not discarded. This previously called the bridge
  // and threw the answer away, so an admin who re-saved a course to retry a
  // failed assignment got an unqualified success either way - no audit entry,
  // no message, no way to tell whether the teacher had actually received it.
  // The local save is deliberately kept: the course edit genuinely succeeded,
  // and rolling it back would lose real work over a downstream outage. The
  // caller reports the two outcomes separately.
  let teacherAssignment;
  if (course.instructor) {
    teacherAssignment = await syncToAssignedTeacher(course);
    if (!teacherAssignment?.assigned) {
      await recordAuditLog({
        actor,
        action: 'course.teacherAssigned',
        entityType: 'Course',
        entityId: course._id,
        metadata: { reason: teacherAssignment?.reason || 'UNKNOWN' },
        result: 'FAILURE',
        req,
      });
    }
  } else if (instructorRemoved) {
    await removeCourseAssignment(String(course._id));
  }

  return { course, teacherAssignment };
}

export async function setCourseStatus(id, { status, notes }, actor, req) {
  const course = await Course.findOne({ _id: id, deletedAt: null });
  if (!course) throw ApiError.notFound('Course not found', 'COURSE_NOT_FOUND');

  const wasSynced = course.catalogSyncStatus === 'synced';
  course.status = status;
  if (notes) course.notes = notes;
  course.reviewedAt = new Date();
  course.reviewedBy = actor?._id;
  await course.save();

  await recordAuditLog({ actor, action: `course.status.${status.toLowerCase()}`, entityType: 'Course', entityId: course._id, metadata: { notes }, req });
  await notifyAllAdmins({
    excludeAdminId: actor._id,
    type: 'COURSE_STATUS',
    title: `Course ${status.toLowerCase().replace('_', ' ')}`,
    message: `"${course.title}" (${course.code}) was marked ${status.toLowerCase().replace('_', ' ')}.`,
    relatedEntityType: 'Course',
    relatedEntityId: course._id,
  });

  let catalogSync;
  if (status === 'APPROVED') {
    catalogSync = await syncToStudentCatalog(course);
    emitEvent.coursePublished(course);
  } else if (wasSynced) {
    // Never delete on the student side (students may already own it) - only unpublish it from new purchases.
    await unpublishCourseFromStudents(String(course._id));
    course.catalogSyncStatus = null;
    await course.save();
  }
  emitEvent.courseUpdated(course);

  // The assigned teacher should see the real governance status too (e.g.
  // still PENDING_REVIEW vs. now APPROVED), independent of the student
  // catalog gate above.
  if (course.instructor) await syncToAssignedTeacher(course);

  return { course, catalogSync };
}

export async function deleteCourse(id, actor, req) {
  const course = await Course.findOne({ _id: id, deletedAt: null });
  if (!course) throw ApiError.notFound('Course not found', 'COURSE_NOT_FOUND');

  const wasSynced = course.catalogSyncStatus === 'synced';
  course.deletedAt = new Date();
  course.status = 'ARCHIVED';
  await course.save();
  if (course.instructor) {
    await Teacher.updateOne({ _id: course.instructor }, { $inc: { coursesCount: -1 } });
    await removeCourseAssignment(String(course._id));
  }

  // A course deleted directly (not via the status-change path) must not
  // stay live/purchasable on the student catalog forever — never delete on
  // that side (students may already own it), only unpublish new purchases,
  // same as setCourseStatus's non-APPROVED transition above.
  if (wasSynced) {
    await unpublishCourseFromStudents(String(course._id));
    course.catalogSyncStatus = null;
    await course.save();
  }

  await recordAuditLog({ actor, action: 'course.deleted', entityType: 'Course', entityId: course._id, req });
  emitEvent.courseDeleted(course._id);
  return course;
}

export default { listCourses, getCourseById, createCourse, updateCourse, setCourseStatus, deleteCourse };
