/**
 * Small display helpers shared by the module-video editor and manager.
 * Copied byte for byte into the Admin portal (see LessonVideoEditor.jsx).
 */

export const VIDEO_SOURCES = {
  upload: { label: 'Uploaded file', short: 'Upload' },
  youtube: { label: 'YouTube', short: 'YouTube' },
  google_drive: { label: 'Google Drive', short: 'Drive' },
};

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
}

export function formatWhen(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export const isAbort = (err) => err?.name === 'AbortError' || err?.name === 'ApiAbortError' || err?.code === 'CANCELLED';

/** Error details from either portal's API client (teacher: details, admin: errors). */
export const detailsOf = (err) => err?.details ?? err?.errors ?? null;

/** Who last changed a video, for display. */
export function byline(video) {
  const who = video?.updatedBy?.name;
  if (!who) return '';
  return `${who}${video.updatedBy.portal ? ` (${video.updatedBy.portal})` : ''}`;
}
