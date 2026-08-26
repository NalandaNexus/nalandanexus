import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isCloudinaryConfigured } from './cloudinaryStorage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');

const SUBDIRS = ['courses', 'resources'];
for (const dir of SUBDIRS) {
  fs.mkdirSync(path.join(UPLOADS_ROOT, dir), { recursive: true });
}

const ALLOWED_MIME_BY_KIND = {
  courses: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  // Magazines (PDF), event photos (images), program resources (PDF/docs).
  resources: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'],
};

const MAX_FILE_SIZE_BY_KIND = {
  courses: 5 * 1024 * 1024, // 5MB — a course cover image
  resources: 20 * 1024 * 1024, // 20MB — a magazine PDF is larger than a cover image
};

// The stored file's extension is derived from this table (keyed by the
// VALIDATED mimetype), never from the client-supplied filename - a client
// can freely lie about Content-Type in a multipart request (fileFilter
// below only checks this same client-declared value), and originalname is
// just as untrusted. Trusting either for the on-disk extension lets an
// attacker upload e.g. a real .html file with a spoofed "image/png"
// Content-Type, which express.static then serves back as real text/html
// (confirmed live via a QA pass on the sibling student/backend upload
// middleware, same pattern - the bug applies here identically).
const EXT_BY_MIME = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
};

function storageFor(kind) {
  // Local disk is only a development fallback. In production the filesystem
  // is ephemeral (see cloudinaryStorage.js), so the file is held in memory
  // just long enough to verify its magic bytes and hand it to Cloudinary.
  if (isCloudinaryConfigured) return multer.memoryStorage();

  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(UPLOADS_ROOT, kind)),
    filename: (req, file, cb) => {
      const ext = EXT_BY_MIME[file.mimetype] || '.bin';
      const safeName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
      cb(null, safeName);
    },
  });
}

function fileFilterFor(kind) {
  const allowed = ALLOWED_MIME_BY_KIND[kind] || [];
  return (req, file, cb) => {
    if (!allowed.includes(file.mimetype)) {
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', `Unsupported file type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  };
}

/** Builds a configured multer instance scoped to a single upload "kind" — mirrors teacher/backend's identical middleware. */
export function uploaderFor(kind) {
  if (!SUBDIRS.includes(kind)) throw new Error(`Unknown upload kind: ${kind}`);
  return multer({
    storage: storageFor(kind),
    fileFilter: fileFilterFor(kind),
    limits: { fileSize: MAX_FILE_SIZE_BY_KIND[kind] || 5 * 1024 * 1024, files: 1 },
  });
}

/**
 * Leading bytes a real file of each accepted type must start with. Verified
 * against the bytes actually written to disk, because the fileFilter above
 * can only ever see the client-declared Content-Type - as forgeable as the
 * filename. Confirmed live on the sibling student/backend middleware: an
 * HTML file sent as "image/png" passed the MIME filter and was stored with
 * a .png extension. WebP is a RIFF container: "RIFF" at 0, "WEBP" at 8.
 */
const MAGIC_BYTES = {
  'image/png': [[0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]]],
  'image/jpeg': [[0, [0xff, 0xd8, 0xff]]],
  'image/gif': [[0, [0x47, 0x49, 0x46, 0x38]]],
  'image/webp': [
    [0, [0x52, 0x49, 0x46, 0x46]],
    [8, [0x57, 0x45, 0x42, 0x50]],
  ],
  'application/pdf': [[0, [0x25, 0x50, 0x44, 0x46]]],
};

function matchesSignature(buffer, mimetype) {
  const signatures = MAGIC_BYTES[mimetype];
  if (!signatures) return false;
  return signatures.every(([offset, bytes]) => bytes.every((byte, i) => buffer[offset + i] === byte));
}

/**
 * Post-multer guard: the file is already on disk by the time multer has run
 * (fileFilter only sees headers), so check the real content here and delete
 * anything that misrepresented itself.
 */
export function verifyFileSignature(req, res, next) {
  if (!req.file) return next();
  // Only types we have a signature for can be verified. Anything else was
  // already gated by the MIME allowlist and passes through unchanged -
  // failing closed here would reject perfectly valid uploads of formats
  // this table simply doesn't model.
  if (!MAGIC_BYTES[req.file.mimetype]) return next();

  let handle = null;
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
    if (handle !== null) {
      try { fs.closeSync(handle); } catch { /* already closed */ }
    }
    if (req.file.path) {
      try { fs.unlinkSync(req.file.path); } catch { /* nothing written */ }
    }
    return next(err);
  }

  // Nothing has been sent to Cloudinary yet, so on that path there is
  // nothing to undo; only a disk write needs cleaning up.
  if (req.file.path) {
    try { fs.unlinkSync(req.file.path); } catch { /* already gone */ }
  }
  return next(
    new multer.MulterError(
      'LIMIT_UNEXPECTED_FILE',
      'That file contents did not match its declared type and was rejected.'
    )
  );
}

/** Public URL path for a stored file, served statically by app.js. */
export function publicUrlFor(kind, filenameOrUrl) {
  // A Cloudinary upload already carries an absolute delivery URL; only a
  // local disk upload needs the /uploads path app.js serves statically.
  if (/^https?:\/\//i.test(filenameOrUrl)) return filenameOrUrl;
  return `/uploads/${kind}/${filenameOrUrl}`;
}

export default uploaderFor;
