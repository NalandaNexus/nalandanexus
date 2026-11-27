import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { bootTestApp, registerAndLogin, bearer } from './helpers/testApp.js';

/**
 * Module and lesson structure, end to end inside the student service: the
 * service-key bridge the Admin and Teacher portals write through, and the
 * enrolled student's own view of the result.
 *
 * The properties that matter most are the ones a careless implementation
 * would break without any visible error: editing one module or lesson must
 * never touch another; a draft lesson (whether added as one or edited into
 * one) must never reach a student; two editors racing on the same module or
 * lesson must find out instead of silently overwriting each other -
 * including on the very FIRST edit of something nobody has ever touched,
 * which is exactly the case a guard that confuses "null" with "absent" gets
 * wrong; and a lesson real students have already opened must block deletion
 * outright rather than quietly erasing their history.
 */

const KEY = { 'X-Internal-Service-Key': 'test_internal_key' };

let ctx;
let request;
let student;

before(async () => {
  ctx = await bootTestApp();
  request = ctx.request;
  const { Course } = await import('../src/models/Course.js');
  const { Enrollment } = await import('../src/models/Enrollment.js');

  await Course.create({
    slug: 'prarambh',
    title: 'PRARAMBH',
    priceInPaise: 0,
    isPublished: true,
    pillar: 'communicate',
    modules: [
      {
        moduleId: 'mod-1',
        title: 'Awakening',
        order: 1,
        lessons: [
          { lessonId: 'l-1', title: 'Welcome', order: 1, summary: 'Hello', content: 'Read me' },
          { lessonId: 'l-2', title: 'Archetypes', order: 2 },
        ],
      },
      {
        moduleId: 'mod-2',
        title: 'Mindset',
        order: 2,
        lessons: [{ lessonId: 'l-3', title: 'Self-doubt', order: 1 }],
      },
    ],
  });
  const course = await Course.findOne({ slug: 'prarambh' });

  student = await registerAndLogin(request, { name: 'Structure Student', email: `structure.${Date.now()}@example.com`, completeProfile: true });
  await Enrollment.create({ userId: student.user.id || student.user._id, courseId: course._id, status: 'active', enrollmentId: 'ENR-2026-990101' });
});

after(async () => {
  await ctx.teardown();
});

const get = (slug) => request.get(`/api/internal/course-structure/courses/${slug}`).set(KEY);
const patchCourse = (slug, body) => request.patch(`/api/internal/course-structure/courses/${slug}`).set(KEY).send(body);
const postModule = (slug, body) => request.post(`/api/internal/course-structure/courses/${slug}/modules`).set(KEY).send(body);
const patchModule = (slug, moduleId, body) =>
  request.patch(`/api/internal/course-structure/courses/${slug}/modules/${moduleId}`).set(KEY).send(body);
const putModuleOrder = (slug, body) => request.put(`/api/internal/course-structure/courses/${slug}/modules/order`).set(KEY).send(body);
const postLesson = (slug, moduleId, body) =>
  request.post(`/api/internal/course-structure/courses/${slug}/modules/${moduleId}/lessons`).set(KEY).send(body);
const patchLesson = (slug, moduleId, lessonId, body) =>
  request.patch(`/api/internal/course-structure/courses/${slug}/modules/${moduleId}/lessons/${lessonId}`).set(KEY).send(body);
const putLessonOrder = (slug, moduleId, body) =>
  request.put(`/api/internal/course-structure/courses/${slug}/modules/${moduleId}/lessons/order`).set(KEY).send(body);
const delLesson = (slug, moduleId, lessonId, body = {}) =>
  request.delete(`/api/internal/course-structure/courses/${slug}/modules/${moduleId}/lessons/${lessonId}`).set(KEY).send(body);

const studentContent = async () => {
  const res = await request.get('/api/student/courses/prarambh/content').set(bearer(student.accessToken));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.data;
};
const lessonIdsOf = (content) => content.modules.flatMap((m) => m.lessons).map((l) => l.lessonId);
const moduleOf = (body, moduleId) => body.data.modules.find((m) => m.moduleId === moduleId);
const lessonOf = (body, moduleId, lessonId) => moduleOf(body, moduleId).lessons.find((l) => l.lessonId === lessonId);

test('the bridge refuses calls without the service key', async () => {
  assert.equal((await request.get('/api/internal/course-structure/courses/prarambh')).status, 401);
  assert.equal((await request.patch('/api/internal/course-structure/courses/prarambh').send({ progressionGatingEnabled: false })).status, 401);
});

test('an unknown course, module or lesson is a 404 with the specific code', async () => {
  const noCourse = await get('nope');
  assert.equal(noCourse.status, 404);
  assert.equal(noCourse.body.error.code, 'COURSE_NOT_FOUND');

  const noModule = await patchModule('prarambh', 'mod-404', { title: 'x' });
  assert.equal(noModule.status, 404);
  assert.equal(noModule.body.error.code, 'MODULE_NOT_FOUND');

  const noLesson = await patchLesson('prarambh', 'mod-1', 'l-404', { title: 'x' });
  assert.equal(noLesson.status, 404);
  assert.equal(noLesson.body.error.code, 'LESSON_NOT_FOUND');
});

test('the full structure lists every module and lesson, with no update history yet', async () => {
  const res = await get('prarambh');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const data = res.body.data;
  assert.equal(data.slug, 'prarambh');
  assert.equal(data.progressionGatingEnabled, true, 'schema default');
  assert.ok(data.updatedAt, 'a saved course always has a real timestamp, from {timestamps:true}');
  assert.deepEqual(data.modules.map((m) => m.moduleId), ['mod-1', 'mod-2']);

  const mod1 = moduleOf(res.body, 'mod-1');
  assert.equal(mod1.lessonCount, 2);
  assert.equal(mod1.updatedAt, null, 'never edited yet');
  assert.equal(mod1.gatingEnabled, null, 'inherits the course setting');
  assert.deepEqual(mod1.lessons.map((l) => l.lessonId), ['l-1', 'l-2']);
  assert.equal(mod1.lessons[0].isPublished, true);
  assert.equal(mod1.lessons[0].updatedAt, null);
});

test('updating course settings persists, and the very first edit is not mistaken for a conflict', async () => {
  // The course has never been edited through this endpoint before. A guard
  // that treats "null" as "the field must be entirely absent" would wrongly
  // 409 here even though nothing has ever actually changed.
  const prior = (await get('prarambh')).body.data;

  const res = await patchCourse('prarambh', { progressionGatingEnabled: false, expectedUpdatedAt: prior.updatedAt });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.progressionGatingEnabled, false);

  const stale = await patchCourse('prarambh', { progressionGatingEnabled: true, expectedUpdatedAt: prior.updatedAt });
  assert.equal(stale.status, 409, JSON.stringify(stale.body));
  assert.equal(stale.body.error.code, 'COURSE_CHANGED');

  const reloaded = (await get('prarambh')).body.data;
  assert.notEqual(reloaded.updatedAt, prior.updatedAt, 'the successful write really did advance the timestamp');
  const again = await patchCourse('prarambh', { progressionGatingEnabled: true, expectedUpdatedAt: reloaded.updatedAt });
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.equal(again.body.data.progressionGatingEnabled, true);
});

test('malformed input is rejected by validation before it reaches the service', async () => {
  const res = await postModule('prarambh', { title: '' });
  assert.equal(res.status, 422, JSON.stringify(res.body));
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');

  // Nothing was added.
  const structure = await get('prarambh');
  assert.deepEqual(structure.body.data.modules.map((m) => m.moduleId), ['mod-1', 'mod-2']);
});

test('adding a module appends it with an id carrying the course slug, and strips markup from its title', async () => {
  const res = await postModule('prarambh', { title: '  <b>Capstone</b>  ', description: 'Final unit' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(
    res.body.data.modules.map((m) => m.moduleId),
    ['mod-1', 'mod-2', 'prarambh-m-1'],
    'a new id that names its course, so it cannot clash with another course'
  );
  const added = moduleOf(res.body, 'prarambh-m-1');
  assert.equal(added.title, 'Capstone');
  assert.equal(added.order, 3);
  assert.equal(added.lessonCount, 0);
  assert.equal(added.gatingEnabled, null);
});

test('editing a module touches only that module, and the first-ever edit is not a false conflict', async () => {
  const prior = (await get('prarambh')).body.data;
  const mod2Before = prior.modules.find((m) => m.moduleId === 'mod-2');
  const newModuleBefore = prior.modules.find((m) => m.moduleId === 'prarambh-m-1');
  assert.equal(mod2Before.updatedAt, null, 'never touched since course creation');
  assert.ok(newModuleBefore.updatedAt, 'addModule stamps updatedAt at creation time, unlike the seeded modules');

  const res = await patchModule('prarambh', 'mod-2', {
    description: 'Overcoming self-doubt',
    gatingEnabled: false,
    expectedUpdatedAt: mod2Before.updatedAt,
    actor: { portal: 'admin', userId: 'admin-1', name: 'Admin One' },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const updated = moduleOf(res.body, 'mod-2');
  assert.equal(updated.title, 'Mindset', 'untouched field is unchanged');
  assert.equal(updated.description, 'Overcoming self-doubt');
  assert.equal(updated.gatingEnabled, false);
  assert.ok(updated.updatedAt);

  // mod-1 (seeded, never touched) is still at the schema default; prarambh-m-1
  // (added in the previous test) keeps exactly the timestamp it was created
  // with. Neither was touched by this edit to mod-2.
  assert.equal(moduleOf(res.body, 'mod-1').updatedAt, null);
  assert.equal(moduleOf(res.body, 'prarambh-m-1').updatedAt, newModuleBefore.updatedAt, 'unaffected by an edit to a sibling module');
});

test('a stale expectedUpdatedAt on a module is a 409 naming who changed it, not a silent overwrite', async () => {
  const stale = await patchModule('prarambh', 'mod-2', { title: 'Hijacked', expectedUpdatedAt: null });
  assert.equal(stale.status, 409, JSON.stringify(stale.body));
  assert.equal(stale.body.error.code, 'MODULE_CHANGED');
  assert.match(stale.body.error.message, /Admin One/);
  assert.equal(stale.body.error.details.current.title, 'Mindset', 'the rejected write never took effect');

  const structure = await get('prarambh');
  assert.equal(moduleOf(structure.body, 'mod-2').title, 'Mindset', 'still unchanged on disk');
});

test('reordering modules renumbers order and refuses a list that is not exactly the existing set', async () => {
  const res = await putModuleOrder('prarambh', { orderedModuleIds: ['prarambh-m-1', 'mod-1', 'mod-2'] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.data.modules.map((m) => m.moduleId), ['prarambh-m-1', 'mod-1', 'mod-2']);
  assert.deepEqual(res.body.data.modules.map((m) => m.order), [1, 2, 3]);

  const bad = await putModuleOrder('prarambh', { orderedModuleIds: ['mod-1', 'mod-2'] }); // missing prarambh-m-1
  assert.equal(bad.status, 400, JSON.stringify(bad.body));
  assert.equal(bad.body.error.code, 'MODULE_ORDER_MISMATCH');

  // Restore a predictable order for the remaining tests.
  const restored = await putModuleOrder('prarambh', { orderedModuleIds: ['mod-1', 'mod-2', 'prarambh-m-1'] });
  assert.deepEqual(restored.body.data.modules.map((m) => m.moduleId), ['mod-1', 'mod-2', 'prarambh-m-1']);
});

test('adding a lesson gives it an id carrying the course slug, numbered across the whole course', async () => {
  // Existing ids across the whole course so far: l-1, l-2 (mod-1), l-3 (mod-2).
  // New ids name their course (see newContentId): "l-N" collided across courses.
  const toMod2 = await postLesson('prarambh', 'mod-2', { title: 'Grit' });
  assert.equal(toMod2.status, 200, JSON.stringify(toMod2.body));
  assert.deepEqual(
    moduleOf(toMod2.body, 'mod-2').lessons.map((l) => l.lessonId),
    ['l-3', 'prarambh-l-1']
  );

  // Adding to an EARLIER module still takes the next number across the whole
  // course (prarambh-l-2), not mod-1's own count.
  const toMod1 = await postLesson('prarambh', 'mod-1', { title: '  <i>New skill</i>  ' });
  assert.equal(toMod1.status, 200, JSON.stringify(toMod1.body));
  const mod1Lessons = moduleOf(toMod1.body, 'mod-1').lessons;
  assert.deepEqual(mod1Lessons.map((l) => l.lessonId), ['l-1', 'l-2', 'prarambh-l-2']);
  const newest = mod1Lessons.find((l) => l.lessonId === 'prarambh-l-2');
  assert.equal(newest.title, 'New skill', 'markup stripped and trimmed');
  assert.equal(newest.isPublished, true, 'defaults to published');
});

test('editing a lesson touches only that lesson, and the first-ever edit is not a false conflict', async () => {
  const priorStructure = await get('prarambh');
  const l1Before = lessonOf(priorStructure.body, 'mod-1', 'l-1');
  const newLessonBefore = lessonOf(priorStructure.body, 'mod-1', 'prarambh-l-2');
  assert.equal(l1Before.updatedAt, null, 'never edited since course creation');
  assert.ok(newLessonBefore.updatedAt, 'addLesson stamps updatedAt at creation time, unlike the seeded lessons');

  const res = await patchLesson('prarambh', 'mod-1', 'l-1', {
    summary: 'Updated hello',
    isPublished: false,
    expectedUpdatedAt: l1Before.updatedAt,
    actor: { portal: 'teacher', userId: 't1', name: 'Teacher One' },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const updated = lessonOf(res.body, 'mod-1', 'l-1');
  assert.equal(updated.summary, 'Updated hello');
  assert.equal(updated.isPublished, false);
  assert.equal(updated.title, 'Welcome', 'untouched field is unchanged');
  assert.equal(updated.content, 'Read me', 'untouched field is unchanged');
  // l-2 (seeded, never touched) is still at the schema default; prarambh-l-2 (added in
  // an earlier test) keeps exactly the timestamp it was created with. Neither
  // was touched by this edit to l-1.
  assert.equal(lessonOf(res.body, 'mod-1', 'l-2').updatedAt, null);
  assert.equal(lessonOf(res.body, 'mod-1', 'prarambh-l-2').updatedAt, newLessonBefore.updatedAt, 'unaffected by an edit to a sibling lesson');
});

test('a stale expectedUpdatedAt on a lesson is a 409 naming who changed it', async () => {
  const stale = await patchLesson('prarambh', 'mod-1', 'l-1', { title: 'Hijacked', expectedUpdatedAt: null });
  assert.equal(stale.status, 409, JSON.stringify(stale.body));
  assert.equal(stale.body.error.code, 'LESSON_CHANGED');
  assert.match(stale.body.error.message, /Teacher One/);
  assert.equal(stale.body.error.details.current.title, 'Welcome', 'the rejected write never took effect');
});

test('an unpublished lesson is withheld from the enrolled student, and reappears once republished', async () => {
  // l-1 was set isPublished:false two tests ago.
  let content = await studentContent();
  assert.equal(lessonIdsOf(content).includes('l-1'), false, 'a draft lesson must not reach a student');
  assert.equal(lessonIdsOf(content).includes('l-2'), true, 'a sibling lesson is unaffected');

  const priorStructure = await get('prarambh');
  const l1 = lessonOf(priorStructure.body, 'mod-1', 'l-1');
  const res = await patchLesson('prarambh', 'mod-1', 'l-1', { isPublished: true, expectedUpdatedAt: l1.updatedAt });
  assert.equal(res.status, 200, JSON.stringify(res.body));

  content = await studentContent();
  assert.equal(lessonIdsOf(content).includes('l-1'), true, 'republishing brings it back');
});

test('reordering lessons renumbers order within one module and leaves every other module untouched', async () => {
  const priorStructure = await get('prarambh');
  const mod2Ids = moduleOf(priorStructure.body, 'mod-2').lessons.map((l) => l.lessonId); // ['l-3','prarambh-l-1']

  const res = await putLessonOrder('prarambh', 'mod-2', { orderedLessonIds: [...mod2Ids].reverse() });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const reordered = moduleOf(res.body, 'mod-2').lessons;
  assert.deepEqual(
    reordered.map((l) => l.lessonId),
    [...mod2Ids].reverse()
  );
  assert.deepEqual(
    reordered.map((l) => l.order),
    [1, 2]
  );

  const bad = await putLessonOrder('prarambh', 'mod-2', { orderedLessonIds: [mod2Ids[0]] });
  assert.equal(bad.status, 400, JSON.stringify(bad.body));
  assert.equal(bad.body.error.code, 'LESSON_ORDER_MISMATCH');

  // mod-1's lessons were never touched by mod-2's reorder.
  assert.deepEqual(
    moduleOf(res.body, 'mod-1').lessons.map((l) => l.lessonId),
    ['l-1', 'l-2', 'prarambh-l-2']
  );
});

test('a lesson added as a draft does not reach the student until published', async () => {
  const res = await postLesson('prarambh', 'mod-2', { title: 'Draft lesson', isPublished: false });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const draft = moduleOf(res.body, 'mod-2').lessons.find((l) => l.title === 'Draft lesson');
  assert.ok(draft, 'the lesson was added');
  assert.equal(draft.isPublished, false);

  const content = await studentContent();
  assert.equal(lessonIdsOf(content).includes(draft.lessonId), false);
});

test('removing a lesson no student has touched deletes it outright, visible to the student right away', async () => {
  // prarambh-l-1 ("Grit") has never been opened or completed by anyone.
  const res = await delLesson('prarambh', 'mod-2', 'prarambh-l-1');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.removed, true);

  const structure = await get('prarambh');
  assert.equal(
    moduleOf(structure.body, 'mod-2').lessons.some((l) => l.lessonId === 'prarambh-l-1'),
    false
  );
});

test('removing a lesson a student has already progressed on is refused, naming how many students', async () => {
  const complete = await request.post('/api/student/courses/lessons/l-1/progress').set(bearer(student.accessToken));
  assert.equal(complete.status, 200, JSON.stringify(complete.body));

  const res = await delLesson('prarambh', 'mod-1', 'l-1');
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.error.code, 'LESSON_HAS_PROGRESS');
  assert.equal(res.body.error.details.progressCount, 1);

  // Still there, completely untouched - unpublishing (tested above) is the
  // real alternative, not a suggestion with no teeth.
  const structure = await get('prarambh');
  assert.equal(
    moduleOf(structure.body, 'mod-1').lessons.some((l) => l.lessonId === 'l-1'),
    true
  );
});

test('deleting a lesson that no longer exists is a 404, not a silent success', async () => {
  // prarambh-l-1 was already removed two tests ago.
  const res = await delLesson('prarambh', 'mod-2', 'prarambh-l-1');
  assert.equal(res.status, 404, JSON.stringify(res.body));
  assert.equal(res.body.error.code, 'LESSON_NOT_FOUND');
});

test('a new lesson never reuses an id from another course, or one that still has progress recorded', async () => {
  const { Course } = await import('../src/models/Course.js');
  const { LessonProgress } = await import('../src/models/LessonProgress.js');
  // GARUD's real scheme. Its first new lesson used to become "l-1", a PRARAMBH lesson.
  const garud = await Course.create({
    slug: 'garud',
    title: 'GARUD',
    priceInPaise: 0,
    isPublished: true,
    pillar: 'communicate',
    modules: [{ moduleId: 'garud-m01', title: 'Flight', order: 1, lessons: [{ lessonId: 'garud-m01-l01', title: 'Lift', order: 1 }] }],
  });

  const first = await postLesson('garud', 'garud-m01', { title: 'Thermals' });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  const ids = moduleOf(first.body, 'garud-m01').lessons.map((l) => l.lessonId);
  assert.deepEqual(ids, ['garud-m01-l01', 'garud-l-1']);
  const prarambh = await get('prarambh');
  const prarambhIds = prarambh.body.data.modules.flatMap((m) => m.lessons.map((l) => l.lessonId));
  assert.ok(!prarambhIds.includes('garud-l-1'), 'unique across courses');

  // Progress outlives a removed lesson; its id must never be handed out again.
  await LessonProgress.create({ userId: student.user.id || student.user._id, courseId: garud._id, moduleId: 'garud-m01', lessonId: 'garud-l-2', completed: true });
  const second = await postLesson('garud', 'garud-m01', { title: 'Gliding' });
  assert.equal(second.status, 200, JSON.stringify(second.body));
  assert.deepEqual(moduleOf(second.body, 'garud-m01').lessons.map((l) => l.lessonId), ['garud-m01-l01', 'garud-l-1', 'garud-l-3']);

  const mod = await postModule('garud', { title: 'Storms' });
  assert.equal(mod.status, 200, JSON.stringify(mod.body));
  assert.deepEqual(mod.body.data.modules.map((m) => m.moduleId), ['garud-m01', 'garud-m-1']);
});
