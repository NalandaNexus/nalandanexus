import mongoose from 'mongoose';

const { Schema } = mongoose;

const lessonProgressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    moduleId: { type: String, required: true },
    lessonId: { type: String, required: true },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    videoPositionSeconds: { type: Number, default: 0 },
  },
  { timestamps: true }
);

lessonProgressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });

export const LessonProgress = mongoose.model('LessonProgress', lessonProgressSchema);
