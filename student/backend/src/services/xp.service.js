import { StudentProfile } from '../models/StudentProfile.js';
import { XPEvent } from '../models/XPEvent.js';
import { Notification } from '../models/Notification.js';

const XP_PER_LEVEL = 500;

export function levelForXp(xp) {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function daysBetween(a, b) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

/**
 * Updates the student's daily streak. Called once per "activity" (lesson
 * complete / task complete / quiz submit). Idempotent for repeat activity
 * within the same UTC day.
 */
function applyStreak(profile) {
  const today = todayKey();
  const last = profile.streak.lastActiveDate;

  if (last === today) {
    // Already counted today - no change.
    return profile;
  }

  if (!last) {
    profile.streak.current = 1;
  } else {
    const gap = daysBetween(last, today);
    if (gap === 1) {
      profile.streak.current += 1;
    } else if (gap > 1) {
      profile.streak.current = 1; // streak broken
    }
    // gap <= 0 shouldn't happen given the `last === today` check above.
  }

  profile.streak.lastActiveDate = today;
  profile.streak.longest = Math.max(profile.streak.longest, profile.streak.current);
  return profile;
}

/**
 * Server-authoritative XP award. This is the ONLY place XP/level/streak
 * are mutated - the frontend never gets to increment these directly
 * (master doc section 25: "Do not let the frontend simply increment XP").
 *
 * `courseId` is required whenever `amount > 0` - the leaderboard is
 * course-scoped, so every XP-earning event must record which course it
 * belongs to (see XPEvent.courseId / leaderboard.service.js).
 */
export async function awardXp(userId, { amount, source, refId, courseId, subjectCode = null, stageCode = null, eventKey = null }) {
  const profile = await StudentProfile.findOne({ userId });
  if (!profile) return null;

  if (amount > 0) {
    if (!courseId) throw new Error('awardXp: courseId is required when amount > 0 (leaderboard is course-scoped)');
    profile.xp += amount;
    profile.level = levelForXp(profile.xp);
    // subjectCode/stageCode/eventKey are carried through for the progression
    // engine, which needs XP broken down per subject and reconcilable against
    // its own event ledger. Null for awards made before that engine existed.
    await XPEvent.create({ userId, courseId, amount, source, refId, subjectCode, stageCode, eventKey });
  }

  applyStreak(profile);
  await profile.save();

  if (amount > 0) {
    const notification = await Notification.create({
      userId,
      title: `You earned +${amount} points`,
      description: describeSource(source),
      type: 'points',
      link: '/student/dashboard',
    });

    // Best-effort real-time push; sockets are optional infra and must never
    // break the XP award itself if unavailable.
    try {
      const { emitNotificationCreated, emitLeaderboardUpdated } = await import('../sockets/index.js');
      emitNotificationCreated(userId, notification);

      // Earning points can move this course's "This Week" leaderboard, so
      // push a fresh snapshot to every student enrolled in THIS course
      // (never a global broadcast - see leaderboard.service.js's
      // course-isolation rule) instead of relying on a manual refresh.
      const { getLeaderboard } = await import('./leaderboard.service.js');
      const { entries } = await getLeaderboard({ courseId, period: 'thisWeek', limit: 20 });
      emitLeaderboardUpdated(courseId, 'thisWeek', entries);
    } catch {
      // socket layer not initialized (e.g. in tests) - ignore
    }
  }

  return profile;
}

function describeSource(source) {
  switch (source) {
    case 'lesson':
      return 'Lesson completed';
    case 'task':
      return 'Task submitted';
    case 'quiz':
      return 'Quiz submitted';
    default:
      return 'Keep up the great work!';
  }
}

export async function recalculateAverages(profile, { quizScore, taskScore } = {}) {
  if (typeof quizScore === 'number') {
    const n = profile.stats.quizzesCompleted;
    profile.stats.averageQuizScore = n === 0
      ? quizScore
      : Math.round((profile.stats.averageQuizScore * n + quizScore) / (n + 1));
  }
  if (typeof taskScore === 'number') {
    const n = profile.stats.tasksCompleted;
    profile.stats.averageTaskScore = n === 0
      ? taskScore
      : Math.round((profile.stats.averageTaskScore * n + taskScore) / (n + 1));
  }
  return profile;
}
