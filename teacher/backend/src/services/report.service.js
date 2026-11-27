import { Student } from '../models/Student.js';
import { SchoolClass } from '../models/SchoolClass.js';
import { Attendance } from '../models/Attendance.js';
import { Assignment } from '../models/Assignment.js';
import { Submission } from '../models/Submission.js';
import { ApiError } from '../utils/ApiError.js';
import { logAudit } from './audit.service.js';
import { getAccessibleClassIds } from './courseAccess.service.js';

function toCsv(rows, columns) {
  const header = columns.map((c) => c.label).join(',');
  const escape = (val) => {
    const str = val === undefined || val === null ? '' : String(val);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = rows.map((row) => columns.map((c) => escape(c.value(row))).join(','));
  return [header, ...lines].join('\n');
}

function dateRangeFilter(from, to) {
  if (!from && !to) return undefined;
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) range.$lte = new Date(to);
  return range;
}

/**
 * Every report queries the same live collections the dashboard/pages read
 * from — there is no separate "reporting" store, no cached snapshot, and
 * no synthetic total. `classId` (optional) scopes every type (except
 * 'classes', below) to a single class; standing to see that specific class
 * (own or course-access) is asserted by the caller (controller) before this
 * runs. With no classId, 'students'/'attendance'/'assignments'/'grades'
 * cover every class this teacher may act on - the same course-wide scope as
 * the dashboard and analytics views, so a CSV export shows the same data a
 * teacher can already see on screen. 'classes' stays this teacher's own
 * batches specifically (matching class.service.js#listClasses) - it is a
 * roster of the batches they administer, not a monitoring view.
 */
export async function generateReport(teacherId, type, filters = {}) {
  const { classId, from, to } = filters;
  const createdAtRange = dateRangeFilter(from, to);
  const classScope = classId ? classId : { $in: await getAccessibleClassIds(teacherId) };

  if (type === 'students') {
    const filter = { class: classScope, status: 'active' };
    const rows = await Student.find(filter).populate('class', 'name').lean();
    return toCsv(rows, [
      { label: 'Name', value: (r) => r.name },
      { label: 'Email', value: (r) => r.email },
      { label: 'Roll Number', value: (r) => r.rollNumber || '' },
      { label: 'Class', value: (r) => r.class?.name || '' },
      { label: 'Verified Enrollment', value: (r) => (r.linkedUserId ? 'Yes' : 'No') },
      { label: 'Current Score', value: (r) => r.metrics?.currentScore ?? 0 },
      { label: 'Attendance Rate %', value: (r) => r.metrics?.attendanceRate ?? 0 },
      { label: 'Submission Rate %', value: (r) => r.metrics?.submissionRate ?? 0 },
      { label: 'Risk Level', value: (r) => r.metrics?.riskLevel || 'good' },
      { label: 'Enrollment Date', value: (r) => new Date(r.enrollmentDate).toISOString().slice(0, 10) },
    ]);
  }

  if (type === 'attendance') {
    const filter = { class: classScope };
    if (createdAtRange) filter.date = createdAtRange;
    const rows = await Attendance.find(filter).populate('student', 'name email rollNumber').populate('class', 'name').sort({ date: -1 }).lean();
    return toCsv(rows, [
      { label: 'Date', value: (r) => new Date(r.date).toISOString().slice(0, 10) },
      { label: 'Student', value: (r) => r.student?.name || '' },
      { label: 'Roll Number', value: (r) => r.student?.rollNumber || '' },
      { label: 'Class', value: (r) => r.class?.name || '' },
      { label: 'Status', value: (r) => r.status },
      { label: 'Remarks', value: (r) => r.remarks || '' },
    ]);
  }

  if (type === 'assignments') {
    const filter = { class: classScope };
    if (createdAtRange) filter.dueDate = createdAtRange;
    const assignments = await Assignment.find(filter).populate('class', 'name').sort({ dueDate: -1 }).lean();
    const rows = await Promise.all(
      assignments.map(async (a) => {
        const [total, submitted, graded] = await Promise.all([
          Student.countDocuments({ class: a.class?._id, status: 'active' }),
          Submission.countDocuments({ assignment: a._id, status: { $in: ['submitted', 'late', 'graded'] } }),
          Submission.countDocuments({ assignment: a._id, status: 'graded' }),
        ]);
        return { ...a, totalStudents: total, submittedCount: submitted, gradedCount: graded };
      })
    );
    return toCsv(rows, [
      { label: 'Title', value: (r) => r.title },
      { label: 'Class', value: (r) => r.class?.name || '' },
      { label: 'Due Date', value: (r) => new Date(r.dueDate).toISOString().slice(0, 10) },
      { label: 'Max Score', value: (r) => r.maxScore },
      { label: 'Status', value: (r) => r.status },
      { label: 'Total Students', value: (r) => r.totalStudents },
      { label: 'Submitted', value: (r) => r.submittedCount },
      { label: 'Graded', value: (r) => r.gradedCount },
    ]);
  }

  if (type === 'grades') {
    const filter = { class: classScope };
    const assignments = await Assignment.find(filter).select('_id title maxScore').lean();
    const assignmentIds = assignments.map((a) => a._id);
    const submissions = await Submission.find({ assignment: { $in: assignmentIds }, status: 'graded' })
      .populate('student', 'name email rollNumber')
      .populate('assignment', 'title maxScore')
      .sort({ gradedAt: -1 })
      .lean();
    return toCsv(submissions, [
      { label: 'Student', value: (r) => r.student?.name || '' },
      { label: 'Roll Number', value: (r) => r.student?.rollNumber || '' },
      { label: 'Assignment', value: (r) => r.assignment?.title || '' },
      { label: 'Score', value: (r) => r.score },
      { label: 'Max Score', value: (r) => r.maxScore || r.assignment?.maxScore || '' },
      { label: 'Percentage', value: (r) => (r.maxScore ? Math.round((r.score / r.maxScore) * 100) : '') },
      { label: 'Feedback', value: (r) => r.feedback || '' },
      { label: 'Graded At', value: (r) => (r.gradedAt ? new Date(r.gradedAt).toISOString() : '') },
    ]);
  }

  if (type === 'classes') {
    const filter = { teacher: teacherId };
    const classes = await SchoolClass.find(filter).lean();
    const rows = await Promise.all(
      classes.map(async (c) => {
        const studentCount = await Student.countDocuments({ class: c._id, status: 'active' });
        const verifiedCount = await Student.countDocuments({ class: c._id, status: 'active', linkedUserId: { $ne: null } });
        return { ...c, studentCount, verifiedCount };
      })
    );
    return toCsv(rows, [
      { label: 'Class Name', value: (r) => r.name },
      { label: 'Code', value: (r) => r.code },
      { label: 'Subject', value: (r) => r.subject || '' },
      { label: 'Grade', value: (r) => r.grade || '' },
      { label: 'Status', value: (r) => r.status },
      { label: 'Linked Student Course', value: (r) => r.studentCourseSlug || '' },
      { label: 'Total Students', value: (r) => r.studentCount },
      { label: 'Verified Enrollments', value: (r) => r.verifiedCount },
    ]);
  }

  throw ApiError.badRequest(`Unknown report type: ${type}`, 'UNKNOWN_REPORT_TYPE');
}

export async function generateReportAndLog(teacherId, type, filters, ip) {
  const csv = await generateReport(teacherId, type, filters);
  await logAudit({ actorId: teacherId, action: 'report.exported', targetType: 'Report', metadata: { type, filters }, ip });
  return csv;
}

export default { generateReport, generateReportAndLog };
