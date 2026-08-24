import { runScheduledSweep } from '../services/announcement.service.js';

const SWEEP_INTERVAL_MS = 60_000;

/**
 * In-process scheduler that reliably publishes scheduled announcements and
 * expires published ones purely from timestamps stored in MongoDB — nothing
 * depends on a browser tab, a socket connection, or any client staying
 * open. This is intentionally NOT the same category of thing as "fake
 * real-time via setInterval": the interval here only decides how promptly a
 * server-side state transition (draft/scheduled -> published -> expired)
 * is noticed, not how a client learns about it — delivery to clients is
 * still push-based, over the `announcement:published` / `announcement:expired`
 * Socket.IO events emitted from within the sweep itself.
 *
 * Known limitation, worth stating plainly: this runs per-process. If this
 * API is ever horizontally scaled to multiple instances, each would run its
 * own sweep — harmless here (the sweep's queries are idempotent: an
 * already-published/expired document is never matched twice), but wasteful.
 * A single shared job runner (e.g. `agenda`/`bull` backed by the same
 * MongoDB) would be the natural next step at that point, not needed yet at
 * this project's scale.
 */
export function startAnnouncementScheduler() {
  const timer = setInterval(() => {
    runScheduledSweep().catch((err) => {
      console.error('[jobs] Announcement scheduler sweep failed:', err.message);
    });
  }, SWEEP_INTERVAL_MS);
  timer.unref?.(); // never keep the process alive on its own (matters for tests/smoke script)
  return timer;
}

export default startAnnouncementScheduler;
