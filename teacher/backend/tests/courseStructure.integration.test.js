import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { bootTestApp, createTeacherAndLogin } from './helpers/testApp.js';

/**
 * Module/lesson structure from the Teacher portal: course-level
 * authorisation, request shaping and error propagation.
 *
 * The student backend's own numbering, publish-filtering and locking rules
 * are exercised by student/backend's own courseStructure.integration.test.js
 * - what matters here is what THIS portal adds on top: an unassigned course
 * is refused before anything reaches the student service, the acting
 * teacher is named on every write, the student service's own refusals (a
 * conflict, a lesson with real progress) reach the teacher with their real
 * code, and every structural write is audited.
 */

let ctx;
let api;
let student;
let CourseAccess;
let AuditLog;
let alice;
let bob;

const uniq = () => crypto.randomBytes(3).toString('hex');

before(async () => {
  ctx = await bootTestApp();
  api = ctx.api;
  student = ctx.student;
  ({ CourseAccess } = await import('../src/models/CourseAccess.js'));
  ({ AuditLog } = await import('../src/models/AuditLog.js'));
  alice = await createTeacherAndLogin(api, { name: 'Alice Rao', email: `alice.${uniq()}@nalanda.test` });
  bob = await createTeacherAndLogin(api, { name: 'Bob Iyer', email: `bob.${uniq()}@nalanda.test` });
});

after(async () => {
  await ctx.teardown();
});

beforeEach(async () => {
  student.reset();
  await CourseAccess.deleteMany({});
  await CourseAccess.create([
    { teacher: alice.teacher._id, studentCourseSlug: 'prarambh', title: 'PRARAMBH', sources: ['teacher-assignment'] },
    { teacher: bob.teacher._id, studentCourseSlug: 'yoddha', title: 'YODDHA', sources: ['teacher-assignment'] },
  ]);
});

const base = '/api/teacher/course-structure/courses/prarambh';

test('every route needs a teacher session', async () => {
  for (const [method, path, body] of [
    ['GET', base],
    ['PATCH', base, { progressionGatingEnabled: true }],
    ['POST', `${base}/modules`, { title: 'x' }],
    ['PUT', `${base}/modules/order`, { orderedModuleIds: ['mod-1'] }],
    ['PATCH', `${base}/modules/mod-1`, { title: 'x' }],
    ['POST', `${base}/modules/mod-1/lessons`, { title: 'x' }],
    ['PUT', `${base}/modules/mod-1/lessons/order`, { orderedLessonIds: ['l-1'] }],
    ['PATCH', `${base}/modules/mod-1/lessons/l-1`, { title: 'x' }],
    ['DELETE', `${base}/modules/mod-1/lessons/l-1`],
  ]) {
    assert.equal((await api(method, path, { body })).status, 401, `${method} ${path}`);
  }
  assert.equal(student.state.courseStructureCalls.length, 0);
});

test('a teacher can read and edit the structure of an assigned course, naming themselves on every write', async () => {
  const got = await api('GET', base, { cookie: alice.cookie });
  assert.equal(got.status, 200, JSON.stringify(got.body));
  assert.equal(got.body.data.modules[0].moduleId, 'mod-1');

  let sent;

  const addedModule = await api('POST', `${base}/modules`, { cookie: alice.cookie, body: { title: 'Capstone' } });
  assert.equal(addedModule.status, 200, JSON.stringify(addedModule.body));
  sent = student.state.courseStructureCalls.at(-1);
  assert.equal(sent.path, '/api/internal/course-structure/courses/prarambh/modules');
  assert.equal(sent.body.title, 'Capstone');
  assert.equal(sent.body.actor.portal, 'teacher');
  assert.equal(sent.body.actor.userId, String(alice.user._id));
  assert.equal(sent.body.actor.name, 'Alice Rao');

  const reorderedModules = await api('PUT', `${base}/modules/order`, { cookie: alice.cookie, body: { orderedModuleIds: ['mod-1', 'mod-2'] } });
  assert.equal(reorderedModules.status, 200, JSON.stringify(reorderedModules.body));
  sent = student.state.courseStructureCalls.at(-1);
  assert.equal(sent.path, '/api/internal/course-structure/courses/prarambh/modules/order');
  assert.deepEqual(sent.body.orderedModuleIds, ['mod-1', 'mod-2']);

  const updatedModule = await api('PATCH', `${base}/modules/mod-1`, { cookie: alice.cookie, body: { description: 'Overview', gatingEnabled: false } });
  assert.equal(updatedModule.status, 200, JSON.stringify(updatedModule.body));
  sent = student.state.courseStructureCalls.at(-1);
  assert.equal(sent.path, '/api/internal/course-structure/courses/prarambh/modules/mod-1');
  assert.equal(sent.body.description, 'Overview');
  assert.equal(sent.body.gatingEnabled, false);

  const addedLesson = await api('POST', `${base}/modules/mod-1/lessons`, { cookie: alice.cookie, body: { title: 'New skill' } });
  assert.equal(addedLesson.status, 200, JSON.stringify(addedLesson.body));
  sent = student.state.courseStructureCalls.at(-1);
  assert.equal(sent.path, '/api/internal/course-structure/courses/prarambh/modules/mod-1/lessons');
  assert.equal(sent.body.title, 'New skill');

  const reorderedLessons = await api('PUT', `${base}/modules/mod-1/lessons/order`, {
    cookie: alice.cookie,
    body: { orderedLessonIds: ['l-2', 'l-1'] },
  });
  assert.equal(reorderedLessons.status, 200, JSON.stringify(reorderedLessons.body));
  sent = student.state.courseStructureCalls.at(-1);
  assert.equal(sent.path, '/api/internal/course-structure/courses/prarambh/modules/mod-1/lessons/order');
  assert.deepEqual(sent.body.orderedLessonIds, ['l-2', 'l-1']);

  const updatedLesson = await api('PATCH', `${base}/modules/mod-1/lessons/l-1`, {
    cookie: alice.cookie,
    body: { summary: 'Updated', isPublished: false },
  });
  assert.equal(updatedLesson.status, 200, JSON.stringify(updatedLesson.body));
  sent = student.state.courseStructureCalls.at(-1);
  assert.equal(sent.body.summary, 'Updated');
  assert.equal(sent.body.isPublished, false);

  const settings = await api('PATCH', base, { cookie: alice.cookie, body: { progressionGatingEnabled: false } });
  assert.equal(settings.status, 200, JSON.stringify(settings.body));
  sent = student.state.courseStructureCalls.at(-1);
  assert.equal(sent.body.progressionGatingEnabled, false);

  const removedLesson = await api('DELETE', `${base}/modules/mod-1/lessons/l-1`, { cookie: alice.cookie });
  assert.equal(removedLesson.status, 200, JSON.stringify(removedLesson.body));
  assert.equal(removedLesson.body.data.removed, true);

  const actions = (await AuditLog.find({ actor: alice.user._id }).lean()).map((a) => a.action);
  for (const expected of [
    'course.module.added',
    'course.modules.reordered',
    'course.module.updated',
    'course.lesson.added',
    'course.lessons.reordered',
    'course.lesson.updated',
    'course.settings.updated',
    'course.lesson.removed',
  ]) {
    assert.ok(actions.includes(expected), `missing audit action ${expected}`);
  }
});

test('a teacher cannot read or edit the structure of a course that is not assigned to them', async () => {
  const yoddhaBase = '/api/teacher/course-structure/courses/yoddha';
  for (const [method, path, body] of [
    ['GET', yoddhaBase],
    ['PATCH', yoddhaBase, { progressionGatingEnabled: true }],
    ['POST', `${yoddhaBase}/modules`, { title: 'x' }],
    ['PUT', `${yoddhaBase}/modules/order`, { orderedModuleIds: ['mod-1'] }],
    ['PATCH', `${yoddhaBase}/modules/mod-1`, { title: 'x' }],
    ['POST', `${yoddhaBase}/modules/mod-1/lessons`, { title: 'x' }],
    ['PUT', `${yoddhaBase}/modules/mod-1/lessons/order`, { orderedLessonIds: ['l-1'] }],
    ['PATCH', `${yoddhaBase}/modules/mod-1/lessons/l-1`, { title: 'x' }],
    ['DELETE', `${yoddhaBase}/modules/mod-1/lessons/l-1`],
    // A course nobody is assigned is no different.
    ['GET', '/api/teacher/course-structure/courses/some-other-course'],
  ]) {
    const res = await api(method, path, { cookie: alice.cookie, body });
    assert.equal(res.status, 403, `${method} ${path}`);
    assert.equal(res.body.error?.code || res.body.code, 'COURSE_NOT_ASSIGNED');
  }
  assert.equal(student.state.courseStructureCalls.length, 0, 'a refused edit never reaches the student service');
});

test('slug case and padding cannot be used to slip past the assignment check', async () => {
  const res = await api('GET', '/api/teacher/course-structure/courses/YODDHA', { cookie: alice.cookie });
  assert.equal(res.status, 403);
  const ok = await api('GET', '/api/teacher/course-structure/courses/PRARAMBH', { cookie: alice.cookie });
  assert.equal(ok.status, 200);
  assert.equal(student.state.courseStructureCalls[0].path, '/api/internal/course-structure/courses/prarambh');
});

test('revoking the assignment revokes editing immediately', async () => {
  const yoddhaBase = '/api/teacher/course-structure/courses/yoddha';
  assert.equal((await api('GET', yoddhaBase, { cookie: bob.cookie })).status, 200);
  await CourseAccess.deleteOne({ teacher: bob.teacher._id, studentCourseSlug: 'yoddha' });
  assert.equal((await api('GET', yoddhaBase, { cookie: bob.cookie })).status, 403);
});

test('malformed input is refused before the bridge', async () => {
  for (const [method, path, body] of [
    ['POST', `${base}/modules`, { title: '' }],
    ['POST', `${base}/modules`, { title: 'x', gatingEnabled: 'yes' }],
    ['PATCH', `${base}/modules/mod-1`, { gatingEnabled: 'yes' }],
    ['PUT', `${base}/modules/order`, { orderedModuleIds: [] }],
    ['POST', `${base}/modules/mod-1/lessons`, { title: 'x'.repeat(500) }],
    ['PATCH', base, { progressionGatingEnabled: 'yes' }],
    ['PATCH', `${base}/modules/mod-1/lessons/l-1`, { expectedUpdatedAt: 'soon' }],
  ]) {
    const res = await api(method, path, { cookie: alice.cookie, body });
    assert.equal(res.status, 422, `${method} ${path} ${JSON.stringify(body)}`);
  }
  assert.equal(student.state.courseStructureCalls.length, 0);
});

test("the student service's refusal reaches the teacher with its code", async () => {
  student.state.courseStructureReject = {
    status: 409,
    code: 'MODULE_CHANGED',
    message: 'This module was changed by Admin One since you opened it.',
  };
  const res = await api('PATCH', `${base}/modules/mod-1`, { cookie: alice.cookie, body: { title: 'Hijacked', expectedUpdatedAt: null } });
  assert.equal(res.status, 409);
  assert.equal(res.body.error?.code || res.body.code, 'MODULE_CHANGED');
});

test('the editor version is forwarded on a lesson edit', async () => {
  const res = await api('PATCH', `${base}/modules/mod-1/lessons/l-1`, {
    cookie: alice.cookie,
    body: { summary: 'x', expectedUpdatedAt: '2026-11-01T10:00:00.000Z' },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(student.state.courseStructureCalls.at(-1).body.expectedUpdatedAt, '2026-11-01T10:00:00.000Z');
});

test('a lesson real students have already progressed on cannot be removed, and the teacher sees why', async () => {
  student.state.courseStructureReject = {
    status: 409,
    code: 'LESSON_HAS_PROGRESS',
    message: "1 student has already opened or completed this lesson, so it can't be deleted.",
    details: { progressCount: 1 },
  };
  const res = await api('DELETE', `${base}/modules/mod-1/lessons/l-1`, { cookie: alice.cookie });
  assert.equal(res.status, 409);
  assert.equal(res.body.error?.code || res.body.code, 'LESSON_HAS_PROGRESS');
});

test('an unreachable student service is a 503, never a false success', async () => {
  student.state.down = true;
  const res = await api('GET', base, { cookie: alice.cookie });
  assert.equal(res.status, 503);
  assert.equal(res.body.error?.code || res.body.code, 'STUDENT_SERVICE_UNAVAILABLE');
});

test('an assigned teacher can delete a module; anyone else cannot, and the refusal reaches the teacher', async () => {
  assert.equal((await api('DELETE', `${base}/modules/mod-2`)).status, 401);
  const forbidden = await api('DELETE', '/api/teacher/course-structure/courses/yoddha/modules/mod-1', { cookie: alice.cookie });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.body.error?.code || forbidden.body.code, 'COURSE_NOT_ASSIGNED');

  const removed = await api('DELETE', `${base}/modules/mod-2`, { cookie: alice.cookie });
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  const { AuditLog } = await import('../src/models/AuditLog.js');
  assert.ok(await AuditLog.exists({ action: 'course.module.removed', 'metadata.moduleId': 'mod-2' }), 'audited');
});
