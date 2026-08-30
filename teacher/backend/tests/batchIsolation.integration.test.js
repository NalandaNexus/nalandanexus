import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { bootTestApp, createTeacherAndLogin } from './helpers/testApp.js';

/**
 * Batch isolation: the coaching model's central rule.
 *
 * One course (PRARAMBH) carries several batches (PB1, PB2, PB3), each with its
 * own teacher, its own students and its own lectures. A student enrolls in the
 * COURSE and is then placed in ONE batch. The teacher of PB1 must see the
 * students placed in PB1 and nobody else.
 *
 * Enrollment sync matches on `studentCourseSlug` alone, so every batch pointing
 * at a course receives every student enrolled in that course. With one batch per
 * course that is invisible; the moment a second batch is opened it becomes a
 * cross-batch data leak. These tests pin the rule down.
 */

let ctx;
let api;
let student;
let SchoolClass;
let Student;

const COURSES = [{ slug: 'prarambh', title: 'PRARAMBH — The Awakening', category: 'Foundation', isPurchasable: true }];

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
  student.state.courses = COURSES;
});

async function signIn(label) {
  const email = `${label}.${Math.random().toString(36).slice(2, 8)}@nalanda.test`;
  return createTeacherAndLogin(api, { name: `Teacher ${label}`, email });
}

async function createBatch(cookie, name) {
  const res = await api('POST', '/api/teacher/classes', {
    cookie,
    body: { name, studentCourseSlug: 'prarambh', capacity: 60 },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.data.id;
}

/**
 * Two batches of ONE course must not receive each other's students.
 *
 * This is the enrollment-to-batch relationship: a student belongs to exactly one
 * batch of a course, and sync must honour that placement rather than treating
 * "enrolled in the course" as "belongs to every batch of the course".
 */
test('two batches of the same course do not receive each other students', async () => {
  const teacherA = await signIn('pb1');
  const teacherB = await signIn('pb2');

  const pb1 = await createBatch(teacherA.cookie, 'PB1');
  const pb2 = await createBatch(teacherB.cookie, 'PB2');

  // Two students bought the same course but were placed in different batches.
  student.state.enrolledBySlug.prarambh = [
    {
      userId: '650000000000000000000101',
      enrollmentId: 'ENR-2026-000001',
      batchId: pb1,
      name: 'Student In PB1',
      email: 'pb1.student@example.com',
      avatar: null,
    },
    {
      userId: '650000000000000000000102',
      enrollmentId: 'ENR-2026-000002',
      batchId: pb2,
      name: 'Student In PB2',
      email: 'pb2.student@example.com',
      avatar: null,
    },
  ];

  await api('POST', `/api/teacher/classes/${pb1}/sync-enrollment`, { cookie: teacherA.cookie });
  await api('POST', `/api/teacher/classes/${pb2}/sync-enrollment`, { cookie: teacherB.cookie });

  const rosterA = await api('GET', `/api/teacher/classes/${pb1}/students`, { cookie: teacherA.cookie });
  const rosterB = await api('GET', `/api/teacher/classes/${pb2}/students`, { cookie: teacherB.cookie });

  const emailsA = rosterA.body.data.map((s) => s.email).sort();
  const emailsB = rosterB.body.data.map((s) => s.email).sort();

  assert.deepEqual(emailsA, ['pb1.student@example.com'], 'PB1 must hold only its own student');
  assert.deepEqual(emailsB, ['pb2.student@example.com'], 'PB2 must hold only its own student');
});

/** An enrollment with no batch placement yet must not be pulled into an arbitrary batch. */
test('an unplaced enrollment is not swept into a batch', async () => {
  const { cookie } = await signIn('unplaced');
  const pb1 = await createBatch(cookie, 'PB1 Unplaced');

  student.state.enrolledBySlug.prarambh = [
    {
      userId: '650000000000000000000103',
      enrollmentId: 'ENR-2026-000003',
      batchId: null,
      name: 'Not Yet Placed',
      email: 'unplaced@example.com',
      avatar: null,
    },
  ];

  const res = await api('POST', `/api/teacher/classes/${pb1}/sync-enrollment`, { cookie });
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const roster = await api('GET', `/api/teacher/classes/${pb1}/students`, { cookie });
  assert.equal(roster.body.data.length, 0, 'a student awaiting placement belongs to no batch yet');
});

/**
 * Enrollment ID is the authoritative identity, not the email address.
 *
 * Matching on email alone means a student who changes their address on the
 * student portal is re-imported as a second roster row, orphaning their grades
 * and attendance under the old one.
 */
test('a student who changes their email keeps the same roster row', async () => {
  const { cookie } = await signIn('rename');
  const pb1 = await createBatch(cookie, 'PB1 Rename');

  student.state.enrolledBySlug.prarambh = [
    {
      userId: '650000000000000000000104',
      enrollmentId: 'ENR-2026-000004',
      batchId: pb1,
      name: 'Original Name',
      email: 'original@example.com',
      avatar: null,
    },
  ];
  await api('POST', `/api/teacher/classes/${pb1}/sync-enrollment`, { cookie });
  assert.equal(await Student.countDocuments({ class: pb1 }), 1);

  // Same enrollment, new email.
  student.state.enrolledBySlug.prarambh[0].email = 'changed@example.com';
  const second = await api('POST', `/api/teacher/classes/${pb1}/sync-enrollment`, { cookie });
  assert.equal(second.status, 200, JSON.stringify(second.body));

  const rows = await Student.find({ class: pb1 }).lean();
  assert.equal(rows.length, 1, 'the enrollment is the same person, so the row must be reused');
  assert.equal(rows[0].email, 'changed@example.com', 'and its email updated');
});

/** Capacity is a business rule and must hold on the server, whatever the client sends. */
test('a batch cannot be filled past its capacity', async () => {
  const { cookie } = await signIn('capacity');
  const res = await api('POST', '/api/teacher/classes', {
    cookie,
    body: { name: 'PB Small', studentCourseSlug: 'prarambh', capacity: 2 },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const batchId = res.body.data.id;

  student.state.enrolledBySlug.prarambh = [1, 2, 3].map((n) => ({
    userId: `65000000000000000000020${n}`,
    enrollmentId: `ENR-2026-00001${n}`,
    batchId,
    name: `Capacity Student ${n}`,
    email: `capacity${n}@example.com`,
    avatar: null,
  }));

  const sync = await api('POST', `/api/teacher/classes/${batchId}/sync-enrollment`, { cookie });
  assert.equal(sync.status, 200, JSON.stringify(sync.body));

  const enrolled = await Student.countDocuments({ class: batchId, linkedUserId: { $ne: null } });
  assert.ok(enrolled <= 2, `capacity 2 must not be exceeded, found ${enrolled}`);
  assert.equal(sync.body.data.overCapacity, 1, 'the batch must report the placement it could not accept');
});
