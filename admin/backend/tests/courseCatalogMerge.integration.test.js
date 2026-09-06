import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Courses the student service owns, seen from the admin portal.
 *
 * The catalogue bridge only ever runs admin -> student, so a course seeded
 * natively on the student side has no record in this portal's database. Every
 * admin screen that reads that collection - the course list, the pickers, the
 * coupon campaign dropdown - therefore could not see Prarambh at all, while
 * students could buy it.
 *
 * These merged entries are read live rather than copied, so the price an admin
 * is shown is the price checkout charges. That is the property worth protecting
 * here: a mirrored copy would pass a "does Prarambh appear" test just as well
 * and then drift.
 */

let mongod;
let server;
let base;
let catalogServer;
let catalogState;

before(async () => {
  mongod = await MongoMemoryServer.create();

  // Stands in for the student service's public catalogue.
  catalogState = {
    status: 200,
    body: {
      success: true,
      data: [
        {
          id: '6a84b83a72e6b674a085fa48',
          slug: 'prarambh',
          title: 'PRARAMBH — The Awakening',
          category: 'foundation',
          description: 'Foundation of future ready skills.',
          priceInPaise: 500000,
          bannerImage: '/prarambh_course_banner.jpg',
          isPurchasable: true,
          instructor: { name: 'Nalanda Nexus Senior Faculty' },
        },
        {
          id: '6a84b83a72e6b674a085fa49',
          slug: 'python-for-beginners',
          title: 'Python for Beginners',
          priceInPaise: 0,
          isPurchasable: false,
        },
      ],
    },
  };
  catalogServer = http.createServer((req, res) => {
    res.writeHead(catalogState.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(catalogState.body));
  });
  await new Promise((r) => catalogServer.listen(0, '127.0.0.1', r));

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'test_catalog_merge_secret';
  process.env.CLIENT_URL = 'http://localhost:5175';
  process.env.COOKIE_SAMESITE = 'lax';
  process.env.STUDENT_BACKEND_URL = `http://127.0.0.1:${catalogServer.address().port}`;
  process.env.STUDENT_BACKEND_SERVICE_KEY = 'test_key';

  const { connectDatabase } = await import('../src/config/db.js');
  await connectDatabase();

  const { createApp } = await import('../src/app.js');
  server = http.createServer(createApp());
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;

  const { Admin } = await import('../src/models/Admin.js');
  await Admin.create({
    name: 'Catalog Admin',
    email: 'catalog.admin@test.local',
    passwordHash: await Admin.hashPassword('TestPass123!'),
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
  });
});

after(async () => {
  await new Promise((r) => server.close(r));
  await new Promise((r) => catalogServer.close(r));
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

const login = () =>
  call('/api/admin/auth/login', { method: 'POST', body: { email: 'catalog.admin@test.local', password: 'TestPass123!' } });

test('the admin course list includes courses the student service owns', async () => {
  const { cookie } = await login();
  const res = await call('/api/admin/courses', { cookie });

  assert.equal(res.status, 200, JSON.stringify(res.body));
  const slugs = res.body.data.map((c) => c.slug);
  assert.ok(slugs.includes('prarambh'), `prarambh missing from ${JSON.stringify(slugs)}`);
  assert.ok(slugs.includes('python-for-beginners'));
  assert.equal(res.body.meta.catalogAvailable, true);
});

test('a merged course carries the price the student service charges', async () => {
  const { cookie } = await login();
  const res = await call('/api/admin/courses', { cookie });
  const prarambh = res.body.data.find((c) => c.slug === 'prarambh');

  // Not a copy kept here - the figure comes from the catalogue on every read,
  // so the admin screen and checkout cannot disagree.
  assert.equal(prarambh.priceInPaise, 500000);
  assert.equal(prarambh.origin, 'student-catalog');
  assert.equal(prarambh.readOnly, true);
});

test('a merged course opens on the details route instead of 404ing', async () => {
  const { cookie } = await login();
  const res = await call('/api/admin/courses/student:prarambh', { cookie });

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.slug, 'prarambh');
  assert.equal(res.body.data.priceInPaise, 500000);
  assert.equal(res.body.data.readOnly, true);
});

test('a merged course cannot be edited, deleted, or re-statused from here', async () => {
  const { cookie } = await login();

  for (const [method, path, body] of [
    ['PUT', '/api/admin/courses/student:prarambh', { title: 'Hijacked' }],
    ['PATCH', '/api/admin/courses/student:prarambh/status', { status: 'ARCHIVED' }],
    ['DELETE', '/api/admin/courses/student:prarambh', undefined],
  ]) {
    const res = await call(path, { method, body, cookie });
    assert.ok(res.status >= 400 && res.status < 500, `${method} ${path} must be refused, got ${res.status}`);
    assert.notEqual(res.status, 500, `${method} ${path} must refuse cleanly`);
  }

  // And the catalogue is untouched by the attempts.
  const after = await call('/api/admin/courses/student:prarambh', { cookie });
  assert.equal(after.body.data.title, 'PRARAMBH — The Awakening');
});

test("a course this portal owns is not duplicated by its student projection", async () => {
  const { cookie } = await login();
  const { Course } = await import('../src/models/Course.js');
  await Course.create({
    code: 'OWNED-01', title: 'Owned Prarambh', slug: 'prarambh',
    status: 'APPROVED', priceInPaise: 500000,
  });

  const res = await call('/api/admin/courses', { cookie });
  const prarambhRows = res.body.data.filter((c) => c.slug === 'prarambh');
  assert.equal(prarambhRows.length, 1, 'the owned record wins; the projection is not a second course');
  assert.equal(prarambhRows[0].origin, 'admin-portal');

  await Course.deleteOne({ code: 'OWNED-01' });
});

test('an unreachable catalogue degrades rather than emptying the page', async () => {
  const { cookie } = await login();
  const previous = catalogState.status;
  catalogState.status = 503;
  try {
    const res = await call('/api/admin/courses', { cookie });
    assert.equal(res.status, 200, 'the course list still renders');
    assert.equal(res.body.meta.catalogAvailable, false, 'and says the rest could not be loaded');
  } finally {
    catalogState.status = previous;
  }
});

test('a soft-deleted course stays out of the merged list', async () => {
  const { cookie } = await login();
  const { Course } = await import('../src/models/Course.js');
  const gone = await Course.create({
    code: 'QA-GONE-01', title: 'QA Verification Course', slug: 'qa-verification-course',
    status: 'ARCHIVED', priceInPaise: 100000, deletedAt: new Date(),
  });

  const res = await call('/api/admin/courses', { cookie });
  const codes = res.body.data.map((c) => c.code);
  assert.ok(!codes.includes('QA-GONE-01'), 'deletedAt must hide it from every admin surface');

  await Course.deleteOne({ _id: gone._id });
});
