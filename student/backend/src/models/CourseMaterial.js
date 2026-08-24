import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Teacher-uploaded lecture material/resource, bridged in from
 * teacher/backend's Resource collection (a separate service/database) via
 * POST /api/internal/materials — see routes/internal.routes.js. Distinct
 * from the student's own personal Note model (a private notebook, unrelated
 * to this). `fileUrl` is an absolute URL pointing back at teacher/backend's
 * own static file server; no binary content is duplicated here.
 */
const courseMaterialSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    moduleTitle: { type: String, default: '', trim: true },
    uploadedByName: { type: String, default: '', trim: true },
    fileUrl: { type: String, required: true },
    fileName: { type: String, default: null },
    fileType: { type: String, default: 'other' },
    fileSizeBytes: { type: Number, default: 0 },
    source: { type: String, enum: ['teacher-portal'], default: 'teacher-portal' },
    // teacher/backend's Resource _id. Deliberately NO `default` - see the
    // identical fix (and its rationale) on Task/LiveClass/Quiz/Announcement.
    sourceId: { type: String },
  },
  { timestamps: true }
);

courseMaterialSchema.index({ courseId: 1, createdAt: -1 });
courseMaterialSchema.index({ sourceId: 1 }, { unique: true, sparse: true });

export const CourseMaterial = mongoose.model('CourseMaterial', courseMaterialSchema);
