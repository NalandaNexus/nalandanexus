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

    /**
     * Current progression snapshot.
     *
     * Derived data, every field of it. The authority is the event ledger
     * (ProgressionEvent) plus the rules document; this is the answer cached so a
     * dashboard is one read instead of a full replay of a student's history.
     * progression/engine.service.js is the only writer, and
     * `recalculateStudent` can rebuild the whole thing from events if it ever
     * disagrees with them.
     *
     * Nested rather than flattened so it cannot collide with the profile fields
     * above, and so "clear the snapshot and rebuild" is one assignment.
     */
    progression: {
      currentStageCode: { type: String, default: null, uppercase: true, trim: true },
      currentStageName: { type: String, default: null, trim: true },

      rankCode: { type: String, default: null, uppercase: true, trim: true },
      rankName: { type: String, default: null, trim: true },

      // XP needed for the next level, so the UI can draw a bar without knowing
      // the level curve - which is configuration the frontend must not hold.
      nextLevelXP: { type: Number, default: 0, min: 0 },
      currentLevelXP: { type: Number, default: 0, min: 0 },

      skills: {
        type: [
          new Schema(
            {
              subjectCode: { type: String, required: true, uppercase: true, trim: true },
              score: { type: Number, default: 0, min: 0, max: 100 },
              lessonsCompleted: { type: Number, default: 0, min: 0 },
              quizAverage: { type: Number, default: 0, min: 0, max: 100 },
              taskAverage: { type: Number, default: 0, min: 0, max: 100 },
              assessmentAverage: { type: Number, default: 0, min: 0, max: 100 },
              activityCount: { type: Number, default: 0, min: 0 },
            },
            { _id: false }
          ),
        ],
        default: [],
      },

      attendanceScore: { type: Number, default: 0, min: 0, max: 100 },
      knowledgeScore: { type: Number, default: 0, min: 0, max: 100 },
      consistencyScore: { type: Number, default: 0, min: 0, max: 100 },
      overallPower: { type: Number, default: 0, min: 0, max: 100 },

      classesConducted: { type: Number, default: 0, min: 0 },
      classesAttended: { type: Number, default: 0, min: 0 },

      stageProgress: { type: Number, default: 0, min: 0, max: 100 },
      achievementsUnlocked: { type: Number, default: 0, min: 0 },

      /**
       * Per-stage eligibility, with the reasons.
       *
       * The unmet list is stored rather than recomputed on read so the student
       * screen can say exactly what is outstanding, and so a later change to the
       * rules is visible as a change to this record rather than as a number that
       * silently moved.
       */
      eligibility: {
        type: [
          new Schema(
            {
              stageCode: { type: String, required: true, uppercase: true, trim: true },
              eligible: { type: Boolean, default: false },
              checks: {
                type: [
                  new Schema(
                    {
                      key: { type: String, required: true },
                      label: { type: String, required: true },
                      required: { type: Number, default: 0 },
                      actual: { type: Number, default: 0 },
                      met: { type: Boolean, default: false },
                    },
                    { _id: false }
                  ),
                ],
                default: [],
              },
              evaluatedAt: { type: Date, default: Date.now },
            },
            { _id: false }
          ),
        ],
        default: [],
      },

      lastActivityAt: { type: Date, default: null },
      recalculatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

export const StudentProfile = mongoose.model('StudentProfile', studentProfileSchema);
