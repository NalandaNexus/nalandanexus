import { Course } from '../models/Course.js';
import { LessonProgress } from '../models/LessonProgress.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { stripHtml } from '../utils/sanitize.js';

/**
 * Module and lesson structure: the one place a course's modules and lessons
 * are renamed, reordered, added, edited or removed.
 *
 * Courses live only here, inside Course.modules[] (and their lessons[]) -
 * exactly like lessonVideo.service.js's video subfield and the subject tag in
 * internal.controller.js, this is a third, independent write path into the
 * same documents. Admin may manage any course; the teacher portal forwards a
 * request here only once its own CourseAccess record says the signed-in
 * teacher is assigned to it (see teacher/backend's courseAccess.service.js).
 *
 * Every write names an `actor` and is guarded by `expectedUpdatedAt`, the
 * same optimistic-concurrency pattern lessonVideo.service.js uses: two edits
 * to the same video cannot silently overwrite each other, and neither can two
 * edits to the same module or lesson's structure.
 *
 * What this never touches: LessonProgress, TaskSubmission, QuizAttempt,
 * Enrollment. Renaming a lesson or adding one does not change whether anyone
 * has completed it. Removing a lesson is refused outright once real student
 * progress exists against it (see removeLesson) - unpublishing is the real
 * alternative, not a suggestion with no teeth.
 */

function shapeActor(actor) {
  return {
    portal: actor?.portal === 'teacher' ? 'teacher' : 'admin',
    userId: actor?.userId ? String(actor.userId).slice(0, 64) : null,
    name: actor?.name ? String(actor.name).slice(0, 120) : null,
  };
}

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return stripHtml(value.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')).slice(0, max);
}

function shapeUpdatedBy(updatedBy) {
  return updatedBy?.portal ? { portal: updatedBy.portal, name: updatedBy.name || null } : null;
}

// --- id generation -----------------------------------------------------------

/*
 * Module and lesson ids are stable, human-legible strings, not ObjectIds, and a
 * lesson id has to be unique across EVERY course: LessonProgress is unique on
 * { userId, lessonId } and lessons are looked up by id alone when a student
 * completes one (course.controller.js). The courses already use different
 * schemes - PRARAMBH runs l-1..l-13, GARUD and YODDHA use garud-m01-l01 - so
 * continuing "l-N" from one course's own ids gave GARUD's first new lesson the
 * id "l-1", which is a PRARAMBH lesson.
 *
 * New ids therefore carry their course's slug ("garud-l-1", "garud-m-1") and are
 * checked against every course, and a lesson id also against recorded progress,
 * so an id is never reused even after the lesson that had it was removed.
 */
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function newContentId(course, kind) {
  const prefix = `${course.slug}-${kind}-`;
  const re = new RegExp(`^${escapeRegex(prefix)}(\\d+)$`);
  const ownIds = kind === 'l' ? allLessonIds(course) : allModuleIds(course);
  let n = 0;
  for (const id of ownIds) {
    const m = re.exec(String(id || ''));
    if (m) n = Math.max(n, Number(m[1]));
  }
  const field = kind === 'l' ? 'modules.lessons.lessonId' : 'modules.moduleId';
  for (let tries = 0; tries < 1000; tries += 1) {
    n += 1;
    const candidate = `${prefix}${n}`;
    // eslint-disable-next-line no-await-in-loop
    const taken = (await Course.exists({ [field]: candidate })) || (kind === 'l' && (await LessonProgress.exists({ lessonId: candidate })));
    if (!taken) return candidate;
  }
  throw AppError.conflict('Could not allocate a new id; please try again.', 'ID_ALLOCATION_FAILED');
}
const allModuleIds = (course) => (course.modules || []).map((m) => m.moduleId);
const allLessonIds = (course) => (course.modules || []).flatMap((m) => (m.lessons || []).map((l) => l.lessonId));

// --- reads ---------------------------------------------------------------

/** Full editable structure, including drafts and manual lock overrides. Never sent to students. */
export async function getCourseStructure(slug) {
  const course = await Course.findOne({ slug }).select('slug title updatedAt progressionGatingEnabled modules').lean();
  if (!course) throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');

  return {
    slug: course.slug,
    title: course.title,
    // The course document's own timestamp (distinct from any one module's or
    // lesson's) - an editor changing progressionGatingEnabled round-trips this
    // value back as expectedUpdatedAt, the same way a module/lesson editor
    // round-trips theirs. Without it here, updateCourseSettings's own guard
    // would have nothing for a caller to actually pass.
    updatedAt: course.updatedAt || null,
    progressionGatingEnabled: course.progressionGatingEnabled !== false,
    modules: [...(course.modules || [])]
      .sort((a, b) => a.order - b.order)
      .map((m) => ({
        moduleId: m.moduleId,
        title: m.title,
        order: m.order,
        description: m.description || '',
        gatingEnabled: m.gatingEnabled ?? null, // null = inherit the course setting
        lessonCount: (m.lessons || []).length,
        updatedAt: m.updatedAt || null,
        updatedBy: shapeUpdatedBy(m.updatedBy),
        lessons: [...(m.lessons || [])]
          .sort((a, b) => a.order - b.order)
          .map((l) => ({
            lessonId: l.lessonId,
            title: l.title,
            order: l.order,
            duration: l.duration || '',
            summary: l.summary || '',
            content: l.content || '',
            isPublished: l.isPublished !== false,
            isLocked: Boolean(l.isLocked),
            hasVideo: Boolean(l.video?.videoId) || Boolean(l.videoUrl),
            updatedAt: l.updatedAt || null,
            updatedBy: shapeUpdatedBy(l.updatedBy),
          })),
      })),
  };
}

// --- targeting + concurrency (mirrors lessonVideo.service.js) --------------

async function locate(slug, target) {
  const course = await Course.findOne({ slug }).select('_id slug updatedAt modules').lean();
  if (!course) throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');
  const mod = (course.modules || []).find((m) => m.moduleId === target.moduleId);
  if (!mod) throw AppError.notFound('Module not found in this course', 'MODULE_NOT_FOUND');
  if (target.lessonId) {
    const lesson = (mod.lessons || []).find((l) => l.lessonId === target.lessonId);
    if (!lesson) throw AppError.notFound('Lesson not found in this module', 'LESSON_NOT_FOUND');
    return { course, mod, lesson };
  }
  return { course, mod, lesson: null };
}

/**
 * expectedUpdatedAt: undefined = don't check; null = "had no prior edit";
 * else the ISO timestamp the editor loaded.
 *
 * Unlike `video` on a lesson (a whole subdocument whose schema default is
 * `undefined`, so an untouched lesson has no `video` key at all), `updatedAt`
 * here is a plain Date field on `lessonSchema`/`moduleSchema` with
 * `default: null` - Mongoose materializes that default into every module and
 * lesson subdocument it creates, so the field is always PRESENT with value
 * `null`, never absent. `{ $exists: false }` only matches a genuinely missing
 * key, so it would never match any real lesson/module and the "no prior
 * edit" case would 409 as a false conflict on literally the first edit of
 * anything. `{ updatedAt: null }` is the right filter: in MongoDB it matches
 * both an explicit null and a missing field, which is what "never edited"
 * actually means here.
 */
function guardFilter(courseId, moduleId, lessonId, expectedUpdatedAt) {
  if (expectedUpdatedAt === undefined) return { _id: courseId };
  const cond = expectedUpdatedAt === null ? { updatedAt: null } : { updatedAt: new Date(expectedUpdatedAt) };
  if (!lessonId) return { _id: courseId, modules: { $elemMatch: { moduleId, ...cond } } };
  return { _id: courseId, modules: { $elemMatch: { moduleId, lessons: { $elemMatch: { lessonId, ...cond } } } } };
}

async function conflictError(slug, target, label) {
  const { mod, lesson } = await locate(slug, target);
  const node = lesson || mod;
  const who = node.updatedBy?.name ? ` by ${node.updatedBy.name}` : '';
  const code = label === 'module' ? 'MODULE_CHANGED' : 'LESSON_CHANGED';
  return new AppError(
    `This ${label} was changed${who} since you opened it. Reload to see the current version before saving.`,
    409,
    code,
    { current: { ...node, updatedBy: shapeUpdatedBy(node.updatedBy) } }
  );
}

async function notifyStudents(courseId, slug) {
  try {
    // Lazy import, as every other caller of the socket layer does, so this
    // service never drags it into a context that has none (scripts, tests).
    const { emitToCourse } = await import('../sockets/index.js');
    emitToCourse(courseId, 'course:content_updated', { courseId: String(courseId), slug });
  } catch {
    // Optional - students also refetch on their next visit to the page.
  }
}

// --- course-level settings --------------------------------------------------

export async function updateCourseSettings(slug, input, actor) {
  const course = await Course.findOne({ slug }).select('_id updatedAt progressionGatingEnabled').lean();
  if (!course) throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');

  // Course.updatedAt comes from this schema's own {timestamps: true}, so
  // (unlike a lesson/module's updatedAt) it is never actually null for a
  // saved course - `new Date(null)` would otherwise silently resolve to the
  // Unix epoch and match nothing for the wrong reason. A literal `null` here
  // has no real "never edited" counterpart to match, so it is treated the
  // same way: a filter that correctly never matches a real course.
  const filter =
    input.expectedUpdatedAt === undefined
      ? { _id: course._id }
      : { _id: course._id, updatedAt: input.expectedUpdatedAt === null ? null : new Date(input.expectedUpdatedAt) };
  const result = await Course.updateOne(filter, { $set: { progressionGatingEnabled: Boolean(input.progressionGatingEnabled) } });
  if (!result.matchedCount) {
    const current = await Course.findOne({ _id: course._id }).select('updatedAt progressionGatingEnabled').lean();
    throw new AppError("This course's settings were changed since you opened them. Reload to see the current version.", 409, 'COURSE_CHANGED', {
      current,
    });
  }
  logger.info(`[courseStructure] ${actor?.portal}:${actor?.userId || '?'} set ${slug} progressionGatingEnabled=${Boolean(input.progressionGatingEnabled)}`);
  return getCourseStructure(slug);
}

// --- modules -----------------------------------------------------------------

export async function addModule(slug, input, actor) {
  const course = await Course.findOne({ slug }).select('_id slug modules.moduleId modules.order').lean();
  if (!course) throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');

  const moduleId = await newContentId(course, 'm');
  const order = Number.isFinite(input.order) ? input.order : (course.modules || []).length + 1;
  const now = new Date();
  const newModule = {
    moduleId,
    title: cleanText(input.title, 200) || 'Untitled module',
    order,
    description: cleanText(input.description, 2000),
    gatingEnabled: typeof input.gatingEnabled === 'boolean' ? input.gatingEnabled : null,
    lessons: [],
    updatedAt: now,
    updatedBy: shapeActor(actor),
  };
  // The id is free when chosen; the filter keeps it that way if another add won the race.
  const pushed = await Course.updateOne({ _id: course._id, 'modules.moduleId': { $ne: moduleId } }, { $push: { modules: newModule } });
  if (!pushed.modifiedCount) throw AppError.conflict('Someone added a module at the same moment. Please try again.', 'ID_TAKEN');
  logger.info(`[courseStructure] ${actor?.portal}:${actor?.userId || '?'} added module ${moduleId} to ${slug}`);
  await notifyStudents(course._id, slug);
  return getCourseStructure(slug);
}

export async function updateModule(slug, moduleId, input, actor) {
  const { course } = await locate(slug, { moduleId });
  const set = { 'modules.$[m].updatedAt': new Date(), 'modules.$[m].updatedBy': shapeActor(actor) };
  if (input.title !== undefined) set['modules.$[m].title'] = cleanText(input.title, 200) || 'Untitled module';
  if (input.description !== undefined) set['modules.$[m].description'] = cleanText(input.description, 2000);
  if (input.gatingEnabled !== undefined) set['modules.$[m].gatingEnabled'] = input.gatingEnabled === null ? null : Boolean(input.gatingEnabled);

  const filter = guardFilter(course._id, moduleId, null, input.expectedUpdatedAt);
  const result = await Course.updateOne(filter, { $set: set }, { arrayFilters: [{ 'm.moduleId': moduleId }] });
  if (!result.matchedCount) throw await conflictError(slug, { moduleId }, 'module');

  logger.info(`[courseStructure] ${actor?.portal}:${actor?.userId || '?'} updated module ${moduleId} on ${slug}`);
  await notifyStudents(course._id, slug);
  return getCourseStructure(slug);
}

/** Re-numbers every module's `order` to match the posted sequence. Refuses a list that doesn't name exactly the course's current modules. */
export async function reorderModules(slug, orderedModuleIds, actor) {
  const course = await Course.findOne({ slug }).select('_id modules.moduleId').lean();
  if (!course) throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');

  const existing = allModuleIds(course);
  if (existing.length !== orderedModuleIds.length || !existing.every((id) => orderedModuleIds.includes(id))) {
    throw AppError.badRequest("The submitted order must list exactly this course's existing modules, no more and no fewer.", 'MODULE_ORDER_MISMATCH');
  }

  await Course.bulkWrite(
    orderedModuleIds.map((moduleId, idx) => ({
      updateOne: { filter: { _id: course._id }, update: { $set: { 'modules.$[m].order': idx + 1 } }, arrayFilters: [{ 'm.moduleId': moduleId }] },
    }))
  );
  logger.info(`[courseStructure] ${actor?.portal}:${actor?.userId || '?'} reordered modules on ${slug}`);
  await notifyStudents(course._id, slug);
  return getCourseStructure(slug);
}

// --- lessons -------------------------------------------------------------

export async function addLesson(slug, moduleId, input, actor) {
  const { course, mod } = await locate(slug, { moduleId });
  const lessonId = await newContentId(course, 'l');
  const order = Number.isFinite(input.order) ? input.order : (mod.lessons || []).length + 1;
  const now = new Date();
  const newLesson = {
    lessonId,
    title: cleanText(input.title, 200) || 'Untitled lesson',
    duration: cleanText(input.duration, 40),
    order,
    summary: cleanText(input.summary, 500),
    content: cleanText(input.content, 20000),
    isPublished: input.isPublished !== false,
    isLocked: false,
    updatedAt: now,
    updatedBy: shapeActor(actor),
  };
  const pushed = await Course.updateOne(
    { _id: course._id, 'modules.lessons.lessonId': { $ne: lessonId } },
    { $push: { 'modules.$[m].lessons': newLesson } },
    { arrayFilters: [{ 'm.moduleId': moduleId }] }
  );
  if (!pushed.modifiedCount) throw AppError.conflict('Someone added a lesson at the same moment. Please try again.', 'ID_TAKEN');
  logger.info(`[courseStructure] ${actor?.portal}:${actor?.userId || '?'} added lesson ${lessonId} to ${slug}/${moduleId}`);
  await notifyStudents(course._id, slug);
  return getCourseStructure(slug);
}

export async function updateLesson(slug, moduleId, lessonId, input, actor) {
  const { course } = await locate(slug, { moduleId, lessonId });
  const set = { 'modules.$[m].lessons.$[l].updatedAt': new Date(), 'modules.$[m].lessons.$[l].updatedBy': shapeActor(actor) };
  if (input.title !== undefined) set['modules.$[m].lessons.$[l].title'] = cleanText(input.title, 200) || 'Untitled lesson';
  if (input.summary !== undefined) set['modules.$[m].lessons.$[l].summary'] = cleanText(input.summary, 500);
  if (input.content !== undefined) set['modules.$[m].lessons.$[l].content'] = cleanText(input.content, 20000);
  if (input.duration !== undefined) set['modules.$[m].lessons.$[l].duration'] = cleanText(input.duration, 40);
  if (input.isPublished !== undefined) set['modules.$[m].lessons.$[l].isPublished'] = Boolean(input.isPublished);

  const filter = guardFilter(course._id, moduleId, lessonId, input.expectedUpdatedAt);
  const result = await Course.updateOne(filter, { $set: set }, { arrayFilters: [{ 'm.moduleId': moduleId }, { 'l.lessonId': lessonId }] });
  if (!result.matchedCount) throw await conflictError(slug, { moduleId, lessonId }, 'lesson');

  logger.info(`[courseStructure] ${actor?.portal}:${actor?.userId || '?'} updated lesson ${lessonId} on ${slug}/${moduleId}`);
  await notifyStudents(course._id, slug);
  return getCourseStructure(slug);
}

/** Re-numbers `order` for every lesson within one module, same no-more-no-fewer rule as reorderModules. */
export async function reorderLessons(slug, moduleId, orderedLessonIds, actor) {
  const { course, mod } = await locate(slug, { moduleId });
  const existing = (mod.lessons || []).map((l) => l.lessonId);
  if (existing.length !== orderedLessonIds.length || !existing.every((id) => orderedLessonIds.includes(id))) {
    throw AppError.badRequest("The submitted order must list exactly this module's existing lessons, no more and no fewer.", 'LESSON_ORDER_MISMATCH');
  }

  await Course.bulkWrite(
    orderedLessonIds.map((lessonId, idx) => ({
      updateOne: {
        filter: { _id: course._id },
        update: { $set: { 'modules.$[m].lessons.$[l].order': idx + 1 } },
        arrayFilters: [{ 'm.moduleId': moduleId }, { 'l.lessonId': lessonId }],
      },
    }))
  );
  logger.info(`[courseStructure] ${actor?.portal}:${actor?.userId || '?'} reordered lessons in ${slug}/${moduleId}`);
  await notifyStudents(course._id, slug);
  return getCourseStructure(slug);
}

/**
 * Removes a lesson outright, but only while no student has ever opened or
 * completed it. A real LessonProgress row means real history - unpublishing
 * (updateLesson with isPublished:false) hides it from students while keeping
 * that history intact; deleting it would not.
 */
export async function removeLesson(slug, moduleId, lessonId, actor) {
  const { course } = await locate(slug, { moduleId, lessonId });
  const progressCount = await LessonProgress.countDocuments({ courseId: course._id, lessonId });
  if (progressCount > 0) {
    throw new AppError(
      `${progressCount} student${progressCount === 1 ? ' has' : 's have'} already opened or completed this lesson, so it can't be deleted. ` +
        'Turn off "Published" instead to hide it from students while keeping their history intact.',
      409,
      'LESSON_HAS_PROGRESS',
      { progressCount }
    );
  }

  await Course.updateOne({ _id: course._id }, { $pull: { 'modules.$[m].lessons': { lessonId } } }, { arrayFilters: [{ 'm.moduleId': moduleId }] });
  logger.info(`[courseStructure] ${actor?.portal}:${actor?.userId || '?'} removed lesson ${lessonId} from ${slug}/${moduleId}`);
  await notifyStudents(course._id, slug);
  return { removed: true };
}

export default {
  getCourseStructure,
  updateCourseSettings,
  addModule,
  updateModule,
  reorderModules,
  addLesson,
  updateLesson,
  reorderLessons,
  removeLesson,
};
