import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

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

const avatarStorage = multer.diskStorage({
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

/** Public URL path for a stored avatar, served statically by app.js. */
export function avatarPublicUrl(filename) {
  return `/uploads/avatars/${filename}`;
}

export default avatarUpload;
