import multer from 'multer';

const ALLOWED_AVATAR_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_AVATAR_MB = 2;

/**
 * Avatars are buffered in memory and then persisted by
 * services/fileStorage.service.js, which writes them to MongoDB.
 *
 * They used to be written to the container's local disk. Render's filesystem
 * is ephemeral, so every redeploy silently deleted every avatar ever uploaded
 * while the URL stayed on the User document - the image simply 404'd from then
 * on. Memory storage is safe here precisely because the size limit below is
 * enforced by multer before the buffer is retained.
 *
 * The stored extension is still derived from the VALIDATED mimetype rather
 * than the client-supplied originalname (see fileStorage.service.js).
 * Confirmed live during an earlier QA pass: a real .html file uploaded with a
 * spoofed "image/png" Content-Type passed the filter below, so the filename is
 * never trusted to decide how the file is later served.
 */
function avatarFileFilter(req, file, cb) {
  if (!ALLOWED_AVATAR_MIME.includes(file.mimetype)) {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', `Unsupported file type: ${file.mimetype}`));
    return;
  }
  cb(null, true);
}

export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: avatarFileFilter,
  limits: { fileSize: MAX_AVATAR_MB * 1024 * 1024, files: 1 },
});

export default avatarUpload;
