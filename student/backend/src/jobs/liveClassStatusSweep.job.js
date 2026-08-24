import { LiveClass } from '../models/LiveClass.js';
import { logger } from '../utils/logger.js';

const SWEEP_INTERVAL_MS = 60_000;

/**
 * Server-authoritative live-lecture status, computed from server time
 * against `scheduledAt`/`durationMinutes` — never trusts the student's
 * device clock (master doc: "the backend should determine status using
 * server time"). Purely time-driven from MongoDB state, mirrors
 * teacher/backend's announcementScheduler.job.js pattern. Pushes
 * `course:lecture_live` the moment a session's status actually flips, so
 * connected students see it without a manual refresh.
 */
export function startLiveClassStatusSweep() {
  const timer = setInterval(() => {
    sweepLiveClassStatuses().catch((err) => {
      logger.error('[jobs] Live class status sweep failed:', err.message);
    });
  }, SWEEP_INTERVAL_MS);
  timer.unref?.();
  return timer;
}

export async function sweepLiveClassStatuses() {
  const now = new Date();
  let wentLive = 0;
  let completed = 0;

  const candidates = await LiveClass.find({ status: { $in: ['upcoming', 'live'] } });
  const { emitToCourse } = await import('../sockets/index.js').catch(() => ({ emitToCourse: null }));

  for (const session of candidates) {
    const start = new Date(session.scheduledAt).getTime();
    const end = start + session.durationMinutes * 60000;
    const nowMs = now.getTime();

    if (session.status === 'upcoming' && nowMs >= start && nowMs < end) {
      session.status = 'live';
      await session.save();
      wentLive += 1;
      if (session.courseId) {
        emitToCourse?.(session.courseId, 'course:lecture_live', { id: session._id, title: session.title, courseId: String(session.courseId) });
      }
    } else if (nowMs >= end) {
      session.status = 'completed';
      await session.save();
      completed += 1;
    }
  }

  return { wentLive, completed };
}

export default startLiveClassStatusSweep;
