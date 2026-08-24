import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A teacher-published update: a class-scoped notice, a broader school/dept
 * event, or a convocation update. One model covers all three (distinguished
 * by `type`) because they share the same lifecycle (draft -> scheduled ->
 * published -> expired/archived), the same audience-targeting shape, and the
 * same real-time delivery path — splitting them into separate collections
 * would just duplicate all of that for no query-pattern benefit.
 *
 * Audience is deliberately scoped to classes this teacher actually teaches —
 * there is no Institution/Department collection anywhere in this schema (see
 * models/index.js), so "entire institution" targeting has nothing real to
 * validate against and is not offered. `audience: 'all_my_classes'` is the
 * broadest reach a teacher has in this data model.
 */
const announcementSchema = new Schema(
  {
    teacher: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },

    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },

    type: {
      type: String,
      enum: ['ANNOUNCEMENT', 'CLASS_UPDATE', 'EVENT', 'CONVOCATION', 'ACADEMIC', 'URGENT'],
      default: 'ANNOUNCEMENT',
      required: true,
      index: true,
    },
    priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },

    audience: { type: String, enum: ['classes', 'all_my_classes'], required: true },
    classes: [{ type: Schema.Types.ObjectId, ref: 'SchoolClass' }],

    // EVENT / CONVOCATION fields — optional for plain ANNOUNCEMENT/CLASS_UPDATE
    eventDate: { type: Date, default: null },
    startTime: { type: String, default: null, trim: true }, // 'HH:mm', kept as a display string like SchoolClass.schedule
    endTime: { type: String, default: null, trim: true },
    venue: { type: String, default: null, trim: true, maxlength: 200 },
    registrationLink: { type: String, default: null, trim: true, maxlength: 500 },

    attachmentUrl: { type: String, default: null },
    attachmentName: { type: String, default: null },
    bannerUrl: { type: String, default: null },

    publishAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },

    status: {
      type: String,
      enum: ['draft', 'scheduled', 'published', 'expired', 'archived'],
      default: 'draft',
      index: true,
    },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Feed queries: "my announcements, newest first" and "my announcements of a given status".
announcementSchema.index({ teacher: 1, status: 1, publishAt: -1 });
announcementSchema.index({ teacher: 1, type: 1 });
announcementSchema.index({ classes: 1 });
// Used by the scheduler sweep to find due work without scanning every announcement.
announcementSchema.index({ status: 1, publishAt: 1 });
announcementSchema.index({ status: 1, expiresAt: 1 });
announcementSchema.index({ title: 'text', description: 'text' });

export const Announcement = mongoose.model('Announcement', announcementSchema);
export default Announcement;
