import { sweepVideoStorage } from '../services/lessonVideo.service.js';
import { logger } from '../utils/logger.js';

const SWEEP_INTERVAL_MS = 10 * 60_000;
const FIRST_RUN_DELAY_MS = 2 * 60_000;

/**
 * Housekeeping for uploaded videos (lessonVideo.service.js#sweepVideoStorage):
 * abandons idle upload sessions, fails verifications that never finished,
 * and deletes replaced or removed files once no student can still be playing
 * them. Does nothing when video storage is not configured.
 */
export function startVideoStorageSweep() {
  let running = false;
  const run = () => {
    if (running) return;
    running = true;
    sweepVideoStorage()
      .then((outcome) => {
        const acted = Object.entries(outcome).some(([k, v]) => k !== 'skipped' && v);
        if (acted) logger.info('[jobs] Video storage sweep', outcome);
      })
      .catch((err) => logger.error('[jobs] Video storage sweep failed:', err.message))
      .finally(() => {
        running = false;
      });
  };
  const first = setTimeout(run, FIRST_RUN_DELAY_MS);
  first.unref?.();
  const timer = setInterval(run, SWEEP_INTERVAL_MS);
  timer.unref?.();
  return timer;
}

export default startVideoStorageSweep;
