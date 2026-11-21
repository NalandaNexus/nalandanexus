import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * One uploaded video file in private object storage, from the moment its
 * upload starts until the object is deleted.
 *
 * This is the registry of stored objects, not a second record of what a
 * module plays: that is only ever Course.modules[].video (or a lesson's
 * video), which points at an object by `storageKey`. Video bytes are never
 * here - only the facts needed to finish, verify, retire and clean up a file.
 *
 *   uploading  -> parts are being PUT straight to storage by the browser
 *   processing -> parts assembled; size and file signature being verified
 *   verified   -> a real video, but not attached (someone else changed the
 *                 module meanwhile and the uploader has not decided yet)
 *   completed  -> attached: this object is what the module/lesson plays
 *   retired    -> replaced or removed; kept until no playback URL handed out
 *                 earlier can still be in use, then deleted
 *   deleted    -> object removed from storage (the record stays as history)
 *   failed / aborted / expired -> never attached; object/parts cleaned up
 */
export const VIDEO_UPLOAD_STATUSES = ['uploading', 'processing', 'verified', 'completed', 'retired', 'deleted', 'failed', 'aborted', 'expired'];

const videoUploadSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    courseSlug: { type: String, required: true },
    targetType: { type: String, enum: ['module', 'lesson'], required: true },
    targetId: { type: String, required: true },
    moduleId: { type: String, required: true },

    objectKey: { type: String, required: true, unique: true },
    multipartUploadId: { type: String, required: true },
    partSize: { type: Number, required: true, min: 1 },
    totalParts: { type: Number, required: true, min: 1 },

    fileName: { type: String, required: true, maxlength: 255 },
    fileSize: { type: Number, required: true, min: 1 },
    mimeType: { type: String, required: true, maxlength: 120 },
    duration: { type: Number, default: null, min: 0 },

    title: { type: String, default: '', maxlength: 200 },
    description: { type: String, default: '', maxlength: 2000 },
    isPublished: { type: Boolean, default: true },
    // The version of the target's video the uploader saw when they started
    // (null = there was none). Attaching the finished file is refused if the
    // module changed in the meantime, unless the uploader confirms.
    expectedUpdatedAt: { type: Date, default: undefined },

    actor: {
      portal: { type: String, enum: ['admin', 'teacher'], required: true },
      userId: { type: String, required: true, maxlength: 64 },
      name: { type: String, default: null, maxlength: 120 },
    },

    status: { type: String, enum: VIDEO_UPLOAD_STATUSES, default: 'uploading' },
    failureCode: { type: String, default: null, maxlength: 60 },
    failureReason: { type: String, default: null, maxlength: 400 },

    // An unfinished session lapses after a day without activity.
    expiresAt: { type: Date, required: true },
    verifiedAt: { type: Date, default: null },
    appliedAt: { type: Date, default: null },
    retiredAt: { type: Date, default: null },
    deleteAfter: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    cleanupAttempts: { type: Number, default: 0 },
    lastCleanupError: { type: String, default: null, maxlength: 400 },
  },
  { timestamps: true }
);

// Per-target lookups (in-progress uploads shown to editors and admins).
videoUploadSchema.index({ courseId: 1, targetType: 1, targetId: 1, status: 1 });
// The storage sweep: stale sessions and retired objects due for deletion.
videoUploadSchema.index({ status: 1, expiresAt: 1 });
videoUploadSchema.index({ status: 1, deleteAfter: 1 });

export const VideoUpload = mongoose.model('VideoUpload', videoUploadSchema);
