import mongoose from 'mongoose';

const { Schema } = mongoose;

const studentProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },

    grade: { type: String, default: null }, // e.g. "10th Standard" (Class 3-12 platform)
    board: { type: String, default: null },
    school: { type: String, default: null },
    bio: { type: String, default: '', maxlength: 500 },

    xp: { type: Number, default: 0, min: 0 },
    level: { type: Number, default: 1, min: 1 },

    streak: {
      current: { type: Number, default: 0 },
      longest: { type: Number, default: 0 },
      lastActiveDate: { type: String, default: null }, // YYYY-MM-DD (UTC date key)
    },

    stats: {
      lessonsCompleted: { type: Number, default: 0 },
      quizzesCompleted: { type: Number, default: 0 },
      tasksCompleted: { type: Number, default: 0 },
      averageQuizScore: { type: Number, default: 0 },
      averageTaskScore: { type: Number, default: 0 },
    },

    badges: [{ type: String }], // simple rule-based achievement slugs, e.g. "first-course", "quiz-master"

    hasCompletedOnboarding: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const StudentProfile = mongoose.model('StudentProfile', studentProfileSchema);
