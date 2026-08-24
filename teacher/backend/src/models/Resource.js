import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Uploaded teaching material metadata (ResourcesPage). Files are stored on
 * local disk under backend/uploads/resources (see middleware/upload.js) and
 * referenced here by URL — deliberately not stored as binary blobs in
 * MongoDB. If/when cloud object storage (S3, GCS, Cloudinary, ...) is wired
 * up for the workspace, only `fileUrl` and the upload middleware need to
 * change; this schema is already storage-agnostic.
 */
const resourceSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    type: { type: String, enum: ['pdf', 'slide', 'doc', 'video', 'image', 'other'], default: 'other' },
    fileUrl: { type: String, required: true },
    fileName: { type: String, default: null },
    fileSize: { type: Number, default: 0 },
    class: { type: Schema.Types.ObjectId, ref: 'SchoolClass', default: null },
    subject: { type: String, default: null, trim: true },
    teacher: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
    downloadsCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

resourceSchema.index({ teacher: 1, createdAt: -1 });

export const Resource = mongoose.model('Resource', resourceSchema);
export default Resource;
