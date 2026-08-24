import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A read-only mirror of an Admin-broadcast announcement (audience 'ALL' or
 * 'TEACHERS') — NOT the same collection as the teacher-authored
 * `Announcement` model, which requires an owning `teacher` and full
 * CRUD/scheduling semantics that don't apply to an admin broadcast a
 * teacher can only ever read. Mirrors the same "separate lightweight
 * read-model" precedent already used for `AssignedCourse`. Upserted by
 * `sourceId` (admin's own Announcement _id) via the shared-secret internal
 * bridge — see controllers/internal.controller.js.
 */
const adminAnnouncementSchema = new Schema(
  {
    // No default deliberately - a sparse unique index only excludes a
    // document when the field is genuinely ABSENT, not merely null (the
    // same bug class fixed repeatedly elsewhere in this project).
    sourceId: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
    authorName: { type: String, default: null },
    publishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

adminAnnouncementSchema.index({ sourceId: 1 }, { unique: true });
adminAnnouncementSchema.index({ publishedAt: -1 });

export const AdminAnnouncement = mongoose.model('AdminAnnouncement', adminAnnouncementSchema);
export default AdminAnnouncement;
