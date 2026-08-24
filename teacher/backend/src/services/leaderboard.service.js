import { Student } from '../models/Student.js';
import { assertClassOwnership } from './class.service.js';
import { dicebearAvatar } from './student.service.js';

const SORT_FIELD_MAP = {
  score: 'metrics.currentScore',
  improvement: 'metrics.scoreChange',
  engagement: 'metrics.engagementScore',
  submissionRate: 'metrics.submissionRate',
  attendance: 'metrics.attendanceRate',
};

/**
 * Class-scoped leaderboard, sorted/filtered/searched on the server (never
 * ships the whole roster for the client to re-sort) and ranked live from
 * `Student.metrics`, which — per services/metrics.service.js — is
 * recalculated the moment grading or attendance changes anything.
 */
export async function getClassLeaderboard(teacherId, classId, { sortBy = 'score', sortOrder = 'desc', filterBy = 'all', search = '' } = {}) {
  await assertClassOwnership(teacherId, classId);

  const filter = { teacher: teacherId, class: classId, status: 'active', linkedUserId: { $ne: null } };
  if (filterBy === 'below_75') filter['metrics.currentScore'] = { $lt: 75 };
  else if (filterBy === 'low_attendance') filter['metrics.attendanceRate'] = { $lt: 75 };
  else if (filterBy === 'low_submission') filter['metrics.submissionRate'] = { $lt: 70 };
  else if (filterBy === 'declining') filter['metrics.scoreChange'] = { $lt: 0 };

  if (search && search.trim()) {
    const q = new RegExp(escapeRegex(search.trim()), 'i');
    filter.$or = [{ name: q }, { email: q }];
  }

  const sortField = SORT_FIELD_MAP[sortBy] || SORT_FIELD_MAP.score;
  const sort = { [sortField]: sortOrder === 'asc' ? 1 : -1 };

  const rows = await Student.find(filter).sort(sort).lean();

  return rows.map((s) => ({
    id: s._id,
    name: s.name,
    email: s.email,
    avatar: s.avatarUrl || dicebearAvatar(s.name),
    score: s.metrics?.currentScore ?? 0,
    scoreChange: s.metrics?.scoreChange ?? 0,
    engagementScore: s.metrics?.engagementScore ?? 0,
    attendanceRate: s.metrics?.attendanceRate ?? 0,
    submissionRate: s.metrics?.submissionRate ?? 0,
    riskLevel: s.metrics?.riskLevel ?? 'good',
  }));
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default { getClassLeaderboard };
