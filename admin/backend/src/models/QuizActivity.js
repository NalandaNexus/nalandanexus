import mongoose from 'mongoose';

const { Schema } = mongoose;

/** Lightweight read-model of a teacher/backend Exam, bridged in for admin monitoring only — see AssignmentActivity.js for the full rationale. */
const quizActivitySchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    className: { type: String, default: '' },
    teacherName: { type: String, default: '' },
    type: { type: String, default: 'quiz' },
    questionCount: { type: Number, default: 0 },
    durationMinutes: { type: Number, default: 0 },
    scheduledAt: { type: Date, default: null },
    status: { type: String, default: 'draft' },
    sourceId: { type: String },
  },
  { timestamps: true }
);

quizActivitySchema.index({ sourceId: 1 }, { unique: true, sparse: true });
quizActivitySchema.index({ scheduledAt: -1 });

export const QuizActivity = mongoose.model('QuizActivity', quizActivitySchema);
export default QuizActivity;
