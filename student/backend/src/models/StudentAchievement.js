import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * One achievement, unlocked once, by one student.
 *
 * "Only unlock once" is the unique index rather than a check in the engine: the
 * engine re-evaluates every criterion after every activity, so without it a
 * student who keeps meeting the same threshold would collect the same award -
 * and its XP - on each pass.
 *
 * The name and description are copied in rather than populated. An achievement
 * an administrator later renames or retires should still read correctly on the
 * profile of someone who earned it under the old wording.
 */
const studentAchievementSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    achievementCode: { type: String, required: true, uppercase: true, trim: true },

    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    icon: { type: String, default: 'Award', trim: true },
    subjectCode: { type: String, default: null, uppercase: true, trim: true },

    xpAwarded: { type: Number, default: 0, min: 0 },
    unlockedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

studentAchievementSchema.index({ userId: 1, achievementCode: 1 }, { unique: true });
studentAchievementSchema.index({ userId: 1, unlockedAt: -1 });

export const StudentAchievement =
  mongoose.models.StudentAchievement || mongoose.model('StudentAchievement', studentAchievementSchema);

export default StudentAchievement;
