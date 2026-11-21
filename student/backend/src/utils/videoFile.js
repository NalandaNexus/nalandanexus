import path from 'node:path';

/**
 * What an uploaded video file is allowed to be, judged by its name, the type
 * the browser declared and - after upload - its actual first bytes.
 *
 * The extension and declared type only decide whether an upload may start.
 * Whether the stored object is really a video is decided by
 * detectVideoContainer() on bytes read back from storage, so a renamed PDF,
 * image or audio file is refused however it was labelled.
 */

export const VIDEO_FORMATS = {
  '.mp4': { family: 'mp4', mimeType: 'video/mp4', accepts: ['video/mp4', 'application/mp4', 'video/x-m4v'] },
  '.mov': { family: 'mp4', mimeType: 'video/quicktime', accepts: ['video/quicktime', 'video/mov', 'video/mp4'] },
  '.webm': { family: 'webm', mimeType: 'video/webm', accepts: ['video/webm'] },
  '.mkv': { family: 'matroska', mimeType: 'video/x-matroska', accepts: ['video/x-matroska', 'video/matroska', 'video/mkv', 'video/webm'] },
};

const GENERIC_TYPES = new Set(['', 'application/octet-stream', 'binary/octet-stream']);

/**
 * Normalizes an upload request's file facts, or returns { ok:false, code }.
 * The stored MIME type comes from the extension, not the browser, so a
 * student's player always receives a type that matches the container.
 */
export function classifyVideoFile({ fileName, mimeType }) {
  const base = typeof fileName === 'string' ? path.basename(fileName.replace(/\\/g, '/')) : '';
  // Control characters and path separators never belong in a display name.
  const clean = base.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 255);
  const extension = path.extname(clean).toLowerCase();
  const format = VIDEO_FORMATS[extension];
  if (!clean || !format) return { ok: false, code: 'UNSUPPORTED_VIDEO_TYPE' };
  const declared = typeof mimeType === 'string' ? mimeType.toLowerCase().split(';')[0].trim() : '';
  if (!GENERIC_TYPES.has(declared) && !format.accepts.includes(declared)) return { ok: false, code: 'VIDEO_TYPE_MISMATCH' };
  return { ok: true, fileName: clean, extension, family: format.family, mimeType: format.mimeType };
}

// ISO-BMFF brands that are not video: still images and audio-only files.
const NON_VIDEO_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1', 'avif', 'avis', 'crx ', 'M4A ', 'M4B ', 'M4P ', 'F4A ', 'F4B ']);
// Atoms an older QuickTime file may open with instead of `ftyp`.
const QUICKTIME_LEADING_ATOMS = new Set(['moov', 'mdat', 'wide', 'free', 'skip', 'pnot']);

function ebmlDocType(bytes) {
  // EBML header element (1A 45 DF A3), then the DocType element (42 82).
  const limit = Math.min(bytes.length - 3, 64);
  for (let i = 4; i < limit; i += 1) {
    if (bytes[i] === 0x42 && bytes[i + 1] === 0x82) {
      const sizeByte = bytes[i + 2];
      if (!(sizeByte & 0x80)) return null; // only the 1-byte size form is used for a doctype
      const size = sizeByte & 0x7f;
      return bytes.subarray(i + 3, i + 3 + size).toString('ascii');
    }
  }
  return null;
}

/** 'mp4' | 'webm' | 'matroska' | null, from a file's first bytes. */
export function detectVideoContainer(bytes) {
  if (!bytes || bytes.length < 12) return null;
  const atom = bytes.subarray(4, 8).toString('latin1');
  if (atom === 'ftyp') {
    const brand = bytes.subarray(8, 12).toString('latin1');
    return NON_VIDEO_BRANDS.has(brand) ? null : 'mp4';
  }
  if (QUICKTIME_LEADING_ATOMS.has(atom)) return 'mp4';
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    const docType = ebmlDocType(bytes);
    if (docType === 'webm') return 'webm';
    if (docType === 'matroska') return 'matroska';
  }
  return null;
}

/** Whether the detected container is acceptable for the file's extension family. */
export function containerMatches(family, detected) {
  if (!detected) return false;
  if (family === 'mp4') return detected === 'mp4';
  if (family === 'webm') return detected === 'webm';
  if (family === 'matroska') return detected === 'matroska' || detected === 'webm';
  return false;
}
