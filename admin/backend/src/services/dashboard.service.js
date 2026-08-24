import { Student } from '../models/Student.js';
import { Teacher } from '../models/Teacher.js';
import { Course } from '../models/Course.js';
import { AuditLog } from '../models/AuditLog.js';
import { Settings } from '../models/Settings.js';
import { computeLeaderboard } from './leaderboard.service.js';
import { bucketByRange, timeAgo } from '../utils/time.js';
import { emitEvent } from '../sockets/index.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function trendFor(currentCount, newInWindow) {
  if (newInWindow === 0) return { trend: 'No change vs last month', isPositive: true };
  const priorCount = Math.max(currentCount - newInWindow, 0);
  const pct = priorCount === 0 ? 100 : Math.round((newInWindow / priorCount) * 1000) / 10;
  return { trend: `↑ ${newInWindow} new this month`, isPositive: true, pct };
}

async function computeKpi() {
  const now = new Date();
  const monthAgo = new Date(now.getTime() - THIRTY_DAYS_MS);

  const [
    totalStudents,
    activeLearners,
    newStudents,
    totalTeachers,
    newTeachers,
    totalCourses,
    newCourses,
  ] = await Promise.all([
    Student.countDocuments({ deletedAt: null }),
    Student.countDocuments({ deletedAt: null, status: 'ACTIVE' }),
    Student.countDocuments({ deletedAt: null, createdAt: { $gte: monthAgo } }),
    Teacher.countDocuments({ deletedAt: null }),
    Teacher.countDocuments({ deletedAt: null, createdAt: { $gte: monthAgo } }),
    Course.countDocuments({ deletedAt: null, status: 'APPROVED' }),
    Course.countDocuments({ deletedAt: null, status: 'APPROVED', createdAt: { $gte: monthAgo } }),
  ]);

  return {
    students: { value: totalStudents, ...trendFor(totalStudents, newStudents) },
    teachers: { value: totalTeachers, ...trendFor(totalTeachers, newTeachers) },
    courses: { value: totalCourses, ...trendFor(totalCourses, newCourses) },
    activeLearners: { value: activeLearners, ...trendFor(activeLearners, newStudents) },
  };
}

async function computeTeacherStatus() {
  const rows = await Teacher.aggregate([
    { $match: { deletedAt: null } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const map = Object.fromEntries(rows.map((r) => [r._id, r.count]));
  return {
    active: map.ACTIVE || 0,
    invited: map.INVITED || 0,
    suspended: map.SUSPENDED || 0,
    inactive: map.INACTIVE || 0,
  };
}

async function computeNeedsAttention() {
  const settings = await Settings.findById('platform_settings').lean();
  const threshold = settings?.academic?.attendanceThresholdPercent ?? 75;

  const [pendingCourses, suspendedTeachers, pendingInvites, lowAttendance] = await Promise.all([
    Course.countDocuments({ deletedAt: null, status: 'PENDING_REVIEW' }),
    Teacher.countDocuments({ deletedAt: null, status: 'SUSPENDED' }),
    Teacher.countDocuments({ deletedAt: null, status: 'INVITED' }),
    Student.countDocuments({ deletedAt: null, status: 'ACTIVE', attendancePercent: { $lt: threshold } }),
  ]);

  const items = [];
  if (pendingCourses > 0) {
    items.push({
      id: 'courses-pending', severity: 'attention', title: 'Courses Awaiting Review', count: pendingCourses,
      description: `${pendingCourses} course${pendingCourses === 1 ? '' : 's'} submitted and waiting for governance approval.`,
      actionText: 'Review Courses', linkTo: '/courses',
    });
  }
  if (suspendedTeachers > 0) {
    items.push({
      id: 'teachers-suspended', severity: 'blocked', title: 'Suspended Faculty Accounts', count: suspendedTeachers,
      description: `${suspendedTeachers} faculty account${suspendedTeachers === 1 ? '' : 's'} currently suspended.`,
      actionText: 'Review Faculty', linkTo: '/teachers',
    });
  }
  if (pendingInvites > 0) {
    items.push({
      id: 'teachers-invited', severity: 'attention', title: 'Pending Faculty Invitations', count: pendingInvites,
      description: `${pendingInvites} invitation${pendingInvites === 1 ? '' : 's'} not yet activated.`,
      actionText: 'View Invitations', linkTo: '/teachers',
    });
  }
  if (lowAttendance > 0) {
    items.push({
      id: 'students-attendance', severity: 'attention', title: 'Low Attendance Students', count: lowAttendance,
      description: `${lowAttendance} student${lowAttendance === 1 ? '' : 's'} below the ${threshold}% attendance threshold.`,
      actionText: 'Review Students', linkTo: '/students',
    });
  }
  return items;
}

async function computeLearningActivity() {
  // Real signal used as the activity proxy: this backend's own audit trail
  // (every admin write is recorded there). There is no separate student
  // session-tracking system owned by admin/backend to source "active
  // sessions" from — see implementation report for the cross-service gap.
  const since = new Date(Date.now() - 370 * 24 * 60 * 60 * 1000);
  const docs = await AuditLog.find({ createdAt: { $gte: since } }).select('createdAt entityType').lean();

  return {
    '7d': bucketByRange(docs, '7d'),
    '30d': bucketByRange(docs, '30d'),
    '3m': bucketByRange(docs, '3m'),
    '1y': bucketByRange(docs, '1y'),
  };
}

async function computeRecentActivity() {
  const logs = await AuditLog.find({}).sort({ createdAt: -1 }).limit(8).lean();
  return logs.map((log) => ({
    id: String(log._id),
    actor: log.actorName || 'System',
    action: humanizeAction(log.action),
    target: log.entityType,
    timestamp: timeAgo(log.createdAt),
    result: log.result,
  }));
}

function humanizeAction(action) {
  return action.replace(/\./g, ' ').replace(/_/g, ' ');
}

export async function getOverview() {
  const [kpi, teacherStatus, needsAttention, learningActivityData, recentActivity, leaderboard] = await Promise.all([
    computeKpi(),
    computeTeacherStatus(),
    computeNeedsAttention(),
    computeLearningActivity(),
    computeRecentActivity(),
    computeLeaderboard(),
  ]);

  const snapshot = { kpi, teacherStatus, needsAttention, learningActivityData, recentActivity, leaderboard };
  emitEvent.analyticsUpdated(snapshot);
  return snapshot;
}

export default { getOverview };
