import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Who may see and mint coupons.
 *
 * The coupon list is not ordinary reporting data: it carries live, unredeemed
 * codes in plain text, and each one is a free seat in a paid course. Anybody who
 * can read this page can take the giveaway, and anybody who can POST to it can
 * mint more. So the boundary is worth a test of its own rather than trusting
 * that the route file still says what it said when it was written.
 *
 * `courses.manage` is the gate. STAFF does not hold it, which makes a STAFF
 * account the honest "logged in, but not allowed" case - a real session, a real
 * token, and still no access. Testing only the logged-out case would prove far
 * less, since that is caught by `authenticate` before permissions are consulted.
 */

let mongod;
let server;
let base;

before(async () => {
  mongod = await MongoMemoryServer.create();

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'test_coupon_access_secret';
  process.env.CLIENT_URL = 'http://localhost:5175';
  process.env.COOKIE_SAMESITE = 'lax';
  // Deliberately unreachable: every assertion here is about the gate in front of
  // the proxy, so a request that reaches the student service has already failed.
  process.env.STUDENT_BACKEND_URL = 'http://127.0.0.1:1';

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
  const mongoose = (await import('mongoose')).default;
  await mongoose.connection.close();
  await mongod.stop();
});

async function call(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  return { status: res.status, body: json, cookie: setCookie.map((c) => c.split(';')[0]).join('; ') };
}

const login = (email) =>
  call('/api/admin/auth/login', { method: 'POST', body: { email, password: 'TestPass123!' } });

const OBJECT_ID = '000000000000000000000001';

// Every coupon route, so a future addition cannot quietly land unguarded.
const ROUTES = [
  { name: 'list', method: 'GET', path: '/api/admin/coupons' },
  { name: 'list campaigns', method: 'GET', path: '/api/admin/coupons/campaigns' },
  {
    name: 'create campaign',
    method: 'POST',
    path: '/api/admin/coupons/campaigns',
    body: { courseSlug: 'some-course', name: 'Launch', count: 25 },
  },
  // The export hands over every live code in a campaign as a file, so it is the
  // single most valuable route here to get wrong.
  { name: 'export campaign', method: 'GET', path: `/api/admin/coupons/campaigns/${OBJECT_ID}/export` },
  { name: 'update', method: 'PATCH', path: `/api/admin/coupons/${OBJECT_ID}`, body: { isActive: false } },
  { name: 'delete', method: 'DELETE', path: `/api/admin/coupons/${OBJECT_ID}` },
];

test('no coupon route answers without a session', async () => {
  for (const route of ROUTES) {
    const res = await call(route.path, { method: route.method, body: route.body });
    assert.equal(res.status, 401, `${route.name} must demand authentication`);
  }
});

test('a signed-in STAFF admin is refused every coupon route', async () => {
  const { cookie, status } = await login('staff@test.local');
  assert.equal(status, 200, 'the STAFF account must genuinely log in, or this proves nothing');

  for (const route of ROUTES) {
    const res = await call(route.path, { method: route.method, body: route.body, cookie });
    assert.equal(res.status, 403, `${route.name} must be forbidden for STAFF`);
  }
});

test('a refused STAFF request never reveals a coupon code', async () => {
  const { cookie } = await login('staff@test.local');
  const res = await call('/api/admin/coupons', { cookie });

  // The denial body is the whole response a STAFF user can observe. If a code
  // ever leaked through an error path, this is where it would show up.
  assert.doesNotMatch(JSON.stringify(res.body ?? {}), /NN[A-Z0-9]{2}-/, 'no coupon code may appear in a denial');
});

test('STAFF is not simply locked out of the whole portal', async () => {
  const { cookie } = await login('staff@test.local');

  // Guards against the false pass where STAFF fails everything for an unrelated
  // reason - a broken session, a bad cookie - and the 403s above mean nothing.
  const allowed = await call('/api/admin/students', { cookie });
  assert.notEqual(allowed.status, 403, 'STAFF holds students.read and must still reach it');
  assert.notEqual(allowed.status, 401, 'the STAFF session must be valid');
});

test('SUPER_ADMIN passes the gate and reaches the proxy', async () => {
  const { cookie } = await login('super@test.local');
  const res = await call('/api/admin/coupons', { cookie });

  // The student service is unreachable by design, so success here is "got past
  // the permission check" - anything but 401/403. A 200 would mean the gate let
  // it through AND something answered, which nothing should.
  assert.notEqual(res.status, 401, 'SUPER_ADMIN is authenticated');
  assert.notEqual(res.status, 403, 'SUPER_ADMIN holds courses.manage');
});

/**
 * The progression control centre is a narrower permission than course
 * administration: these rules decide who becomes eligible to buy the next
 * stage, so they sit behind `settings.manage`, which ADMIN does not hold by
 * default and STAFF certainly does not.
 */
const PROGRESSION_ROUTES = [
  { name: 'read rules', method: 'GET', path: '/api/admin/progression/rules' },
  { name: 'write rules', method: 'PUT', path: '/api/admin/progression/rules', body: { levels: { xpPerLevel: 1 } } },
  { name: 'edit stage', method: 'PATCH', path: '/api/admin/progression/stages/PRARAMBH', body: { requirements: { minXP: 0 } } },
  { name: 'edit achievement', method: 'PATCH', path: '/api/admin/progression/achievements/CONSISTENCY', body: { criteriaValue: 1 } },
  { name: 'recalculate', method: 'POST', path: '/api/admin/progression/recalculate', body: {} },
];

test('progression configuration answers nobody without a session', async () => {
  for (const route of PROGRESSION_ROUTES) {
    const res = await call(route.path, { method: route.method, body: route.body });
    assert.equal(res.status, 401, `${route.name} must demand authentication`);
  }
});

test('a signed-in STAFF admin cannot read or change progression rules', async () => {
  const { cookie, status } = await login('staff@test.local');
  assert.equal(status, 200, 'the STAFF account must genuinely log in, or this proves nothing');

  for (const route of PROGRESSION_ROUTES) {
    const res = await call(route.path, { method: route.method, body: route.body, cookie });
    assert.equal(res.status, 403, `${route.name} must be forbidden for STAFF`);
  }
});

test('SUPER_ADMIN holds settings.manage and passes the gate', async () => {
  const { cookie } = await login('super@test.local');
  const res = await call('/api/admin/progression/rules', { cookie });

  // The student service is unreachable in this suite by design, so anything
  // other than 401/403 means the permission check let it through.
  assert.notEqual(res.status, 401);
  assert.notEqual(res.status, 403);
});
