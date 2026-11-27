import mongoose from 'mongoose';
import { pushAttendanceToStudents } from './studentBridge.service.js';
import { Attendance } from '../models/Attendance.js';
import { Student } from '../models/Student.js';
import { SchoolClass } from '../models/SchoolClass.js';
import { Teacher } from '../models/Teacher.js';
import { ApiError } from '../utils/ApiError.js';
import { assertCourseAccessForClass, getAccessibleClassIds } from './courseAccess.service.js';
import { recalculateStudentMetrics } from './metrics.service.js';
import { logAudit } from './audit.service.js';
import { notifyTeacher } from './notification.service.js';
import { pushAttendanceSummary } from './adminBridge.service.js';
import { emitToCourse } from '../sockets/index.js';

/**
 * Marks (or corrects, via upsert on the unique student+class+date index)
 * attendance for a batch of students in one class/day, then recalculates
 * each affected student's cached attendance rate. Emits an attendance-alert
 * notification the moment a student crosses into a 3-consecutive-absence
 * streak, rather than on a schedule.
 *
 * Authorized by course-access now, not just batch ownership (see
 * courseAccess.service.js#assertCourseAccessForClass) - any teacher sharing
 * this class's course may mark attendance for it, not only the batch's own
 * teacher.
 */
export async function markAttendance(teacherId, { classId, date, records }, ip) {
  const classDoc = await assertCourseAccessForClass(teacherId, classId);

  const studentIds = records.map((r) => r.studentId);
  // Membership in THIS class, not ownership by THIS teacher - the access
  // check above already proved standing to act on the class; who the
  // roster rows themselves belong to doesn't matter any more.
  const validStudents = await Student.find({ _id: { $in: studentIds }, class: classId, linkedUserId: { $ne: null } }).select('_id name').lean();
  const validIds = new Set(validStudents.map((s) => String(s._id)));
  const nameById = new Map(validStudents.map((s) => [String(s._id), s.name]));

  const invalid = studentIds.filter((id) => !validIds.has(String(id)));
  if (invalid.length) {
    throw ApiError.badRequest('One or more students do not belong to this class.', 'STUDENT_NOT_IN_CLASS', { invalid });
  }

  const normalizedDate = Attendance.normalizeDate(date);

  // Optimistic-concurrency pre-check: a record that names expectedUpdatedAt
  // must still match the stored row, so two teachers correcting the same
  // day's attendance can never silently overwrite one another. Checked for
  // every such record BEFORE any write, so a conflict leaves nothing
  // half-applied - unlike a per-record upsert filter, which would try to
  // INSERT a second row on a mismatch and collide with the unique
  // (student, class, date) index instead of reporting a clean conflict.
  const withExpectation = records.filter((r) => r.expectedUpdatedAt !== undefined);
  if (withExpectation.length) {
    const existingRows = await Attendance.find({
      student: { $in: withExpectation.map((r) => r.studentId) },
      class: classId,
      date: normalizedDate,
    }).lean();
    const existingByStudent = new Map(existingRows.map((row) => [String(row.student), row]));
    const conflicts = [];
    for (const r of withExpectation) {
      const existingRow = existingByStudent.get(String(r.studentId));
      const existingStamp = existingRow ? existingRow.updatedAt.getTime() : null;
      const expectedStamp = r.expectedUpdatedAt === null ? null : new Date(r.expectedUpdatedAt).getTime();
      if (existingStamp !== expectedStamp) {
        conflicts.push({
          studentId: r.studentId,
          current: existingRow
            ? { status: existingRow.status, remarks: existingRow.remarks, updatedAt: existingRow.updatedAt, markedBy: existingRow.markedBy }
            : null,
        });
      }
    }
    if (conflicts.length) {
      throw ApiError.conflict(
        'Attendance for one or more students here was just changed by someone else. Review the latest version before saving again.',
        'ATTENDANCE_CHANGED',
        { conflicts }
      );
    }
  }

  const ops = records.map((r) => ({
    updateOne: {
      filter: { student: r.studentId, class: classId, date: normalizedDate },
      update: {
        $set: {
          status: r.status,
          remarks: r.remarks || null,
          markedBy: teacherId,
        },
        // Set once, at creation, from the batch's own owning teacher - never
        // overwritten on a correction. Before this fix it was set to
        // whichever teacher happened to call this, on every single upsert
        // (insert or update alike); that was harmless while only the owning
        // teacher could ever call it, but once a second, course-access
        // teacher can legitimately touch the same class's attendance,
        // Attendance.teacher would otherwise silently become "whoever
        // touched it last" - which would then make every `{teacher:
        // teacherId}` read elsewhere lie about whose data it's showing.
        $setOnInsert: { teacher: classDoc.teacher },
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

  if (classDoc.studentCourseSlug) {
    emitToCourse(classDoc.studentCourseSlug, 'attendance.marked', { classId: String(classId), date: normalizedDate.toISOString().slice(0, 10) });
  }

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
      // Always the batch's own home teacher, never the acting teacher - so a
      // visiting course-access teacher marking attendance doesn't start
      // paging themselves for every alert on a class they don't actually run.
      await checkConsecutiveAbsenceAlert(classDoc.teacher, r.studentId, classId, nameById.get(String(r.studentId)));
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
  await assertCourseAccessForClass(teacherId, classId);
  const normalizedDate = Attendance.normalizeDate(date);
  // Scoped by class, not by `teacher` any more - the access check above
  // already decided whether this teacher may see this class's attendance at
  // all, and a second teacher's marks for the same class/day must show up
  // here too, not just the ones this caller happened to write themselves.
  const records = await Attendance.find({ class: classId, date: normalizedDate })
    .populate('student', 'name email avatarUrl')
    .lean();

  return records.map((r) => ({
    id: r._id,
    studentId: r.student?._id,
    studentName: r.student?.name,
    status: r.status,
    remarks: r.remarks,
    date: r.date.toISOString().slice(0, 10),
    // The optimistic-concurrency baseline a later correction's
    // expectedUpdatedAt is checked against (see markAttendance).
    updatedAt: r.updatedAt,
  }));
}

export async function listAttendance(teacherId, { classId, studentId, date, page, limit } = {}) {
  let filter;
  if (classId) {
    await assertCourseAccessForClass(teacherId, classId);
    filter = { class: classId };
  } else {
    // No specific class named - every class this teacher may act on, not
    // just the ones they own, so "my attendance records" reads as the same
    // shared, course-wide view as the rest of this feature.
    filter = { class: { $in: await getAccessibleClassIds(teacherId) } };
  }
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
    // Same concurrency baseline as getAttendanceForClassDate - this is the
    // shape AttendancePage actually reads attendance through (GET /attendance).
    updatedAt: r.updatedAt,
  }));
}

/** Class-wide attendance analytics: rolling daily rate + present/absent/late breakdown over a window. */
export async function getAttendanceAnalytics(teacherId, classId, { days = 30 } = {}) {
  await assertCourseAccessForClass(teacherId, classId);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await Attendance.aggregate([
    { $match: { class: new mongoose.Types.ObjectId(classId), date: { $gte: since } } },
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
