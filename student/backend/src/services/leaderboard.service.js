import mongoose from 'mongoose';
import { StudentProfile } from '../models/StudentProfile.js';
import { XPEvent } from '../models/XPEvent.js';
import { User } from '../models/User.js';

const PERIODS = ['thisWeek', 'thisMonth', 'allTime'];

function periodStartDate(period) {
  const now = new Date();
  if (period === 'thisWeek') {
    const start = new Date(now);
    const day = start.getUTCDay(); // 0 = Sunday
    const diffToMonday = (day + 6) % 7;
    start.setUTCDate(start.getUTCDate() - diffToMonday);
    start.setUTCHours(0, 0, 0, 0);
    return start;
  }
  if (period === 'thisMonth') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  return null; // allTime
}

/**
 * Returns the top N leaderboard entries for a single course + period, plus
 * the requesting student's own rank even if outside the top N.
 *
 * CRITICAL: leaderboards on this platform are course-specific, never
 * global — two students only ever appear together here if they're both
 * enrolled in `courseId`. This is enforced by scoping every query to
 * `courseId` (never trusting a global XP total), and by the caller gating
 * this behind `requireEnrollment` so a student can't view a course's
 * leaderboard they aren't enrolled in.
 *
 * Ranking is computed from a fully deterministic sort (points desc, then
 * userId asc as a stable tie-break) so rank never shifts based on incidental
 * document retrieval order — the same rule is applied consistently whether
 * this ties or not.
 */
export async function getLeaderboard({ courseId, period = 'thisWeek', limit = 20, requestingUserId } = {}) {
  if (!PERIODS.includes(period)) period = 'thisWeek';
  if (!courseId) return { period, courseId: null, entries: [], currentUserEntry: null };

  const start = periodStartDate(period);
  const match = { courseId: new mongoose.Types.ObjectId(courseId) };
  if (start) match.createdAt = { $gte: start };

  const sums = await XPEvent.aggregate([
    { $match: match },
    { $group: { _id: '$userId', points: { $sum: '$amount' } } },
    { $sort: { points: -1, _id: 1 } },
    { $limit: 500 },
  ]);

  const userIds = sums.map((s) => s._id);
  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select('name avatar').lean(),
    StudentProfile.find({ userId: { $in: userIds } }).select('userId streak').lean(),
  ]);
  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const streakMap = new Map(profiles.map((p) => [String(p.userId), p.streak?.current || 0]));

  const ranked = sums.map((s) => ({
    userId: String(s._id),
    name: userMap.get(String(s._id))?.name || 'Student',
    avatar: userMap.get(String(s._id))?.avatar || null,
    points: s.points,
    streak: streakMap.get(String(s._id)) || 0,
  }));

  const withRank = ranked.map((entry, index) => ({ rank: index + 1, ...entry }));
  const top = withRank.slice(0, limit).map((entry) => ({
    ...entry,
    isCurrentUser: requestingUserId ? entry.userId === String(requestingUserId) : false,
  }));

  let currentUserEntry = null;
  if (requestingUserId) {
    currentUserEntry = withRank.find((e) => e.userId === String(requestingUserId)) || null;
  }

  return { period, courseId: String(courseId), entries: top, currentUserEntry };
}
