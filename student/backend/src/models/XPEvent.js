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
      enum: ['lesson', 'task', 'quiz', 'streak_bonus', 'achievement'],
      required: true,
    },
    refId: { type: String, default: null }, // lessonId / taskId / quizId
  },
  { timestamps: true }
);

xpEventSchema.index({ userId: 1, createdAt: -1 });
xpEventSchema.index({ courseId: 1, createdAt: -1 });

export const XPEvent = mongoose.model('XPEvent', xpEventSchema);
