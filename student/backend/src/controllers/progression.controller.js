import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { ProgressionEvent } from '../models/ProgressionEvent.js';
import { StudentAchievement } from '../models/StudentAchievement.js';
import { Achievement } from '../models/Achievement.js';
import { Subject } from '../models/Subject.js';
import { Stage } from '../models/Stage.js';
import { rebuildSnapshot } from '../services/progression/engine.service.js';

/**
 * The three-stage journey, with each stage's state for this student.
 *
 * States are derived, never stored: an enrolment plus a progress figure plus
 * the previous stage's eligibility verdict fully determine which of the four a
 * stage is in, and a stored state would be a fifth thing that could disagree
 * with the other four.
 *
 * LOCKED and ELIGIBLE are both "not enrolled" - the difference is whether the
 * student has earned the right to be, which is exactly what a student needs to
 * see to know whether to keep working or to go and enrol.
 */
async function buildJourney(userId, profile) {
  const { Stage } = await import('../models/Stage.js');
  const { Course } = await import('../models/Course.js');
  const { Enrollment } = await import('../models/Enrollment.js');

  const stages = await Stage.find({ enabled: true }).sort({ order: 1 }).lean();
  if (!stages.length) return [];

  const slugs = stages.map((s) => s.courseSlug).filter(Boolean);
  const courses = await Course.find({ slug: { $in: slugs } })
    .select('slug title subtitle tagline duration durationValue durationUnit priceInPaise isPurchasable')
    .lean();
  const courseBySlug = new Map(courses.map((c) => [c.slug, c]));

  const enrolments = await Enrollment.find({ userId, status: 'active' }).select('courseId startsAt endsAt progressPercent').lean();
  const enrolmentByCourse = new Map(enrolments.map((e) => [String(e.courseId), e]));

  const snapshot = profile.progression || {};
  const eligibilityFor = (code) => (snapshot.eligibility || []).find((e) => e.stageCode === code);

  return stages.map((stage, index) => {
    const course = stage.courseSlug ? courseBySlug.get(stage.courseSlug) : null;
    const enrolment = course ? enrolmentByCourse.get(String(course._id)) : null;
    const isCurrent = snapshot.currentStageCode === stage.code;
    const progress = isCurrent ? snapshot.stageProgress || 0 : enrolment ? enrolment.progressPercent || 0 : 0;

    const previous = index > 0 ? stages[index - 1] : null;
    const ownVerdict = eligibilityFor(stage.code);
    // Whether this stage may be entered is this stage's own verdict - the
    // published rule targeting it - not a property of the stage before.
    const mayEnter = previous ? Boolean(ownVerdict?.eligible) : true;

    let state;
    if (enrolment && progress >= 100) state = 'COMPLETED';
    else if (enrolment) state = 'ACTIVE';
    else if (mayEnter) state = 'ELIGIBLE';
    else state = 'LOCKED';

    return {
      code: stage.code,
      name: stage.name,
      tagline: stage.tagline,
      order: stage.order,
      state,
      progress,
      // The real duration, so the client can show it without parsing a label.
      duration: course ? { value: course.durationValue, unit: course.durationUnit, label: course.duration } : null,
      course: course
        ? { slug: course.slug, title: course.title, priceInPaise: course.priceInPaise, isPurchasable: course.isPurchasable }
        : null,
      enrolment: enrolment ? { startsAt: enrolment.startsAt, endsAt: enrolment.endsAt } : null,
      // Why a locked stage is locked, item by item. Read from THIS stage's
      // own verdict: the rule for GARUD describes what it takes to enter
      // GARUD, which is what a student looking at GARUD wants to know.
      requirements: eligibilityFor(stage.code)?.requirements || [],
      eligibilityStatus: eligibilityFor(stage.code)?.status || 'NOT_CONFIGURED',
      unlocksAfter: previous ? { code: previous.code, name: previous.name } : null,
    };
  });
}

/**
 * The student's own Digital Learner Profile.
 *
 * Read-only by construction. There is no endpoint anywhere that lets a client
 * set XP, a level, a rank, a skill score or an eligibility verdict - every one
 * of these is computed by the engine from recorded activity, and this route
 * only reports the result. That is the whole anti-tampering story: not a
 * validation rule that could be missed, but an absence of any route to misuse.
 *
 * Always scoped to `req.user._id`. A student id in the request is never read.
 */
export const getMyProgression = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  let profile = await StudentProfile.findOne({ userId });
  // A student who predates the engine, or who has not acted yet, still deserves
  // a coherent card rather than an empty one.
  if (!profile || !profile.progression?.recalculatedAt) {
    const rebuilt = await rebuildSnapshot(userId);
    profile = rebuilt.profile || profile;
  }
  if (!profile) return sendSuccess(res, { data: null, message: 'No learner profile yet.' });

  const [subjects, stages, unlocked, definitions] = await Promise.all([
    Subject.find({ enabled: true }).sort({ order: 1 }).lean(),
    Stage.find({ enabled: true }).sort({ order: 1 }).lean(),
    StudentAchievement.find({ userId }).sort({ unlockedAt: -1 }).lean(),
    Achievement.find({ enabled: true }).sort({ order: 1 }).lean(),
  ]);

  const p = profile.progression || {};
  const unlockedCodes = new Set(unlocked.map((a) => a.achievementCode));
  const subjectMeta = new Map(subjects.map((s) => [s.code, s]));

  const currentStage = stages.find((s) => s.code === p.currentStageCode) || null;
  const nextStage = currentStage?.nextStageCode ? stages.find((s) => s.code === currentStage.nextStageCode) : null;
  const nextEligibility = nextStage ? (p.eligibility || []).find((e) => e.stageCode === nextStage.code) : null;

  return sendSuccess(res, {
    data: {
      username: req.user.name,
      stage: currentStage
        ? { code: currentStage.code, name: currentStage.name, tagline: currentStage.tagline, progress: p.stageProgress || 0 }
        : null,

      level: profile.level || 1,
      rank: { code: p.rankCode || null, name: p.rankName || null },
      xp: { current: profile.xp || 0, intoLevel: p.currentLevelXP || 0, forNextLevel: p.nextLevelXP || 0 },

      // Joined to subject metadata here so the UI does not need a second call
      // to learn what ENGLISH is called or what colour to draw it.
      skills: (p.skills || []).map((s) => ({
        code: s.subjectCode,
        name: subjectMeta.get(s.subjectCode)?.name || s.subjectCode,
        icon: subjectMeta.get(s.subjectCode)?.icon || 'BookOpen',
        color: subjectMeta.get(s.subjectCode)?.color || '#22355E',
        score: s.score,
        activityCount: s.activityCount,
      })),

      scores: {
        attendance: p.attendanceScore || 0,
        knowledge: p.knowledgeScore || 0,
        consistency: p.consistencyScore || 0,
        overallPower: p.overallPower || 0,
      },

      attendance: { attended: p.classesAttended || 0, conducted: p.classesConducted || 0 },
      streak: { current: profile.streak?.current || 0, longest: profile.streak?.longest || 0 },

      stats: {
        lessonsCompleted: profile.stats?.lessonsCompleted || 0,
        quizzesCompleted: profile.stats?.quizzesCompleted || 0,
        tasksCompleted: profile.stats?.tasksCompleted || 0,
        achievementsUnlocked: unlocked.length,
      },

      // Locked achievements are returned too, so the student can see what there
      // is to aim at rather than only what they already have.
      achievements: definitions.map((def) => {
        const mine = unlocked.find((a) => a.achievementCode === def.code);
        return {
          code: def.code,
          name: def.name,
          description: def.description,
          icon: def.icon,
          unlocked: unlockedCodes.has(def.code),
          unlockedAt: mine?.unlockedAt || null,
        };
      }),

      nextStage: nextStage
        ? {
            code: nextStage.code,
            name: nextStage.name,
            tagline: nextStage.tagline,
            eligible: nextEligibility?.eligible || false,
            status: nextEligibility?.status || 'NOT_CONFIGURED',
            // Every requirement, met and unmet, so a locked stage explains
            // itself instead of just refusing.
            requirements: nextEligibility?.requirements || [],
          }
        : null,

      // The whole journey, so the dashboard can show where this student is in
      // it rather than only the stage they happen to be on.
      journey: await buildJourney(userId, profile),

      lastActivityAt: p.lastActivityAt || null,
    },
  });
});

/** The student's own activity timeline, newest first. */
export const getMyActivity = asyncHandler(async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const events = await ProgressionEvent.find({ userId: req.user._id })
    .sort({ occurredAt: -1 })
    .limit(limit)
    .lean();

  return sendSuccess(res, {
    data: events.map((e) => ({
      activityType: e.activityType,
      status: e.status,
      subjectCode: e.subjectCode,
      score: e.score,
      xpAwarded: e.xpAwarded,
      refId: e.refId,
      occurredAt: e.occurredAt,
    })),
  });
});

export default { getMyProgression, getMyActivity };
