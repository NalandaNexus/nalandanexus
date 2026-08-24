import crypto from 'crypto';
import { Student } from '../models/Student.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, buildPaginationMeta, parseSort } from '../utils/pagination.js';
import { withIds } from '../utils/serialize.js';
import { recordAuditLog } from './auditLog.service.js';
import { emitEvent } from '../sockets/index.js';
import * as emailService from './email.service.js';

const SORTABLE_FIELDS = ['name', 'email', 'rollNo', 'department', 'status', 'gpa', 'attendancePercent', 'createdAt'];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function generateTempPassword() {
  return crypto.randomBytes(9).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 12) + 'A1!';
}

export async function listStudents(query) {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query.sort, SORTABLE_FIELDS);

  const filter = { deletedAt: null };
  if (query.status) filter.status = query.status;
  if (query.department) filter.department = new RegExp(escapeRegex(query.department), 'i');
  if (query.courseId) filter.enrolledCourses = query.courseId;
  if (query.batch) filter.batch = query.batch;
  if (query.search) filter.$text = { $search: query.search };

  const [items, total] = await Promise.all([
    Student.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Student.countDocuments(filter),
  ]);

  return { items: withIds(items), meta: buildPaginationMeta({ page, limit, total }) };
}

export async function getStudentById(id) {
  const student = await Student.findOne({ _id: id, deletedAt: null }).populate('enrolledCourses', 'title code');
  if (!student) throw ApiError.notFound('Student not found', 'STUDENT_NOT_FOUND');
  return student;
}

export async function createStudent(data, actor, req) {
  const existingEmail = await Student.findOne({ email: data.email.toLowerCase() });
  if (existingEmail) throw ApiError.conflict('A student with this email already exists', 'STUDENT_EMAIL_EXISTS');
  const existingRoll = await Student.findOne({ rollNo: data.rollNo });
  if (existingRoll) throw ApiError.conflict('A student with this roll number already exists', 'STUDENT_ROLLNO_EXISTS');

  const tempPassword = generateTempPassword();
  const student = await Student.create({
    name: data.name,
    email: data.email.toLowerCase(),
    phone: data.phone,
    rollNo: data.rollNo,
    batch: data.batch,
    semester: data.semester,
    department: data.department,
    passwordHash: await Student.hashPassword(tempPassword),
  });

  await emailService.send({
    to: student.email,
    subject: 'Your Nalanda Nexus student account has been created',
    text: `Hi ${student.name},\n\nAn administrator created a student account for you.\nRoll No: ${student.rollNo}\nTemporary password: ${tempPassword}\nPlease log in and change this password.\n\n— Nalanda Nexus`,
  });

  await recordAuditLog({ actor, action: 'student.created', entityType: 'Student', entityId: student._id, metadata: { email: student.email }, req });
  emitEvent.studentCreated(student);
  return student;
}

export async function updateStudent(id, data, actor, req) {
  const student = await Student.findOne({ _id: id, deletedAt: null });
  if (!student) throw ApiError.notFound('Student not found', 'STUDENT_NOT_FOUND');

  Object.assign(student, data);
  await student.save();

  await recordAuditLog({ actor, action: 'student.updated', entityType: 'Student', entityId: student._id, metadata: { fields: Object.keys(data) }, req });
  emitEvent.studentUpdated(student);
  return student;
}

export async function deleteStudent(id, actor, req) {
  const student = await Student.findOne({ _id: id, deletedAt: null });
  if (!student) throw ApiError.notFound('Student not found', 'STUDENT_NOT_FOUND');

  // Soft delete — preserves academic history (grades, enrollments, audit
  // trail referencing this student) instead of a destructive hard delete.
  student.deletedAt = new Date();
  student.status = 'INACTIVE';
  await student.save();

  await recordAuditLog({ actor, action: 'student.deleted', entityType: 'Student', entityId: student._id, req });
  emitEvent.studentDeleted(student._id);
  return student;
}

export default { listStudents, getStudentById, createStudent, updateStudent, deleteStudent };
