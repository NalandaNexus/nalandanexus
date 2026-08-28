import crypto from 'node:crypto';
import { StoredFile } from '../models/StoredFile.js';

/**
 * Durable storage for user uploads.
 *
 * The only extension a stored file may carry is derived from its VALIDATED
 * mimetype (see middleware/upload.js) - never from the client-supplied
 * filename, which is as attacker-controlled as the Content-Type header.
 */
const EXT_BY_MIME = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/** Public URL path for a stored avatar. Matches the route registered in app.js. */
export function avatarPublicUrl(key) {
  return `/uploads/avatars/${key}`;
}

/**
 * Persists an avatar and returns its public URL path.
 *
 * Replaces any avatar this user previously stored, so a student changing their
 * picture repeatedly cannot accumulate orphaned blobs in the database.
 */
export async function storeAvatar({ ownerId, buffer, mimetype }) {
  const ext = EXT_BY_MIME[mimetype] || '.bin';
  const key = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;

  await StoredFile.deleteMany({ ownerId, kind: 'avatar' });
  await StoredFile.create({
    key,
    kind: 'avatar',
    ownerId,
    contentType: mimetype,
    sizeBytes: buffer.length,
    data: buffer,
  });

  return avatarPublicUrl(key);
}

/**
 * Looks up a stored file by its public key. Returns null when absent.
 *
 * `.lean()` hands back the raw BSON Binary rather than a Node Buffer, and
 * passing that straight to res.send() serialises it as JSON instead of bytes -
 * i.e. a corrupt image. Normalise it here so every caller gets a real Buffer.
 */
export async function getStoredFile(key) {
  const file = await StoredFile.findOne({ key }).lean();
  if (!file) return null;

  const data = Buffer.isBuffer(file.data)
    ? file.data
    : Buffer.from(file.data?.buffer ?? file.data ?? []);

  return { ...file, data };
}

/** Removes every file owned by a user - used when purging an account. */
export async function deleteFilesForOwner(ownerId) {
  const res = await StoredFile.deleteMany({ ownerId });
  return res.deletedCount || 0;
}
