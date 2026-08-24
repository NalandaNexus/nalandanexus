import { Course } from '../models/Course.js';
import { Student } from '../models/Student.js';
import { Submission } from '../models/Submission.js';
import { Assignment } from '../models/Assignment.js';
import { SchoolClass } from '../models/SchoolClass.js';
import { ApiError } from '../utils/ApiError.js';
import { logAudit } from './audit.service.js';

async function assertCourseOwnership(teacherId, courseId) {
  const course = await Course.findOne({ _id: courseId, teacher: teacherId });
  if (!course) throw ApiError.notFound('Course not found.', 'COURSE_NOT_FOUND');
  return course;
}

/**
 * A course's `classes` link directly drives its (otherwise teacher-scoped)
 * studentCount/completionRate aggregates in shapeCourse() below, which do
 * NOT themselves filter by teacher — so without this check, linking another
 * teacher's classId would leak that class's real roster size and completion
 * rate through this teacher's own Courses page. Same ownership-check pattern
 * as assertClassOwnership elsewhere, just applied to a list.
 */
async function assertClassIdsOwnership(teacherId, classIds) {
  if (!classIds || !classIds.length) return;
  const uniqueIds = [...new Set(classIds.map(String))];
  const count = await SchoolClass.countDocuments({ _id: { $in: uniqueIds }, teacher: teacherId });
  if (count !== uniqueIds.length) {
    throw ApiError.notFound('One or more classes were not found.', 'CLASS_NOT_FOUND');
  }
}

/** Student count and completion rate are derived live from the course's linked classes — never stored. */
async function shapeCourse(course) {
  const classIds = course.classes || [];
  const studentCount = classIds.length ? await Student.countDocuments({ class: { $in: classIds }, status: 'active', linkedUserId: { $ne: null } }) : 0;

  let completionRate = null;
  if (classIds.length) {
    const assignmentIds = (await Assignment.find({ class: { $in: classIds }, status: { $ne: 'draft' } }).select('_id')).map((a) => a._id);
    if (assignmentIds.length) {
      const [total, graded] = await Promise.all([
        Submission.countDocuments({ assignment: { $in: assignmentIds } }),
        Submission.countDocuments({ assignment: { $in: assignmentIds }, status: 'graded' }),
      ]);
      completionRate = total ? Math.round((graded / total) * 100) : 0;
    } else {
      completionRate = 0;
    }
  }

  return {
    id: course._id,
    title: course.title,
    category: course.category,
    classIds,
    modules: course.modulesCount,
    rating: course.rating,
    status: course.status,
    students: studentCount,
    completionRate,
    createdAt: course.createdAt,
  };
}

export async function listCourses(teacherId) {
  const courses = await Course.find({ teacher: teacherId, status: { $ne: 'archived' } }).sort({ createdAt: -1 }).lean();
  return Promise.all(courses.map(shapeCourse));
}

export async function createCourse(teacherId, payload, ip) {
  await assertClassIdsOwnership(teacherId, payload.classIds);

  const course = await Course.create({
    title: payload.title,
    category: payload.category || null,
    teacher: teacherId,
    classes: payload.classIds || [],
    modulesCount: payload.modulesCount || 0,
  });
  await logAudit({ actorId: teacherId, action: 'course.created', targetType: 'Course', targetId: course._id, metadata: { title: course.title }, ip });
  return shapeCourse(course);
}

export async function updateCourse(teacherId, courseId, updates, ip) {
  const course = await assertCourseOwnership(teacherId, courseId);

  // Explicit whitelist (rather than Object.assign(course, updates)) so an
  // undeclared field in the request body can never reach the document, even
  // if a future change to updateCourseValidator stops rejecting it first —
  // see assertClassIdsOwnership's doc-comment for why that matters for
  // `classes` specifically.
  const patchable = ['title', 'category', 'modulesCount', 'status'];
  for (const key of patchable) {
    if (updates[key] !== undefined) course[key] = updates[key];
  }
  await course.save();
  await logAudit({ actorId: teacherId, action: 'course.updated', targetType: 'Course', targetId: course._id, metadata: { updates }, ip });
  return shapeCourse(course);
}

export async function archiveCourse(teacherId, courseId, ip) {
  const course = await assertCourseOwnership(teacherId, courseId);
  course.status = 'archived';
  await course.save();
  await logAudit({ actorId: teacherId, action: 'course.archived', targetType: 'Course', targetId: course._id, ip });
  return { id: course._id, status: course.status };
}

export default { listCourses, createCourse, updateCourse, archiveCourse };
