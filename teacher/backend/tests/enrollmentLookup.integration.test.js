import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { bootTestApp, createTeacherAndLogin } from './helpers/testApp.js';

/**
 * Searching for a student by enrollment number.
 *
 * The feature is trivial; the boundary is not. An enrollment number is short and
 * sequential, so a teacher could walk the whole range. What this file proves is
 * that doing so yields nothing: a student outside the teacher's own roster is
 * indistinguishable from a number nobody holds, the student portal is only ever
 * asked within the teacher's scope, and its answer is checked again here rather
 * than trusted.
 */

let ctx;
let api;
let portal;
let seq = 0;

before(async () => {
  ctx = await bootTestApp();
  api = ctx.api;
  portal = ctx.student;
});

after(async () => {
  await ctx.teardown();
});

beforeEach(() => {
  portal.reset();
});

const oid = () => new mongoose.Types.ObjectId().toString();
const search = (cookie, number) => api('GET', `/api/teacher/students/enrollment-number/${encodeURIComponent(number)}`, { cookie });

async function teacherWithRoster(label, rows) {
  const { Student } = await import('../src/models/Student.js');
  const { SchoolClass } = await import('../src/models/SchoolClass.js');
  seq += 1;
  const { teacher, cookie } = await createTeacherAndLogin(api, {
    name: `Teacher ${label}`,
    email: `lookup.${label}.${seq}.${Date.now()}@test.local`,
  });
  const klass = await SchoolClass.create({
    name: `Batch ${label}`,
    code: `PB-${label.toUpperCase()}-${seq}`,
    teacher: teacher._id,
    status: 'active',
    studentCourseSlug: 'prarambh',
  });
  const students = [];
  for (const r of rows) {
    students.push(
      await Student.create({
        name: r.name,
        email: `${r.name.toLowerCase().replace(/\s+/g, '.')}.${seq}@example.com`,
        teacher: teacher._id,
        class: klass._id,
        linkedUserId: r.linkedUserId ?? null,
        ...(r.enrollmentId ? { enrollmentId: r.enrollmentId } : {}),
        status: r.status || 'active',
      })
    );
  }
  return { teacher, cookie, klass, students };
}

function portalStudent({ number, userId, enrollments }) {
  return {
    userId,
    enrollmentNumber: number,
    fullName: 'Aarav Sharma',
    guardianName: 'Sunita Sharma',
    grade: 'Class 9',
    phone: '+919876543210',
    email: 'aarav@example.com',
    avatar: null,
    profileComplete: true,
    enrollments,
    // Present to prove it is stripped: a teacher must never receive payment data.
    payments: [{ orderId: 'order-1', status: 'paid', amountInPaise: 500000 }],
  };
}

const enrolment = (enrollmentId, courseSlug = 'prarambh') => ({
  enrollmentId,
  courseSlug,
  courseTitle: courseSlug.toUpperCase(),
  status: 'active',
  enrolledAt: '2026-06-01T00:00:00.000Z',
  batchCode: 'PB1',
});

test('a teacher finds their own student by enrollment number, however it was typed', async () => {
  const userId = oid();
  const mine = await teacherWithRoster('own', [{ name: 'Aarav Sharma', linkedUserId: userId, enrollmentId: 'ENR-2026-000101' }]);
  portal.state.lookupStudents = [portalStudent({ number: 'NN26-000124', userId, enrollments: [enrolment('ENR-2026-000101')] })];

  const res = await search(mine.cookie, ' nn26 000124 ');
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const d = res.body.data;
  assert.equal(d.enrollmentNumber, 'NN26-000124');
  assert.equal(d.fullName, 'Aarav Sharma');
  assert.equal(d.guardianName, 'Sunita Sharma');
  assert.equal(d.grade, 'Class 9');
  assert.equal(d.phone, '+919876543210');
  assert.equal(d.email, 'aarav@example.com');
  assert.equal(d.enrollments.length, 1);
  assert.equal(d.enrollments[0].status, 'active');
  assert.equal(d.payments, undefined, 'payment details never reach a teacher');
  assert.equal(d.classes[0].studentId, String(mine.students[0]._id), 'linked to the roster row, so the profile can be opened');

  const asked = portal.state.lookups.at(-1);
  assert.equal(asked.enrollmentNumber, 'NN26-000124', 'normalised before it leaves this service');
  assert.deepEqual(asked.scope.userIds, [userId]);
  assert.deepEqual(asked.scope.enrollmentIds, ['ENR-2026-000101']);
  assert.equal(asked.includePayments, undefined, 'and payments are never asked for');
});

test("another teacher's student answers exactly like a number nobody holds", async () => {
  const myUser = oid();
  const theirUser = oid();
  const mine = await teacherWithRoster('mine', [{ name: 'My Student', linkedUserId: myUser, enrollmentId: 'ENR-2026-000201' }]);
  const theirs = await teacherWithRoster('theirs', [{ name: 'Their Student', linkedUserId: theirUser, enrollmentId: 'ENR-2026-000301' }]);
  portal.state.lookupStudents = [portalStudent({ number: 'NN26-000300', userId: theirUser, enrollments: [enrolment('ENR-2026-000301')] })];

  const other = await search(mine.cookie, 'NN26-000300');
  const nobody = await search(mine.cookie, 'NN26-999999');
  assert.equal(other.status, 404);
  assert.equal(nobody.status, 404);
  assert.deepEqual(other.body, nobody.body, 'identical, so the response cannot be used to probe other rosters');

  for (const asked of portal.state.lookups) {
    assert.ok(!asked.scope.userIds.includes(theirUser), 'the other teacher student is never part of the question');
    assert.ok(!asked.scope.enrollmentIds.includes('ENR-2026-000301'));
  }

  const ownTeacher = await search(theirs.cookie, 'NN26-000300');
  assert.equal(ownTeacher.status, 200, 'while their own teacher finds them');
});

test('the answer from the student portal is checked again, not trusted', async () => {
  const myUser = oid();
  const strangerUser = oid();
  const mine = await teacherWithRoster('recheck', [{ name: 'Checked Student', linkedUserId: myUser, enrollmentId: 'ENR-2026-000401' }]);

  // A student portal that ignores the scope it was given - a bug or worse - and
  // hands back everything it has.
  portal.state.lookupIgnoresScope = true;
  portal.state.lookupStudents = [
    portalStudent({ number: 'NN26-000500', userId: strangerUser, enrollments: [enrolment('ENR-2026-000501')] }),
    portalStudent({ number: 'NN26-000400', userId: myUser, enrollments: [enrolment('ENR-2026-000401'), enrolment('ENR-2026-000999', 'garud')] }),
  ];

  assert.equal((await search(mine.cookie, 'NN26-000500')).status, 404, 'a student outside the roster is refused even if sent');

  const own = await search(mine.cookie, 'NN26-000400');
  assert.equal(own.status, 200);
  assert.deepEqual(own.body.data.enrollments.map((e) => e.enrollmentId), ['ENR-2026-000401'], 'only the enrolments this teacher teaches');
  assert.equal(own.body.data.payments, undefined);
});

test('a placed student counts before sync; an archived one no longer does', async () => {
  const placedUser = oid();
  const archivedUser = oid();
  const mine = await teacherWithRoster('states', [
    // Placed by the student portal at purchase, not yet matched to an account.
    { name: 'Placed Student', linkedUserId: null, enrollmentId: 'ENR-2026-000601' },
    { name: 'Archived Student', linkedUserId: archivedUser, enrollmentId: 'ENR-2026-000701', status: 'inactive' },
  ]);
  portal.state.lookupStudents = [
    portalStudent({ number: 'NN26-000600', userId: placedUser, enrollments: [enrolment('ENR-2026-000601')] }),
    portalStudent({ number: 'NN26-000700', userId: archivedUser, enrollments: [enrolment('ENR-2026-000701')] }),
  ];

  assert.equal((await search(mine.cookie, 'NN26-000600')).status, 200);
  assert.equal((await search(mine.cookie, 'NN26-000700')).status, 404);
});

test('a teacher with no students never asks the student portal at all', async () => {
  const empty = await teacherWithRoster('empty', []);
  const res = await search(empty.cookie, 'NN26-000124');
  assert.equal(res.status, 404);
  assert.equal(portal.state.lookups.length, 0);
});

test('a hand-typed roster row, or an edit to one, grants no access', async () => {
  const strangerUser = oid();
  const { Student } = await import('../src/models/Student.js');
  const mine = await teacherWithRoster('forge', [{ name: 'Typed In', linkedUserId: null }]);
  portal.state.lookupIgnoresScope = true;
  portal.state.lookupStudents = [portalStudent({ number: 'NN26-000800', userId: strangerUser, enrollments: [enrolment('ENR-2026-000801')] })];

  assert.equal((await search(mine.cookie, 'NN26-000800')).status, 404, 'an unlinked, unplaced row is not a student');

  const edit = await api('PATCH', `/api/teacher/students/${mine.students[0]._id}`, {
    cookie: mine.cookie,
    body: { linkedUserId: strangerUser, enrollmentId: 'ENR-2026-000801', name: 'Typed In' },
  });
  assert.ok(edit.status < 500, JSON.stringify(edit.body));
  const row = await Student.findById(mine.students[0]._id).lean();
  assert.equal(row.linkedUserId, null, 'the account link cannot be written by a teacher');
  assert.equal(row.enrollmentId, undefined, 'nor the enrollment ID');
  assert.equal((await search(mine.cookie, 'NN26-000800')).status, 404);
});

test('refuses anonymous callers and malformed numbers, and says when the student portal is down', async () => {
  assert.equal((await search(undefined, 'NN26-000124')).status, 401);

  const userId = oid();
  const mine = await teacherWithRoster('errors', [{ name: 'Error Case', linkedUserId: userId, enrollmentId: 'ENR-2026-000901' }]);
  const malformed = await search(mine.cookie, 'hello');
  assert.equal(malformed.status, 422);
  assert.equal(portal.state.lookups.length, 0, 'a malformed number never leaves this service');

  portal.state.lookupStatus = 500;
  const failing = await search(mine.cookie, 'NN26-000900');
  assert.equal(failing.status, 503, 'unreachable is not the same as not found');

  portal.state.lookupStatus = 200;
  portal.state.down = true;
  assert.equal((await search(mine.cookie, 'NN26-000900')).status, 503);
});
