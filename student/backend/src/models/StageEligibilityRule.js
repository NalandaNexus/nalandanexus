import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * What a metric can be compared with.
 *
 * Numeric operators and existence operators are deliberately separate sets: a
 * threshold on "does this student hold the Cyber Guardian achievement" is not a
 * meaningful question, and the validator refuses the combination rather than
 * quietly coercing it.
 */
export const NUMERIC_OPERATORS = Object.freeze(['GTE', 'GT', 'EQ', 'LTE', 'LT']);
export const EXISTENCE_OPERATORS = Object.freeze(['IS', 'IS_NOT']);

export const OPERATOR_SYMBOL = Object.freeze({
  GTE: '>=', GT: '>', EQ: '=', LTE: '<=', LT: '<', IS: 'is', IS_NOT: 'is not',
});

/**
 * Every metric eligibility can be built from, and what each one needs.
 *
 * Held as data rather than a switch inside the evaluator so a new metric is a
 * row here plus a reader, and so the admin UI can build its own form from the
 * same definition the backend validates against - which is what stops the two
 * drifting into disagreement about what a valid rule is.
 */
export const METRICS = Object.freeze({
  PREVIOUS_STAGE_COMPLETION: { category: 'STAGE', label: 'Previous stage completion', unit: '%', operators: NUMERIC_OPERATORS, max: 100 },
  XP: { category: 'PROGRESSION', label: 'Total XP', unit: 'XP', operators: NUMERIC_OPERATORS },
  KNOWLEDGE: { category: 'PROGRESSION', label: 'Knowledge score', unit: '%', operators: NUMERIC_OPERATORS, max: 100 },
  CONSISTENCY: { category: 'PROGRESSION', label: 'Consistency score', unit: '%', operators: NUMERIC_OPERATORS, max: 100 },
  OVERALL_POWER: { category: 'PROGRESSION', label: 'Overall power', unit: '', operators: NUMERIC_OPERATORS, max: 100 },
  SUBJECT_SCORE: { category: 'SUBJECT', label: 'Subject score', unit: '%', operators: NUMERIC_OPERATORS, max: 100, needs: 'subjectCode' },
  ATTENDANCE: { category: 'ATTENDANCE', label: 'Attendance', unit: '%', operators: NUMERIC_OPERATORS, max: 100 },
  COURSE_COMPLETION: { category: 'ACTIVITY', label: 'Course completion', unit: '%', operators: NUMERIC_OPERATORS, max: 100 },
  LESSON_COMPLETION: { category: 'ACTIVITY', label: 'Lesson completion', unit: '%', operators: NUMERIC_OPERATORS, max: 100 },
  ASSIGNMENT_COMPLETION: { category: 'ACTIVITY', label: 'Assignment completion', unit: '%', operators: NUMERIC_OPERATORS, max: 100 },
  QUIZ_SCORE: { category: 'ACTIVITY', label: 'Average quiz score', unit: '%', operators: NUMERIC_OPERATORS, max: 100 },
  FINAL_ASSESSMENT: { category: 'ACTIVITY', label: 'Final assessment score', unit: '%', operators: NUMERIC_OPERATORS, max: 100 },
  ACHIEVEMENT: { category: 'ACHIEVEMENT', label: 'Achievement', unit: '', operators: EXISTENCE_OPERATORS, needs: 'achievementCode' },
});

export const METRIC_CODES = Object.freeze(Object.keys(METRICS));

const requirementSchema = new Schema(
  {
    // Stable across edits so the UI can key rows and a published rule can be
    // compared with its draft field by field.
    key: { type: String, required: true, trim: true, maxlength: 64 },
    metric: { type: String, required: true, uppercase: true, trim: true },
    operator: { type: String, required: true, uppercase: true, trim: true },
    value: { type: Number, default: 0 },

    // Only meaningful for the metrics that declare they need them.
    subjectCode: { type: String, default: null, uppercase: true, trim: true },
    achievementCode: { type: String, default: null, uppercase: true, trim: true },
    activityType: { type: String, default: null, uppercase: true, trim: true },

    // A disabled requirement is kept but ignored, so an administrator can park
    // one without losing how it was configured.
    enabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const groupSchema = new Schema(
  {
    logic: { type: String, enum: ['ALL', 'ANY'], default: 'ALL' },
    label: { type: String, default: '', trim: true, maxlength: 120 },
    requirements: { type: [requirementSchema], default: [] },
  },
  { _id: false }
);

/**
 * The criteria for moving from one stage to the next.
 *
 * One document per (targetStage, version). Exactly one may be PUBLISHED for a
 * transition at a time - enforced by a partial unique index rather than by
 * remembering to unpublish the old one - and drafts sit beside it without
 * affecting a single student until they are published.
 *
 * Structure is a root group plus optional sub-groups, which is enough for
 * "all of these, and any one of those" without becoming an arbitrary expression
 * tree nobody can predict the behaviour of. The evaluator is deterministic over
 * it and the UI can render it.
 *
 * Nothing here is seeded with thresholds. A transition with no published rule is
 * NOT passable - inventing production criteria would be worse than an explicit
 * "not configured yet".
 */
const stageEligibilityRuleSchema = new Schema(
  {
    targetStageCode: { type: String, required: true, uppercase: true, trim: true, index: true },
    previousStageCode: { type: String, required: true, uppercase: true, trim: true },

    version: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['DRAFT', 'PUBLISHED', 'DISABLED', 'ARCHIVED'], default: 'DRAFT', index: true },

    rootGroup: { type: groupSchema, default: () => ({ logic: 'ALL', requirements: [] }) },
    // Additional groups evaluated alongside the root, each with its own logic.
    // One level deep on purpose - see the class comment.
    groups: { type: [groupSchema], default: [] },

    notes: { type: String, default: '', trim: true, maxlength: 1000 },

    createdByEmail: { type: String, default: null, trim: true, lowercase: true },
    updatedByEmail: { type: String, default: null, trim: true, lowercase: true },
    publishedByEmail: { type: String, default: null, trim: true, lowercase: true },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

stageEligibilityRuleSchema.index({ targetStageCode: 1, version: 1 }, { unique: true });
// At most one live rule per transition. A partial index makes that structural
// instead of a thing the publish path has to remember.
stageEligibilityRuleSchema.index(
  { targetStageCode: 1 },
  { unique: true, partialFilterExpression: { status: 'PUBLISHED' } }
);

export const StageEligibilityRule =
  mongoose.models.StageEligibilityRule || mongoose.model('StageEligibilityRule', stageEligibilityRuleSchema);

export default StageEligibilityRule;
