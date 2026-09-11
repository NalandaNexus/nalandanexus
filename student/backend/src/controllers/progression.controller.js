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
            // Every requirement, met and unmet, so a locked stage explains
            // itself instead of just refusing.
            checks: nextEligibility?.checks || [],
          }
        : null,

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
