import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A real student's server-graded result on a bridged Exam/quiz, pushed in
 * from student/backend's own QuizAttempt via receiveBridgedQuizResult (the
 * return leg of the quiz bridge — see studentBridge.service.js's
 * pushQuizToStudents doc-comment). Exam itself deliberately has no
 * per-student attempt tracking (see models/Exam.js's comment); this is
 * where that data actually lives once real results start arriving.
 */
const examResultSchema = new Schema(
  {
    exam: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    class: { type: Schema.Types.ObjectId, ref: 'SchoolClass', required: true, index: true },
    teacher: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },

    scorePercentage: { type: Number, required: true, min: 0, max: 100 },
    correctCount: { type: Number, required: true, min: 0 },
    totalCount: { type: Number, required: true, min: 0 },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

examResultSchema.index({ exam: 1, student: 1 }, { unique: true });

export const ExamResult = mongoose.model('ExamResult', examResultSchema);
export default ExamResult;
