import { QuizAttempt } from '../models/QuizAttempt.js';
import { finalizeExpiredAttempt } from '../controllers/quiz.controller.js';
import { logger } from '../utils/logger.js';

const SWEEP_INTERVAL_MS = 60_000;

/**
 * In-process sweep that enforces the quiz deadline even if the student never
 * comes back to submit (master doc section 10: "do not require the student
 * to keep the browser tab open"). Purely time-driven from `expiresAt` stored
 * in MongoDB - nothing here depends on a client connection. Mirrors
 * teacher/backend's announcementScheduler.job.js pattern.
 */
export function startQuizExpirySweep() {
  const timer = setInterval(() => {
    sweepExpiredAttempts().catch((err) => {
      logger.error('[jobs] Quiz expiry sweep failed:', err.message);
    });
  }, SWEEP_INTERVAL_MS);
  timer.unref?.();
  return timer;
}

export async function sweepExpiredAttempts() {
  const expired = await QuizAttempt.find({ status: 'in_progress', expiresAt: { $lte: new Date() } });
  for (const attempt of expired) {
    await finalizeExpiredAttempt(attempt);
  }
  return { expired: expired.length };
}

export default startQuizExpirySweep;
