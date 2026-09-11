import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Minimum a student must reach in one subject to complete a stage.
 *
 * Held per subject rather than as three named fields so a fourth subject needs
 * a row here, not a schema change.
 */
const subjectRequirementSchema = new Schema(
  {
    subjectCode: { type: String, required: true, uppercase: true, trim: true },
    minScore: { type: Number, default: 0, min: 0, max: 100 },
    // A subject can be tracked and shown without gating progression - useful
    // while a stage's content for it is still being written.
    required: { type: Boolean, default: true },
  },
  { _id: false }
);

/**
 * A stage of the Nalanda Nexus journey, and what it takes to finish it.
 *
 * The requirements live on the stage rather than in a controller because they
 * are the single thing an administrator most needs to change, and because the
 * eligibility engine must be able to explain a refusal item by item - which
 * means the criteria have to be data it can iterate, not code it can only run.
 *
 * `courseSlug` links a stage to the course a student actually buys. It is the
 * slug, not an _id: the admin and teacher services address courses by slug too,
 * and their databases hold different _ids for the same course.
 */
const stageSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 32 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    tagline: { type: String, default: '', trim: true, maxlength: 200 },
    description: { type: String, default: '', trim: true, maxlength: 1000 },

    order: { type: Number, required: true, index: true },
    courseSlug: { type: String, default: null, trim: true, lowercase: true, index: true },

    // Which stage this one leads to. Null on the final stage.
    nextStageCode: { type: String, default: null, uppercase: true, trim: true },

    /**
     * Completion requirements. Every one of these is checked by the eligibility
     * engine and reported back individually, so a locked stage can say exactly
     * what is outstanding rather than just "not eligible".
     */
    requirements: {
      minStageProgress: { type: Number, default: 100, min: 0, max: 100 },
      minXP: { type: Number, default: 0, min: 0 },
      minAttendance: { type: Number, default: 0, min: 0, max: 100 },
      minKnowledge: { type: Number, default: 0, min: 0, max: 100 },
      minConsistency: { type: Number, default: 0, min: 0, max: 100 },
      minOverallPower: { type: Number, default: 0, min: 0, max: 100 },
      subjects: { type: [subjectRequirementSchema], default: [] },
      // Achievement codes that must be unlocked first, if any.
      requiredAchievements: { type: [String], default: [] },
      // Every published lesson in the stage's course must be completed.
      requireAllLessons: { type: Boolean, default: false },
    },

    // A disabled stage is not offered to anyone and never reports eligibility,
    // without deleting the progression history of students already in it.
    enabled: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

stageSchema.index({ enabled: 1, order: 1 });

/** The journey as launched. Seeded; the engine reads whatever is in the collection. */
export const DEFAULT_STAGES = Object.freeze([
  {
    code: 'PRARAMBH',
    name: 'PRARAMBH',
    tagline: 'The Awakening',
    description: 'Begin Your Journey',
    order: 1,
    courseSlug: 'prarambh',
    nextStageCode: 'GARUD',
  },
  {
    code: 'GARUD',
    name: 'GARUD',
    tagline: 'The Rise',
    description: 'Build Your Power',
    order: 2,
    courseSlug: null,
    nextStageCode: 'YODDHA',
  },
  {
    code: 'YODDHA',
    name: 'YODDHA',
    tagline: 'The Warrior',
    description: 'Master Your Skills. Lead With Confidence.',
    order: 3,
    courseSlug: null,
    nextStageCode: null,
  },
]);

export const Stage = mongoose.models.Stage || mongoose.model('Stage', stageSchema);

export default Stage;
