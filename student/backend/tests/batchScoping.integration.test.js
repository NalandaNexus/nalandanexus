import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { bootTestApp, registerAndLogin, bearer } from './helpers/testApp.js';

/**
 * Batch scoping on the student side.
 *
 * A course (PRARAMBH) runs several batches (PB1, PB2), each with its own teacher
 * and its own timetable. A student buys the COURSE and is placed in ONE batch.
 * Lectures were scoped by course alone, so every student of the course received
 * - and could join - every batch's session. These tests pin down that a student
 * sees their own batch's lectures and the course-wide ones, and nothing else.
 */

let ctx;
let request;
let Course;
let Enrollment;
let LiveClass;

const PB1 = '650000000000000000000aa1';
const PB2 = '650000000000000000000aa2';

before(async () => {
  ctx = await bootTestApp();
  request = ctx.request;
  ({ Course } = await import('../src/models/Course.js'));
  ({ Enrollment } = await import('../src/models/Enrollment.js'));
  ({ LiveClass } = await import('../src/models/LiveClass.js'));
});

after(async () => {
  await ctx.teardown();
});

async function makeCourse(slug, title) {
  return Course.create({
    slug,
    title,
    description: 'Foundation of future ready skills',
    priceInPaise: 100000,
    isPublished: true,
    isPurchasable: true,
  });
}

test('a student only sees lectures for the batch they were placed in', async () => {
  const course = await makeCourse('prarambh', 'PRARAMBH — The Awakening');

  const alice = await registerAndLogin(request, { name: 'Alice PB1', email: 'alice.pb1@example.com' });
  const bob = await registerAndLogin(request, { name: 'Bob PB2', email: 'bob.pb2@example.com' });

  await Enrollment.create({
    enrollmentId: 'ENR-2026-900001',
    userId: alice.user.id || alice.user._id,
    courseId: course._id,
    batchId: PB1,
    status: 'active',
  });
  await Enrollment.create({
    enrollmentId: 'ENR-2026-900002',
    userId: bob.user.id || bob.user._id,
    courseId: course._id,
    batchId: PB2,
    status: 'active',
  });

  const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  await LiveClass.create({ courseId: course._id, batchId: PB1, title: 'PB1 Only Lecture', instructor: 'Teacher A', scheduledAt: future, joinUrl: 'https://example.com/pb1' });
  await LiveClass.create({ courseId: course._id, batchId: PB2, title: 'PB2 Only Lecture', instructor: 'Teacher B', scheduledAt: future, joinUrl: 'https://example.com/pb2' });
  await LiveClass.create({ courseId: course._id, batchId: null, title: 'Course Wide Session', instructor: 'Head Faculty', scheduledAt: future, joinUrl: 'https://example.com/all' });

  const aliceRes = await request.get('/api/student/live-classes').set(bearer(alice.accessToken));
  const bobRes = await request.get('/api/student/live-classes').set(bearer(bob.accessToken));

  const aliceTitles = aliceRes.body.data.upcoming.map((l) => l.title).sort();
  const bobTitles = bobRes.body.data.upcoming.map((l) => l.title).sort();

  assert.deepEqual(aliceTitles, ['Course Wide Session', 'PB1 Only Lecture'], 'PB1 student sees their batch plus course-wide');
  assert.deepEqual(bobTitles, ['Course Wide Session', 'PB2 Only Lecture'], 'PB2 student must not see PB1 lectures');
});

test('a student awaiting batch placement still sees course-wide sessions only', async () => {
  const course = await makeCourse('unplaced-course', 'Unplaced Course');
  const carol = await registerAndLogin(request, { name: 'Carol Unplaced', email: 'carol.unplaced@example.com' });

  await Enrollment.create({
    enrollmentId: 'ENR-2026-900003',
    userId: carol.user.id || carol.user._id,
    courseId: course._id,
    batchId: null,
    status: 'active',
  });

  const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  await LiveClass.create({ courseId: course._id, batchId: PB1, title: 'Some Batch Lecture', instructor: 'T', scheduledAt: future, joinUrl: 'https://example.com/x' });
  await LiveClass.create({ courseId: course._id, batchId: null, title: 'Orientation For Everyone', instructor: 'T', scheduledAt: future, joinUrl: 'https://example.com/y' });

  const res = await request.get('/api/student/live-classes').set(bearer(carol.accessToken));
  const titles = res.body.data.upcoming.map((l) => l.title).sort();

  assert.deepEqual(titles, ['Orientation For Everyone'], 'an unplaced student belongs to no batch, so no batch lecture is theirs');
});

test('a student not enrolled in the course sees none of its lectures', async () => {
  const course = await makeCourse('private-course', 'Private Course');
  const dave = await registerAndLogin(request, { name: 'Dave Outsider', email: 'dave.outsider@example.com' });

  const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  await LiveClass.create({ courseId: course._id, batchId: PB1, title: 'Paid Batch Lecture', instructor: 'T', scheduledAt: future, joinUrl: 'https://example.com/z' });

  const res = await request.get('/api/student/live-classes').set(bearer(dave.accessToken));
  const titles = res.body.data.upcoming.map((l) => l.title);
  assert.ok(!titles.includes('Paid Batch Lecture'), 'a lecture must never reach someone who has not bought the course');
});

test('an enrollment identifier is unique, and its shape is the documented one', async () => {
  const { nextEnrollmentId } = await import('../src/services/enrollment.service.js');

  const issued = await Promise.all(Array.from({ length: 25 }, () => nextEnrollmentId()));

  assert.equal(new Set(issued).size, 25, 'concurrent issuance must never repeat a number');
  for (const id of issued) {
    assert.match(id, /^ENR-\d{4}-\d{6}$/, `unexpected shape: ${id}`);
  }
});

test('an issued enrollment identifier cannot be overwritten', async () => {
  const course = await makeCourse('immutable-course', 'Immutable Course');
  const erin = await registerAndLogin(request, { name: 'Erin Fixed', email: 'erin.fixed@example.com' });

  const enrollment = await Enrollment.create({
    enrollmentId: 'ENR-2026-950001',
    userId: erin.user.id || erin.user._id,
    courseId: course._id,
    status: 'active',
  });

  enrollment.enrollmentId = 'ENR-2026-999999';
  await assert.rejects(() => enrollment.save(), /immutable/i, 'a quoted business identifier must never be reissued');

  const fresh = await Enrollment.findById(enrollment._id).lean();
  assert.equal(fresh.enrollmentId, 'ENR-2026-950001');
});

test('two enrollments cannot share an identifier', async () => {
  const courseA = await makeCourse('dup-a', 'Dup A');
  const courseB = await makeCourse('dup-b', 'Dup B');
  const frank = await registerAndLogin(request, { name: 'Frank Dup', email: 'frank.dup@example.com' });
  const userId = frank.user.id || frank.user._id;

  await Enrollment.create({ enrollmentId: 'ENR-2026-960001', userId, courseId: courseA._id, status: 'active' });
  await assert.rejects(
    () => Enrollment.create({ enrollmentId: 'ENR-2026-960001', userId, courseId: courseB._id, status: 'active' }),
    (err) => err?.code === 11000,
    'the unique index must reject a duplicate identifier'
  );
});

/**
 * What the student is actually told about their own enrollment.
 *
 * The endpoint used to send this database's ObjectId under the name
 * `enrollmentId`, so any screen rendering it would have shown an internal key
 * where the student expects the ENR-YYYY-NNNNNN they quote to support.
 */
test('a student is shown their business enrollment identity, batch and teacher', async () => {
  const course = await makeCourse('identity-course', 'Identity Course');
  const gina = await registerAndLogin(request, { name: 'Gina Identity', email: 'gina.identity@example.com' });

  const created = await Enrollment.create({
    enrollmentId: 'ENR-2026-970001',
    userId: gina.user.id || gina.user._id,
    courseId: course._id,
    batchId: PB1,
    batchCode: 'PB1',
    status: 'active',
    assignedTeacher: { teacherId: 't-1', name: 'Faculty Name', avatarUrl: null, resolvedAt: new Date() },
  });

  const res = await request.get('/api/student/courses').set(bearer(gina.accessToken));
  assert.equal(res.status, 200);

  const row = res.body.data.find((c) => c.slug === 'identity-course');
  assert.ok(row, 'the enrolled course must be listed');
  assert.equal(row.enrollmentId, 'ENR-2026-970001', 'the business identifier, not the database key');
  assert.notEqual(row.enrollmentId, String(created._id), 'the internal id must never masquerade as the enrollment id');
  assert.equal(row.batchCode, 'PB1', 'the student can see which batch they are in');
  assert.equal(row.teacherName, 'Faculty Name', 'and who teaches it');
  assert.equal(row.status, 'active');
});

test('an unplaced student is told so honestly rather than shown a wrong batch', async () => {
  const course = await makeCourse('pending-course', 'Pending Course');
  const hank = await registerAndLogin(request, { name: 'Hank Pending', email: 'hank.pending@example.com' });

  await Enrollment.create({
    enrollmentId: 'ENR-2026-980001',
    userId: hank.user.id || hank.user._id,
    courseId: course._id,
    status: 'active',
  });

  const res = await request.get('/api/student/courses').set(bearer(hank.accessToken));
  const row = res.body.data.find((c) => c.slug === 'pending-course');
  assert.equal(row.batchCode, null, 'awaiting placement is a real state, not a fabricated batch');
  assert.equal(row.teacherName, null);
  assert.equal(row.enrollmentId, 'ENR-2026-980001', 'the identity is issued even before placement');
});
