import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Append-only ledger of XP awards. Used to:
 *  - compute time-windowed leaderboards (this week / this month) without
 *    mutating a single cumulative counter,
 *  - provide an auditable trail of why a student's points changed.
 */
const xpEventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Which course this XP was earned in — the leaderboard MUST be
    // course-scoped (never a single global ranking), so every award has to
    // carry the course it belongs to.
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    amount: { type: Number, required: true },
    source: {
      type: String,
      enum: ['lesson', 'task', 'quiz', 'streak_bonus', 'achievement', 'attendance', 'assessment'],
      required: true,
    },
    refId: { type: String, default: null }, // lessonId / taskId / quizId

    /**
     * Which subject and stage this XP belongs to, recorded at award time.
     *
     * Lets total XP be broken down per subject later without replaying history,
     * and - like ProgressionEvent.subjectCode - deliberately snapshots the
     * classification as it stood, so re-tagging content does not silently
     * rewrite what a student was credited with.
     *
     * Nullable because rows written before the progression engine existed have
     * no subject, and backfilling a guess would be worse than an honest null.
     */
    subjectCode: { type: String, default: null, uppercase: true, trim: true, index: true },
    stageCode: { type: String, default: null, uppercase: true, trim: true },

    // Ties this award to the ProgressionEvent that caused it, so the ledger can
    // be reconciled against the activity history in both directions.
    eventKey: { type: String, default: null, trim: true, index: true },
  },
  { timestamps: true }
);

xpEventSchema.index({ userId: 1, createdAt: -1 });
xpEventSchema.index({ courseId: 1, createdAt: -1 });

export const XPEvent = mongoose.model('XPEvent', xpEventSchema);
