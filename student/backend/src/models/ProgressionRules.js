import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * How much XP an activity is worth, and how often it may be earned.
 *
 * `awardPolicy` is the anti-farming rule. It lives in configuration rather than
 * in each controller because "can a retaken quiz pay again?" is a product
 * decision an administrator changes, not a code path a developer rewrites.
 */
const xpRuleSchema = new Schema(
  {
    activityType: { type: String, required: true, uppercase: true, trim: true },
    baseXP: { type: Number, default: 0, min: 0 },
    // Added on top when the activity was performed well - see highScoreThreshold.
    bonusXP: { type: Number, default: 0, min: 0 },
    highScoreThreshold: { type: Number, default: 90, min: 0, max: 100 },
    awardPolicy: {
      type: String,
      enum: ['FIRST_ONLY', 'PASSED_ONLY', 'BEST_IMPROVEMENT', 'EVERY_TIME'],
      default: 'FIRST_ONLY',
    },
    // 0 means uncapped. A cap is the backstop for EVERY_TIME policies.
    maxDailyXP: { type: Number, default: 0, min: 0 },
    enabled: { type: Boolean, default: true },
    // Optional narrowing: a rule can apply only to one stage or one subject.
    stageCode: { type: String, default: null, uppercase: true, trim: true },
    subjectCode: { type: String, default: null, uppercase: true, trim: true },
  },
  { _id: false }
);

const rankRuleSchema = new Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, required: true },
    minLevel: { type: Number, default: 1, min: 1 },
    minOverallPower: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false }
);

const weightedSubjectSchema = new Schema(
  { subjectCode: { type: String, required: true, uppercase: true, trim: true }, weight: { type: Number, default: 0, min: 0 } },
  { _id: false }
);

/**
 * Every configurable number the progression engine consults.
 *
 * One document, fetched once per calculation. The spec is emphatic that these
 * must not be scattered through controllers or React components, and the reason
 * is practical: a student disputing their score should be answerable by reading
 * one record, not by auditing the codebase.
 *
 * Defaults below reproduce the behaviour the platform already had (500 XP per
 * level, 10 XP per lesson) so that turning the engine on does not silently
 * restate every existing student's level.
 */
const progressionRulesSchema = new Schema(
  {
    // Singleton. A fixed key rather than "whichever document sorts first".
    key: { type: String, required: true, unique: true, default: 'GLOBAL', uppercase: true },

    xpRules: { type: [xpRuleSchema], default: [] },

    levels: {
      mode: { type: String, enum: ['LINEAR', 'TABLE'], default: 'LINEAR' },
      xpPerLevel: { type: Number, default: 500, min: 1 },
      // Used when mode is TABLE: explicit { level, requiredXP } rows.
      table: {
        type: [new Schema({ level: { type: Number, required: true }, requiredXP: { type: Number, required: true } }, { _id: false })],
        default: [],
      },
      maxLevel: { type: Number, default: 100, min: 1 },
    },

    ranks: { type: [rankRuleSchema], default: [] },

    /**
     * How a subject's 0-100 score is built from what a student actually did.
     *
     * Weights are relative, not percentages: whichever components have data are
     * normalised against each other. A subject with no quizzes yet is scored on
     * its lessons and tasks instead of being dragged to zero by a missing one.
     */
    skillWeights: {
      lessons: { type: Number, default: 20, min: 0 },
      quizzes: { type: Number, default: 40, min: 0 },
      tasks: { type: Number, default: 25, min: 0 },
      assessments: { type: Number, default: 15, min: 0 },
    },

    knowledgeWeights: {
      quizzes: { type: Number, default: 45, min: 0 },
      tasks: { type: Number, default: 30, min: 0 },
      assessments: { type: Number, default: 25, min: 0 },
    },

    consistency: {
      // Streak length that counts as full marks for the streak component.
      targetStreakDays: { type: Number, default: 14, min: 1 },
      // Window the active-days ratio is measured over.
      windowDays: { type: Number, default: 30, min: 1 },
      streakWeight: { type: Number, default: 50, min: 0 },
      activeDaysWeight: { type: Number, default: 50, min: 0 },
    },

    overallPower: {
      subjects: { type: [weightedSubjectSchema], default: [] },
      attendance: { type: Number, default: 10, min: 0 },
      knowledge: { type: Number, default: 20, min: 0 },
      consistency: { type: Number, default: 10, min: 0 },
    },

    attendance: {
      // Whether a 'late' mark counts, and for how much.
      lateCreditPercent: { type: Number, default: 50, min: 0, max: 100 },
      // Below this many recorded sessions, attendance is reported but does not
      // gate progression - three classes is not a trend.
      minSessionsForScore: { type: Number, default: 3, min: 0 },
    },

    updatedByEmail: { type: String, default: null, trim: true, lowercase: true },
  },
  { timestamps: true }
);

/**
 * Launch defaults.
 *
 * XP values match what the controllers previously hard-coded, so enabling the
 * engine changes who is tracked, not what anyone has already earned.
 */
export const DEFAULT_XP_RULES = Object.freeze([
  { activityType: 'LECTURE_COMPLETED', baseXP: 10, bonusXP: 0, awardPolicy: 'FIRST_ONLY' },
  { activityType: 'QUIZ_SUBMITTED', baseXP: 0, bonusXP: 0, awardPolicy: 'FIRST_ONLY' },
  { activityType: 'QUIZ_PASSED', baseXP: 50, bonusXP: 25, highScoreThreshold: 90, awardPolicy: 'FIRST_ONLY' },
  { activityType: 'ASSIGNMENT_SUBMITTED', baseXP: 20, bonusXP: 0, awardPolicy: 'FIRST_ONLY' },
  { activityType: 'ASSIGNMENT_PASSED', baseXP: 60, bonusXP: 20, highScoreThreshold: 90, awardPolicy: 'FIRST_ONLY' },
  { activityType: 'ASSESSMENT_PASSED', baseXP: 100, bonusXP: 50, highScoreThreshold: 90, awardPolicy: 'FIRST_ONLY' },
  { activityType: 'CLASS_ATTENDED', baseXP: 15, bonusXP: 0, awardPolicy: 'FIRST_ONLY' },
  { activityType: 'STREAK_MILESTONE', baseXP: 25, bonusXP: 0, awardPolicy: 'FIRST_ONLY' },
  { activityType: 'ACHIEVEMENT_UNLOCKED', baseXP: 0, bonusXP: 0, awardPolicy: 'FIRST_ONLY' },
]);

export const DEFAULT_RANKS = Object.freeze([
  { code: 'E', name: 'Novice', order: 1, minLevel: 1, minOverallPower: 0 },
  { code: 'D', name: 'Apprentice', order: 2, minLevel: 3, minOverallPower: 25 },
  { code: 'C', name: 'Practitioner', order: 3, minLevel: 6, minOverallPower: 45 },
  { code: 'B', name: 'Proficient', order: 4, minLevel: 10, minOverallPower: 60 },
  { code: 'A', name: 'Advanced', order: 5, minLevel: 15, minOverallPower: 75 },
  { code: 'S', name: 'Master', order: 6, minLevel: 20, minOverallPower: 88 },
]);

export const ProgressionRules =
  mongoose.models.ProgressionRules || mongoose.model('ProgressionRules', progressionRulesSchema);

export default ProgressionRules;
