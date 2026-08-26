import { v2 as cloudinary } from 'cloudinary';

/**
 * Persists an uploaded file to Cloudinary instead of local disk.
 *
 * Render's filesystem is ephemeral: anything written to ./uploads is wiped
 * on every deploy and every restart, so avatars and course images silently
 * vanished. Cloudinary keeps them, and serves them over a CDN.
 *
 * Configured entirely from CLOUDINARY_URL (the single "API Environment
 * variable" string Cloudinary's dashboard hands you). When it is unset the
 * whole module is inert and uploads fall back to the original local-disk
 * behaviour, which is what local development and the test suites use - so
 * this is safe to run without an account.
 */

export const isCloudinaryConfigured = Boolean(process.env.CLOUDINARY_URL);

if (isCloudinaryConfigured) {
  // The SDK reads CLOUDINARY_URL from the environment on its own; calling
  // config() with no argument makes that explicit rather than implicit.
  cloudinary.config({ secure: true });
}

/**
 * Cloudinary treats images and everything else differently: `image` gets
 * transformations and format conversion, `raw` is served back byte-for-byte.
 * PDFs and office documents must be `raw`, or Cloudinary tries to rasterize
 * them.
 */
function resourceTypeFor(mimetype) {
  if (mimetype?.startsWith('image/')) return 'image';
  if (mimetype?.startsWith('video/')) return 'video';
  return 'raw';
}

function uploadBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    stream.end(buffer);
  });
}

/**
 * Express middleware placed after multer and after the magic-byte check, so
 * only files that are genuinely what they claim to be ever leave this
 * server. Sets `req.file.filename` to the absolute delivery URL; the
 * publicUrlFor/avatarPublicUrl helpers pass absolute URLs through unchanged,
 * so every existing call site keeps working against either backend.
 */
export function uploadToCloudinary(folder) {
  return async function persistUpload(req, res, next) {
    if (!isCloudinaryConfigured || !req.file?.buffer) return next();

    try {
      const result = await uploadBuffer(req.file.buffer, {
        folder: `nalanda/${folder}`,
        resource_type: resourceTypeFor(req.file.mimetype),
        // Cloudinary generates a collision-free public_id itself; keeping the
        // client's filename out of it means originalname can't influence the
        // stored path any more than it could influence the on-disk one.
        use_filename: false,
        unique_filename: true,
        overwrite: false,
      });

      req.file.filename = result.secure_url;
      req.file.publicId = result.public_id;
      req.file.resourceType = result.resource_type;
      // Free the buffer promptly - these can be up to 20MB on the resource
      // upload paths and there is no reason to keep them for the response.
      req.file.buffer = undefined;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

/**
 * Deletes a previously uploaded asset. Accepts either a Cloudinary delivery
 * URL or a bare public_id; a local /uploads path is ignored here and left to
 * the disk-based cleanup path. Never throws - failing to delete an old
 * avatar should not fail the request that replaced it.
 */
export async function destroyCloudinaryAsset(urlOrPublicId) {
  if (!isCloudinaryConfigured || !urlOrPublicId) return { deleted: false, reason: 'NOT_CONFIGURED' };

  // A local disk path is not ours to delete here - the disk-based cleanup
  // path owns those. Without this guard the whole path was passed to
  // Cloudinary as a public_id, which "succeeds" against nothing.
  if (urlOrPublicId.startsWith('/')) return { deleted: false, reason: 'NOT_A_CLOUDINARY_URL' };

  let publicId = urlOrPublicId;
  let resourceType = 'image';

  const match = /^https?:\/\/res\.cloudinary\.com\/[^/]+\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+)$/i.exec(urlOrPublicId);
  if (match) {
    resourceType = match[1];
    // Strip the format suffix: the public_id never includes it.
    publicId = match[2].replace(/\.[a-z0-9]+$/i, '');
  } else if (/^https?:\/\//i.test(urlOrPublicId)) {
    // Some other host's URL - not ours to delete.
    return { deleted: false, reason: 'NOT_A_CLOUDINARY_URL' };
  }

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return { deleted: true };
  } catch (err) {
    console.error('[Cloudinary] Failed to delete asset', publicId, err.message);
    return { deleted: false, reason: 'REQUEST_FAILED' };
  }
}

export default { isCloudinaryConfigured, uploadToCloudinary, destroyCloudinaryAsset };
