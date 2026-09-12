import { Stage } from '../../models/Stage.js';
import { StudentProfile } from '../../models/StudentProfile.js';
import { AppError } from '../../utils/AppError.js';
import { rebuildSnapshot } from './engine.service.js';

/**
 * Whether a student may take up a stage of the journey.
 *
 * Creating the GARUD and YODDHA courses does not make them available. A course
 * existing and a student being allowed to have it are separate facts, and this
 * is the only place the second one is decided - so a direct API call, a guessed
 * URL or a frontend that renders the button anyway all arrive here and get the
 * same answer.
 *
 * Checked at the point of ENROLMENT rather than at the point of reading
 * content. Content is already gated by requireEnrollment, which means a student
 * who was never allowed to enrol can never reach the material either; putting
 * the stage check here as well would re-run an eligibility evaluation on every
 * lesson load for no additional safety.
 */

/** Duration in a form dates can be computed from, or null when the course has none. */
export function enrollmentWindow(course, from = new Date()) {
  const value = course?.durationValue;
  const unit = course?.durationUnit;
  if (!value || !unit) return { startsAt: from, endsAt: null };

  const endsAt = new Date(from);
  if (unit === 'DAYS') endsAt.setUTCDate(endsAt.getUTCDate() + value);
  else if (unit === 'WEEKS') endsAt.setUTCDate(endsAt.getUTCDate() + value * 7);
  else if (unit === 'MONTHS') endsAt.setUTCMonth(endsAt.getUTCMonth() + value);
  else if (unit === 'YEARS') endsAt.setUTCFullYear(endsAt.getUTCFullYear() + value);
  else return { startsAt: from, endsAt: null };

  return { startsAt: from, endsAt };
}

/**
 * The stage a course belongs to, or null if it is an ordinary course.
 *
 * Courses outside the journey are unaffected by any of this - they enrol the
 * way they always did.
 */
export async function stageForCourse(course) {
  if (!course?.slug) return null;
  return Stage.findOne({ courseSlug: course.slug, enabled: true }).lean();
}

/**
 * Decides whether this student may enrol in this course, and says why not.
 *
 * The first stage of the journey is always open - it is where everyone starts.
 * Every later one requires the stage before it to have been completed to the
 * administrator's configured standard, which is the verdict the progression
 * engine already produces.
 *
 * The snapshot is rebuilt before the decision rather than read as it stands.
 * This runs once per enrolment, and an authorization decision made from a stale
 * cache is a decision that can be wrong in the direction that matters.
 */
export async function evaluateStageAccess(userId, course) {
  const stage = await stageForCourse(course);
  if (!stage) return { allowed: true, reason: 'NOT_A_STAGE_COURSE', stage: null };

  const stages = await Stage.find({ enabled: true }).sort({ order: 1 }).lean();
  const first = stages[0];
  if (!first || stage.code === first.code) {
    return { allowed: true, reason: 'FIRST_STAGE', stage };
  }

  const previous = [...stages].reverse().find((s) => s.order < stage.order);
  if (!previous) return { allowed: true, reason: 'NO_PRIOR_STAGE', stage };

  await rebuildSnapshot(userId);
  const profile = await StudentProfile.findOne({ userId }).lean();
  // This stage's own verdict - produced by the published rule that targets it.
  const verdict = (profile?.progression?.eligibility || []).find((e) => e.stageCode === stage.code);

  if (verdict?.eligible) {
    return { allowed: true, reason: 'ELIGIBLE', stage, previousStage: previous };
  }

  return {
    allowed: false,
    // An unconfigured transition is refused for a different reason than an
    // unmet one, and the message a student sees should say which.
    reason: verdict?.status === 'NOT_CONFIGURED' ? 'NOT_CONFIGURED' : 'REQUIREMENTS_NOT_MET',
    stage,
    previousStage: previous,
    status: verdict?.status || 'NOT_CONFIGURED',
    unmet: (verdict?.requirements || []).filter((r) => !r.passed),
    requirements: verdict?.requirements || [],
  };
}

/** Throws unless the student may enrol. Used by every path that creates an enrolment. */
export async function assertStageAccessible(userId, course) {
  const result = await evaluateStageAccess(userId, course);
  if (result.allowed) return result;

  if (result.reason === 'NOT_CONFIGURED') {
    throw AppError.forbidden(
      `${result.stage.name} is not open yet - its entry requirements have not been published.`,
      'STAGE_NOT_CONFIGURED'
    );
  }

  const outstanding = result.unmet.map((r) =>
    r.status === 'DATA_REQUIRED'
      ? `${r.name} (no data yet)`
      : `${r.name} (${Math.round(r.actual ?? 0)}/${Math.round(r.required)}${r.unit || ''})`
  );
  throw AppError.forbidden(
    outstanding.length
      ? `${result.stage.name} unlocks when you meet its requirements. Still needed: ${outstanding.join(', ')}.`
      : `${result.stage.name} is not unlocked yet.`,
    'STAGE_LOCKED'
  );
}

export default { evaluateStageAccess, assertStageAccessible, stageForCourse, enrollmentWindow };
