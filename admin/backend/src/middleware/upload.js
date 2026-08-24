import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

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

/** Public URL path for a stored file, served statically by app.js. */
export function publicUrlFor(kind, filename) {
  return `/uploads/${kind}/${filename}`;
}

export default uploaderFor;
