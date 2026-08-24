import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');

const SUBDIRS = ['avatars', 'resources', 'assignments', 'announcements'];
for (const dir of SUBDIRS) {
  fs.mkdirSync(path.join(UPLOADS_ROOT, dir), { recursive: true });
}

const ALLOWED_MIME_BY_KIND = {
  avatars: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  resources: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'video/mp4',
  ],
  assignments: ['application/pdf', 'image/png', 'image/jpeg', 'application/zip'],
  announcements: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'image/webp',
  ],
};

// The stored file's extension is derived from this table (keyed by the
// VALIDATED mimetype), never from the client-supplied filename. A client
// can freely lie about Content-Type in a multipart request (fileFilter
// below only checks this same client-declared value), and originalname is
// just as untrusted - trusting either for the on-disk extension lets an
// attacker upload e.g. a real .html file with a spoofed "image/png"
// Content-Type, which express.static then serves back as real text/html
// (confirmed live via a QA pass: the script tag was stored and served with
// Content-Type: text/html, only blocked from executing by this app's own
// CSP as a lucky second layer of defense - the upload itself should never
// have allowed it).
const EXT_BY_MIME = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'video/mp4': '.mp4',
  'application/zip': '.zip',
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

/** Builds a configured multer instance scoped to a single upload "kind". */
export function uploaderFor(kind) {
  if (!SUBDIRS.includes(kind)) throw new Error(`Unknown upload kind: ${kind}`);
  return multer({
    storage: storageFor(kind),
    fileFilter: fileFilterFor(kind),
    limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 1 },
  });
}

/** Public URL path for a stored file, served statically by app.js. */
export function publicUrlFor(kind, filename) {
  return `/uploads/${kind}/${filename}`;
}

export default uploaderFor;
