import mongoose from 'mongoose';
import { pushAttendanceToStudents } from './studentBridge.service.js';
import { Attendance } from '../models/Attendance.js';
import { Student } from '../models/Student.js';
import { SchoolClass } from '../models/SchoolClass.js';
import { Teacher } from '../models/Teacher.js';
import { ApiError } from '../utils/ApiError.js';
import { assertClassOwnership } from './class.service.js';
import { recalculateStudentMetrics } from './metrics.service.js';
import { logAudit } from './audit.service.js';
import { notifyTeacher } from './notification.service.js';
import { pushAttendanceSummary } from './adminBridge.service.js';

/**
 * Marks (or corrects, via upsert on the unique student+class+date index)
 * attendance for a batch of students in one class/day, then recalculates
 * each affected student's cached attendance rate. Emits an attendance-alert
 * notification the moment a student crosses into a 3-consecutive-absence
 * streak, rather than on a schedule.
 */
export async function markAttendance(teacherId, { classId, date, records }, ip) {
  await assertClassOwnership(teacherId, classId);

  const studentIds = records.map((r) => r.studentId);
  const validStudents = await Student.find({ _id: { $in: studentIds }, teacher: teacherId, class: classId, linkedUserId: { $ne: null } }).select('_id name').lean();
  const validIds = new Set(validStudents.map((s) => String(s._id)));
  const nameById = new Map(validStudents.map((s) => [String(s._id), s.name]));

  const invalid = studentIds.filter((id) => !validIds.has(String(id)));
  if (invalid.length) {
    throw ApiError.badRequest('One or more students do not belong to this class.', 'STUDENT_NOT_IN_CLASS', { invalid });
  }

  const normalizedDate = Attendance.normalizeDate(date);

  const ops = records.map((r) => ({
    updateOne: {
      filter: { student: r.studentId, class: classId, date: normalizedDate },
      update: {
        $set: {
          status: r.status,
          remarks: r.remarks || null,
          markedBy: teacherId,
          teacher: teacherId,
        },
      },
      upsert: true,
    },
  }));
  await Attendance.bulkWrite(ops, { ordered: false });

  await logAudit({
    actorId: teacherId,
    action: 'attendance.marked',
    targetType: 'SchoolClass',
    targetId: classId,
    metadata: { date: normalizedDate, count: records.length },
    ip,
  });

  // Cross to the student service, which turns these into progression events and
  // scores them. Best-effort: the marks above are already saved, so a sleeping
  // peer delays a score rather than losing a register.
  const linkable = await Student.find({ _id: { $in: studentIds }, linkedUserId: { $ne: null } })
    .select('_id linkedUserId')
    .lean();
  const linkedUserByStudent = new Map(linkable.map((s) => [String(s._id), String(s.linkedUserId)]));

  await pushAttendanceToStudents(
    records
      .filter((r) => linkedUserByStudent.has(String(r.studentId)))
      .map((r) => ({
        userId: linkedUserByStudent.get(String(r.studentId)),
        classId: String(classId),
        date: normalizedDate,
        status: r.status,
        markedBy: String(teacherId),
      }))
  );

  for (const r of records) {
    await recalculateStudentMetrics(r.studentId);
    if (r.status === 'absent') {
      await checkConsecutiveAbsenceAlert(teacherId, r.studentId, classId, nameById.get(String(r.studentId)));
    }
  }

  await notifyAdminOfAttendance(teacherId, classId, normalizedDate);

  return getAttendanceForClassDate(teacherId, classId, normalizedDate);
}

/** Best-effort admin monitoring push — a daily per-class tally, not per-student detail. */
async function notifyAdminOfAttendance(teacherId, classId, normalizedDate) {
  const [tally, classDoc, teacher] = await Promise.all([
    Attendance.aggregate([
      { $match: { class: new mongoose.Types.ObjectId(classId), date: normalizedDate } },
      {
        $group: {
          _id: null,
          present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
    ]),
    SchoolClass.findById(classId).lean(),
    Teacher.findById(teacherId).populate('user', 'name').lean(),
  ]);
  const t = tally[0] || { present: 0, absent: 0, late: 0, total: 0 };
  await pushAttendanceSummary({
    classId: String(classId),
    date: normalizedDate.toISOString().slice(0, 10),
    className: classDoc?.name || '',
    teacherName: teacher?.user?.name || '',
    presentCount: t.present,
    absentCount: t.absent,
    lateCount: t.late,
    totalCount: t.total,
  });
}

async function checkConsecutiveAbsenceAlert(teacherId, studentId, classId, studentName) {
  const recent = await Attendance.find({ student: studentId, class: classId }).sort({ date: -1 }).limit(3).lean();
  if (recent.length === 3 && recent.every((r) => r.status === 'absent')) {
    await notifyTeacher(teacherId, {
      type: 'attendance',
      title: 'Attendance alert',
      message: `${studentName || 'A student'} has been absent for 3 consecutive sessions.`,
      relatedEntityType: 'Student',
      relatedEntityId: studentId,
    });
  }
}

export async function getAttendanceForClassDate(teacherId, classId, date) {
  await assertClassOwnership(teacherId, classId);
  const normalizedDate = Attendance.normalizeDate(date);
  const records = await Attendance.find({ teacher: teacherId, class: classId, date: normalizedDate })
    .populate('student', 'name email avatarUrl')
    .lean();

  return records.map((r) => ({
    id: r._id,
    studentId: r.student?._id,
    studentName: r.student?.name,
    status: r.status,
    remarks: r.remarks,
    date: r.date.toISOString().slice(0, 10),
  }));
}

export async function listAttendance(teacherId, { classId, studentId, date, page, limit } = {}) {
  const filter = { teacher: teacherId };
  if (classId) filter.class = classId;
  if (studentId) filter.student = studentId;
  if (date) filter.date = Attendance.normalizeDate(date);

  const rows = await Attendance.find(filter)
    .populate('student', 'name email')
    .populate('class', 'name')
    .sort({ date: -1 })
    .limit(limit || 200)
    .lean();

  return rows.map((r) => ({
    id: r._id,
    studentId: r.student?._id,
    studentName: r.student?.name,
    classId: r.class?._id,
    className: r.class?.name,
    status: r.status,
    date: r.date.toISOString().slice(0, 10),
    remarks: r.remarks,
  }));
}

/** Class-wide attendance analytics: rolling daily rate + present/absent/late breakdown over a window. */
export async function getAttendanceAnalytics(teacherId, classId, { days = 30 } = {}) {
  await assertClassOwnership(teacherId, classId);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await Attendance.aggregate([
    { $match: { teacher: new mongoose.Types.ObjectId(teacherId), class: new mongoose.Types.ObjectId(classId), date: { $gte: since } } },
    {
      $group: {
        _id: '$date',
        present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
        late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
        total: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return rows.map((r) => ({
    date: r._id.toISOString().slice(0, 10),
    present: r.present,
    absent: r.absent,
    late: r.late,
    total: r.total,
    attendanceRate: r.total ? Math.round(((r.present + r.late * 0.5) / r.total) * 100) : 0,
  }));
}

export default { markAttendance, getAttendanceForClassDate, listAttendance, getAttendanceAnalytics };
