import mongoose from 'mongoose';

const { Schema } = mongoose;

const liveClassSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', default: null, index: true },
    title: { type: String, required: true, trim: true },
    instructor: { type: String, required: true, trim: true },
    scheduledAt: { type: Date, required: true, index: true },
    durationMinutes: { type: Number, default: 60 },
    joinUrl: { type: String, default: null },
    recordingUrl: { type: String, default: null },
    status: { type: String, enum: ['upcoming', 'live', 'completed', 'cancelled'], default: 'upcoming' },
    isPublished: { type: Boolean, default: true },
    // Set only for sessions delivered by teacher/backend's cross-portal
    // bridge (see routes/internal.routes.js) rather than authored natively
    // here. sourceId is the teacher portal's own ClassSession _id, used to
    // make delivery/cancellation idempotent. `source` keeps its 'native'
    // default (a meaningful, queryable state), but `sourceId` deliberately
    // has NO default - a sparse index only excludes a document when the
    // field is genuinely ABSENT, not merely `null`, so a `default: null`
    // here would put every native session in the index under the same key
    // and collide on the second one (confirmed by a real duplicate-key
    // error while seeding during verification).
    source: { type: String, enum: ['native', 'teacher-portal'], default: 'native' },
    sourceId: { type: String },
  },
  { timestamps: true }
);

liveClassSchema.index({ isPublished: 1, scheduledAt: 1 });
liveClassSchema.index({ sourceId: 1 }, { unique: true, sparse: true });

export const LiveClass = mongoose.model('LiveClass', liveClassSchema);
