import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A read-only mirror of a teacher-authored announcement, bridged in from
 * teacher/backend for admin visibility only (see routes/internal.routes.js)
 * — NOT the source of truth (that's teacher/backend's own Announcement
 * collection, a separate service/database). Admin never writes to this;
 * it only mirrors what teacher/backend's own
 * services/adminBridge.service.js pushes. Mirrors the same precedent
 * already used for AssignmentActivity/QuizActivity/AttendanceSummary.
 */
const teacherAnnouncementSchema = new Schema(
  {
    // No default deliberately - a sparse unique index only excludes a
    // document when the field is genuinely ABSENT, not merely null (the
    // same bug class fixed repeatedly elsewhere in this project).
    sourceId: { type: String },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true },
    priority: { type: String, default: 'MEDIUM' },
    teacherName: { type: String, default: '' },
    className: { type: String, default: '' },
    publishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

teacherAnnouncementSchema.index({ sourceId: 1 }, { unique: true, sparse: true });
teacherAnnouncementSchema.index({ publishedAt: -1 });

export const TeacherAnnouncement = mongoose.model('TeacherAnnouncement', teacherAnnouncementSchema);
export default TeacherAnnouncement;
