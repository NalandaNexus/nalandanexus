import mongoose from 'mongoose';

const { Schema } = mongoose;

const quizAttemptSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    quizId: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
    answers: { type: Schema.Types.Mixed, default: {} }, // { [questionId]: selectedIndex }
    correctCount: { type: Number, default: 0 },
    totalCount: { type: Number, default: 0 },
    scorePercentage: { type: Number, default: 0 },
    pointsAwarded: { type: Number, required: true, default: 0 },
    isFirstAttempt: { type: Boolean, required: true },
    attemptNumber: { type: Number, required: true },
    // Server-authoritative timer (master doc section 8-10): expiresAt is
    // computed from server time + quiz.timeLimitMins the moment the attempt
    // starts, and submit is rejected once `now > expiresAt` - never trusts a
    // client-reported "time remaining". A background sweep
    // (jobs/quizExpirySweep.job.js) finalizes attempts left in_progress past
    // their deadline even if the student never returns to submit.
    startedAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ['in_progress', 'submitted', 'expired'], default: 'in_progress', index: true },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

quizAttemptSchema.index({ userId: 1, quizId: 1, createdAt: -1 });
quizAttemptSchema.index({ status: 1, expiresAt: 1 });

export const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema);
