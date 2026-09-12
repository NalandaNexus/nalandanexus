import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { StageEligibilityRule, METRICS, OPERATOR_SYMBOL } from '../models/StageEligibilityRule.js';
import { Stage } from '../models/Stage.js';
import { Course } from '../models/Course.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { User } from '../models/User.js';
import { validateRule } from '../services/progression/eligibility.service.js';
import { logger } from '../utils/logger.js';

/**
 * Administering the criteria that gate each stage.
 *
 * A draft can be edited freely and affects nobody; publishing is the moment it
 * starts deciding who may progress. Keeping those apart is the whole point of
 * the lifecycle - an administrator experimenting with thresholds should not be
 * moving live students between locked and eligible while they think.
 *
 * Reached only through the service-key router, which the admin portal proxies
 * to. Nothing here is exposed to students or teachers.
 */

const stageOrder = (stages, code) => stages.find((s) => s.code === code)?.order ?? -1;

/**
 * A search box is a literal substring, not a pattern the caller gets to author.
 *
 * Passing it to `new RegExp` unescaped made "(" a 500 and "(a+)+$" a way to
 * pin the process against every name in the collection.
 */
const escapeRegex = (term) => String(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The transition each stage represents, or null for the starting stage. */
async function transitions() {
  const stages = await Stage.find({ enabled: true }).sort({ order: 1 }).lean();
  return stages.map((stage, index) => ({
    stage,
    previous: index > 0 ? stages[index - 1] : null,
  }));
}

/** Every transition with its current rule state - the control centre's list. */
export const listEligibility = asyncHandler(async (req, res) => {
  const rows = await transitions();
  const rules = await StageEligibilityRule.find({}).sort({ version: -1 }).lean();

  const data = rows.map(({ stage, previous }) => {
    const forStage = rules.filter((r) => r.targetStageCode === stage.code);
    const published = forStage.find((r) => r.status === 'PUBLISHED') || null;
    const draft = forStage.find((r) => r.status === 'DRAFT') || null;

    const countRequirements = (rule) =>
      rule ? [rule.rootGroup, ...(rule.groups || [])].reduce((n, g) => n + (g?.requirements || []).filter((x) => x.enabled !== false).length, 0) : 0;

    return {
      stageCode: stage.code,
      stageName: stage.name,
      tagline: stage.tagline,
      order: stage.order,
      previousStageCode: previous?.code || null,
      previousStageName: previous?.name || null,
      // The first stage has no prerequisite at all; saying "not configured"
      // about it would imply somebody ought to configure one.
      isStartingStage: !previous,
      status: !previous ? 'STARTING_STAGE' : published ? 'PUBLISHED' : draft ? 'DRAFT' : 'NOT_CONFIGURED',
      publishedVersion: published?.version || null,
      publishedAt: published?.publishedAt || null,
      publishedBy: published?.publishedByEmail || null,
      publishedRequirements: countRequirements(published),
      draftVersion: draft?.version || null,
      draftRequirements: countRequirements(draft),
      draftUpdatedAt: draft?.updatedAt || null,
    };
  });

  return sendSuccess(res, { data });
});

/** One transition in full: its published rule, its draft, and its history. */
export const getEligibility = asyncHandler(async (req, res) => {
  const code = String(req.params.stage).toUpperCase();
  const rows = await transitions();
  const row = rows.find((r) => r.stage.code === code);
  if (!row) throw AppError.notFound('Stage not found', 'STAGE_NOT_FOUND');

  const { Subject } = await import('../models/Subject.js');
  const { Achievement } = await import('../models/Achievement.js');

  const [rules, subjects, achievements] = await Promise.all([
    StageEligibilityRule.find({ targetStageCode: code }).sort({ version: -1 }).lean(),
    Subject.find({ enabled: true }).sort({ order: 1 }).select('code name').lean(),
    Achievement.find({ enabled: true }).sort({ order: 1 }).select('code name').lean(),
  ]);

  return sendSuccess(res, {
    data: {
      stage: { code: row.stage.code, name: row.stage.name, tagline: row.stage.tagline },
      // The options the builder offers, so it never has to guess at what a
      // valid subject or achievement code is.
      subjects: subjects.map((x) => ({ code: x.code, name: x.name })),
      achievements: achievements.map((x) => ({ code: x.code, name: x.name })),
      previousStage: row.previous ? { code: row.previous.code, name: row.previous.name } : null,
      isStartingStage: !row.previous,
      published: rules.find((r) => r.status === 'PUBLISHED') || null,
      draft: rules.find((r) => r.status === 'DRAFT') || null,
      history: rules.filter((r) => ['ARCHIVED', 'DISABLED'].includes(r.status)),
      // The vocabulary the builder offers, served from the same definition the
      // validator enforces, so the two cannot disagree about what is valid.
      metrics: Object.entries(METRICS).map(([metric, d]) => ({
        metric, category: d.category, label: d.label, unit: d.unit,
        operators: d.operators.map((op) => ({ code: op, symbol: OPERATOR_SYMBOL[op] })),
        max: d.max ?? null, needs: d.needs ?? null,
      })),
    },
  });
});

/** Creates or replaces the draft for a transition. */
export const saveDraft = asyncHandler(async (req, res) => {
  const code = String(req.params.stage).toUpperCase();
  const rows = await transitions();
  const row = rows.find((r) => r.stage.code === code);
  if (!row) throw AppError.notFound('Stage not found', 'STAGE_NOT_FOUND');
  if (!row.previous) {
    throw AppError.badRequest('The first stage has no prerequisite to configure.', 'STARTING_STAGE');
  }

  const existingDraft = await StageEligibilityRule.findOne({ targetStageCode: code, status: 'DRAFT' });
  const highest = await StageEligibilityRule.findOne({ targetStageCode: code }).sort({ version: -1 }).select('version').lean();

  const payload = {
    targetStageCode: code,
    previousStageCode: row.previous.code,
    rootGroup: req.body.rootGroup || { logic: 'ALL', requirements: [] },
    groups: req.body.groups || [],
    notes: req.body.notes || '',
    updatedByEmail: req.body.updatedByEmail || null,
  };

  const draft = existingDraft
    ? await StageEligibilityRule.findByIdAndUpdate(existingDraft._id, { $set: payload }, { new: true, runValidators: true })
    : await StageEligibilityRule.create({
        ...payload,
        // A draft claims the next version number, so a published version is
        // never overwritten and history stays readable.
        version: (highest?.version || 0) + 1,
        status: 'DRAFT',
        createdByEmail: req.body.updatedByEmail || null,
      });

  return sendSuccess(res, { message: 'Draft saved.', data: draft });
});

/** Checks a rule without saving or publishing it. */
export const validateDraft = asyncHandler(async (req, res) => {
  const code = String(req.params.stage).toUpperCase();
  const rows = await transitions();
  const row = rows.find((r) => r.stage.code === code);
  if (!row) throw AppError.notFound('Stage not found', 'STAGE_NOT_FOUND');
  // Same refusal as saveDraft. Without it the starting stage validated with a
  // baffling "Previous stage undefined does not exist."
  if (!row.previous) {
    throw AppError.badRequest('The first stage has no prerequisite to configure.', 'STARTING_STAGE');
  }

  const candidate = req.body.rootGroup
    ? { targetStageCode: code, previousStageCode: row.previous?.code, rootGroup: req.body.rootGroup, groups: req.body.groups || [] }
    : await StageEligibilityRule.findOne({ targetStageCode: code, status: 'DRAFT' }).lean();

  if (!candidate) throw AppError.notFound('No draft to validate.', 'NO_DRAFT');

  const previousCourseId = row.previous?.courseSlug
    ? (await Course.findOne({ slug: row.previous.courseSlug }).select('_id').lean())?._id
    : null;

  const result = await validateRule(candidate, { previousStageCourseId: previousCourseId });
  if (!result.valid) {
    logger.warn(`[eligibility] validation failed for ${code}: ${result.errors.join('; ')}`);
  }
  return sendSuccess(res, { data: result });
});

/**
 * Makes a draft live.
 *
 * Validates first and refuses on error - a rule with no enabled requirements
 * would lock the stage permanently, and one naming a subject that no longer
 * exists can never be satisfied. Warnings do not block: requiring a subject the
 * prerequisite stage does not yet teach is a legitimate thing to do knowingly.
 */
export const publishRule = asyncHandler(async (req, res) => {
  const code = String(req.params.stage).toUpperCase();
  const draft = await StageEligibilityRule.findOne({ targetStageCode: code, status: 'DRAFT' });
  if (!draft) throw AppError.notFound('There is no draft to publish.', 'NO_DRAFT');

  const rows = await transitions();
  const row = rows.find((r) => r.stage.code === code);
  const previousCourseId = row?.previous?.courseSlug
    ? (await Course.findOne({ slug: row.previous.courseSlug }).select('_id').lean())?._id
    : null;

  const validation = await validateRule(draft.toObject(), { previousStageCourseId: previousCourseId });
  if (!validation.valid) {
    throw AppError.badRequest(`This rule cannot be published: ${validation.errors.join(' ')}`, 'RULE_INVALID');
  }

  // The previous live rule is retired before the new one goes live, because the
  // partial unique index permits exactly one PUBLISHED rule per transition.
  await StageEligibilityRule.updateMany({ targetStageCode: code, status: 'PUBLISHED' }, { $set: { status: 'ARCHIVED' } });

  draft.status = 'PUBLISHED';
  draft.publishedAt = new Date();
  draft.publishedByEmail = req.body.publishedByEmail || null;
  await draft.save();

  return sendSuccess(res, {
    message: `Version ${draft.version} is live.`,
    data: { rule: draft, warnings: validation.warnings },
  });
});

/** Takes a live rule out of service. The stage becomes unenterable, not open. */
export const disableRule = asyncHandler(async (req, res) => {
  const code = String(req.params.stage).toUpperCase();
  const published = await StageEligibilityRule.findOne({ targetStageCode: code, status: 'PUBLISHED' });
  if (!published) throw AppError.notFound('There is no published rule to disable.', 'NO_PUBLISHED_RULE');

  published.status = 'DISABLED';
  await published.save();

  return sendSuccess(res, {
    message: 'Rule disabled. This stage now has no published criteria, so nobody can progress into it.',
    data: published,
  });
});

/**
 * Evaluates one real student against a rule, without touching them.
 *
 * Uses the draft when asked to, so an administrator can see what a change would
 * do before it does it. Reads only - previewing must never move a student's
 * standing.
 */
export const previewEligibility = asyncHandler(async (req, res) => {
  const { userId, stageCode, useDraft = false } = req.body;
  if (!mongoose.isValidObjectId(userId)) {
    throw AppError.badRequest('A valid student id is required.', 'INVALID_USER_ID');
  }
  if (!stageCode) throw AppError.badRequest('A target stage is required.', 'STAGE_REQUIRED');
  const code = String(stageCode).toUpperCase();

  const profile = await StudentProfile.findOne({ userId }).lean();
  if (!profile) throw AppError.notFound('That student has no learner profile.', 'PROFILE_NOT_FOUND');

  const rows = await transitions();
  const row = rows.find((r) => r.stage.code === code);
  if (!row) throw AppError.notFound('Stage not found', 'STAGE_NOT_FOUND');

  const rule = useDraft
    ? await StageEligibilityRule.findOne({ targetStageCode: code, status: 'DRAFT' }).lean()
    : await StageEligibilityRule.findOne({ targetStageCode: code, status: 'PUBLISHED' }).lean();

  // Asking to try a draft that does not exist is a different answer from a
  // stage nobody has configured. Reported as its own refusal, because otherwise
  // the portal shows "no criteria published" next to a banner insisting it just
  // evaluated the draft.
  if (useDraft && !rule) {
    throw AppError.notFound('There is no draft for this stage to try.', 'NO_DRAFT');
  }

  const { evaluateStageEligibility, buildEvaluationContext, buildStudentContext } = await import(
    '../services/progression/eligibility.service.js'
  );
  const previousCourseId = row.previous?.courseSlug
    ? (await Course.findOne({ slug: row.previous.courseSlug }).select('_id').lean())?._id
    : null;

  const [reference, student, user] = await Promise.all([
    buildEvaluationContext(),
    buildStudentContext(userId, previousCourseId),
    User.findById(userId).select('name email').lean(),
  ]);

  // The engine only has a progress figure for the stage the student is actually
  // standing on; for any other stage it evaluates against 0. Mirrored exactly
  // here - a preview that used a different number would disagree with the gate
  // it is meant to predict, and an administrator would trust the wrong one.
  const currentStageCode = profile.progression?.currentStageCode || null;
  const previousProgress =
    row.previous && row.previous.code === currentStageCode ? profile.progression?.stageProgress || 0 : 0;

  const verdict = await evaluateStageEligibility({
    profile,
    previousStage: row.previous
      ? { code: row.previous.code, name: row.previous.name, progress: previousProgress }
      : null,
    targetStageCode: code,
    rule,
    context: { ...reference, ...student },
  });

  return sendSuccess(res, {
    data: {
      student: { userId: String(userId), name: user?.name || null, email: user?.email || null },
      usingDraft: Boolean(useDraft),
      ...verdict,
    },
  });
});

/**
 * Every student's standing against every transition.
 *
 * Reads the stored verdicts rather than re-evaluating per row: the snapshot
 * already holds them, and recomputing a page of students from their event
 * histories would be the N+1 this is meant to avoid. Paged and filtered in the
 * database for the same reason.
 */
export const studentEligibilityOverview = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const { stageCode, targetStage, eligibility, search } = req.query;

  const filter = {};
  if (stageCode) filter['progression.currentStageCode'] = String(stageCode).toUpperCase();

  if (targetStage && eligibility) {
    const wantEligible = eligibility === 'ELIGIBLE';
    filter['progression.eligibility'] = {
      $elemMatch: { stageCode: String(targetStage).toUpperCase(), eligible: wantEligible },
    };
  }

  // A name or email search has to cross into the user collection; done as one
  // lookup rather than per row.
  if (search) {
    const term = String(search).trim();
    const safe = escapeRegex(term);
    const users = await User.find({
      $or: [{ name: new RegExp(safe, 'i') }, { email: new RegExp(safe, 'i') }],
    })
      .select('_id')
      .limit(500)
      .lean();
    filter.userId = { $in: users.map((u) => u._id) };
  }

  const [profiles, total] = await Promise.all([
    StudentProfile.find(filter).sort({ 'progression.recalculatedAt': -1 }).skip((page - 1) * limit).limit(limit).lean(),
    StudentProfile.countDocuments(filter),
  ]);

  const users = await User.find({ _id: { $in: profiles.map((p) => p.userId) } }).select('name email').lean();
  const userById = new Map(users.map((u) => [String(u._id), u]));

  const data = profiles.map((profile) => {
    const p = profile.progression || {};
    const user = userById.get(String(profile.userId));
    const verdicts = (p.eligibility || []).filter((e) => e.status !== 'STARTING_STAGE');

    return {
      userId: String(profile.userId),
      name: user?.name || null,
      email: user?.email || null,
      currentStage: p.currentStageCode || null,
      stageProgress: p.stageProgress || 0,
      stages: verdicts.map((e) => ({
        stageCode: e.stageCode,
        eligible: e.eligible,
        status: e.status,
        // Names only - the overview is a scan, not a report.
        missing: (e.requirements || []).filter((r) => !r.passed).map((r) => r.name),
      })),
      lastEvaluated: p.recalculatedAt || null,
    };
  });

  // The stages are configuration, not constants, so the table that renders them
  // is told what they are rather than guessing. `targets` excludes the starting
  // stage: nothing gates entry to it, so it is never a column.
  const rows = await transitions();

  return sendSuccess(res, {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      stages: rows.map(({ stage, previous }) => ({
        code: stage.code,
        name: stage.name,
        order: stage.order,
        isStartingStage: !previous,
      })),
      targets: rows.filter(({ previous }) => previous).map(({ stage }) => stage.code),
    },
  });
});

export default {
  listEligibility,
  getEligibility,
  saveDraft,
  validateDraft,
  publishRule,
  disableRule,
  previewEligibility,
  studentEligibilityOverview,
};
