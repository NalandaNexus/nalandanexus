import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * The history of every module and lesson video: who attached, replaced,
 * published or removed what, every upload that failed or lapsed, and every
 * storage clean-up that did not go through.
 *
 * Written by the one service that changes videos, so it covers edits from the
 * Admin and Teacher portals alike. It is a log, never read to decide what a
 * student sees - that is Course.modules[].video alone. Kept for a year.
 */
export const COURSE_VIDEO_ACTIONS = [
  'link_saved',
  'published',
  'unpublished',
  'removed',
  'upload_started',
  'upload_completed',
  'upload_failed',
  'upload_aborted',
  'upload_expired',
  'upload_conflict',
  'object_deleted',
  'object_cleanup_failed',
  'availability_changed',
];

const refSchema = new Schema(
  {
    provider: { type: String, default: null },
    // YouTube id, Drive file id or the uploaded file's name - never a signed URL.
    ref: { type: String, default: null, maxlength: 300 },
    isPublished: { type: Boolean, default: null },
  },
  { _id: false }
);

const courseVideoEventSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    courseSlug: { type: String, required: true },
    targetType: { type: String, enum: ['module', 'lesson'], required: true },
    targetId: { type: String, required: true },
    moduleId: { type: String, default: null },
    action: { type: String, enum: COURSE_VIDEO_ACTIONS, required: true },
    level: { type: String, enum: ['info', 'warn', 'error'], default: 'info' },
    video: { type: refSchema, default: null },
    previous: { type: refSchema, default: null },
    uploadId: { type: Schema.Types.ObjectId, ref: 'VideoUpload', default: null },
    message: { type: String, default: '', maxlength: 500 },
    actor: {
      portal: { type: String, enum: ['admin', 'teacher', 'system'], default: 'system' },
      userId: { type: String, default: null, maxlength: 64 },
      name: { type: String, default: null, maxlength: 120 },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

courseVideoEventSchema.index({ courseSlug: 1, createdAt: -1 });
courseVideoEventSchema.index({ level: 1, createdAt: -1 });
courseVideoEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60, name: 'createdAt_ttl' });

export const CourseVideoEvent = mongoose.model('CourseVideoEvent', courseVideoEventSchema);
