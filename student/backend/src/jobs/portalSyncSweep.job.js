import { retryPendingPortalSyncs } from '../services/portalSync.service.js';
import { logger } from '../utils/logger.js';

const SWEEP_INTERVAL_MS = 2 * 60_000;

/**
 * Retries student records that did not reach the admin or teacher portal.
 *
 * A sync fails when one of those services is asleep or restarting. The student
 * keeps their course regardless; the profile is marked pending, and this picks
 * it up on the next pass, backing off per student (services/portalSync.service.js
 * #retryDelayMs) so a portal that stays down is not hammered. Only students this
 * code marked pending are considered, so a deploy alone sends nothing.
 */
export function startPortalSyncSweep() {
  let running = false;
  const timer = setInterval(() => {
    if (running) return; // a slow pass is never overlapped by the next one
    running = true;
    retryPendingPortalSyncs()
      .then((outcome) => {
        if (outcome.considered) logger.info('[jobs] Portal sync retry pass', outcome);
      })
      .catch((err) => logger.error('[jobs] Portal sync retry pass failed:', err.message))
      .finally(() => {
        running = false;
      });
  }, SWEEP_INTERVAL_MS);
  timer.unref?.();
  return timer;
}

export default startPortalSyncSweep;
