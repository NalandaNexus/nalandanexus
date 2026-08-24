import { Teacher } from '../models/Teacher.js';
import { Course } from '../models/Course.js';
import { emitEvent } from '../sockets/index.js';

/**
 * Every score below is a deterministic formula over real, currently-stored
 * fields — there is no separate "XP"/gamification ledger owned by admin, so
 * this composes the closest real signals available (ratings, cached
 * counters, attendance/GPA, course completion) rather than inventing one.
 */
export async function computeLeaderboard() {
  const [teachers, courses] = await Promise.all([computeTeacherBoard(), computeCourseBoard()]);
  const leaderboard = { teachers, courses };
  emitEvent.leaderboardUpdated(leaderboard);
  return leaderboard;
}

async function computeTeacherBoard() {
  const teachers = await Teacher.find({ deletedAt: null, status: 'ACTIVE' })
    .select('name department rating coursesCount studentsCount')
    .lean();

  const scored = teachers.map((t) => ({
    name: t.name,
    department: t.department || 'General',
    score: Math.round(((t.rating || 0) / 5) * 50 + Math.min(t.coursesCount || 0, 10) * 3 + Math.min(t.studentsCount || 0, 100) * 0.2),
    metric: `${t.coursesCount || 0} course${t.coursesCount === 1 ? '' : 's'} · ${t.studentsCount || 0} students`,
  }));

  return rank(scored).slice(0, 5);
}

async function computeCourseBoard() {
  const courses = await Course.find({ deletedAt: null, status: 'APPROVED' })
    .select('title code completionRate rating')
    .populate('instructor', 'name')
    .lean();

  const scored = courses.map((c) => ({
    name: c.title,
    code: c.code,
    score: Math.round((c.completionRate || 0) * 0.7 + ((c.rating || 0) / 5) * 100 * 0.3),
    metric: `${Math.round(c.completionRate || 0)}% completed`,
  }));

  return rank(scored).slice(0, 5);
}

function rank(items) {
  return items
    .sort((a, b) => b.score - a.score)
    .map((item, idx) => ({ rank: idx + 1, ...item }));
}

export default { computeLeaderboard };
