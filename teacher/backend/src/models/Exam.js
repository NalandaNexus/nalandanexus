import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A single quiz question, authored via ExamsPage's "Manage Questions" panel.
 * Same shape as student/backend's Quiz.questions, for a 1:1 bridge mapping
 * (see services/studentBridge.service.js#pushQuizToStudents) — this is the
 * one place `correctIndex` is ever writable; it's never returned to a
 * student pre-submission on either side.
 */
const questionSchema = new Schema(
  {
    question: { type: String, required: true, trim: true, maxlength: 2000 },
    options: { type: [String], required: true },
    correctIndex: { type: Number, required: true, min: 0 },
    explanation: { type: String, default: '', maxlength: 2000 },
  },
  { _id: false }
);

/**
 * Exam/quiz builder record (ExamsPage). Started as a pure scheduling shell
 * with no question-answering flow; `questions` was added once a real
 * student-facing quiz engine existed to bridge into (see student/backend's
 * Quiz/QuizAttempt models) — still stays lightweight otherwise (no
 * per-student attempt tracking here, that lives entirely on the student
 * side once bridged).
 */
const examSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    class: { type: Schema.Types.ObjectId, ref: 'SchoolClass', required: true, index: true },
    teacher: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
    type: { type: String, enum: ['quiz', 'test', 'exam'], default: 'quiz' },
    totalQuestions: { type: Number, default: 0, min: 0 },
    durationMinutes: { type: Number, default: 30, min: 1 },
    scheduledAt: { type: Date, default: null },
    status: { type: String, enum: ['draft', 'scheduled', 'active', 'completed'], default: 'draft', index: true },
    questions: { type: [questionSchema], default: [] },
  },
  { timestamps: true }
);

examSchema.index({ teacher: 1, status: 1 });

export const Exam = mongoose.model('Exam', examSchema);
export default Exam;
