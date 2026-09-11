import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Criteria kinds the achievement engine knows how to evaluate.
 *
 * Kept small and declarative on purpose. Every one of these is a comparison the
 * engine can run against a progress snapshot, which means an administrator can
 * invent a new achievement from the admin UI without anyone shipping code. A
 * free-form expression field would be more flexible and far less safe.
 */
export const CRITERIA_TYPES = Object.freeze([
  'SUBJECT_SCORE', // one subject reaches a score
  'ALL_SUBJECTS_SCORE', // every enabled subject reaches a score
  'STREAK_DAYS', // current streak reaches N days
  'ACTIVITY_COUNT', // N activities of a given type completed
  'PERFECT_SCORE', // any scored activity at criteriaValue or above
  'LEVEL_REACHED',
  'OVERALL_POWER',
  'STAGE_COMPLETED',
]);

const achievementSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 64 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', trim: true, maxlength: 400 },
    icon: { type: String, default: 'Award', trim: true, maxlength: 64 },

    criteriaType: { type: String, enum: CRITERIA_TYPES, required: true },
    criteriaValue: { type: Number, default: 0 },
    // Narrows the criterion: which subject, which activity type, which stage.
    subjectCode: { type: String, default: null, uppercase: true, trim: true },
    activityType: { type: String, default: null, uppercase: true, trim: true },
    stageCode: { type: String, default: null, uppercase: true, trim: true },

    xpReward: { type: Number, default: 0, min: 0 },
    order: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

achievementSchema.index({ enabled: 1, order: 1 });

/**
 * The launch set, drawn from the product spec.
 *
 * Thresholds are starting points an administrator is expected to tune, not
 * constants - which is why they are seeded into a collection rather than being
 * compared against in code.
 */
export const DEFAULT_ACHIEVEMENTS = Object.freeze([
  {
    code: 'VOICE_OF_CONFIDENCE',
    name: 'Voice of Confidence',
    description: 'Reach a strong score in English & Communication.',
    icon: 'MessageSquare',
    criteriaType: 'SUBJECT_SCORE',
    subjectCode: 'ENGLISH',
    criteriaValue: 70,
    xpReward: 50,
    order: 1,
  },
  {
    code: 'DIGITAL_NAVIGATOR',
    name: 'Digital Navigator',
    description: 'Master the essential computer skills.',
    icon: 'Monitor',
    criteriaType: 'SUBJECT_SCORE',
    subjectCode: 'COMPUTER',
    criteriaValue: 70,
    xpReward: 50,
    order: 2,
  },
  {
    code: 'CYBER_GUARDIAN',
    name: 'Cyber Guardian',
    description: 'Reach a strong score in Cybersecurity.',
    icon: 'ShieldCheck',
    criteriaType: 'SUBJECT_SCORE',
    subjectCode: 'CYBERSECURITY',
    criteriaValue: 70,
    xpReward: 50,
    order: 3,
  },
  {
    code: 'CONSISTENCY',
    name: 'Consistency',
    description: 'Keep a learning streak going for seven days.',
    icon: 'Flame',
    criteriaType: 'STREAK_DAYS',
    criteriaValue: 7,
    xpReward: 25,
    order: 4,
  },
  {
    code: 'PERFECT_SCORE',
    name: 'Perfect Score',
    description: 'Score full marks on any assessment.',
    icon: 'Target',
    criteriaType: 'PERFECT_SCORE',
    criteriaValue: 100,
    xpReward: 75,
    order: 5,
  },
  {
    code: 'FAST_LEARNER',
    name: 'Fast Learner',
    description: 'Complete twenty five learning activities.',
    icon: 'Zap',
    criteriaType: 'ACTIVITY_COUNT',
    activityType: 'LECTURE_COMPLETED',
    criteriaValue: 25,
    xpReward: 50,
    order: 6,
  },
  {
    code: 'TRIPLE_THREAT',
    name: 'Triple Threat',
    description: 'Reach a solid score in every subject at once.',
    icon: 'Layers',
    criteriaType: 'ALL_SUBJECTS_SCORE',
    criteriaValue: 60,
    xpReward: 150,
    order: 7,
  },
  {
    code: 'NEXUS_MASTER',
    name: 'Nexus Master',
    description: 'Complete the full Nalanda Nexus journey.',
    icon: 'Crown',
    criteriaType: 'STAGE_COMPLETED',
    stageCode: 'YODDHA',
    criteriaValue: 1,
    xpReward: 500,
    order: 8,
  },
]);

export const Achievement = mongoose.models.Achievement || mongoose.model('Achievement', achievementSchema);

export default Achievement;
