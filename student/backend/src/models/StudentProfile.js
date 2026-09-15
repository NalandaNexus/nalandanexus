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

    // --- the profile a course requires -----------------------------------------
    //
    // See services/studentProfile.service.js. The full name and phone number are
    // User.name and User.phone, and the class is `grade` above, because every
    // other portal already reads them there. Only these three are new.

    guardianName: { type: String, default: null, trim: true, maxlength: 120 },

    // The student's own identity across the institution, e.g. NN26-000124: one
    // per student for life, however many courses they take. Not the same thing
    // as Enrollment.enrollmentId, which names a single course place. Issued only
    // by studentProfile.service.js#ensureEnrollmentNumber, never by a client.
    //
    // Deliberately NO `default: null`. The unique index below is sparse, and a
    // sparse index only skips a document when the field is genuinely ABSENT -
    // the same trap documented on Enrollment.enrollmentId.
    enrollmentNumber: { type: String, trim: true, uppercase: true },

    // When the profile first became complete. Set once and never moved.
    profileCompletedAt: { type: Date, default: null },

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
              // NOT_CONFIGURED is meaningfully different from NOT_ELIGIBLE: one
              // means nobody has published criteria, the other that the student
              // has not met them.
              status: { type: String, default: 'NOT_CONFIGURED' },
              // Which published rule produced this verdict, so a dispute can be
              // traced to the criteria that were live at the time.
              version: { type: Number, default: null },
              requirements: {
                type: [
                  new Schema(
                    {
                      key: { type: String, required: true },
                      metric: { type: String, default: null },
                      name: { type: String, required: true },
                      operator: { type: String, default: '>=' },
                      required: { type: Number, default: 0 },
                      // Null where the platform has no authoritative figure -
                      // attendance with no recorded classes, for instance.
                      actual: { type: Number, default: null },
                      unit: { type: String, default: '' },
                      passed: { type: Boolean, default: false },
                      status: { type: String, default: 'FAILED' },
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

// Globally unique, and the index the teacher and admin portals' lookup is served by.
studentProfileSchema.index({ enrollmentNumber: 1 }, { unique: true, sparse: true });

/** An issued enrollment number is quoted by teachers, admins and support, so it is never rewritten. */
studentProfileSchema.pre('save', function guardEnrollmentNumber(next) {
  if (!this.isNew && this.isModified('enrollmentNumber')) {
    return next(new Error('enrollmentNumber is immutable once assigned.'));
  }
  next();
});

export const StudentProfile = mongoose.model('StudentProfile', studentProfileSchema);
