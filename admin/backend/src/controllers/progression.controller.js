import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as studentBridge from '../services/studentCourseBridge.service.js';
import { recordAuditLog } from '../services/auditLog.service.js';

/**
 * The Nalanda Nexus progression control centre.
 *
 * Everything the engine consults - XP amounts, the level curve, rank
 * thresholds, skill and power weights, stage completion requirements,
 * achievement criteria - is edited here and nowhere else. The rules themselves
 * live with the engine that applies them, so this portal configures a single
 * definition rather than keeping a second copy that could drift.
 *
 * Every change is audit-logged with the acting administrator. A student
 * disputing their score needs an answer to "what were the rules when I earned
 * this, and who changed them", and that is only answerable if the change was
 * recorded at the moment it was made.
 */

export const getRules = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await studentBridge.getProgressionRules() });
});

export const updateRules = catchAsync(async (req, res) => {
  const saved = await studentBridge.updateProgressionRules({
    ...req.body,
    // Taken from the session, never the body - otherwise the record of who
    // changed a rule is whatever the caller typed.
    updatedByEmail: req.admin?.email || null,
  });

  await recordAuditLog({
    actor: req.admin,
    action: 'progression.rules.updated',
    entityType: 'ProgressionRules',
    entityId: 'GLOBAL',
    metadata: { sections: Object.keys(req.body || {}) },
    req,
  });

  sendSuccess(res, { message: 'Progression rules updated', data: saved });
});

export const updateStage = catchAsync(async (req, res) => {
  const saved = await studentBridge.updateStage(req.params.code, req.body);

  await recordAuditLog({
    actor: req.admin,
    action: 'progression.stage.updated',
    entityType: 'Stage',
    entityId: req.params.code,
    // The requirements are the part that decides who may buy the next course,
    // so they are recorded in full rather than as a field count.
    metadata: { requirements: req.body.requirements ?? null, enabled: req.body.enabled },
    req,
  });

  sendSuccess(res, { message: 'Stage updated', data: saved });
});

export const updateAchievement = catchAsync(async (req, res) => {
  const saved = await studentBridge.updateAchievement(req.params.code, req.body);

  await recordAuditLog({
    actor: req.admin,
    action: 'progression.achievement.updated',
    entityType: 'Achievement',
    entityId: req.params.code,
    metadata: { changes: req.body },
    req,
  });

  sendSuccess(res, { message: 'Achievement updated', data: saved });
});

/**
 * Rebuilds student snapshots from the event ledger.
 *
 * Separate from saving a rule on purpose: a rule change can move thousands of
 * scores, and an administrator should decide when that happens rather than
 * discovering it as a side effect of a form submission.
 */
export const recalculate = catchAsync(async (req, res) => {
  const result = await studentBridge.recalculateProgression(req.body || {});

  await recordAuditLog({
    actor: req.admin,
    action: 'progression.recalculated',
    entityType: 'StudentProfile',
    entityId: req.body?.userId || 'BATCH',
    metadata: result,
    req,
  });

  sendSuccess(res, { message: 'Recalculation complete', data: result });
});

/**
 * Brings the GARUD and YODDHA courses into existence.
 *
 * Dry run unless explicitly applied, and audit-logged when it is: creating a
 * course puts something in the public catalogue, which is a decision worth
 * being able to attribute later.
 */
export const setupJourney = catchAsync(async (req, res) => {
  const apply = req.body?.apply === true;
  const result = await studentBridge.setupJourney({ apply });

  if (apply) {
    await recordAuditLog({
      actor: req.admin,
      action: 'progression.journey.setup',
      entityType: 'Course',
      entityId: 'JOURNEY',
      metadata: { courses: result?.courses || [], links: result?.links || [] },
      req,
    });
  }

  sendSuccess(res, { message: apply ? 'Journey courses set up' : 'Dry run', data: result });
});

/**
 * Puts the GARUD and YODDHA curriculum into the database.
 *
 * Dry run unless explicitly applied, and audit-logged when it is. It adds and
 * never overwrites, so a second run leaves an administrator's edits alone - and
 * it writes no student data, because populating a course does not give anybody
 * access to it. The eligibility gate still decides that.
 */
export const seedCurriculum = catchAsync(async (req, res) => {
  const apply = req.body?.apply === true;
  const result = await studentBridge.seedCurriculum({ apply, only: req.body?.only || null });

  if (apply) {
    const decisions = (result?.courses || []).flatMap((c) => c.decisions || []);
    await recordAuditLog({
      actor: req.admin,
      action: 'progression.curriculum.seeded',
      entityType: 'Course',
      entityId: 'CURRICULUM',
      metadata: {
        only: req.body?.only || 'all',
        created: decisions.filter((d) => d.action === 'CREATE').length,
        unchanged: decisions.filter((d) => d.action === 'UNCHANGED').length,
        courses: (result?.courses || []).map((c) => c.slug),
      },
      req,
    });
  }

  sendSuccess(res, { message: apply ? 'Curriculum applied' : 'Dry run', data: result });
});

/** What is actually in the database for the journey courses. Read-only. */
export const auditCurriculum = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await studentBridge.auditCurriculum() });
});

// --- Stage eligibility -------------------------------------------------------

/**
 * The criteria that gate each stage.
 *
 * A draft is edited freely and decides nothing; publishing is the moment it
 * starts deciding who may progress. Only publish and disable are audited -
 * saving a draft changes nobody's standing, and logging every keystroke of a
 * work in progress would bury the entries that matter.
 */
export const listEligibility = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await studentBridge.listEligibility() });
});

export const getEligibility = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await studentBridge.getEligibility(req.params.stage) });
});

export const saveEligibilityDraft = catchAsync(async (req, res) => {
  const saved = await studentBridge.saveEligibilityDraft(req.params.stage, {
    ...req.body,
    // From the session, never the body - otherwise the record of who wrote a
    // rule is whatever the caller typed.
    updatedByEmail: req.admin?.email || null,
  });
  sendSuccess(res, { message: 'Draft saved', data: saved });
});

export const validateEligibility = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await studentBridge.validateEligibility(req.params.stage, req.body) });
});

export const publishEligibility = catchAsync(async (req, res) => {
  const result = await studentBridge.publishEligibility(req.params.stage, {
    publishedByEmail: req.admin?.email || null,
  });

  await recordAuditLog({
    actor: req.admin,
    action: 'eligibility.rules.published',
    entityType: 'StageEligibilityRule',
    entityId: req.params.stage,
    metadata: {
      targetStage: req.params.stage,
      previousStage: result?.rule?.previousStageCode || null,
      version: result?.rule?.version || null,
      // Published warnings are recorded too: an administrator who knowingly
      // required a subject the curriculum does not teach should be able to
      // point at the moment they were told.
      warnings: result?.warnings || [],
    },
    req,
  });

  sendSuccess(res, { message: 'Eligibility rule published', data: result });
});

export const disableEligibility = catchAsync(async (req, res) => {
  const result = await studentBridge.disableEligibility(req.params.stage);

  await recordAuditLog({
    actor: req.admin,
    action: 'eligibility.rules.disabled',
    entityType: 'StageEligibilityRule',
    entityId: req.params.stage,
    metadata: { targetStage: req.params.stage, version: result?.version || null },
    req,
  });

  sendSuccess(res, { message: 'Eligibility rule disabled', data: result });
});

/** Evaluates one real student. Read-only - previewing never alters them. */
export const previewEligibility = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await studentBridge.previewEligibility(req.body) });
});

export const studentEligibilityOverview = catchAsync(async (req, res) => {
  const { rows, meta } = await studentBridge.studentEligibilityOverview(req.query);
  sendSuccess(res, { data: rows, meta });
});

export const getAnalytics = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await studentBridge.getProgressionAnalytics() });
});

export default {
  getRules, updateRules, updateStage, updateAchievement, recalculate, setupJourney, getAnalytics,
  seedCurriculum, auditCurriculum,
  listEligibility, getEligibility, saveEligibilityDraft, validateEligibility,
  publishEligibility, disableEligibility, previewEligibility, studentEligibilityOverview,
};
