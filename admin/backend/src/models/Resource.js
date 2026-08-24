import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Admin-authored public content — magazines, event photos, program
 * resources — shown on the Landing Page's public Resources section. This is
 * the authoring/ownership record on the admin side; every create/update/
 * delete bridges (best-effort) to student/backend's real public Resource
 * collection via services/studentResourceBridge.service.js, mirroring the
 * Course→student-catalog bridge exactly.
 */
const resourceSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', trim: true, maxlength: 2000 },
    type: { type: String, enum: ['magazine', 'event', 'program'], required: true, index: true },
    file: { type: String, required: true }, // relative /uploads/resources/<filename> path, served by this backend
    fileName: { type: String, default: null },
    fileType: { type: String, default: 'other' },
    fileSizeBytes: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin' },

    // Bridge delivery bookkeeping, mirroring Course.catalogSyncedAt/Status —
    // never silently claim a resource is live on the Landing Page.
    catalogSyncedAt: { type: Date, default: null },
    catalogSyncStatus: { type: String, enum: ['synced', 'failed', null], default: null },

    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

resourceSchema.index({ title: 'text', description: 'text' });

export const Resource = mongoose.model('Resource', resourceSchema);
export default Resource;
