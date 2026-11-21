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
          subtitle: 'The Awakening',
          duration: '9 Months',
          totalModules: 5,
          totalLessons: 13,
        },
        {
          id: '6a84b83a72e6b674a085fa50',
          slug: 'garud',
          title: 'GARUD — The Rise',
          priceInPaise: 0,
          isPurchasable: false,
          duration: '9 Months',
          totalModules: 18,
          totalLessons: 106,
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
    // A suspended Render service answers 503. The administrator is told what
    // failed and which address was tried, so a wrong STUDENT_BACKEND_URL is
    // visible on the page instead of looking like "there are no courses".
    assert.equal(res.body.meta.catalogError, 'REQUEST_FAILED');
    assert.match(res.body.meta.catalogErrorDetail, /503/);
    assert.equal(res.body.meta.catalogHost, `127.0.0.1:${catalogServer.address().port}`);
    assert.ok(!res.body.data.some((c) => c.slug === 'prarambh'));
  } finally {
    catalogState.status = previous;
  }
});

test('a catalogue course card carries its duration, modules and lessons', async () => {
  const { cookie } = await login();
  const res = await call('/api/admin/courses', { cookie });
  const garud = res.body.data.find((c) => c.slug === 'garud');
  assert.equal(garud.duration, '9 Months');
  assert.equal(garud.totalModules, 18);
  assert.equal(garud.totalLessons, 106);
  const prarambh = res.body.data.find((c) => c.slug === 'prarambh');
  assert.equal(prarambh.subtitle, 'The Awakening');
  assert.equal(prarambh.totalLessons, 13);
});

test('each course reports its assigned teachers and active enrolments from this portal\'s records', async () => {
  const { Teacher } = await import('../src/models/Teacher.js');
  const { Student } = await import('../src/models/Student.js');
  const stamp = Date.now();
  await Teacher.create([
    { name: 'T One', email: `t1.${stamp}@test.local`, teacherId: `TCH-C${stamp}1`, status: 'ACTIVE', assignedCourses: [{ slug: 'garud' }, { slug: 'prarambh' }] },
    { name: 'T Two', email: `t2.${stamp}@test.local`, teacherId: `TCH-C${stamp}2`, status: 'ACTIVE', assignedCourses: [{ slug: 'garud' }] },
    // A deleted teacher no longer counts.
    { name: 'T Gone', email: `t3.${stamp}@test.local`, teacherId: `TCH-C${stamp}3`, status: 'INACTIVE', deletedAt: new Date(), assignedCourses: [{ slug: 'garud' }] },
  ]);
  const enrol = (slug, status) => ({ enrollmentId: `E-${slug}-${Math.random()}`, courseSlug: slug, status });
  await Student.create([
    { name: 'S One', email: `s1.${stamp}@test.local`, rollNo: `R${stamp}1`, source: 'student-portal', portalUserId: `u1${stamp}`, portalEnrollments: [enrol('prarambh', 'active'), enrol('garud', 'revoked')] },
    { name: 'S Two', email: `s2.${stamp}@test.local`, rollNo: `R${stamp}2`, source: 'student-portal', portalUserId: `u2${stamp}`, portalEnrollments: [enrol('prarambh', 'active')] },
  ]);

  const { cookie } = await login();
  const res = await call('/api/admin/courses', { cookie });
  const bySlug = Object.fromEntries(res.body.data.map((c) => [c.slug, c]));
  assert.equal(bySlug.garud.assignedTeachersCount, 2);
  assert.equal(bySlug.garud.enrolledStudentsCount, 0, 'a revoked enrolment is not counted');
  assert.equal(bySlug.prarambh.assignedTeachersCount, 1);
  assert.equal(bySlug.prarambh.enrolledStudentsCount, 2);
  assert.equal(bySlug['python-for-beginners'].assignedTeachersCount, 0);

  const one = await call('/api/admin/courses/student:garud', { cookie });
  assert.equal(one.status, 200, JSON.stringify(one.body));
  assert.equal(one.body.data.assignedTeachersCount, 2);
  assert.equal(one.body.data.totalModules, 18);
});

test('a course not yet open for enrolment is approved, not archived', async () => {
  const { cookie } = await login();
  const previous = catalogState.body.data;
  catalogState.body = {
    success: true,
    data: [
      ...previous,
      { id: '6a84b83a72e6b674a085fa50', slug: 'garud', title: 'GARUD — The Rise', priceInPaise: 0, isPurchasable: false },
    ],
  };
  try {
    const res = await call('/api/admin/courses', { cookie });
    const garud = res.body.data.find((c) => c.slug === 'garud');

    // Review state and sale state are different things. Calling an upcoming
    // stage ARCHIVED reads as retired, which is the opposite of what it is.
    assert.equal(garud.status, 'APPROVED', 'published content is approved');
    assert.equal(garud.isPurchasable, false, 'and its sale state is reported separately');

    const detail = await call('/api/admin/courses/student:garud', { cookie });
    assert.equal(detail.body.data.status, 'APPROVED');
    assert.equal(detail.body.data.isPurchasable, false);
  } finally {
    catalogState.body = { success: true, data: previous };
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
