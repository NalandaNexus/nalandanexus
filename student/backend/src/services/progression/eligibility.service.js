import {
  StageEligibilityRule,
  METRICS,
  NUMERIC_OPERATORS,
  EXISTENCE_OPERATORS,
  OPERATOR_SYMBOL,
} from '../../models/StageEligibilityRule.js';

/**
 * The eligibility engine.
 *
 * Takes a student's progress snapshot and the PUBLISHED rule for a transition,
 * and returns a verdict plus a line per requirement. It reads; it never writes.
 * Evaluating eligibility must not award XP, touch achievements or move a score -
 * a student refreshing a page should not be able to change their own standing,
 * and an administrator previewing a rule against a real student must not alter
 * that student.
 *
 * Two absences are treated as deliberately different things:
 *
 *   no published rule    -> NOT_CONFIGURED, not eligible. Silence is not consent;
 *                           inventing criteria would be worse.
 *   no attendance data   -> DATA_REQUIRED, not eligible, actual null. A student
 *                           with no recorded classes has not attended 0% of
 *                           them, and telling them so would be a lie.
 */

const compare = (actual, operator, value) => {
  switch (operator) {
    case 'GTE': return actual >= value;
    case 'GT': return actual > value;
    case 'EQ': return actual === value;
    case 'LTE': return actual <= value;
    case 'LT': return actual < value;
    default: return false;
  }
};

/** The published rule for a transition, or null when none has been published. */
export async function getPublishedRule(targetStageCode) {
  return StageEligibilityRule.findOne({ targetStageCode: String(targetStageCode).toUpperCase(), status: 'PUBLISHED' }).lean();
}

/**
 * Reads one metric off the progress snapshot.
 *
 * Returns `{ actual, available }`. `available: false` means the platform has no
 * authoritative figure - distinct from a figure that happens to be zero, and the
 * reason a requirement can come back DATA_REQUIRED rather than simply failed.
 */
function readMetric(requirement, context) {
  const { snapshot, profile, previousStage, achievements, activity } = context;
  const skillFor = (code) => (snapshot.skills || []).find((s) => s.subjectCode === code);

  switch (requirement.metric) {
    case 'PREVIOUS_STAGE_COMPLETION':
      // The progress a student has made through the stage they are leaving.
      return { actual: previousStage?.progress ?? 0, available: true };

    case 'XP':
      return { actual: profile.xp || 0, available: true };

    case 'KNOWLEDGE':
      return { actual: snapshot.knowledgeScore || 0, available: true };

    case 'CONSISTENCY':
      return { actual: snapshot.consistencyScore || 0, available: true };

    case 'OVERALL_POWER':
      return { actual: snapshot.overallPower || 0, available: true };

    case 'SUBJECT_SCORE': {
      const skill = skillFor(requirement.subjectCode);
      // A subject with no activity has no score yet. Reported as zero rather
      // than unavailable: the student genuinely has not done any of it, which
      // is a real answer, and the curriculum warning covers the case where
      // there is nothing for them to do.
      return { actual: skill?.score ?? 0, available: true };
    }

    case 'ATTENDANCE':
      // The one metric where "no data" is common and meaningful.
      if (!snapshot.classesConducted) return { actual: null, available: false };
      return { actual: snapshot.attendanceScore || 0, available: true };

    case 'COURSE_COMPLETION':
    case 'LESSON_COMPLETION':
      return { actual: previousStage?.progress ?? 0, available: true };

    case 'ASSIGNMENT_COMPLETION':
      return { actual: activity.assignmentCompletion, available: activity.assignmentsAvailable > 0 };

    case 'QUIZ_SCORE':
      return { actual: activity.quizAverage, available: activity.quizCount > 0 };

    case 'FINAL_ASSESSMENT':
      return { actual: activity.assessmentBest, available: activity.assessmentCount > 0 };

    case 'ACHIEVEMENT': {
      const held = achievements.has(requirement.achievementCode);
      return { actual: held ? 1 : 0, available: true, held };
    }

    default:
      return { actual: null, available: false };
  }
}

/** Evaluates one requirement into a line the UI can render verbatim. */
function evaluateRequirement(requirement, context) {
  const definition = METRICS[requirement.metric];
  const { actual, available, held } = readMetric(requirement, context);

  const base = {
    key: requirement.key,
    metric: requirement.metric,
    name: labelFor(requirement, context),
    operator: OPERATOR_SYMBOL[requirement.operator] || requirement.operator,
    required: requirement.value,
    actual,
    unit: definition?.unit ?? '',
  };

  if (!available) {
    // Not a failure the student caused, and worth saying so separately so the
    // UI can show "attendance data required" rather than "you failed".
    return { ...base, passed: false, status: 'DATA_REQUIRED' };
  }

  if (EXISTENCE_OPERATORS.includes(requirement.operator)) {
    const passed = requirement.operator === 'IS' ? Boolean(held) : !held;
    return { ...base, required: 1, actual: held ? 1 : 0, passed, status: passed ? 'PASSED' : 'FAILED' };
  }

  const passed = compare(actual, requirement.operator, requirement.value);
  return { ...base, passed, status: passed ? 'PASSED' : 'FAILED' };
}

function labelFor(requirement, context) {
  if (requirement.metric === 'SUBJECT_SCORE') {
    return context.subjectNames.get(requirement.subjectCode) || requirement.subjectCode || 'Subject';
  }
  if (requirement.metric === 'ACHIEVEMENT') {
    return context.achievementNames.get(requirement.achievementCode) || requirement.achievementCode || 'Achievement';
  }
  if (requirement.metric === 'PREVIOUS_STAGE_COMPLETION') {
    return `${context.previousStage?.name || 'Previous stage'} completion`;
  }
  return METRICS[requirement.metric]?.label || requirement.metric;
}

/** Evaluates one group, honouring its ALL/ANY logic. */
function evaluateGroup(group, context) {
  const active = (group.requirements || []).filter((r) => r.enabled !== false);
  const results = active.map((r) => evaluateRequirement(r, context));

  // An empty group is not "vacuously satisfied". Treating it as passed would
  // mean clearing a group silently opens the gate.
  const satisfied = results.length > 0 && (group.logic === 'ANY' ? results.some((r) => r.passed) : results.every((r) => r.passed));

  return { logic: group.logic, label: group.label || '', satisfied, requirements: results };
}

/**
 * The full verdict for one transition.
 *
 * Deterministic and side-effect free: called with the same snapshot and the same
 * rule it returns the same answer, and it writes nothing anywhere.
 */
export async function evaluateStageEligibility({ profile, previousStage, targetStageCode, rule, context }) {
  const snapshot = profile.progression || {};

  if (!rule) {
    return {
      targetStage: targetStageCode,
      eligible: false,
      status: 'NOT_CONFIGURED',
      version: null,
      groups: [],
      requirements: [],
      missingRequirements: [],
      message: 'Eligibility criteria have not been published for this stage yet.',
    };
  }

  const evalContext = { ...context, snapshot, profile, previousStage };
  const groups = [rule.rootGroup, ...(rule.groups || [])].filter(Boolean).map((g) => evaluateGroup(g, evalContext));

  const allRequirements = groups.flatMap((g) => g.requirements);
  // Every group must be satisfied; the logic inside each decides how.
  const eligible = groups.length > 0 && groups.every((g) => g.satisfied);

  return {
    targetStage: targetStageCode,
    previousStage: rule.previousStageCode,
    eligible,
    status: eligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE',
    version: rule.version,
    groups,
    requirements: allRequirements,
    missingRequirements: allRequirements.filter((r) => !r.passed),
  };
}

/**
 * Facts the evaluator needs that are not on the snapshot.
 *
 * Gathered once and passed in, so evaluating a page of students costs one pass
 * over the reference data rather than one per student.
 */
export async function buildEvaluationContext() {
  const { Subject } = await import('../../models/Subject.js');
  const { Achievement } = await import('../../models/Achievement.js');

  const [subjects, achievements] = await Promise.all([
    Subject.find({}).select('code name').lean(),
    Achievement.find({}).select('code name').lean(),
  ]);

  return {
    subjectNames: new Map(subjects.map((s) => [s.code, s.name])),
    achievementNames: new Map(achievements.map((a) => [a.code, a.name])),
  };
}

/** Per-student facts the snapshot does not carry. */
export async function buildStudentContext(userId, previousStageCourseId) {
  const { StudentAchievement } = await import('../../models/StudentAchievement.js');
  const { ProgressionEvent } = await import('../../models/ProgressionEvent.js');
  const { Task } = await import('../../models/Task.js');

  const [held, events, assignmentsAvailable] = await Promise.all([
    StudentAchievement.find({ userId }).select('achievementCode').lean(),
    ProgressionEvent.find({ userId }).select('activityType status score refId').lean(),
    previousStageCourseId ? Task.countDocuments({ courseId: previousStageCourseId }) : 0,
  ]);

  const scored = (types) => events.filter((e) => types.includes(e.activityType) && typeof e.score === 'number').map((e) => e.score);
  const quiz = scored(['QUIZ_PASSED', 'QUIZ_FAILED', 'QUIZ_SUBMITTED']);
  const assessment = scored(['ASSESSMENT_PASSED', 'ASSESSMENT_FAILED', 'ASSESSMENT_SUBMITTED']);
  const assignmentsDone = new Set(
    events.filter((e) => e.activityType.startsWith('ASSIGNMENT') && e.refId).map((e) => e.refId)
  ).size;

  return {
    achievements: new Set(held.map((a) => a.achievementCode)),
    activity: {
      quizCount: quiz.length,
      quizAverage: quiz.length ? Math.round(quiz.reduce((a, b) => a + b, 0) / quiz.length) : 0,
      assessmentCount: assessment.length,
      // Best rather than mean: a final assessment is a bar to clear, and a
      // strong second attempt should not be dragged down by a weak first.
      assessmentBest: assessment.length ? Math.max(...assessment) : 0,
      assignmentsAvailable,
      assignmentCompletion: assignmentsAvailable > 0 ? Math.round((assignmentsDone / assignmentsAvailable) * 100) : 0,
    },
  };
}

// --- Configuration validation ----------------------------------------------

/**
 * Checks a rule before it can be published.
 *
 * Errors block publishing; warnings do not. The distinction matters most for
 * the curriculum check: requiring a Cybersecurity score is a legitimate thing to
 * want, and also something no student can currently satisfy if the prerequisite
 * stage teaches no Cybersecurity. That is the administrator's call to make
 * knowingly, not one to be silently prevented from making - or, worse, to make
 * unknowingly.
 */
export async function validateRule(rule, { previousStageCourseId } = {}) {
  const { Stage } = await import('../../models/Stage.js');
  const { Subject } = await import('../../models/Subject.js');
  const { Achievement } = await import('../../models/Achievement.js');

  const errors = [];
  const warnings = [];

  const [target, previous, subjects, achievements] = await Promise.all([
    Stage.findOne({ code: rule.targetStageCode }).lean(),
    Stage.findOne({ code: rule.previousStageCode }).lean(),
    Subject.find({ enabled: true }).select('code name').lean(),
    Achievement.find({}).select('code name').lean(),
  ]);

  if (!target) errors.push(`Target stage ${rule.targetStageCode} does not exist.`);
  if (!previous) errors.push(`Previous stage ${rule.previousStageCode} does not exist.`);
  if (target && previous && previous.order >= target.order) {
    errors.push(`${rule.previousStageCode} does not come before ${rule.targetStageCode}.`);
  }

  const subjectCodes = new Set(subjects.map((s) => s.code));
  const achievementCodes = new Set(achievements.map((a) => a.code));

  const groups = [rule.rootGroup, ...(rule.groups || [])].filter(Boolean);
  const active = groups.flatMap((g) => (g.requirements || []).filter((r) => r.enabled !== false));

  if (!active.length) {
    errors.push('A rule needs at least one enabled requirement. Publishing an empty rule would leave the stage permanently locked.');
  }

  // An empty group is refused at publish time rather than left for the
  // evaluator to interpret. The evaluator treats it as unsatisfied - the safe
  // direction - but a half-filled group reaching production at all means an
  // administrator locked everyone out by adding a group and not filling it in.
  for (const [index, group] of groups.entries()) {
    const enabled = (group.requirements || []).filter((r) => r.enabled !== false);
    if (!enabled.length) {
      errors.push(
        index === 0
          ? 'The main requirement group is empty.'
          : `Group ${index} ("${group.label || group.logic}") has no enabled requirements. Remove it or add one.`
      );
    }
  }

  for (const r of active) {
    const definition = METRICS[r.metric];
    if (!definition) {
      errors.push(`Unknown metric "${r.metric}".`);
      continue;
    }
    if (!definition.operators.includes(r.operator)) {
      errors.push(`${definition.label} cannot use the operator "${r.operator}".`);
    }
    if (definition.needs === 'subjectCode' && !subjectCodes.has(r.subjectCode)) {
      errors.push(`${definition.label} refers to a subject that does not exist or is disabled: "${r.subjectCode}".`);
    }
    if (definition.needs === 'achievementCode' && !achievementCodes.has(r.achievementCode)) {
      errors.push(`Achievement "${r.achievementCode}" does not exist.`);
    }
    if (NUMERIC_OPERATORS.includes(r.operator)) {
      if (!Number.isFinite(r.value)) errors.push(`${definition.label} needs a numeric value.`);
      else if (r.value < 0) errors.push(`${definition.label} cannot be negative.`);
      else if (definition.max && r.value > definition.max) {
        errors.push(`${definition.label} cannot exceed ${definition.max}${definition.unit}.`);
      }
    }
  }

  // Curriculum reachability: a subject requirement nobody can satisfy because
  // the prerequisite stage teaches none of it.
  const subjectRequirements = active.filter((r) => r.metric === 'SUBJECT_SCORE' && subjectCodes.has(r.subjectCode) && r.value > 0);
  if (subjectRequirements.length && previousStageCourseId) {
    const contributing = await countContributingActivities(previousStageCourseId);
    for (const r of subjectRequirements) {
      if (!contributing.get(r.subjectCode)) {
        const name = subjects.find((s) => s.code === r.subjectCode)?.name || r.subjectCode;
        warnings.push(
          `This rule requires ${name} ${OPERATOR_SYMBOL[r.operator]} ${r.value}%, but ${rule.previousStageCode} currently has no ` +
            `${name} activities contributing to the progression score. Students may be unable to satisfy it. ` +
            'Review curriculum tagging before publishing.'
        );
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/** How many published activities in a course resolve to each subject. */
async function countContributingActivities(courseId) {
  const { Course } = await import('../../models/Course.js');
  const { resolveSubject } = await import('./subject.service.js');

  const course = await Course.findById(courseId).select('pillar modules').lean();
  const counts = new Map();
  if (!course) return counts;

  for (const mod of course.modules || []) {
    for (const lesson of mod.lessons || []) {
      if (lesson.isPublished === false) continue;
      const subject = await resolveSubject({
        activitySubject: lesson.subject,
        moduleSubject: mod.subject,
        coursePillar: course.pillar,
      });
      counts.set(subject, (counts.get(subject) || 0) + 1);
    }
  }
  return counts;
}

export default {
  evaluateStageEligibility,
  getPublishedRule,
  buildEvaluationContext,
  buildStudentContext,
  validateRule,
};
