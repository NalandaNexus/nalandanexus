import mongoose from 'mongoose';

const { Schema } = mongoose;

const announcementSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, trim: true, maxlength: 4000 },
    type: { type: String, enum: ['general', 'course', 'urgent'], default: 'general' },
    // Who published this - a teacher/admin/super_admin user. Nullable only
    // for announcements seeded before this field existed; every announcement
    // created through the real /api/admin endpoint always sets it from
    // req.user (never trusts a client-supplied author id).
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    isPublished: { type: Boolean, default: true, index: true },
    publishAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, default: null },
    // Small, bounded per-announcement read receipts - fine as an embedded
    // array since a course-wide announcement audience is at most a few
    // hundred students in this system, not an unbounded fan-out.
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],

    // Set only for announcements delivered by a (separate) teacher/admin
    // backend's cross-portal bridge (see routes/internal.routes.js) rather
    // than authored natively here. `sourceId` is the source portal's own
    // Announcement _id, used to make delivery/update/retraction idempotent
    // - a retried bridge call must not create a duplicate. Deliberately NO
    // `default` on `sourceId`: a sparse index only excludes a document when
    // the field is genuinely ABSENT, not merely `null`, so giving it one
    // would put every native announcement in the index under the same key
    // and collide on the second one (confirmed by a real duplicate-key
    // error on an identical pattern in Task/LiveClass/Quiz during
    // verification).
    source: { type: String, enum: ['native', 'teacher-portal', 'admin-portal'], default: 'native', index: true },
    sourceId: { type: String },
    // Display name for a bridged announcement's author, who has no User
    // account in this database (a teacher-portal account, not a login
    // here) - shown in place of `createdBy` when that's null.
    externalAuthorName: { type: String, default: null, trim: true, maxlength: 160 },
    // Course-scoping: empty = institution-wide broadcast (every student
    // sees it - the historical/default behavior). Non-empty = only shown to
    // students enrolled in one of these courses (master doc section 28:
    // "do not expose a teacher's course announcement to students outside
    // that course").
    courseIds: [{ type: Schema.Types.ObjectId, ref: 'Course' }],
  },
  { timestamps: true }
);

announcementSchema.index({ isPublished: 1, publishAt: -1 });
announcementSchema.index({ courseIds: 1 });
announcementSchema.index({ sourceId: 1 }, { unique: true, sparse: true });

export const Announcement = mongoose.model('Announcement', announcementSchema);
