import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { bootTestApp, createTeacherAndLogin } from './helpers/testApp.js';

/**
 * Batch placement: the call the student portal makes at purchase time.
 *
 * It owns the enrollment but not the batches, their capacity, or their teachers,
 * so it asks this service which batch a newly-paid student joins. Capacity is a
 * real business rule (a coaching batch seats 50-60), so it has to hold on the
 * server under concurrency, not merely in a form.
 */

let ctx;
let api;
let student;
let SchoolClass;
let Student;

const KEY = { 'X-Internal-Service-Key': 'test_service_key' };

/**
 * Each test gets its own course.
 *
 * The suite shares one database, so batches created by an earlier test stay
 * visible to a later one - and placement deliberately searches every batch of a
 * course. Sharing a slug would make tests place students into each other's
 * batches, which is a fixture problem, not the behaviour under test. Separate
 * courses is also what production looks like.
 */
let courseSlug;

before(async () => {
  ctx = await bootTestApp();
  api = ctx.api;
  student = ctx.student;
  ({ SchoolClass } = await import('../src/models/SchoolClass.js'));
  ({ Student } = await import('../src/models/Student.js'));
});

after(async () => {
  await ctx.teardown();
});

beforeEach(() => {
  student.reset();
  courseSlug = `course-${Math.random().toString(36).slice(2, 10)}`;
  student.state.courses = [{ slug: courseSlug, title: `Course ${courseSlug}`, isPurchasable: true }];
});

async function signIn(label) {
  const email = `${label}.${Math.random().toString(36).slice(2, 8)}@nalanda.test`;
  return createTeacherAndLogin(api, { name: `Teacher ${label}`, email });
}

async function createBatch(cookie, name, capacity) {
  const res = await api('POST', '/api/teacher/classes', {
    cookie,
    body: { name, studentCourseSlug: courseSlug, capacity },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.data.id;
}

function place(enrollmentId, studentName = 'Test Student') {
  return api('POST', '/api/internal/batches/place', {
    headers: KEY,
    body: { studentCourseSlug: courseSlug, enrollmentId, studentName },
  });
}

test('a paid enrollment is placed into a batch of its course', async () => {
  const { cookie } = await signIn('place');
  const pb1 = await createBatch(cookie, 'PB1 Place', 60);

  const res = await place('ENR-2026-200001');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.batchId, pb1);
  assert.equal(res.body.data.alreadyPlaced, false);

  const batch = await SchoolClass.findById(pb1).lean();
  assert.equal(batch.enrolledCount, 1, 'the seat is recorded on the batch');
});

test('placement is idempotent - a retry never consumes a second seat', async () => {
  const { cookie } = await signIn('idem');
  const pb1 = await createBatch(cookie, 'PB1 Idem', 60);

  const first = await place('ENR-2026-200002');
  const second = await place('ENR-2026-200002');

  assert.equal(first.body.data.alreadyPlaced, false);
  assert.equal(second.body.data.alreadyPlaced, true, 'the second call reports the existing placement');
  assert.equal(second.body.data.batchId, pb1);

  assert.equal(await Student.countDocuments({ enrollmentId: 'ENR-2026-200002' }), 1);
  const batch = await SchoolClass.findById(pb1).lean();
  assert.equal(batch.enrolledCount, 1, 'a retry must not take another seat');
});

test('capacity is enforced exactly - the seat after the last one is refused', async () => {
  const { cookie } = await signIn('exact');
  const pb = await createBatch(cookie, 'PB Exact', 3);

  const results = [];
  for (let i = 1; i <= 4; i += 1) {
    const res = await place(`ENR-2026-30000${i}`, `Student ${i}`);
    results.push(res.body.data);
  }

  assert.ok(results[0] && results[1] && results[2], 'the first three fit');
  assert.equal(results[3], null, 'the fourth is refused, not squeezed in');

  const batch = await SchoolClass.findById(pb).lean();
  assert.equal(batch.enrolledCount, 3);
  assert.equal(await Student.countDocuments({ class: pb }), 3);
});

/**
 * The launch-day case: many purchases landing at once on the last few seats.
 *
 * A check-then-insert would let several of these all read "2 taken, room for
 * one more" before any of them wrote, and overfill the batch.
 */
test('simultaneous purchases cannot oversubscribe the final seats', async () => {
  const { cookie } = await signIn('race');
  const pb = await createBatch(cookie, 'PB Race', 5);

  const attempts = Array.from({ length: 12 }, (_, i) => place(`ENR-2026-4000${String(i).padStart(2, '0')}`, `Racer ${i}`));
  const settled = await Promise.all(attempts);

  const placed = settled.filter((r) => r.body.data).length;
  assert.equal(placed, 5, `exactly 5 seats exist, ${placed} were handed out`);

  const batch = await SchoolClass.findById(pb).lean();
  assert.equal(batch.enrolledCount, 5, 'the seat counter matches reality');
  assert.equal(await Student.countDocuments({ class: pb }), 5);
});

test('a full course overflows into its next batch with room', async () => {
  const { cookie } = await signIn('overflow');
  const pb1 = await createBatch(cookie, 'PB1 Overflow', 2);
  const pb2 = await createBatch(cookie, 'PB2 Overflow', 2);

  const placements = [];
  for (let i = 1; i <= 4; i += 1) {
    const res = await place(`ENR-2026-50000${i}`, `Overflow ${i}`);
    placements.push(res.body.data.batchId);
  }

  assert.equal(placements.filter((b) => b === pb1).length, 2);
  assert.equal(placements.filter((b) => b === pb2).length, 2);

  const fifth = await place('ENR-2026-500005', 'Overflow 5');
  assert.equal(fifth.body.data, null, 'with every batch full, placement reports no room rather than overfilling');
});

test('an archived batch is never used for placement', async () => {
  const { cookie } = await signIn('archived');
  const open = await createBatch(cookie, 'PB Open', 60);
  const closed = await createBatch(cookie, 'PB Closed', 60);
  await api('DELETE', `/api/teacher/classes/${closed}`, { cookie }); // archives it

  const res = await place('ENR-2026-600001');
  assert.equal(res.body.data.batchId, open, 'only an active batch may receive a student');
});

test('placement requires the internal service key', async () => {
  const { cookie } = await signIn('nokey');
  await createBatch(cookie, 'PB Secure', 60);

  const res = await api('POST', '/api/internal/batches/place', {
    body: { studentCourseSlug: courseSlug, enrollmentId: 'ENR-2026-700001' },
  });
  assert.equal(res.status, 401, 'an unauthenticated caller cannot place students');
  assert.equal(await Student.countDocuments({ enrollmentId: 'ENR-2026-700001' }), 0);
});

test('a malformed enrollment identifier is rejected', async () => {
  const { cookie } = await signIn('badid');
  await createBatch(cookie, 'PB Validate', 60);

  for (const bad of ['', '   ', '<script>alert(1)</script>', 'a'.repeat(100), 'ENR/../../etc']) {
    const res = await api('POST', '/api/internal/batches/place', {
      headers: KEY,
      body: { studentCourseSlug: courseSlug, enrollmentId: bad },
    });
    assert.equal(res.status, 422, `"${bad.slice(0, 20)}" should be refused, got ${res.status}`);
  }
});

test('a course with no batches yet reports no room rather than failing', async () => {
  const res = await place('ENR-2026-800001');
  assert.equal(res.status, 200, 'a paid student must never see an error here');
  assert.equal(res.body.data, null);
  assert.match(res.body.message, /no batch/i);
});
