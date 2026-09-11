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

export const getAnalytics = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await studentBridge.getProgressionAnalytics() });
});

export default { getRules, updateRules, updateStage, updateAchievement, recalculate, getAnalytics };
