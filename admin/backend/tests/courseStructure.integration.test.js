import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Module/lesson structure from the Admin portal.
 *
 * This portal holds no modules or lessons: it gates (courses.manage),
 * forwards to the student service, and audits - the same split as lesson
 * videos. So this test stands up a stand-in student service and checks
 * exactly that: who gets through, what crosses the bridge (including who did
 * it), that the student service's own refusal reaches the admin with its code
 * intact, and that an unreachable service is a 503 rather than a silent
 * success. The student-side behaviour itself is covered in
 * student/backend/tests/courseStructure.integration.test.js and the
 * assigned-teacher behaviour in teacher/backend/tests/courseStructure.integration.test.js.
 */

let mongod;
let server;
let base;
let student;
const received = [];
const fake = { down: false, rejectNext: null };

function startFakeStudentService() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      if (fake.down) return req.socket.destroy();
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const body = raw ? JSON.parse(raw) : undefined;
        received.push({ method: req.method, url: req.url, key: req.headers['x-internal-service-key'], body });
        const send = (status, payload) => {
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(payload));
        };
        if (fake.rejectNext) {
          const r = fake.rejectNext;
          fake.rejectNext = null;
          return send(r.status, { success: false, error: { code: r.code, message: r.message, details: r.details } });
        }
        const url = req.url;
        const now = '2026-11-20T00:00:00.000Z';

        if (req.method === 'GET') {
          return send(200, { success: true, data: { slug: 'prarambh', title: 'PRARAMBH', updatedAt: null, progressionGatingEnabled: true, modules: [] } });
        }
        if (req.method === 'PATCH') {
          if (/\/lessons\/[^/]+$/.test(url)) {
            return send(200, { success: true, data: { lessonId: 'l-1', moduleId: 'mod-1', title: body?.title ?? 'Lesson One', updatedAt: now } });
          }
          if (/\/modules\/[^/]+$/.test(url)) {
            return send(200, { success: true, data: { moduleId: 'mod-1', title: body?.title ?? 'Module One', gatingEnabled: body?.gatingEnabled ?? null, updatedAt: now } });
          }
          return send(200, { success: true, data: { slug: 'prarambh', progressionGatingEnabled: Boolean(body?.progressionGatingEnabled), updatedAt: now } });
        }
        if (req.method === 'POST') {
          if (url.endsWith('/lessons')) {
            return send(201, { success: true, data: { lessonId: 'l-9', moduleId: 'mod-1', title: body?.title, updatedAt: now } });
          }
          return send(201, { success: true, data: { moduleId: 'mod-3', title: body?.title, gatingEnabled: body?.gatingEnabled ?? null, order: 3, updatedAt: now } });
        }
        if (req.method === 'PUT') {
          if (url.endsWith('/lessons/order')) {
            return send(200, { success: true, data: { moduleId: 'mod-1', orderedLessonIds: body?.orderedLessonIds } });
          }
          return send(200, { success: true, data: { orderedModuleIds: body?.orderedModuleIds } });
        }
        if (req.method === 'DELETE') {
          return send(200, { success: true, data: { lessonId: 'l-1', moduleId: 'mod-1', removed: true } });
        }
        return send(404, { success: false, error: { code: 'UNKNOWN_ROUTE', message: 'no stub for this request' } });
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

before(async () => {
  mongod = await MongoMemoryServer.create();
  student = await startFakeStudentService();

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'test_course_structure_secret';
  process.env.CLIENT_URL = 'http://localhost:5175';
  process.env.COOKIE_SAMESITE = 'lax';
  process.env.STUDENT_BACKEND_URL = `http://127.0.0.1:${student.address().port}`;
  process.env.STUDENT_BACKEND_SERVICE_KEY = 'admin_to_student_key';

  const { connectDatabase } = await import('../src/config/db.js');
  await connectDatabase();
  const { createApp } = await import('../src/app.js');
  server = http.createServer(createApp());
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;

  const { Admin } = await import('../src/models/Admin.js');
  const passwordHash = await Admin.hashPassword('TestPass123!');
  await Admin.create({ name: 'Super', email: 'super@test.local', passwordHash, role: 'SUPER_ADMIN', status: 'ACTIVE' });
  await Admin.create({ name: 'Staffer', email: 'staff@test.local', passwordHash, role: 'STAFF', status: 'ACTIVE' });
});

after(async () => {
  await new Promise((r) => server.close(r));
  await new Promise((r) => student.close(r));
  const mongoose = (await import('mongoose')).default;
  await mongoose.connection.close();
  await mongod.stop();
});

beforeEach(() => {
  received.length = 0;
  fake.down = false;
  fake.rejectNext = null;
});

async function call(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  return { status: res.status, body: json, cookie: setCookie.map((c) => c.split(';')[0]).join('; ') };
}

const login = async (email) => (await call('/api/admin/auth/login', { method: 'POST', body: { email, password: 'TestPass123!' } })).cookie;

const BASE = '/api/admin/course-structure/courses/prarambh';
const ROUTES = [
  { method: 'GET', path: BASE },
  { method: 'PATCH', path: BASE, body: { progressionGatingEnabled: true } },
  { method: 'POST', path: `${BASE}/modules`, body: { title: 'New Module' } },
  { method: 'PUT', path: `${BASE}/modules/order`, body: { orderedModuleIds: ['mod-1', 'mod-2'] } },
  { method: 'PATCH', path: `${BASE}/modules/mod-1`, body: { title: 'Module One Renamed' } },
  { method: 'POST', path: `${BASE}/modules/mod-1/lessons`, body: { title: 'New Lesson' } },
  { method: 'PUT', path: `${BASE}/modules/mod-1/lessons/order`, body: { orderedLessonIds: ['l-1', 'l-2'] } },
  { method: 'PATCH', path: `${BASE}/modules/mod-1/lessons/l-1`, body: { title: 'Lesson One Renamed' } },
  { method: 'DELETE', path: `${BASE}/modules/mod-1/lessons/l-1` },
];

test('every course-structure route needs a session, and STAFF is refused', async () => {
  const staff = await login('staff@test.local');
  assert.ok(staff, 'STAFF must genuinely log in, or this proves nothing');
  for (const r of ROUTES) {
    assert.equal((await call(r.path, { method: r.method, body: r.body })).status, 401, `${r.method} ${r.path} unauthenticated`);
    assert.equal((await call(r.path, { method: r.method, body: r.body, cookie: staff })).status, 403, `${r.method} ${r.path} STAFF`);
  }
  assert.equal(received.length, 0, 'nothing refused here may reach the student service');
});

test('every write forwards the edit with the service key and the acting admin, and is audited', async () => {
  const cookie = await login('super@test.local');

  const settings = await call(BASE, { method: 'PATCH', body: { progressionGatingEnabled: false }, cookie });
  assert.equal(settings.status, 200, JSON.stringify(settings.body));
  assert.equal(received.at(-1).url, '/api/internal/course-structure/courses/prarambh');
  assert.equal(received.at(-1).key, 'admin_to_student_key');
  assert.equal(received.at(-1).body.actor.portal, 'admin');
  assert.equal(received.at(-1).body.actor.name, 'Super');

  const addModule = await call(`${BASE}/modules`, { method: 'POST', body: { title: 'New Module', gatingEnabled: null }, cookie });
  assert.equal(addModule.status, 200, JSON.stringify(addModule.body));
  assert.equal(received.at(-1).url, '/api/internal/course-structure/courses/prarambh/modules');
  assert.equal(received.at(-1).body.title, 'New Module');
  assert.equal(received.at(-1).body.gatingEnabled, null, 'an explicit null must be forwarded, not dropped as undefined');

  const reorderModules = await call(`${BASE}/modules/order`, {
    method: 'PUT',
    body: { orderedModuleIds: ['mod-2', 'mod-1'] },
    cookie,
  });
  assert.equal(reorderModules.status, 200, JSON.stringify(reorderModules.body));
  assert.deepEqual(received.at(-1).body.orderedModuleIds, ['mod-2', 'mod-1']);

  const updateModule = await call(`${BASE}/modules/mod-1`, {
    method: 'PATCH',
    body: { title: 'Module One Renamed', expectedUpdatedAt: null },
    cookie,
  });
  assert.equal(updateModule.status, 200, JSON.stringify(updateModule.body));
  assert.equal(received.at(-1).url, '/api/internal/course-structure/courses/prarambh/modules/mod-1');
  assert.equal(received.at(-1).body.expectedUpdatedAt, null);

  const addLesson = await call(`${BASE}/modules/mod-1/lessons`, { method: 'POST', body: { title: 'New Lesson' }, cookie });
  assert.equal(addLesson.status, 200, JSON.stringify(addLesson.body));
  assert.equal(received.at(-1).url, '/api/internal/course-structure/courses/prarambh/modules/mod-1/lessons');

  const reorderLessons = await call(`${BASE}/modules/mod-1/lessons/order`, {
    method: 'PUT',
    body: { orderedLessonIds: ['l-2', 'l-1'] },
    cookie,
  });
  assert.equal(reorderLessons.status, 200, JSON.stringify(reorderLessons.body));
  assert.deepEqual(received.at(-1).body.orderedLessonIds, ['l-2', 'l-1']);

  const updateLesson = await call(`${BASE}/modules/mod-1/lessons/l-1`, {
    method: 'PATCH',
    body: { title: 'Lesson One Renamed' },
    cookie,
  });
  assert.equal(updateLesson.status, 200, JSON.stringify(updateLesson.body));
  assert.equal(received.at(-1).url, '/api/internal/course-structure/courses/prarambh/modules/mod-1/lessons/l-1');

  const removeLesson = await call(`${BASE}/modules/mod-1/lessons/l-1`, { method: 'DELETE', cookie });
  assert.equal(removeLesson.status, 200, JSON.stringify(removeLesson.body));
  assert.equal(received.at(-1).method, 'DELETE');
  assert.equal(received.at(-1).body.actor.portal, 'admin');

  const { AuditLog } = await import('../src/models/AuditLog.js');
  const actions = [
    'course.settings.updated',
    'course.module.added',
    'course.modules.reordered',
    'course.module.updated',
    'course.lesson.added',
    'course.lessons.reordered',
    'course.lesson.updated',
    'course.lesson.removed',
  ];
  for (const action of actions) {
    assert.ok(await AuditLog.exists({ action, entityRef: 'prarambh' }), `audited: ${action}`);
  }
});

test('malformed requests are refused before the bridge', async () => {
  const cookie = await login('super@test.local');
  const bad = [
    { path: BASE, method: 'PATCH', body: {} }, // progressionGatingEnabled is required
    { path: BASE, method: 'PATCH', body: { progressionGatingEnabled: 'yes' } },
    { path: `${BASE}/modules`, method: 'POST', body: { title: '' } },
    { path: `${BASE}/modules`, method: 'POST', body: { title: 'x', gatingEnabled: 'maybe' } },
    { path: `${BASE}/modules/mod-1`, method: 'PATCH', body: { expectedUpdatedAt: 'soon' } },
    { path: `${BASE}/modules/mod-1/lessons`, method: 'POST', body: {} }, // title is required
    { path: `/api/admin/course-structure/courses/bad%20slug!/modules/mod-1/lessons`, method: 'POST', body: { title: 'x' } },
  ];
  for (const b of bad) {
    assert.equal((await call(b.path, { method: b.method, body: b.body, cookie })).status, 422, JSON.stringify(b.body).slice(0, 80));
  }
  assert.equal(received.length, 0);
});

test("the student service's refusal reaches the admin with its status and code", async () => {
  const cookie = await login('super@test.local');
  fake.rejectNext = { status: 409, code: 'MODULE_CHANGED', message: 'This module was changed by Teacher One since you opened it.' };
  const res = await call(`${BASE}/modules/mod-1`, { method: 'PATCH', body: { title: 'Renamed' }, cookie });
  assert.equal(res.status, 409);
  assert.equal(res.body.error?.code || res.body.code, 'MODULE_CHANGED');
  assert.match(res.body.message || res.body.error?.message, /Teacher One/);
});

test('a student with real progress blocks a lesson removal, with its own code', async () => {
  const cookie = await login('super@test.local');
  fake.rejectNext = { status: 409, code: 'LESSON_HAS_PROGRESS', message: '3 students have progress on this lesson.', details: { progressCount: 3 } };
  const res = await call(`${BASE}/modules/mod-1/lessons/l-1`, { method: 'DELETE', cookie });
  assert.equal(res.status, 409);
  assert.equal(res.body.error?.code || res.body.code, 'LESSON_HAS_PROGRESS');
  assert.equal((res.body.errors || res.body.error?.details).progressCount, 3);
});

test('an unreachable student service is a 503, never a false success', async () => {
  const cookie = await login('super@test.local');
  fake.down = true;
  const res = await call(`${BASE}/modules/mod-1/lessons`, { method: 'POST', body: { title: 'New Lesson' }, cookie });
  assert.equal(res.status, 503);
  assert.match(res.body.message || res.body.error?.message, /course content/);
});

test('a version conflict reaches the admin intact, with the current state, however long the answer', async () => {
  const cookie = await login('super@test.local');
  const current = { title: 'x'.repeat(180), description: 'y'.repeat(900), updatedBy: { name: 'Alice Rao', portal: 'teacher' } };
  fake.rejectNext = { status: 409, code: 'LESSON_CHANGED', message: 'This lesson was changed by Alice Rao since you opened it.', details: { current } };
  const res = await call(`${BASE}/modules/mod-1/lessons/l-1`, {
    method: 'PATCH',
    body: { title: 'Renamed', expectedUpdatedAt: '2026-11-01T10:00:00.000Z' },
    cookie,
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.error?.code || res.body.code, 'LESSON_CHANGED');
  assert.equal(res.body.error?.message || res.body.message, 'This lesson was changed by Alice Rao since you opened it.');
  assert.equal((res.body.errors || res.body.error?.details).current.description.length, 900);
  assert.equal(received.find((r) => r.method === 'PATCH').body.expectedUpdatedAt, '2026-11-01T10:00:00.000Z');
});

test('a malformed version is refused before the bridge', async () => {
  const cookie = await login('super@test.local');
  const res = await call(`${BASE}/modules/mod-1/lessons/l-1`, { method: 'PATCH', body: { title: 'x', expectedUpdatedAt: 'soon' }, cookie });
  assert.equal(res.status, 422);
  assert.equal(received.length, 0);
});
