import mongoose from 'mongoose';
import { StudentProfile } from '../../models/StudentProfile.js';
import { ProgressionEvent } from '../../models/ProgressionEvent.js';
import { Achievement } from '../../models/Achievement.js';
import { StudentAchievement } from '../../models/StudentAchievement.js';
import { Stage } from '../../models/Stage.js';
import { Subject, UNASSIGNED_SUBJECT, DEFAULT_SUBJECTS } from '../../models/Subject.js';
import { Course } from '../../models/Course.js';
import { Enrollment } from '../../models/Enrollment.js';
import { LessonProgress } from '../../models/LessonProgress.js';
import { getRules, findXpRule } from './rules.service.js';
import { resolveSubject } from './subject.service.js';
import * as calc from './calculators.js';
import { awardXp } from '../xp.service.js';

/**
 * The progression engine.
 *
 * Two entry points, and the relationship between them is the whole design:
 *
 *   recordActivity()   - takes one thing a student did, decides what it is
 *                        worth, and refreshes their snapshot.
 *   rebuildSnapshot()  - recomputes the snapshot from the event ledger alone.
 *
 * Everything on a student's profile except their XP balance is DERIVED, and
 * `rebuildSnapshot` is the definition of how. That is what makes a half-failed
 * write survivable: the ledger is the truth, the snapshot is a cache of it, and
 * a snapshot that is wrong is repaired by the next activity or by an explicit
 * recalculation. Wrapping the two in a transaction would protect less than it
 * appears to - the ledger insert is the only step that must not be lost, and it
 * is a single atomic document write already.
 */

const SCORED_TYPES = {
  quiz: ['QUIZ_PASSED', 'QUIZ_FAILED', 'QUIZ_SUBMITTED'],
  task: ['ASSIGNMENT_PASSED', 'ASSIGNMENT_FAILED', 'ASSIGNMENT_SUBMITTED', 'ASSIGNMENT_REVIEWED'],
  assessment: ['ASSESSMENT_PASSED', 'ASSESSMENT_FAILED', 'ASSESSMENT_SUBMITTED'],
};

const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
const avg = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);

/**
 * Builds the key that decides whether this activity has already been counted.
 *
 * The award policy chooses the grain. FIRST_ONLY keys on the activity, so a
 * retake collides with the original and pays nothing. EVERY_TIME keys on the
 * attempt, so each genuine attempt is its own event and the daily cap is what
 * limits it. Getting this wrong in either direction is a real bug - too coarse
 * and legitimate work goes unrewarded, too fine and the activity can be farmed.
 */
export function buildEventKey({ userId, activityType, refId, policy, attemptId }) {
  const base = `${userId}:${activityType}:${refId ?? 'none'}`;
  if (policy === 'EVERY_TIME' || policy === 'BEST_IMPROVEMENT') return `${base}:${attemptId ?? Date.now()}`;
  return base;
}

/** How much XP this activity earns under the configured rule. */
function xpForActivity(rule, { score, status }) {
  if (!rule) return 0;
  if (rule.awardPolicy === 'PASSED_ONLY' && status !== 'PASSED') return 0;

  let xp = rule.baseXP || 0;
  if (rule.bonusXP && typeof score === 'number' && score >= (rule.highScoreThreshold ?? 90)) {
    xp += rule.bonusXP;
  }
  return Math.max(0, Math.round(xp));
}

/** XP already earned today for this activity type, for the daily cap. */
async function xpEarnedToday(userId, activityType) {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const rows = await ProgressionEvent.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(String(userId)), activityType, occurredAt: { $gte: since } } },
    { $group: { _id: null, total: { $sum: '$xpAwarded' } } },
  ]);
  return rows[0]?.total || 0;
}

/**
 * Records one activity and returns the refreshed profile.
 *
 * Safe to call twice with the same inputs: the second call loses the unique
 * insert, awards nothing, and returns the unchanged profile with
 * `duplicate: true`. Callers do not need their own guard.
 */
export async function recordActivity({
  userId,
  activityType,
  status,
  refId = null,
  courseId = null,
  subjectCode = null,
  stageCode = null,
  score = null,
  attemptId = null,
  source = 'student-portal',
  createdBy = null,
  occurredAt = new Date(),
}) {
  const rules = await getRules();
  const type = String(activityType).toUpperCase();

  const resolvedStage = stageCode || (await stageCodeForCourse(courseId));
  const rule = findXpRule(rules, { activityType: type, stageCode: resolvedStage, subjectCode });
  const policy = rule?.awardPolicy || 'FIRST_ONLY';

  const eventKey = buildEventKey({ userId, activityType: type, refId, policy, attemptId });

  let xp = xpForActivity(rule, { score, status });

  // Daily cap, checked before the insert so the recorded xpAwarded is the truth.
  if (xp > 0 && rule?.maxDailyXP > 0) {
    const already = await xpEarnedToday(userId, type);
    xp = Math.max(0, Math.min(xp, rule.maxDailyXP - already));
  }

  let event;
  try {
    event = await ProgressionEvent.create({
      userId,
      eventKey,
      activityType: type,
      courseId,
      stageCode: resolvedStage,
      subjectCode,
      refId,
      status,
      score,
      xpAwarded: xp,
      source,
      createdBy,
      occurredAt,
    });
  } catch (err) {
    // The unique index refusing the insert IS the duplicate check. A read-first
    // version lets two simultaneous submissions both find nothing and both pay.
    if (err?.code === 11000) {
      const profile = await StudentProfile.findOne({ userId });
      return { duplicate: true, xpAwarded: 0, profile, achievementsUnlocked: [] };
    }
    throw err;
  }

  if (xp > 0 && courseId) {
    // Reuses the platform's existing single XP mutation point, so the
    // course-scoped leaderboard and its live push keep working unchanged.
    await awardXp(userId, {
      amount: xp,
      source: xpSourceFor(type),
      refId,
      courseId,
      subjectCode,
      stageCode: resolvedStage,
      eventKey,
    });
  }

  const result = await rebuildSnapshot(userId);
  return { duplicate: false, xpAwarded: xp, event, ...result };
}

/** Maps a progression activity type onto XPEvent's own narrower source enum. */
function xpSourceFor(activityType) {
  if (activityType.startsWith('LECTURE')) return 'lesson';
  if (activityType.startsWith('QUIZ')) return 'quiz';
  if (activityType.startsWith('ASSIGNMENT')) return 'task';
  if (activityType.startsWith('ASSESSMENT')) return 'assessment';
  if (activityType.startsWith('CLASS')) return 'attendance';
  if (activityType.startsWith('STREAK')) return 'streak_bonus';
  return 'achievement';
}

/** The stage a course belongs to, or null if it is not part of the journey. */
async function stageCodeForCourse(courseId) {
  if (!courseId) return null;
  const course = await Course.findById(courseId).select('slug').lean();
  if (!course) return null;
  const stage = await Stage.findOne({ courseSlug: course.slug, enabled: true }).select('code').lean();
  return stage?.code || null;
}

/**
 * How many published lessons exist per subject, across the student's courses.
 *
 * The denominator for lesson-based skill progress, resolved through the same
 * precedence as the events themselves - otherwise a student could complete
 * every English lesson and still not reach 100%.
 *
 * Deliberately reflects the syllabus AS IT IS NOW, while the numerator comes
 * from what the student actually did. So reclassifying a lesson out of English
 * does move existing English percentages: the remaining English syllabus is
 * genuinely smaller, and a student who finished what is left has finished it.
 *
 * That is a different thing from rewriting history, which does not happen - the
 * ProgressionEvent keeps the subject it was credited under and no XP is
 * restated. What shifts is a ratio against a changed denominator, which is the
 * honest answer to "how much of this subject have you covered".
 */
async function lessonsAvailableBySubject(courseIds) {
  const courses = await Course.find({ _id: { $in: courseIds } }).select('pillar modules').lean();
  const counts = new Map();
  for (const course of courses) {
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
  }
  return counts;
}

/**
 * Recomputes every derived number for one student from the event ledger.
 *
 * The only writer of `profile.progression`. Called after each activity and by
 * the admin recalculation path, which is what makes a stale or damaged snapshot
 * a recoverable condition rather than a permanent one.
 */
export async function rebuildSnapshot(userId) {
  const rules = await getRules();
  const profile = await StudentProfile.findOne({ userId });
  if (!profile) return { profile: null, achievementsUnlocked: [] };

  const [events, enrollments, subjects, stages] = await Promise.all([
    ProgressionEvent.find({ userId }).sort({ occurredAt: 1 }).lean(),
    Enrollment.find({ userId, status: 'active' }).select('courseId').lean(),
    Subject.find({ enabled: true }).sort({ order: 1 }).lean(),
    Stage.find({ enabled: true }).sort({ order: 1 }).lean(),
  ]);

  const subjectCodes = (subjects.length ? subjects : DEFAULT_SUBJECTS).map((s) => s.code);
  const courseIds = enrollments.map((e) => e.courseId).filter(Boolean);
  const availableBySubject = await lessonsAvailableBySubject(courseIds);

  // --- per-subject skill scores ---------------------------------------------
  const skills = subjectCodes.map((code) => {
    const mine = events.filter((e) => e.subjectCode === code);
    const scored = (types) => mine.filter((e) => types.includes(e.activityType) && typeof e.score === 'number').map((e) => e.score);

    const quiz = scored(SCORED_TYPES.quiz);
    const task = scored(SCORED_TYPES.task);
    const assessment = scored(SCORED_TYPES.assessment);
    const lessonsCompleted = mine.filter((e) => e.activityType === 'LECTURE_COMPLETED').length;
    const lessonsAvailable = availableBySubject.get(code) || 0;

    const score = calc.skillScore(
      {
        lessonCompletionPercent: lessonsAvailable ? (lessonsCompleted / lessonsAvailable) * 100 : 0,
        lessonsAvailable,
        quizAverage: avg(quiz),
        quizCount: quiz.length,
        taskAverage: avg(task),
        taskCount: task.length,
        assessmentAverage: avg(assessment),
        assessmentCount: assessment.length,
      },
      rules.skillWeights
    );

    return {
      subjectCode: code,
      score,
      lessonsCompleted,
      quizAverage: Math.round(avg(quiz)),
      taskAverage: Math.round(avg(task)),
      assessmentAverage: Math.round(avg(assessment)),
      activityCount: mine.length,
    };
  });

  // --- knowledge, across every subject at once -------------------------------
  const allScored = (types) => events.filter((e) => types.includes(e.activityType) && typeof e.score === 'number').map((e) => e.score);
  const kQuiz = allScored(SCORED_TYPES.quiz);
  const kTask = allScored(SCORED_TYPES.task);
  const kAssessment = allScored(SCORED_TYPES.assessment);
  const knowledge = calc.knowledgeScore(
    {
      quizAverage: avg(kQuiz),
      quizCount: kQuiz.length,
      taskAverage: avg(kTask),
      taskCount: kTask.length,
      assessmentAverage: avg(kAssessment),
      assessmentCount: kAssessment.length,
    },
    rules.knowledgeWeights
  );

  // --- attendance, from the events the teacher service pushes ----------------
  //
  // A teacher correcting a mark appends a new event rather than editing the old
  // one, so a session can carry several. The latest wins, and both remain
  // visible - which is what lets a disputed record be explained rather than
  // just overwritten.
  const attendanceBySession = new Map();
  // Ordered by when the mark was RECORDED, not by the session date - both marks
  // for one session share a date, so `occurredAt` cannot separate an original
  // from its correction. `createdAt` can, and is what "latest" has to mean here.
  const recordedAt = (e) => new Date(e.createdAt || e.occurredAt).getTime();
  for (const e of events) {
    if (e.activityType !== 'CLASS_ATTENDED' && e.activityType !== 'CLASS_MISSED') continue;
    const key = e.refId || String(e._id);
    const seen = attendanceBySession.get(key);
    if (!seen || recordedAt(e) >= recordedAt(seen)) attendanceBySession.set(key, e);
  }
  const latestMarks = [...attendanceBySession.values()];
  const present = latestMarks.filter((e) => e.status === 'ATTENDED').length;
  const late = latestMarks.filter((e) => e.status === 'LATE').length;
  const missed = latestMarks.filter((e) => e.status === 'MISSED').length;
  const attendance = calc.attendanceScore({ present, late, total: present + late + missed }, rules.attendance);

  // --- consistency, from when activity actually happened ---------------------
  const windowDays = rules.consistency?.windowDays ?? 30;
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const activeDays = new Set(events.filter((e) => new Date(e.occurredAt).getTime() >= cutoff).map((e) => dayKey(e.occurredAt)));
  const consistency = calc.consistencyScore(
    { currentStreak: profile.streak?.current || 0, activeDaysInWindow: activeDays.size },
    rules.consistency
  );

  // --- one number for all of it ---------------------------------------------
  const overallPower = calc.overallPower(
    { skills, attendance, knowledge, consistency },
    rules.overallPower
  );

  const { level, currentLevelXP, nextLevelXP } = calc.levelForXp(profile.xp, rules.levels);
  const rank = calc.rankFor({ level, overallPower }, rules.ranks);

  // --- stage --------------------------------------------------------------
  const currentStage = await resolveCurrentStage(userId, stages, enrollments);
  const stageLessons = await stageLessonCounts(userId, currentStage, courseIds);
  const stageProgressPercent = calc.stageProgress(stageLessons);

  profile.level = level;
  profile.progression = {
    ...(profile.progression?.toObject ? profile.progression.toObject() : profile.progression || {}),
    currentStageCode: currentStage?.code || null,
    currentStageName: currentStage ? `${currentStage.name} — ${currentStage.tagline}` : null,
    rankCode: rank.code,
    rankName: rank.name,
    currentLevelXP,
    nextLevelXP,
    skills,
    attendanceScore: attendance.score,
    knowledgeScore: knowledge,
    consistencyScore: consistency,
    overallPower,
    classesConducted: attendance.conducted,
    classesAttended: attendance.attended,
    stageProgress: stageProgressPercent,
    lastActivityAt: events.length ? events[events.length - 1].occurredAt : null,
    recalculatedAt: new Date(),
  };
  await profile.save();

  // Achievements are evaluated against the snapshot just written, so a criterion
  // about overall power sees the value the student actually has now.
  const unlocked = await evaluateAchievements(userId, profile, { events, subjectCodes });

  // Unlocking can award XP, which moves level and power - so the eligibility
  // verdict is computed from a profile re-read after that.
  const fresh = unlocked.length ? await StudentProfile.findOne({ userId }) : profile;
  fresh.progression.achievementsUnlocked = await StudentAchievement.countDocuments({ userId });
  fresh.progression.eligibility = await evaluateEligibility(userId, fresh, stages, {
    ...stageLessons,
    // The current stage's progress, keyed so a rule about the PREVIOUS stage
    // can read it whichever stage the student is standing on.
    progressByStage: { [currentStage?.code || '']: stageProgressPercent },
  });
  await fresh.save();

  return { profile: fresh, achievementsUnlocked: unlocked };
}

/** The stage the student is currently working through. */
async function resolveCurrentStage(userId, stages, enrollments) {
  if (!stages.length) return null;
  const courseIds = enrollments.map((e) => String(e.courseId));
  const courses = await Course.find({ _id: { $in: courseIds } }).select('slug').lean();
  const slugs = new Set(courses.map((c) => c.slug));

  // The furthest stage the student is actually enrolled in; failing that, the
  // first stage, so a brand-new account has somewhere to stand.
  const enrolled = stages.filter((s) => s.courseSlug && slugs.has(s.courseSlug));
  if (enrolled.length) return enrolled[enrolled.length - 1];
  return stages[0] || null;
}

/** Lessons completed and available for the stage's own course. */
async function stageLessonCounts(userId, stage, courseIds) {
  if (!stage?.courseSlug) return { lessonsCompleted: 0, lessonsAvailable: 0 };
  const course = await Course.findOne({ slug: stage.courseSlug }).select('_id modules').lean();
  if (!course) return { lessonsCompleted: 0, lessonsAvailable: 0 };

  const lessonsAvailable = (course.modules || []).reduce(
    (n, m) => n + (m.lessons || []).filter((l) => l.isPublished !== false).length,
    0
  );
  const lessonsCompleted = await LessonProgress.countDocuments({ userId, courseId: course._id, completed: true });
  return { lessonsCompleted, lessonsAvailable };
}

/**
 * Checks every achievement criterion against the current snapshot.
 *
 * Re-evaluated in full after each activity rather than incrementally: criteria
 * are cheap to test, and an incremental version would miss an achievement whose
 * threshold was lowered after the student had already passed it.
 */
export async function evaluateAchievements(userId, profile, { events, subjectCodes }) {
  const definitions = await Achievement.find({ enabled: true }).sort({ order: 1 }).lean();
  if (!definitions.length) return [];

  const held = new Set((await StudentAchievement.find({ userId }).select('achievementCode').lean()).map((a) => a.achievementCode));
  const snapshot = profile.progression || {};
  const skillFor = (code) => (snapshot.skills || []).find((s) => s.subjectCode === code)?.score ?? 0;

  const unlocked = [];
  for (const def of definitions) {
    if (held.has(def.code)) continue;
    if (!meetsCriterion(def, { snapshot, profile, events, subjectCodes, skillFor })) continue;

    try {
      await StudentAchievement.create({
        userId,
        achievementCode: def.code,
        name: def.name,
        description: def.description,
        icon: def.icon,
        subjectCode: def.subjectCode,
        xpAwarded: def.xpReward || 0,
      });
    } catch (err) {
      // Unlock-once is the unique index; a concurrent evaluation losing here is
      // the correct outcome, not an error.
      if (err?.code === 11000) continue;
      throw err;
    }

    if (def.xpReward > 0) {
      const courseId = events.find((e) => e.courseId)?.courseId;
      if (courseId) {
        await awardXp(userId, {
          amount: def.xpReward,
          source: 'achievement',
          refId: def.code,
          courseId,
          subjectCode: def.subjectCode,
          eventKey: `${userId}:ACHIEVEMENT:${def.code}`,
        });
      }
    }
    unlocked.push({ code: def.code, name: def.name, description: def.description, icon: def.icon, xpAwarded: def.xpReward || 0 });
  }
  return unlocked;
}

function meetsCriterion(def, { snapshot, profile, events, subjectCodes, skillFor }) {
  switch (def.criteriaType) {
    case 'SUBJECT_SCORE':
      return def.subjectCode ? skillFor(def.subjectCode) >= def.criteriaValue : false;
    case 'ALL_SUBJECTS_SCORE':
      return subjectCodes.length > 0 && subjectCodes.every((code) => skillFor(code) >= def.criteriaValue);
    case 'STREAK_DAYS':
      return (profile.streak?.current || 0) >= def.criteriaValue;
    case 'ACTIVITY_COUNT':
      return events.filter((e) => !def.activityType || e.activityType === def.activityType).length >= def.criteriaValue;
    case 'PERFECT_SCORE':
      return events.some((e) => typeof e.score === 'number' && e.score >= def.criteriaValue);
    case 'LEVEL_REACHED':
      return (profile.level || 1) >= def.criteriaValue;
    case 'OVERALL_POWER':
      return (snapshot.overallPower || 0) >= def.criteriaValue;
    case 'STAGE_COMPLETED':
      return (
        snapshot.currentStageCode === def.stageCode &&
        (snapshot.stageProgress || 0) >= 100
      );
    default:
      return false;
  }
}

/**
 * Works out, per stage, whether the student may move on - and if not, why.
 *
 * The criteria come from the PUBLISHED eligibility rule for each transition,
 * built by an administrator. A transition with no published rule is reported as
 * NOT_CONFIGURED and is not passable: silence is not consent, and inventing
 * thresholds would be worse than saying nobody has set any.
 *
 * Read-only. Evaluating eligibility awards no XP, unlocks no achievement and
 * moves no score - which is what makes it safe to run on every snapshot rebuild
 * and in an administrator's preview against a real student.
 */
export async function evaluateEligibility(userId, profile, stages, stageLessons) {
  const { getPublishedRule, evaluateStageEligibility, buildEvaluationContext, buildStudentContext } = await import(
    './eligibility.service.js'
  );

  const ordered = [...stages].sort((a, b) => a.order - b.order);
  const snapshot = profile.progression || {};

  const [referenceContext, studentContext] = await Promise.all([
    buildEvaluationContext(),
    buildStudentContext(userId, await courseIdForStage(ordered.find((s) => s.code === snapshot.currentStageCode))),
  ]);
  const context = { ...referenceContext, ...studentContext };

  const results = [];
  for (const [index, stage] of ordered.entries()) {
    const previous = index > 0 ? ordered[index - 1] : null;

    // The first stage has nothing before it, so there is nothing to evaluate -
    // it is where everyone starts.
    if (!previous) {
      results.push({ stageCode: stage.code, eligible: true, status: 'STARTING_STAGE', version: null, requirements: [], evaluatedAt: new Date() });
      continue;
    }

    const rule = await getPublishedRule(stage.code);
    const verdict = await evaluateStageEligibility({
      profile,
      previousStage: {
        code: previous.code,
        name: previous.name,
        // How far through the stage being left the student actually is.
        progress: previous.code === snapshot.currentStageCode ? snapshot.stageProgress || 0 : stageLessons?.progressByStage?.[previous.code] ?? 0,
      },
      targetStageCode: stage.code,
      rule,
      context,
    });

    results.push({
      stageCode: stage.code,
      eligible: verdict.eligible,
      status: verdict.status,
      version: verdict.version,
      requirements: verdict.requirements,
      evaluatedAt: new Date(),
    });
  }
  return results;
}

/** The course a stage teaches, used to scope activity-based metrics. */
async function courseIdForStage(stage) {
  if (!stage?.courseSlug) return null;
  const course = await Course.findOne({ slug: stage.courseSlug }).select('_id').lean();
  return course?._id || null;
}

/** Admin-triggered full rebuild. Students can never reach this. */
export async function recalculateStudent(userId) {
  return rebuildSnapshot(userId);
}

export default { recordActivity, rebuildSnapshot, recalculateStudent, evaluateEligibility, buildEventKey };
