import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Binary storage for small user uploads (avatars), held in MongoDB.
 *
 * Avatars previously went to the container's local disk. Render's filesystem
 * is ephemeral, so every redeploy silently wiped every profile picture ever
 * uploaded - the URL stayed on the User document and the image 404'd forever
 * after. Atlas is the only durable store this deployment already has, and an
 * avatar is capped at 2MB, so the bytes live here and survive restarts.
 *
 * This is deliberately scoped to small images. For large or high-volume media,
 * move to object storage (S3/Cloudinary) and swap the driver in
 * services/fileStorage.service.js - callers do not need to change.
 */
const storedFileSchema = new Schema(
  {
    // Stable public key used in the URL (/uploads/avatars/<key>). Random, so
    // a filename can never be guessed or enumerated from a user id.
    key: { type: String, required: true, unique: true, index: true },
    kind: { type: String, required: true, enum: ['avatar'], index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contentType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);

export const StoredFile = mongoose.model('StoredFile', storedFileSchema);
