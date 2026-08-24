import { Teacher } from '../models/Teacher.js';
import { Student } from '../models/Student.js';
import { Course } from '../models/Course.js';
import { Payment } from '../models/Payment.js';
import { Enrollment } from '../models/Enrollment.js';
import { AuditLog } from '../models/AuditLog.js';
import { ApiError } from '../utils/ApiError.js';

function toCsv(rows, columns) {
  const header = columns.map((c) => c.label).join(',');
  const escape = (val) => {
    const str = val === undefined || val === null ? '' : String(val);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = rows.map((row) => columns.map((c) => escape(c.value(row))).join(','));
  return [header, ...lines].join('\n');
}

/** Builds a createdAt range filter from optional ISO `from`/`to` query params — omitted entirely when neither is given. */
function dateRangeFilter(from, to) {
  if (!from && !to) return undefined;
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) range.$lte = new Date(to);
  return range;
}

export async function generateReport(type, filters = {}) {
  const { from, to, status } = filters;
  const createdAtRange = dateRangeFilter(from, to);

  if (type === 'teachers') {
    const filter = { deletedAt: null };
    if (status) filter.status = status;
    if (createdAtRange) filter.createdAt = createdAtRange;
    const rows = await Teacher.find(filter).lean();
    return toCsv(rows, [
      { label: 'Teacher ID', value: (r) => r.teacherId },
      { label: 'Name', value: (r) => r.name },
      { label: 'Email', value: (r) => r.email },
      { label: 'Department', value: (r) => r.department || '' },
      { label: 'Subject', value: (r) => r.subject || '' },
      { label: 'Status', value: (r) => r.status },
      { label: 'Rating', value: (r) => r.rating },
      { label: 'Students', value: (r) => r.studentsCount },
      { label: 'Courses', value: (r) => r.coursesCount },
      { label: 'Portal Provisioned', value: (r) => (r.portalProvisioned ? 'Yes' : 'No') },
      { label: 'Credential Email Status', value: (r) => r.emailDeliveryStatus || '' },
      { label: 'Created At', value: (r) => new Date(r.createdAt).toISOString() },
    ]);
  }

  if (type === 'students') {
    const filter = { deletedAt: null };
    if (status) filter.status = status;
    if (createdAtRange) filter.createdAt = createdAtRange;
    const rows = await Student.find(filter).lean();
    return toCsv(rows, [
      { label: 'Roll No', value: (r) => r.rollNo },
      { label: 'Name', value: (r) => r.name },
      { label: 'Email', value: (r) => r.email },
      { label: 'Department', value: (r) => r.department || '' },
      { label: 'Batch', value: (r) => r.batch || '' },
      { label: 'Status', value: (r) => r.status },
      { label: 'Attendance %', value: (r) => r.attendancePercent },
      { label: 'GPA', value: (r) => r.gpa },
      { label: 'Created At', value: (r) => new Date(r.createdAt).toISOString() },
    ]);
  }

  if (type === 'courses') {
    const filter = { deletedAt: null };
    if (status) filter.status = status;
    if (createdAtRange) filter.createdAt = createdAtRange;
    const rows = await Course.find(filter).populate('instructor', 'name email').lean();
    return toCsv(rows, [
      { label: 'Code', value: (r) => r.code },
      { label: 'Title', value: (r) => r.title },
      { label: 'Department', value: (r) => r.department || '' },
      { label: 'Instructor', value: (r) => r.instructor?.name || '' },
      { label: 'Status', value: (r) => r.status },
      { label: 'Price (INR)', value: (r) => (r.priceInPaise ? (r.priceInPaise / 100).toFixed(2) : '0.00') },
      { label: 'Credits', value: (r) => r.credits },
      { label: 'Rating', value: (r) => r.rating },
      { label: 'Completion Rate %', value: (r) => r.completionRate },
      { label: 'Catalog Sync Status', value: (r) => r.catalogSyncStatus || '' },
      { label: 'Created At', value: (r) => new Date(r.createdAt).toISOString() },
    ]);
  }

  if (type === 'payments') {
    const filter = { deletedAt: null };
    if (status) filter.status = status;
    if (createdAtRange) filter.createdAt = createdAtRange;
    const rows = await Payment.find(filter).populate('student', 'name rollNo email').lean();
    return toCsv(rows, [
      { label: 'Student Name', value: (r) => r.student?.name || r.externalStudentName || '' },
      { label: 'Student Email', value: (r) => r.student?.email || r.externalStudentEmail || '' },
      { label: 'Roll No', value: (r) => r.student?.rollNo || '' },
      { label: 'Course', value: (r) => r.courseTitle || '' },
      { label: 'Amount', value: (r) => r.amount },
      { label: 'Currency', value: (r) => r.currency },
      { label: 'Status', value: (r) => r.status },
      { label: 'Source', value: (r) => r.source },
      { label: 'Method', value: (r) => r.method },
      { label: 'Razorpay Order ID', value: (r) => r.razorpayOrderId || '' },
      { label: 'Razorpay Payment ID', value: (r) => r.razorpayPaymentId || '' },
      { label: 'Reference', value: (r) => r.reference || '' },
      { label: 'Paid At', value: (r) => (r.paidAt ? new Date(r.paidAt).toISOString() : '') },
      { label: 'Created At', value: (r) => new Date(r.createdAt).toISOString() },
    ]);
  }

  if (type === 'enrollments') {
    const filter = {};
    if (status) filter.status = status;
    if (createdAtRange) filter.enrolledAt = createdAtRange;
    const rows = await Enrollment.find(filter).populate('student', 'name rollNo email').populate('course', 'title code').lean();
    return toCsv(rows, [
      { label: 'Student Name', value: (r) => r.student?.name || '' },
      { label: 'Roll No', value: (r) => r.student?.rollNo || '' },
      { label: 'Student Email', value: (r) => r.student?.email || '' },
      { label: 'Course', value: (r) => r.course?.title || '' },
      { label: 'Course Code', value: (r) => r.course?.code || '' },
      { label: 'Status', value: (r) => r.status },
      { label: 'Progress %', value: (r) => r.progressPercent },
      { label: 'Enrolled At', value: (r) => (r.enrolledAt ? new Date(r.enrolledAt).toISOString() : '') },
      { label: 'Completed At', value: (r) => (r.completedAt ? new Date(r.completedAt).toISOString() : '') },
    ]);
  }

  if (type === 'audit') {
    const filter = {};
    if (createdAtRange) filter.createdAt = createdAtRange;
    const rows = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(5000).lean();
    return toCsv(rows, [
      { label: 'Timestamp', value: (r) => new Date(r.createdAt).toISOString() },
      { label: 'Actor', value: (r) => r.actorName || '' },
      { label: 'Role', value: (r) => r.actorRole || '' },
      { label: 'Action', value: (r) => r.action },
      { label: 'Entity Type', value: (r) => r.entityType },
      { label: 'Entity ID', value: (r) => (r.entityId ? String(r.entityId) : '') },
      { label: 'Result', value: (r) => r.result },
      { label: 'IP', value: (r) => r.ip || '' },
    ]);
  }

  throw ApiError.badRequest(`Unknown report type: ${type}`, 'UNKNOWN_REPORT_TYPE');
}

export default { generateReport };
