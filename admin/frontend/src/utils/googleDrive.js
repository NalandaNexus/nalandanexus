/**
 * Google Drive link parsing for module and lesson videos.
 *
 * THIS FILE IS SHARED. The same module is copied, byte for byte, into
 *   student/frontend/src/utils/googleDrive.js
 *   admin/frontend/src/utils/googleDrive.js
 *   teacher/frontend/src/utils/googleDrive.js
 * so the preview an editor sees comes from exactly the rule the student
 * service enforces on save. It has no imports and touches no Node or browser
 * API. tests/googleDrive.util.test.js fails if a copy drifts.
 *
 * Only a Drive *file* id (and, for files shared before Google's 2021 link
 * update, its resource key) is ever stored. Nothing is framed except
 * googleDriveEmbedUrl(<an id that passed isValidGoogleDriveFileId>), rebuilt
 * from that id - never a pasted URL.
 *
 * A valid link is not a promise that students can watch it: the file must be
 * shared with them, normally "Anyone with the link". The student service
 * checks what it can (see lessonVideo.service.js#checkGoogleDriveAvailability)
 * and the editors explain the rest.
 */

const FILE_ID = /^[A-Za-z0-9_-]{20,200}$/;
const RESOURCE_KEY = /^[A-Za-z0-9_-]{1,120}$/;
const HOSTS = new Set(['drive.google.com', 'docs.google.com']);

export const GOOGLE_DRIVE_URL_MAX_LENGTH = 2048;
export const GOOGLE_DRIVE_EMBED_ORIGIN = 'https://drive.google.com';

export function isValidGoogleDriveFileId(id) {
  return typeof id === 'string' && FILE_ID.test(id);
}

function keyQuery(resourceKey) {
  return resourceKey && RESOURCE_KEY.test(resourceKey) ? `?resourcekey=${resourceKey}` : '';
}

export function googleDriveEmbedUrl(fileId, resourceKey) {
  if (!isValidGoogleDriveFileId(fileId)) throw new Error('Invalid Google Drive file id');
  return `https://drive.google.com/file/d/${fileId}/preview${keyQuery(resourceKey)}`;
}

export function googleDriveViewUrl(fileId, resourceKey) {
  if (!isValidGoogleDriveFileId(fileId)) throw new Error('Invalid Google Drive file id');
  return `https://drive.google.com/file/d/${fileId}/view${keyQuery(resourceKey)}`;
}

function fail(code, message) {
  return { ok: false, code, message };
}

/**
 * Accepts Drive's file links: /file/d/<id>/view|preview|edit (with or without
 * a /u/<n>/ account segment), /open?id=<id> and /uc?id=<id>. Folders, Docs,
 * Sheets and Slides are refused with a reason, as is anything not on Google's
 * own Drive hosts.
 */
export function parseGoogleDriveUrl(input) {
  if (typeof input !== 'string' || !input.trim()) return fail('EMPTY_URL', 'Paste a Google Drive video link.');
  let raw = input.trim();
  if (raw.length > GOOGLE_DRIVE_URL_MAX_LENGTH) return fail('URL_TOO_LONG', 'That link is too long.');
  if (/^(drive|docs)\.google\.com\//i.test(raw)) raw = `https://${raw}`;

  let url;
  try {
    url = new URL(raw);
  } catch {
    return fail('INVALID_URL', 'Paste the full Google Drive link, starting with https://drive.google.com/.');
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!/^https?:$/.test(url.protocol) || !HOSTS.has(host) || url.username || url.password || url.port) {
    return fail('UNSUPPORTED_PROVIDER', 'Only Google Drive links (drive.google.com) can be used here.');
  }

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.includes('folders')) {
    return fail('DRIVE_FOLDER', 'That is a Drive folder. Open the video file itself and copy its share link.');
  }
  if (host === 'docs.google.com' && segments[0] !== 'file') {
    return fail('NOT_A_DRIVE_FILE', 'That is a Google Docs, Sheets or Slides link, not a video file.');
  }

  let fileId = null;
  const fileAt = segments.indexOf('file');
  if (fileAt >= 0) {
    const dAt = segments.indexOf('d', fileAt + 1);
    if (dAt >= 0) fileId = segments[dAt + 1] || null;
  } else if (['open', 'uc'].includes(segments[segments.length - 1])) {
    fileId = url.searchParams.get('id');
  }
  if (!isValidGoogleDriveFileId(fileId)) {
    return fail('INVALID_DRIVE_FILE_ID', 'That Google Drive link does not point to a file. Use the link from Share → Copy link.');
  }

  const key = url.searchParams.get('resourcekey');
  const resourceKey = key && RESOURCE_KEY.test(key) ? key : null;
  return {
    ok: true,
    fileId,
    resourceKey,
    canonicalUrl: googleDriveViewUrl(fileId, resourceKey),
    embedUrl: googleDriveEmbedUrl(fileId, resourceKey),
  };
}
