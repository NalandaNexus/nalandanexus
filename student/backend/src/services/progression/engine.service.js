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
 * This is the denominator for lesson-based skill progress, and it has to be
 * resolved through the same precedence as the events themselves - otherwise a
 * student could complete every English lesson and still not reach 100%.
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
  const attended = events.filter((e) => e.activityType === 'CLASS_ATTENDED');
  const present = attended.filter((e) => e.status === 'ATTENDED').length;
  const missed = events.filter((e) => e.activityType === 'CLASS_MISSED').length;
  const attendance = calc.attendanceScore({ present, late: 0, total: present + missed }, rules.attendance);

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
  fresh.progression.eligibility = await evaluateEligibility(userId, fresh, stages, stageLessons);
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
 * Returns every check with its required and actual value, met or not. The
 * student screen renders that list directly, which is the difference between
 * "GARUD is locked" and "your Cybersecurity score is 61, you need 70".
 *
 * Only the stage AFTER the student's current one is meaningful to evaluate, but
 * all are returned so an administrator can see the whole ladder.
 */
export async function evaluateEligibility(userId, profile, stages, stageLessons) {
  const snapshot = profile.progression || {};
  const skillFor = (code) => (snapshot.skills || []).find((s) => s.subjectCode === code)?.score ?? 0;
  const unlockedCodes = new Set(
    (await StudentAchievement.find({ userId }).select('achievementCode').lean()).map((a) => a.achievementCode)
  );

  const results = [];
  for (const stage of stages) {
    const req = stage.requirements || {};
    const checks = [];
    const add = (key, label, required, actual) =>
      checks.push({ key, label, required, actual, met: actual >= required });

    if (req.minStageProgress > 0) add('stageProgress', 'Stage progress', req.minStageProgress, snapshot.stageProgress || 0);
    if (req.minXP > 0) add('xp', 'Total XP', req.minXP, profile.xp || 0);
    if (req.minAttendance > 0) add('attendance', 'Attendance', req.minAttendance, snapshot.attendanceScore || 0);
    if (req.minKnowledge > 0) add('knowledge', 'Knowledge score', req.minKnowledge, snapshot.knowledgeScore || 0);
    if (req.minConsistency > 0) add('consistency', 'Consistency', req.minConsistency, snapshot.consistencyScore || 0);
    if (req.minOverallPower > 0) add('overallPower', 'Overall power', req.minOverallPower, snapshot.overallPower || 0);

    for (const s of req.subjects || []) {
      if (!s.required) continue;
      add(`subject:${s.subjectCode}`, `${s.subjectCode} score`, s.minScore, skillFor(s.subjectCode));
    }

    for (const code of req.requiredAchievements || []) {
      checks.push({ key: `achievement:${code}`, label: `Achievement: ${code}`, required: 1, actual: unlockedCodes.has(code) ? 1 : 0, met: unlockedCodes.has(code) });
    }

    if (req.requireAllLessons && stageLessons?.lessonsAvailable > 0) {
      add('lessons', 'Lessons completed', stageLessons.lessonsAvailable, stageLessons.lessonsCompleted);
    }

    results.push({
      stageCode: stage.code,
      // A stage with no configured requirements is not "automatically passed" -
      // it is unevaluated, and treating that as eligible would hand out the next
      // stage for free the moment an administrator cleared a field.
      eligible: checks.length > 0 && checks.every((c) => c.met),
      checks,
      evaluatedAt: new Date(),
    });
  }
  return results;
}

/** Admin-triggered full rebuild. Students can never reach this. */
export async function recalculateStudent(userId) {
  return rebuildSnapshot(userId);
}

export default { recordActivity, rebuildSnapshot, recalculateStudent, evaluateEligibility, buildEventKey };
