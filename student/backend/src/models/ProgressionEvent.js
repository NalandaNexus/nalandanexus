import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Immutable record of one thing a student did that progression cares about.
 *
 * This collection IS the idempotency mechanism. Every event carries an
 * `eventKey` under a unique index, and the engine's first act is to insert it.
 * A duplicate request loses that insert and is told so, which is the only
 * version of this that survives concurrency: a "have we already awarded this?"
 * read lets two simultaneous submissions both find nothing and both pay out.
 *
 * The key is composed by the caller (see progression/engine.service.js) so that
 * the award policy decides what counts as "the same event" - a FIRST_ONLY quiz
 * keys on the quiz, an EVERY_TIME one keys on the attempt.
 *
 * Nothing here is ever updated. Corrections are new events, so the history of
 * what a student was credited with, and when, stays readable after the fact.
 */
const progressionEventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // The unique index is doing real work - see the class comment.
    eventKey: { type: String, required: true, unique: true, trim: true, maxlength: 300 },

    activityType: { type: String, required: true, uppercase: true, trim: true, index: true },

    courseId: { type: Schema.Types.ObjectId, ref: 'Course', default: null, index: true },
    stageCode: { type: String, default: null, uppercase: true, trim: true, index: true },

    /**
     * The subject as resolved AT THE TIME the activity happened.
     *
     * Deliberately a snapshot, not a live lookup. If an administrator later
     * re-tags a lesson from English to Computer, this still says what the
     * student was actually credited with - the spec calls for exactly that
     * distinction between current content subject and historical activity
     * subject, and rewriting history would make past reports unexplainable.
     */
    subjectCode: { type: String, default: null, uppercase: true, trim: true, index: true },

    // lessonId / quizId / taskId - whatever identifies the thing that was done.
    refId: { type: String, default: null, trim: true },

    status: {
      type: String,
      enum: ['STARTED', 'SUBMITTED', 'PASSED', 'FAILED', 'COMPLETED', 'ATTENDED', 'MISSED', 'UNLOCKED'],
      required: true,
    },

    // 0-100 where the activity has a score; null where the notion is meaningless
    // (a lecture is completed, not scored).
    score: { type: Number, default: null, min: 0, max: 100 },

    xpAwarded: { type: Number, default: 0, min: 0 },

    // Which service produced this - 'student-portal', 'teacher-bridge', 'admin',
    // 'seed'. Useful when a number is disputed.
    source: { type: String, default: 'student-portal', trim: true, maxlength: 64 },
    // Set when somebody other than the student caused it (a teacher grading, an
    // admin correcting). Null for the student's own actions.
    createdBy: { type: String, default: null, trim: true, maxlength: 120 },

    occurredAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// Serves the activity timeline, which is always one student newest-first.
progressionEventSchema.index({ userId: 1, occurredAt: -1 });
// Serves per-subject skill aggregation.
progressionEventSchema.index({ userId: 1, subjectCode: 1, activityType: 1 });
// Serves the daily-cap check.
progressionEventSchema.index({ userId: 1, activityType: 1, occurredAt: -1 });

export const ProgressionEvent =
  mongoose.models.ProgressionEvent || mongoose.model('ProgressionEvent', progressionEventSchema);

export default ProgressionEvent;
