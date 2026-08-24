import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A single scheduled meeting/period of a SchoolClass (what the UI's
 * "Today's Schedule" / "Master Timetable" / Live Studio panel show) — as
 * opposed to `SchoolClass.schedule`, which is just the recurring
 * human-readable pattern ("Mon, Wed, Fri 03:00 PM"). Discrete sessions are
 * needed because each one carries its own topic, room override, and
 * live/completed state.
 *
 * `status` only tracks teacher-controlled state transitions
 * (scheduled -> live -> completed, or cancelled); "is this live/upcoming/
 * completed right now" for *display* is derived from startAt/durationMinutes
 * vs. the current time by services/schedule.service.js#withComputedStatus,
 * so we never show a stale "LIVE NOW" badge after the period has ended.
 */
const classSessionSchema = new Schema(
  {
    class: { type: Schema.Types.ObjectId, ref: 'SchoolClass', required: true, index: true },
    teacher: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
    startAt: { type: Date, required: true, index: true },
    durationMinutes: { type: Number, default: 45, min: 5, max: 300 },
    subject: { type: String, default: null, trim: true }, // denormalized override, e.g. 'Doubt Session'
    topic: { type: String, default: '', trim: true, maxlength: 300 },
    room: { type: String, default: null, trim: true },
    status: { type: String, enum: ['scheduled', 'live', 'completed', 'cancelled'], default: 'scheduled', index: true },
    // Optional YouTube live link, canonicalized server-side (utils/youtube.js)
    // before storage. When set AND the class is linked to a student-portal
    // course, this session is bridged to students as a Live Lecture.
    youtubeUrl: { type: String, default: null },

    // A reschedule is a real time change on this SAME session, never a new
    // document (students/attendance/history must all keep pointing at the
    // one session). `status` deliberately stays in its existing 4-value
    // enum rather than gaining a 'rescheduled' terminal state - a
    // rescheduled class is still fundamentally "scheduled", just at a new
    // time; `rescheduleHistory.length > 0` is what marks it as having been
    // moved, and the UI can badge that alongside the real status.
    rescheduleHistory: [
      {
        previousStartAt: { type: Date, required: true },
        previousDurationMinutes: { type: Number, required: true },
        reason: { type: String, default: null, trim: true, maxlength: 300 },
        rescheduledAt: { type: Date, default: Date.now },
        rescheduledBy: { type: Schema.Types.ObjectId, ref: 'Teacher' },
      },
    ],
  },
  { timestamps: true }
);

classSessionSchema.index({ teacher: 1, startAt: 1 });
classSessionSchema.index({ class: 1, startAt: 1 });

export const ClassSession = mongoose.model('ClassSession', classSessionSchema);
export default ClassSession;
