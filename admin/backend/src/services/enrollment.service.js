import { Enrollment } from '../models/Enrollment.js';
import { Student } from '../models/Student.js';
import { Course } from '../models/Course.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, buildPaginationMeta, parseSort } from '../utils/pagination.js';
import { withIds } from '../utils/serialize.js';
import { recordAuditLog } from './auditLog.service.js';
import { emitEvent } from '../sockets/index.js';

const SORTABLE_FIELDS = ['createdAt', 'progressPercent', 'status'];

export async function listEnrollments(query) {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query.sort, SORTABLE_FIELDS);
  const filter = {};
  if (query.student) filter.student = query.student;
  if (query.course) filter.course = query.course;
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    Enrollment.find(filter).sort(sort).skip(skip).limit(limit).populate('student', 'name rollNo').populate('course', 'title code').lean(),
    Enrollment.countDocuments(filter),
  ]);
  return { items: withIds(items), meta: buildPaginationMeta({ page, limit, total }) };
}

export async function createEnrollment(data, actor, req) {
  const [student, course] = await Promise.all([
    Student.findOne({ _id: data.student, deletedAt: null }),
    Course.findOne({ _id: data.course, deletedAt: null }),
  ]);
  if (!student) throw ApiError.badRequest('Invalid student reference', 'INVALID_STUDENT_REF');
  if (!course) throw ApiError.badRequest('Invalid course reference', 'INVALID_COURSE_REF');

  const existing = await Enrollment.findOne({ student: data.student, course: data.course });
  if (existing) throw ApiError.conflict('Student is already enrolled in this course', 'DUPLICATE_ENROLLMENT');

  const enrollment = await Enrollment.create(data);
  await Student.updateOne({ _id: data.student }, { $addToSet: { enrolledCourses: data.course } });

  await recordAuditLog({ actor, action: 'enrollment.created', entityType: 'Enrollment', entityId: enrollment._id, req });
  emitEvent.enrollmentCreated(enrollment);
  return enrollment;
}

export async function updateEnrollment(id, data, actor, req) {
  const enrollment = await Enrollment.findById(id);
  if (!enrollment) throw ApiError.notFound('Enrollment not found', 'ENROLLMENT_NOT_FOUND');

  Object.assign(enrollment, data);
  if (data.status === 'COMPLETED') enrollment.completedAt = new Date();
  await enrollment.save();

  await recordAuditLog({ actor, action: 'enrollment.updated', entityType: 'Enrollment', entityId: enrollment._id, req });
  emitEvent.enrollmentUpdated(enrollment);
  return enrollment;
}

export default { listEnrollments, createEnrollment, updateEnrollment };
