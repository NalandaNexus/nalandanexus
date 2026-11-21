import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { bootTestApp, createTeacherAndLogin } from './helpers/testApp.js';

/**
 * Lesson videos from the Teacher portal: course-level authorisation.
 *
 * A teacher may manage the videos of exactly the courses an administrator has
 * assigned them - the CourseAccess rows that already decide whose students
 * they see - and nothing else. The checks that matter are server-side and per
 * request: an unassigned course is refused before anything reaches the student
 * service, and revoking an assignment revokes editing at once.
 */

let ctx;
let api;
let student;
let CourseAccess;
let AuditLog;
let alice;
let bob;

const VIDEO = { url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Welcome', isPublished: true };
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
  // Alice teaches PRARAMBH (assigned directly) and GARUD (as instructor of an
  // Admin-authored course sold under that slug). Bob teaches YODDHA only.
  await CourseAccess.create([
    { teacher: alice.teacher._id, studentCourseSlug: 'prarambh', title: 'PRARAMBH', sources: ['teacher-assignment'] },
    { teacher: alice.teacher._id, studentCourseSlug: 'garud', title: 'GARUD', sources: ['course-instructor'] },
    { teacher: bob.teacher._id, studentCourseSlug: 'yoddha', title: 'YODDHA', sources: ['teacher-assignment'] },
  ]);
});

const put = (cookie, slug, lessonId = 'l-1', body = VIDEO) =>
  api('PUT', `/api/teacher/lesson-videos/courses/${slug}/lessons/${lessonId}`, { cookie, body });

test('every route needs a teacher session', async () => {
  for (const [method, path, body] of [
    ['GET', '/api/teacher/lesson-videos/courses'],
    ['GET', '/api/teacher/lesson-videos/courses/prarambh'],
    ['POST', '/api/teacher/lesson-videos/inspect', { url: VIDEO.url }],
    ['PUT', '/api/teacher/lesson-videos/courses/prarambh/lessons/l-1', VIDEO],
    ['DELETE', '/api/teacher/lesson-videos/courses/prarambh/lessons/l-1'],
  ]) {
    assert.equal((await api(method, path, { body })).status, 401, `${method} ${path}`);
  }
  assert.equal(student.state.videoCalls.length, 0);
});

test('a teacher lists only their assigned courses', async () => {
  const res = await api('GET', '/api/teacher/lesson-videos/courses', { cookie: alice.cookie });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data.map((c) => c.slug).sort(), ['garud', 'prarambh']);
  const asked = student.state.videoCalls[0];
  assert.match(decodeURIComponent(asked.query), /slugs=(prarambh,garud|garud,prarambh)/);
  assert.doesNotMatch(asked.query, /yoddha/, 'another teacher\'s course is never even asked about');
});

test('a teacher can read, save, publish and remove videos in an assigned course', async () => {
  assert.equal((await api('GET', '/api/teacher/lesson-videos/courses/prarambh', { cookie: alice.cookie })).status, 200);

  const saved = await put(alice.cookie, 'prarambh');
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const sent = student.state.videoCalls.find((c) => c.method === 'PUT');
  assert.equal(sent.path, '/api/internal/lesson-videos/courses/prarambh/lessons/l-1');
  assert.equal(sent.body.url, VIDEO.url);
  assert.equal(sent.body.isPublished, true);
  assert.equal(sent.body.actor.portal, 'teacher');
  assert.equal(sent.body.actor.userId, String(alice.user._id));
  assert.equal(sent.body.actor.name, 'Alice Rao');

  // Assignment via instructorship counts exactly like a direct assignment.
  assert.equal((await put(alice.cookie, 'garud', 'g-1')).status, 200);

  const removed = await api('DELETE', '/api/teacher/lesson-videos/courses/prarambh/lessons/l-1', { cookie: alice.cookie });
  assert.equal(removed.status, 200);

  const actions = (await AuditLog.find({ actor: alice.user._id }).lean()).map((a) => a.action);
  assert.ok(actions.includes('course.lesson_video.published'));
  assert.ok(actions.includes('course.lesson_video.removed'));
});

test('a teacher cannot read or modify a course that is not assigned to them', async () => {
  for (const [method, path, body] of [
    ['GET', '/api/teacher/lesson-videos/courses/yoddha'],
    ['PUT', '/api/teacher/lesson-videos/courses/yoddha/lessons/y-1', VIDEO],
    ['DELETE', '/api/teacher/lesson-videos/courses/yoddha/lessons/y-1'],
    // A course nobody is assigned is no different.
    ['PUT', '/api/teacher/lesson-videos/courses/some-other-course/lessons/l-1', VIDEO],
  ]) {
    const res = await api(method, path, { cookie: alice.cookie, body });
    assert.equal(res.status, 403, `${method} ${path}`);
    assert.equal(res.body.error?.code || res.body.code, 'COURSE_NOT_ASSIGNED');
  }
  assert.equal(student.state.videoCalls.length, 0, 'a refused edit never reaches the student service');
});

test('slug case and padding cannot be used to slip past the assignment check', async () => {
  const res = await api('PUT', '/api/teacher/lesson-videos/courses/YODDHA/lessons/y-1', { cookie: alice.cookie, body: VIDEO });
  assert.equal(res.status, 403);
  const ok = await api('PUT', '/api/teacher/lesson-videos/courses/PRARAMBH/lessons/l-1', { cookie: alice.cookie, body: VIDEO });
  assert.equal(ok.status, 200);
  assert.equal(student.state.videoCalls[0].path, '/api/internal/lesson-videos/courses/prarambh/lessons/l-1');
});

test('revoking the assignment revokes editing immediately', async () => {
  assert.equal((await put(bob.cookie, 'yoddha')).status, 200);
  await CourseAccess.deleteOne({ teacher: bob.teacher._id, studentCourseSlug: 'yoddha' });
  assert.equal((await put(bob.cookie, 'yoddha')).status, 403);
});

test('malformed input is refused before the bridge', async () => {
  for (const body of [
    { url: 'https://youtu.be/dQw4w9WgXcQ', playbackMode: 'iframe' },
    { url: 'https://youtu.be/dQw4w9WgXcQ', isPublished: 'yes' },
    { url: { $gt: '' } },
    { url: 'x'.repeat(3000) },
  ]) {
    const res = await put(alice.cookie, 'prarambh', 'l-1', body);
    assert.equal(res.status, 422, JSON.stringify(body).slice(0, 80));
  }
  assert.equal(student.state.videoCalls.length, 0);
});

test("the student service's refusal reaches the teacher with its code", async () => {
  student.state.videoReject = { status: 422, code: 'INVALID_VIDEO_ID', message: 'That YouTube link has a malformed video id.' };
  const res = await put(alice.cookie, 'prarambh', 'l-1', { url: 'https://youtu.be/bad' });
  assert.equal(res.status, 422);
  assert.equal(res.body.error?.code || res.body.code, 'INVALID_VIDEO_ID');
});

test('an unreachable student service is a 503, never a false success', async () => {
  student.state.down = true;
  const res = await put(alice.cookie, 'prarambh');
  assert.equal(res.status, 503);
  assert.equal(res.body.error?.code || res.body.code, 'STUDENT_SERVICE_UNAVAILABLE');
});

test('module videos follow the same assignment rule', async () => {
  const ok = await api('PUT', '/api/teacher/lesson-videos/courses/prarambh/modules/mod-1', { cookie: alice.cookie, body: VIDEO });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(student.state.videoCalls[0].path, '/api/internal/lesson-videos/courses/prarambh/modules/mod-1');
  assert.equal(student.state.videoCalls[0].body.actor.portal, 'teacher');

  const refused = await api('PUT', '/api/teacher/lesson-videos/courses/yoddha/modules/y-mod-1', { cookie: alice.cookie, body: VIDEO });
  assert.equal(refused.status, 403);
  const refusedDelete = await api('DELETE', '/api/teacher/lesson-videos/courses/yoddha/modules/y-mod-1', { cookie: alice.cookie });
  assert.equal(refusedDelete.status, 403);
  assert.equal(student.state.videoCalls.length, 1);
});

test('the editor version is forwarded, and a conflict reaches the teacher with the current video', async () => {
  student.state.videoReject = { status: 409, code: 'VIDEO_CHANGED', message: 'This video was changed by Admin One since you opened it.' };
  const res = await api('PUT', '/api/teacher/lesson-videos/courses/prarambh/lessons/l-1', {
    cookie: alice.cookie,
    body: { ...VIDEO, expectedUpdatedAt: '2026-11-01T10:00:00.000Z' },
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.error?.code || res.body.code, 'VIDEO_CHANGED');
  assert.equal(student.state.videoCalls[0].body.expectedUpdatedAt, '2026-11-01T10:00:00.000Z');

  const bad = await api('PUT', '/api/teacher/lesson-videos/courses/prarambh/lessons/l-1', { cookie: alice.cookie, body: { ...VIDEO, expectedUpdatedAt: 'soon' } });
  assert.equal(bad.status, 422);
});

// --- Uploads, Google Drive and live notices --------------------------------------------------------

const UPLOAD = { fileName: 'module-1.mp4', fileSize: 52_428_800, mimeType: 'video/mp4', title: 'Week one' };
const SESSION = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const SERVICE = { 'X-Internal-Service-Key': 'test_service_key' };

test('upload routes need a teacher session', async () => {
  for (const [method, path, body] of [
    ['POST', '/api/teacher/lesson-videos/courses/prarambh/modules/mod-1/uploads', UPLOAD],
    ['POST', `/api/teacher/lesson-videos/courses/prarambh/uploads/${SESSION}/parts`, { partNumbers: [1] }],
    ['POST', `/api/teacher/lesson-videos/courses/prarambh/uploads/${SESSION}/resume`, {}],
    ['POST', `/api/teacher/lesson-videos/courses/prarambh/uploads/${SESSION}/complete`, {}],
    ['DELETE', `/api/teacher/lesson-videos/courses/prarambh/uploads/${SESSION}`],
    ['PATCH', '/api/teacher/lesson-videos/courses/prarambh/modules/mod-1', { isPublished: false }],
    ['GET', '/api/teacher/lesson-videos/courses/prarambh/activity'],
  ]) {
    assert.equal((await api(method, path, { body })).status, 401, `${method} ${path}`);
  }
  assert.equal(student.state.videoCalls.length, 0);
});

test('an assigned teacher runs a whole upload; every step names the course and the teacher', async () => {
  const started = await api('POST', '/api/teacher/lesson-videos/courses/prarambh/modules/mod-1/uploads', { cookie: alice.cookie, body: UPLOAD });
  assert.equal(started.status, 201, JSON.stringify(started.body));
  assert.equal(started.body.data.uploadId, SESSION);

  const parts = await api('POST', `/api/teacher/lesson-videos/courses/prarambh/uploads/${SESSION}/parts`, { cookie: alice.cookie, body: { partNumbers: [1, 2] } });
  assert.equal(parts.status, 200);
  assert.equal((await api('POST', `/api/teacher/lesson-videos/courses/prarambh/uploads/${SESSION}/resume`, { cookie: alice.cookie, body: {} })).status, 200);
  const done = await api('POST', `/api/teacher/lesson-videos/courses/prarambh/uploads/${SESSION}/complete`, { cookie: alice.cookie, body: { duration: 61.5 } });
  assert.equal(done.status, 200);

  const calls = student.state.videoCalls;
  assert.deepEqual(
    calls.map((c) => `${c.method} ${c.path}`),
    [
      'POST /api/internal/lesson-videos/courses/prarambh/modules/mod-1/uploads',
      `POST /api/internal/lesson-videos/courses/prarambh/uploads/${SESSION}/parts`,
      `POST /api/internal/lesson-videos/courses/prarambh/uploads/${SESSION}/resume`,
      `POST /api/internal/lesson-videos/courses/prarambh/uploads/${SESSION}/complete`,
    ]
  );
  for (const call of calls) {
    assert.equal(call.body.actor.portal, 'teacher');
    assert.equal(call.body.actor.userId, String(alice.user._id));
  }
  assert.equal(calls[0].body.fileName, 'module-1.mp4');
  assert.equal(calls[0].body.fileSize, 52_428_800);
  assert.deepEqual(calls[1].body.partNumbers, [1, 2]);
  assert.equal(calls[3].body.duration, 61.5);

  const actions = (await AuditLog.find({ actor: alice.user._id }).lean()).map((a) => a.action);
  assert.ok(actions.includes('course.lesson_video.upload_started'));
  assert.ok(actions.includes('course.lesson_video.published'));
});

test('a teacher cannot upload to, or drive an upload in, a course not assigned to them', async () => {
  for (const [method, path, body] of [
    ['POST', '/api/teacher/lesson-videos/courses/yoddha/modules/y-mod-1/uploads', UPLOAD],
    ['POST', '/api/teacher/lesson-videos/courses/yoddha/lessons/y-1/uploads', UPLOAD],
    ['POST', `/api/teacher/lesson-videos/courses/yoddha/uploads/${SESSION}/parts`, { partNumbers: [1] }],
    ['POST', `/api/teacher/lesson-videos/courses/yoddha/uploads/${SESSION}/resume`, {}],
    ['POST', `/api/teacher/lesson-videos/courses/yoddha/uploads/${SESSION}/complete`, {}],
    ['DELETE', `/api/teacher/lesson-videos/courses/yoddha/uploads/${SESSION}`],
    ['PATCH', '/api/teacher/lesson-videos/courses/yoddha/modules/y-mod-1', { isPublished: false }],
    ['GET', '/api/teacher/lesson-videos/courses/yoddha/activity'],
  ]) {
    const res = await api(method, path, { cookie: alice.cookie, body });
    assert.equal(res.status, 403, `${method} ${path}`);
    assert.equal(res.body.error?.code || res.body.code, 'COURSE_NOT_ASSIGNED');
  }
  assert.equal(student.state.videoCalls.length, 0, 'nothing reached the student service');
});

test('removing a course from a teacher stops their upload at its next step', async () => {
  const started = await api('POST', '/api/teacher/lesson-videos/courses/prarambh/modules/mod-1/uploads', { cookie: alice.cookie, body: UPLOAD });
  assert.equal(started.status, 201);
  await CourseAccess.deleteOne({ teacher: alice.teacher._id, studentCourseSlug: 'prarambh' });
  const parts = await api('POST', `/api/teacher/lesson-videos/courses/prarambh/uploads/${SESSION}/parts`, { cookie: alice.cookie, body: { partNumbers: [1] } });
  assert.equal(parts.status, 403);
  const complete = await api('POST', `/api/teacher/lesson-videos/courses/prarambh/uploads/${SESSION}/complete`, { cookie: alice.cookie, body: {} });
  assert.equal(complete.status, 403);
  assert.equal(student.state.videoCalls.length, 1, 'only the start, made while assigned, crossed');
});

test('upload requests are shape-checked before they cross', async () => {
  const cases = [
    ['POST', '/api/teacher/lesson-videos/courses/prarambh/modules/mod-1/uploads', { ...UPLOAD, fileSize: 0 }],
    ['POST', '/api/teacher/lesson-videos/courses/prarambh/modules/mod-1/uploads', { ...UPLOAD, fileName: '' }],
    ['POST', '/api/teacher/lesson-videos/courses/prarambh/uploads/not-an-id/parts', { partNumbers: [1] }],
    ['POST', `/api/teacher/lesson-videos/courses/prarambh/uploads/${SESSION}/parts`, { partNumbers: [] }],
    ['POST', `/api/teacher/lesson-videos/courses/prarambh/uploads/${SESSION}/parts`, { partNumbers: Array.from({ length: 51 }, (_, i) => i + 1) }],
    ['POST', `/api/teacher/lesson-videos/courses/prarambh/uploads/${SESSION}/complete`, { duration: -1 }],
    ['PUT', '/api/teacher/lesson-videos/courses/prarambh/modules/mod-1', { ...VIDEO, provider: 'vimeo' }],
  ];
  for (const [method, path, body] of cases) {
    const res = await api(method, path, { cookie: alice.cookie, body });
    assert.equal(res.status, 422, `${method} ${path} ${JSON.stringify(body).slice(0, 60)}`);
  }
  assert.equal(student.state.videoCalls.length, 0);
});

test('a Google Drive link is forwarded as a Drive link; details and visibility can be changed', async () => {
  const drive = await api('PUT', '/api/teacher/lesson-videos/courses/prarambh/modules/mod-2', {
    cookie: alice.cookie,
    body: { provider: 'google_drive', url: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view', isPublished: true },
  });
  assert.equal(drive.status, 200);
  assert.equal(student.state.videoCalls[0].body.provider, 'google_drive');

  const hidden = await api('PATCH', '/api/teacher/lesson-videos/courses/prarambh/modules/mod-2', {
    cookie: alice.cookie,
    body: { isPublished: false, title: 'Later', expectedUpdatedAt: '2026-11-21T10:00:00.000Z' },
  });
  assert.equal(hidden.status, 200);
  const patch = student.state.videoCalls[1];
  assert.equal(patch.method, 'PATCH');
  assert.deepEqual(
    { isPublished: patch.body.isPublished, title: patch.body.title, expectedUpdatedAt: patch.body.expectedUpdatedAt, portal: patch.body.actor.portal },
    { isPublished: false, title: 'Later', expectedUpdatedAt: '2026-11-21T10:00:00.000Z', portal: 'teacher' }
  );

  const inspect = await api('POST', '/api/teacher/lesson-videos/inspect', { cookie: alice.cookie, body: { url: 'https://drive.google.com/file/d/x/view', provider: 'google_drive' } });
  assert.equal(inspect.status, 200);
  assert.equal(student.state.videoCalls[2].body.provider, 'google_drive');
});

test("a video change notice from the student service reaches only that course's teachers", async () => {
  const notice = { slug: 'prarambh', moduleId: 'mod-1', lessonId: null, action: 'upload_completed', provider: 'upload', isPublished: true, actor: { portal: 'admin', name: 'Asha' } };
  const unauth = await api('POST', '/api/internal/course-videos/events', { body: notice });
  assert.equal(unauth.status, 401);

  const res = await api('POST', '/api/internal/course-videos/events', { body: notice, headers: SERVICE });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.delivered, 1, 'only Alice teaches PRARAMBH');

  const yoddha = await api('POST', '/api/internal/course-videos/events', { body: { ...notice, slug: 'yoddha' }, headers: SERVICE });
  assert.equal(yoddha.body.data.delivered, 1, 'only Bob teaches YODDHA');

  const bad = await api('POST', '/api/internal/course-videos/events', { body: { ...notice, slug: '../x' }, headers: SERVICE });
  assert.equal(bad.status, 422);
});
