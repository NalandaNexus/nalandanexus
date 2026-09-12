import { Subject, UNASSIGNED_SUBJECT, PILLAR_DEFAULT_SUBJECT, DEFAULT_SUBJECTS } from '../../models/Subject.js';

/**
 * Which subject a piece of learning belongs to.
 *
 * Precedence, most specific first:
 *
 *   lesson/quiz/task subject  ->  module subject  ->  course pillar  ->  UNASSIGNED
 *
 * The course pillar is a DEFAULT and nothing more. It describes the broad
 * orientation of a course, which is a coarser thing than what an individual
 * lesson teaches - Prarambh is a `communicate` course that nonetheless has to
 * carry Computer and Cybersecurity material. Treating pillar as the permanent
 * skill identity would mean two of three skill scores could never leave zero.
 *
 * Falling through to UNASSIGNED is deliberate. Guessing a subject would quietly
 * credit the wrong skill, and a wrong number nobody can see is worse than a
 * visible gap an administrator can fix.
 */

let cache = null;
let cachedAt = 0;
const CACHE_MS = 60_000;

/** Enabled subject codes, briefly cached - this is read on every activity. */
export async function loadEnabledSubjectCodes({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cachedAt < CACHE_MS) return cache;
  const rows = await Subject.find({ enabled: true }).select('code').sort({ order: 1 }).lean();
  // Before the seed has run there is nothing in the collection; the launch set
  // keeps resolution working rather than sending every activity to UNASSIGNED.
  cache = rows.length ? rows.map((r) => r.code) : DEFAULT_SUBJECTS.map((s) => s.code);
  cachedAt = Date.now();
  return cache;
}

/** Drops the cache. Called when subjects are edited, and by tests. */
export function invalidateSubjectCache() {
  cache = null;
  cachedAt = 0;
}

const normalize = (value) => String(value ?? '').trim().toUpperCase() || null;

/**
 * Resolves the subject for one activity.
 *
 * Pure apart from the subject-code lookup, so it can be called per activity in
 * a loop without a query each time.
 */
export async function resolveSubject({ activitySubject, moduleSubject, coursePillar } = {}) {
  const enabled = await loadEnabledSubjectCodes();

  const explicit = normalize(activitySubject);
  if (explicit) {
    // An explicitly-set subject that is no longer enabled is reported as
    // unassigned rather than falling through to the module or the pillar:
    // somebody chose that value, and quietly overriding their choice hides the
    // problem. Disabling a subject would otherwise move every lesson still
    // tagged with it onto the pillar's skill - crediting, on a `communicate`
    // course like PRARAMBH, English for cybersecurity work. UNASSIGNED is
    // visible and counted for review; a wrong number nobody can see is not.
    return enabled.includes(explicit) ? explicit : UNASSIGNED_SUBJECT;
  }

  const fromModule = normalize(moduleSubject);
  if (fromModule && enabled.includes(fromModule)) return fromModule;

  const pillar = String(coursePillar ?? '').trim().toLowerCase();
  const fromPillar = PILLAR_DEFAULT_SUBJECT[pillar];
  if (fromPillar && enabled.includes(fromPillar)) return fromPillar;

  return UNASSIGNED_SUBJECT;
}

/**
 * Resolves the subject of a lesson inside a course document.
 *
 * Takes the whole course because the answer depends on three levels of it, and
 * callers otherwise end up re-implementing the walk.
 */
export async function resolveLessonSubject(course, lessonId) {
  for (const mod of course?.modules || []) {
    const lesson = (mod.lessons || []).find((l) => l.lessonId === lessonId);
    if (lesson) {
      return resolveSubject({
        activitySubject: lesson.subject,
        moduleSubject: mod.subject,
        coursePillar: course.pillar,
      });
    }
  }
  return resolveSubject({ coursePillar: course?.pillar });
}

/**
 * Counts activities whose subject cannot be determined.
 *
 * Feeds the administrator's "needs review" list - the promised counterpart to
 * letting resolution fall through instead of guessing.
 */
export async function countUnassignedActivities(Course) {
  const courses = await Course.find({ isPublished: true }).select('slug title pillar modules').lean();
  const unassigned = [];
  for (const course of courses) {
    for (const mod of course.modules || []) {
      for (const lesson of mod.lessons || []) {
        const subject = await resolveSubject({
          activitySubject: lesson.subject,
          moduleSubject: mod.subject,
          coursePillar: course.pillar,
        });
        if (subject === UNASSIGNED_SUBJECT) {
          unassigned.push({ courseSlug: course.slug, moduleId: mod.moduleId, lessonId: lesson.lessonId, title: lesson.title });
        }
      }
    }
  }
  return unassigned;
}

export default { resolveSubject, resolveLessonSubject, loadEnabledSubjectCodes, invalidateSubjectCache, countUnassignedActivities };
