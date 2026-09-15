import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { bootTestApp, createTeacherAndLogin } from './helpers/testApp.js';

/**
 * A student's record from the student portal, applied to the roster.
 *
 * Placement creates a roster row when a student buys a course, but only with a
 * placeholder email and no link to their account - and the Students list shows
 * linked rows only, so a student who had paid was invisible to their teacher
 * until somebody pressed Sync. These tests are about what the record changes
 * when it arrives, and just as much about what it must not: another teacher's
 * roster, rows placed for other enrolments, anything a teacher owns, or a
 * newer record already applied.
 */

let ctx;
let api;
let student;
let Student;
let courseSlug;

const KEY = { 'X-Internal-Service-Key': 'test_service_key' };
const uniq = () => crypto.randomBytes(3).toString('hex');
const objectId = () => crypto.randomBytes(12).toString('hex');

before(async () => {
  ctx = await bootTestApp();
  api = ctx.api;
  student = ctx.student;
  ({ Student } = await import('../src/models/Student.js'));
  await Student.init();
});

after(async () => {
  await ctx.teardown();
});

beforeEach(() => {
  student.reset();
  courseSlug = `course-${uniq()}`;
  student.state.courses = [
    { slug: courseSlug, title: `Course ${courseSlug}`, isPurchasable: true },
    { slug: `${courseSlug}-other`, title: 'Another course', isPurchasable: true },
  ];
});

async function teacher(label) {
  return createTeacherAndLogin(api, { name: `Teacher ${label}`, email: `${label}.${uniq()}@nalanda.test` });
}

async function createBatch(cookie, name, slug = courseSlug) {
  const res = await api('POST', '/api/teacher/classes', { cookie, body: { name, studentCourseSlug: slug, capacity: 60 } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.data.id;
}

async function place(enrollmentId, studentName, slug = courseSlug) {
  const res = await api('POST', '/api/internal/batches/place', { headers: KEY, body: { studentCourseSlug: slug, enrollmentId, studentName } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.data;
}

function record(overrides = {}) {
  return {
    userId: overrides.userId || objectId(),
    enrollmentNumber: 'NN26-000124',
    fullName: 'Aarav Sharma',
    email: `aarav.${uniq()}@example.com`,
    phone: '+919876543210',
    avatar: null,
    guardianName: 'Sunita Sharma',
    grade: 'Class 9',
    profileComplete: true,
    enrollments: [],
    sourceUpdatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const send = (rec, headers = KEY) => api('PUT', `/api/internal/portal-students/${rec.userId}`, { headers, body: rec });

async function roster(cookie) {
  const res = await api('GET', '/api/teacher/students?limit=100', { cookie });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.data?.students || res.body.data || [];
}

const later = (ms) => new Date(Date.now() + ms).toISOString();

test('a placed student appears on their teacher\'s list, by name, as soon as their record arrives', async () => {
  const anita = await teacher('anita');
  const batchId = await createBatch(anita.cookie, 'PB1 Sync');
  const enrollmentId = `ENR-2026-${Math.floor(Math.random() * 900000 + 100000)}`;
  await place(enrollmentId, 'Aarav');

  const hidden = (await roster(anita.cookie)).find((s) => s.enrollmentId === enrollmentId);
  assert.equal(hidden, undefined, 'placement alone does not put an unverified row on the list');

  const rec = record({ enrollments: [{ enrollmentId, status: 'active', batchId }] });
  const res = await send(rec);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.linked, 1);

  const row = (await roster(anita.cookie)).find((s) => s.enrollmentId === enrollmentId);
  assert.ok(row, 'the student is on the list without anybody pressing Sync');
  assert.equal(row.name, 'Aarav Sharma', 'with the name the student portal holds');
  assert.equal(row.email, rec.email, 'and their real email instead of the placement placeholder');
  assert.equal(row.enrollmentNumber, 'NN26-000124');
  assert.equal(row.verified, true);

  const detail = await api('GET', `/api/teacher/students/${row.id}`, { cookie: anita.cookie });
  assert.equal(detail.status, 200, JSON.stringify(detail.body));
  assert.equal(detail.body.data.grade, 'Class 9');
  assert.equal(detail.body.data.guardianName, 'Sunita Sharma');
  assert.equal(detail.body.data.phone, '+919876543210');
});

test('another teacher neither lists the student nor finds them by enrollment number', async () => {
  const anita = await teacher('owner');
  const vikram = await teacher('other');
  const batchId = await createBatch(anita.cookie, 'PB1 Owner');
  await createBatch(vikram.cookie, 'PY1 Other', `${courseSlug}-other`);
  const enrollmentId = `ENR-2026-${Math.floor(Math.random() * 900000 + 100000)}`;
  await place(enrollmentId, 'Aarav');

  const rec = record({ enrollmentNumber: 'NN26-000777', enrollments: [{ enrollmentId, status: 'active', batchId }] });
  assert.equal((await send(rec)).status, 200);

  assert.ok((await roster(anita.cookie)).some((s) => s.enrollmentId === enrollmentId));
  assert.equal((await roster(vikram.cookie)).some((s) => s.enrollmentId === enrollmentId), false, 'nothing reaches a roster it was not placed on');

  student.state.lookupStudents = [
    { userId: rec.userId, enrollmentNumber: 'NN26-000777', fullName: rec.fullName, email: rec.email, enrollments: [{ enrollmentId, courseSlug, status: 'active' }] },
  ];
  const own = await api('GET', '/api/teacher/students/enrollment-number/NN26-000777', { cookie: anita.cookie });
  const foreign = await api('GET', '/api/teacher/students/enrollment-number/NN26-000777', { cookie: vikram.cookie });
  assert.equal(own.status, 200, JSON.stringify(own.body));
  assert.equal(foreign.status, 404, 'the other teacher gets the same answer as for a number nobody holds');
});

test('the same record twice changes nothing the second time, and never adds a row', async () => {
  const anita = await teacher('idem');
  const batchId = await createBatch(anita.cookie, 'PB1 Idem');
  const enrollmentId = `ENR-2026-${Math.floor(Math.random() * 900000 + 100000)}`;
  await place(enrollmentId, 'Aarav');

  const rec = record({ enrollments: [{ enrollmentId, status: 'active', batchId }] });
  const first = await send(rec);
  const second = await send(rec);
  assert.equal(first.body.data.updated, 1);
  assert.equal(second.status, 200);
  assert.equal(second.body.data.updated, 0);
  assert.equal(second.body.data.unchanged, 1);
  assert.equal(await Student.countDocuments({ enrollmentId }), 1);
});

test('a later name replaces the earlier one; an older record arriving late is ignored', async () => {
  const anita = await teacher('rename');
  const batchId = await createBatch(anita.cookie, 'PB1 Rename');
  const enrollmentId = `ENR-2026-${Math.floor(Math.random() * 900000 + 100000)}`;
  await place(enrollmentId, 'Aarav');
  const enrollments = [{ enrollmentId, status: 'active', batchId }];
  const userId = objectId();

  const t0 = new Date().toISOString();
  assert.equal((await send(record({ userId, enrollments, fullName: 'Aarav Sharma', sourceUpdatedAt: t0 }))).status, 200);
  const renamed = await send(record({ userId, enrollments, fullName: 'Aarav Kumar Sharma', sourceUpdatedAt: later(1000) }));
  assert.equal(renamed.body.data.updated, 1);

  const late = await send(record({ userId, enrollments, fullName: 'Aarav Sharma', sourceUpdatedAt: t0 }));
  assert.equal(late.status, 200);
  assert.equal(late.body.data.stale, 1, 'the out-of-order delivery is recognised');

  const row = (await roster(anita.cookie)).find((s) => s.enrollmentId === enrollmentId);
  assert.equal(row.name, 'Aarav Kumar Sharma', 'the newest name stands');
});

test('a revoked enrolment takes the student off the list but keeps the row and its history', async () => {
  const anita = await teacher('revoke');
  const batchId = await createBatch(anita.cookie, 'PB1 Revoke');
  const enrollmentId = `ENR-2026-${Math.floor(Math.random() * 900000 + 100000)}`;
  await place(enrollmentId, 'Aarav');
  const userId = objectId();

  await send(record({ userId, enrollments: [{ enrollmentId, status: 'active', batchId }] }));
  const revoked = await send(record({ userId, enrollments: [{ enrollmentId, status: 'revoked', batchId }], sourceUpdatedAt: later(1000) }));
  assert.equal(revoked.body.data.unlinked, 1);

  assert.equal((await roster(anita.cookie)).some((s) => s.enrollmentId === enrollmentId), false);
  const row = await Student.findOne({ enrollmentId }).lean();
  assert.ok(row, 'the row stays');
  assert.equal(row.linkedUserId, null);
});

test('a record changes only rows placed for its own enrolments', async () => {
  const anita = await teacher('scope');
  const batchId = await createBatch(anita.cookie, 'PB1 Scope');
  const mine = `ENR-2026-${Math.floor(Math.random() * 900000 + 100000)}`;
  const theirs = `ENR-2026-${Math.floor(Math.random() * 900000 + 100000)}`;
  await place(mine, 'Aarav');
  await place(theirs, 'Diya Patel');

  await send(record({ enrollments: [{ enrollmentId: mine, status: 'active', batchId }] }));

  const other = await Student.findOne({ enrollmentId: theirs }).lean();
  assert.equal(other.name, 'Diya Patel');
  assert.equal(other.linkedUserId, null);
  assert.match(other.email, /@placement\.pending$/);
});

test('teacher-owned fields are left alone, and an address a hand-entered row already holds is not taken', async () => {
  const anita = await teacher('owned');
  const batchId = await createBatch(anita.cookie, 'PB1 Owned');
  const enrollmentId = `ENR-2026-${Math.floor(Math.random() * 900000 + 100000)}`;
  await place(enrollmentId, 'Aarav');
  const email = `taken.${uniq()}@example.com`;

  const manual = await api('POST', '/api/teacher/students', { cookie: anita.cookie, body: { name: 'Typed By Teacher', email, classId: batchId } });
  assert.equal(manual.status, 201, JSON.stringify(manual.body));

  await Student.updateOne({ enrollmentId }, { $set: { rollNumber: 'R-42', guardianPhone: '+911111111111', status: 'active' } });

  const res = await send(record({ email, enrollments: [{ enrollmentId, status: 'active', batchId }] }));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const row = await Student.findOne({ enrollmentId }).lean();
  assert.equal(row.name, 'Aarav Sharma');
  assert.ok(row.linkedUserId, 'still verified');
  assert.match(row.email, /@placement\.pending$/, 'the address stays with the row that already had it');
  assert.equal(row.rollNumber, 'R-42');
  assert.equal(row.guardianPhone, '+911111111111');
});

test('the endpoint needs the service key, a matching user id and a well-formed record', async () => {
  const rec = record({ enrollments: [] });
  assert.equal((await send(rec, {})).status, 401);

  const mismatch = await api('PUT', `/api/internal/portal-students/${objectId()}`, { headers: KEY, body: rec });
  assert.equal(mismatch.status, 400);
  assert.equal(mismatch.body.error?.code || mismatch.body.code, 'USER_ID_MISMATCH');

  const malformed = await send({ ...rec, email: 'not-an-email', enrollments: [{ enrollmentId: '$gt', status: 'paid' }] });
  assert.equal(malformed.status, 422);
});
