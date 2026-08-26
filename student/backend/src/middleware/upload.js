import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isCloudinaryConfigured } from './cloudinaryStorage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');

const ALLOWED_AVATAR_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_AVATAR_MB = 2;

fs.mkdirSync(path.join(UPLOADS_ROOT, 'avatars'), { recursive: true });

// Extension is derived from this table (keyed by the VALIDATED mimetype),
// never from the client-supplied originalname - originalname is just as
// attacker-controlled as the Content-Type header itself. Confirmed live via
// a QA pass: uploading a real .html file with a spoofed "image/png"
// Content-Type passed the filter below and was stored with a .html
// extension, which express.static then served back as genuine
// Content-Type: text/html (only this app's own CSP, as a second,
// independent layer, stopped the resulting inline <script> from executing -
// the upload itself should never have allowed arbitrary content through).
const EXT_BY_MIME = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

// Local disk is only a development fallback. In production the filesystem
// is ephemeral (see cloudinaryStorage.js), so the file is held in memory
// just long enough to verify its magic bytes and hand it to Cloudinary.
const avatarStorage = isCloudinaryConfigured
  ? multer.memoryStorage()
  : multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(UPLOADS_ROOT, 'avatars')),
    filename: (req, file, cb) => {
      const ext = EXT_BY_MIME[file.mimetype] || '.bin';
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
    },
  });

function avatarFileFilter(req, file, cb) {
  if (!ALLOWED_AVATAR_MIME.includes(file.mimetype)) {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', `Unsupported file type: ${file.mimetype}`));
    return;
  }
  cb(null, true);
}

export const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter: avatarFileFilter,
  limits: { fileSize: MAX_AVATAR_MB * 1024 * 1024, files: 1 },
});

/**
 * Leading bytes every real file of a given type must start with. Checked
 * against the bytes actually written to disk, because `file.mimetype` above
 * is nothing more than the Content-Type the client typed into the request -
 * as attacker-controlled as the filename. Confirmed live: an HTML file sent
 * as "image/png" passed the MIME filter and was stored with a .png
 * extension. Serving it back as image/png with nosniff stopped it doing any
 * harm, but the content should never have been accepted in the first place.
 *
 * WebP is RIFF-container: "RIFF" at 0, "WEBP" at 8.
 */
const MAGIC_BYTES = {
  'image/png': [[0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]]],
  'image/jpeg': [[0, [0xff, 0xd8, 0xff]]],
  'image/gif': [[0, [0x47, 0x49, 0x46, 0x38]]],
  'image/webp': [
    [0, [0x52, 0x49, 0x46, 0x46]],
    [8, [0x57, 0x45, 0x42, 0x50]],
  ],
};

function matchesSignature(buffer, mimetype) {
  const signatures = MAGIC_BYTES[mimetype];
  if (!signatures) return false;
  return signatures.every(([offset, bytes]) =>
    bytes.every((byte, i) => buffer[offset + i] === byte)
  );
}

/**
 * Post-multer guard: the file is already on disk by the time multer's
 * fileFilter has run (it only ever sees headers), so verify the real
 * content here and delete anything that lied about what it was.
 */
export function verifyImageSignature(req, res, next) {
  if (!req.file) return next();
  // Only types we have a signature for can be verified. Anything else was
  // already gated by the MIME allowlist and passes through unchanged -
  // failing closed here would reject perfectly valid uploads of formats
  // this table simply doesn't model.
  if (!MAGIC_BYTES[req.file.mimetype]) return next();

  let handle;
  try {
    // Memory storage (the Cloudinary path) gives us the bytes directly;
    // disk storage means reading the header back off the file just written.
    let header;
    if (req.file.buffer) {
      header = req.file.buffer.subarray(0, 12);
    } else {
      header = Buffer.alloc(12);
      handle = fs.openSync(req.file.path, 'r');
      fs.readSync(handle, header, 0, 12, 0);
      fs.closeSync(handle);
      handle = null;
    }

    if (matchesSignature(header, req.file.mimetype)) return next();
  } catch (err) {
    if (handle !== null && handle !== undefined) {
      try { fs.closeSync(handle); } catch { /* already closed */ }
    }
    if (req.file.path) {
      try { fs.unlinkSync(req.file.path); } catch { /* nothing written */ }
    }
    return next(err);
  }

  // Content didn't match the declared type - don't keep the file around.
  // Nothing has been sent to Cloudinary yet, so on that path there is
  // nothing to undo; only a disk write needs cleaning up.
  if (req.file.path) {
    try { fs.unlinkSync(req.file.path); } catch { /* already gone */ }
  }
  const error = new multer.MulterError(
    'LIMIT_UNEXPECTED_FILE',
    'That file is not a valid image. Please upload a PNG, JPEG, WebP, or GIF.'
  );
  return next(error);
}

/**
 * Public URL for a stored avatar. A Cloudinary upload already carries an
 * absolute delivery URL, so it passes straight through; a local disk upload
 * gets the /uploads path app.js serves statically.
 */
export function avatarPublicUrl(filenameOrUrl) {
  if (/^https?:\/\//i.test(filenameOrUrl)) return filenameOrUrl;
  return `/uploads/avatars/${filenameOrUrl}`;
}

export default avatarUpload;
