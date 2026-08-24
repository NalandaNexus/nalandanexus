import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Public institute content (magazines, event photos, program resources),
 * bridged in from admin/backend's own Resource collection (a separate
 * service/database) via POST/PATCH/DELETE /api/internal/resources - see
 * routes/internal.routes.js. `fileUrl` is an absolute URL pointing back at
 * admin/backend's own static file server; no binary content is duplicated
 * here, matching the CourseMaterial/Course bridge pattern.
 */
const resourceSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', trim: true, maxlength: 2000 },
    type: { type: String, enum: ['magazine', 'event', 'program'], required: true, index: true },
    fileUrl: { type: String, required: true },
    fileName: { type: String, default: null },
    fileType: { type: String, default: 'other' },
    fileSizeBytes: { type: Number, default: 0 },
    uploadedByName: { type: String, default: '', trim: true },
    isPublished: { type: Boolean, default: true, index: true },
    publishedAt: { type: Date, default: Date.now },
    source: { type: String, enum: ['admin-portal'], default: 'admin-portal' },
    // admin/backend's Resource _id. Deliberately NO `default` - a schema
    // default of '' would make every unset document collide on the
    // sparse-unique index below (the same bug class fixed repeatedly on
    // Task/LiveClass/Quiz/Announcement/CourseMaterial in this project).
    sourceId: { type: String },
  },
  { timestamps: true }
);

resourceSchema.index({ sourceId: 1 }, { unique: true, sparse: true });
resourceSchema.index({ type: 1, isPublished: 1, publishedAt: -1 });
resourceSchema.index({ title: 'text', description: 'text' });

export const Resource = mongoose.model('Resource', resourceSchema);
