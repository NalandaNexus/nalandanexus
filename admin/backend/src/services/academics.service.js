import { Student } from '../models/Student.js';
import { Course } from '../models/Course.js';
import { AssignmentActivity } from '../models/AssignmentActivity.js';
import { QuizActivity } from '../models/QuizActivity.js';
import { AttendanceSummary } from '../models/AttendanceSummary.js';
import { emitEvent } from '../sockets/index.js';

/**
 * Assignments/exams/attendance-detail are genuinely owned by
 * teacher/backend (a separate service/database) — this never queries that
 * database directly. Instead, teacher/backend pushes live activity here
 * via /api/internal/academics/* (see routes/internal.routes.js), and this
 * reads back the resulting read-model collections. Nothing here is
 * fabricated: an institution that has bridged no activity yet correctly
 * sees an empty list, not a placeholder claiming the data doesn't exist.
 */
export async function getAttendanceOverview() {
  const rows = await Student.aggregate([
    { $match: { deletedAt: null, status: 'ACTIVE' } },
    { $group: { _id: '$department', avgAttendance: { $avg: '$attendancePercent' }, count: { $sum: 1 } } },
    { $sort: { avgAttendance: -1 } },
  ]);

  const overall = rows.length
    ? rows.reduce((sum, r) => sum + r.avgAttendance * r.count, 0) / rows.reduce((sum, r) => sum + r.count, 0)
    : 0;

  return {
    overallPercent: Math.round(overall * 10) / 10,
    byDepartment: rows.map((r) => ({ department: r._id || 'Unassigned', avgAttendance: Math.round(r.avgAttendance * 10) / 10, studentCount: r.count })),
  };
}

export async function getContentRepositoryStats() {
  const rows = await Course.aggregate([
    { $match: { deletedAt: null, status: 'APPROVED' } },
    { $group: { _id: null, totalModules: { $sum: '$modulesCount' }, courseCount: { $sum: 1 } } },
  ]);
  const { totalModules = 0, courseCount = 0 } = rows[0] || {};
  return { totalModules, courseCount };
}

export async function listAssignmentActivity() {
  return AssignmentActivity.find({}).sort({ dueDate: -1 }).limit(200).lean();
}

export async function listQuizActivity() {
  return QuizActivity.find({}).sort({ scheduledAt: -1 }).limit(200).lean();
}

export async function listAttendanceSummaries() {
  return AttendanceSummary.find({}).sort({ date: -1 }).limit(200).lean();
}

export async function ingestAssignmentActivity(data) {
  const row = await AssignmentActivity.findOneAndUpdate(
    { sourceId: data.sourceId },
    { $set: data },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  emitEvent.assignmentActivityUpdated(row);
  return row;
}

export async function ingestQuizActivity(data) {
  const row = await QuizActivity.findOneAndUpdate(
    { sourceId: data.sourceId },
    { $set: data },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  emitEvent.quizActivityUpdated(row);
  return row;
}

export async function ingestAttendanceSummary(data) {
  const row = await AttendanceSummary.findOneAndUpdate(
    { sourceId: data.sourceId },
    { $set: data },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  emitEvent.attendanceSummaryUpdated(row);
  return row;
}

export default {
  getAttendanceOverview,
  getContentRepositoryStats,
  listAssignmentActivity,
  listQuizActivity,
  listAttendanceSummaries,
  ingestAssignmentActivity,
  ingestQuizActivity,
  ingestAttendanceSummary,
};
