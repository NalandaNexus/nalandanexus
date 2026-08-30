import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { bootTestApp, createTeacherAndLogin } from './helpers/testApp.js';

/**
 * Batch administration on behalf of the Admin portal.
 *
 * Batches live in this service's database, so Admin reaches them over the shared
 * secret bridge instead of owning a competing model. What matters here is that
 * routing through Admin does not become a way around the rules a teacher is held
 * to: the course must still exist, capacity must still be sane, and the ability
 * to move a batch between teachers must stay admin-only.
 */

let ctx;
let api;
let student;
let SchoolClass;
let Student;

const KEY = { 'X-Internal-Service-Key': 'test_service_key' };
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

function adminCreate(body) {
  return api('POST', '/api/internal/batches', { headers: KEY, body });
}

test('admin creates a batch for a named teacher, and it belongs to that teacher', async () => {
  const owner = await signIn('adminowner');

  const res = await adminCreate({
    courseSlug,
    name: 'PB1',
    teacherEmail: owner.user.email,
    capacity: 60,
  });

  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.data.name, 'PB1');
  assert.equal(res.body.data.capacity, 60);
  assert.equal(res.body.data.enrolledCount, 0);
  assert.equal(res.body.data.seatsRemaining, 60);
  assert.equal(res.body.data.isFull, false);
  assert.equal(res.body.data.teacher.email, owner.user.email);
  assert.equal(res.body.data.courseSlug, courseSlug);

  // And the teacher genuinely owns it — it shows up in their own list.
  const mine = await api('GET', '/api/teacher/classes', { cookie: owner.cookie });
  assert.ok(mine.body.data.some((b) => b.name === 'PB1'));
});

test('admin cannot create a batch against a course that does not exist', async () => {
  const owner = await signIn('adminbadcourse');

  const res = await adminCreate({ courseSlug: 'no-such-course', name: 'PB Bad', teacherEmail: owner.user.email });

  assert.equal(res.status, 422, JSON.stringify(res.body));
  assert.equal(res.body.error.code, 'COURSE_SLUG_UNKNOWN', 'admin must clear the same course check a teacher does');
});

test('admin cannot create a batch for a teacher who does not exist', async () => {
  const res = await adminCreate({ courseSlug, name: 'PB Ghost', teacherEmail: 'nobody@nowhere.test' });
  assert.equal(res.status, 422, JSON.stringify(res.body));
  assert.equal(res.body.error.code, 'TEACHER_NOT_FOUND');
});

test('a course catalogue outage blocks batch creation rather than orphaning a batch', async () => {
  const owner = await signIn('adminoutage');
  student.state.down = true;

  const res = await adminCreate({ courseSlug, name: 'PB Outage', teacherEmail: owner.user.email });

  assert.equal(res.status, 503, JSON.stringify(res.body));
  assert.equal(res.body.error.code, 'COURSE_CATALOG_UNAVAILABLE');
  assert.equal(await SchoolClass.countDocuments({ name: 'PB Outage' }), 0, 'nothing may be written');
});

test('capacity is bounded - zero, negative and absurd values are refused', async () => {
  const owner = await signIn('admincap');

  for (const bad of [0, -5, 100000, 'sixty']) {
    const res = await adminCreate({ courseSlug, name: `PB Cap ${bad}`, teacherEmail: owner.user.email, capacity: bad });
    assert.equal(res.status, 422, `capacity ${bad} should be refused, got ${res.status}`);
  }
});

test('admin edits capacity, and the new value is what placement enforces', async () => {
  const owner = await signIn('admincapedit');
  const created = await adminCreate({ courseSlug, name: 'PB Resize', teacherEmail: owner.user.email, capacity: 5 });
  const batchId = created.body.data.id;

  const updated = await api('PATCH', `/api/internal/batches/${batchId}`, { headers: KEY, body: { capacity: 2 } });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.equal(updated.body.data.capacity, 2);
  assert.equal(updated.body.data.seatsRemaining, 2);

  // Placement must honour the edited value, not the one it was created with.
  const placed = [];
  for (let i = 1; i <= 3; i += 1) {
    const res = await api('POST', '/api/internal/batches/place', {
      headers: KEY,
      body: { studentCourseSlug: courseSlug, enrollmentId: `ENR-2026-77000${i}`, studentName: `Resize ${i}` },
    });
    placed.push(res.body.data);
  }
  assert.ok(placed[0] && placed[1], 'the first two fit the new capacity');
  assert.equal(placed[2], null, 'the third is refused against the EDITED capacity');
});

test('admin reassigns a batch to another teacher, and the roster moves with it', async () => {
  const from = await signIn('reassignfrom');
  const to = await signIn('reassignto');

  const created = await adminCreate({ courseSlug, name: 'PB Move', teacherEmail: from.user.email, capacity: 60 });
  const batchId = created.body.data.id;

  await api('POST', '/api/internal/batches/place', {
    headers: KEY,
    body: { studentCourseSlug: courseSlug, enrollmentId: 'ENR-2026-780001', studentName: 'Moving Student' },
  });

  const res = await api('PATCH', `/api/internal/batches/${batchId}/teacher`, {
    headers: KEY,
    body: { teacherEmail: to.user.email },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.teacher.email, to.user.email);

  // The batch is now the new teacher's, and gone from the old one's list.
  const newList = await api('GET', '/api/teacher/classes', { cookie: to.cookie });
  const oldList = await api('GET', '/api/teacher/classes', { cookie: from.cookie });
  assert.ok(newList.body.data.some((b) => b.id === batchId), 'the new teacher sees the batch');
  assert.ok(!oldList.body.data.some((b) => b.id === batchId), 'the old teacher no longer does');

  // The roster row moved too - otherwise the new teacher owns a batch whose
  // students they cannot see.
  const stranded = await Student.countDocuments({ class: batchId, teacher: from.teacher._id });
  assert.equal(stranded, 0, 'no roster row may be left pointing at the previous teacher');
  assert.equal(await Student.countDocuments({ class: batchId, teacher: to.teacher._id }), 1);
});

test('reassignment does not become a way for a teacher to grab a batch', async () => {
  const owner = await signIn('grabowner');
  const attacker = await signIn('grabattacker');
  const created = await adminCreate({ courseSlug, name: 'PB Guarded', teacherEmail: owner.user.email });
  const batchId = created.body.data.id;

  // The teacher-facing edit endpoint must still refuse to move ownership.
  const viaTeacherApi = await api('PATCH', `/api/teacher/classes/${batchId}`, {
    cookie: owner.cookie,
    body: { teacher: String(attacker.teacher._id), name: 'PB Guarded' },
  });
  assert.ok(viaTeacherApi.status < 400, JSON.stringify(viaTeacherApi.body));

  const after = await SchoolClass.findById(batchId).lean();
  assert.equal(String(after.teacher), String(owner.teacher._id), 'ownership must not move through the teacher API');

  // And the admin route itself is unreachable without the service key.
  const noKey = await api('PATCH', `/api/internal/batches/${batchId}/teacher`, {
    body: { teacherEmail: attacker.user.email },
  });
  assert.equal(noKey.status, 401, 'batch administration requires the internal service key');
});

test('admin list shows every teacher batch, and filters narrow it in the query', async () => {
  const a = await signIn('lista');
  const b = await signIn('listb');
  await adminCreate({ courseSlug, name: 'PB Alpha', teacherEmail: a.user.email });
  await adminCreate({ courseSlug, name: 'PB Beta', teacherEmail: b.user.email });

  const all = await api('GET', `/api/internal/batches?courseSlug=${courseSlug}`, { headers: KEY });
  assert.equal(all.status, 200, JSON.stringify(all.body));
  const names = all.body.data.map((x) => x.name).sort();
  assert.deepEqual(names, ['PB Alpha', 'PB Beta'], 'admin sees across teachers, unlike a teacher');

  const byTeacher = await api('GET', `/api/internal/batches?courseSlug=${courseSlug}&teacherEmail=${encodeURIComponent(a.user.email)}`, { headers: KEY });
  assert.deepEqual(byTeacher.body.data.map((x) => x.name), ['PB Alpha']);

  const bySearch = await api('GET', `/api/internal/batches?courseSlug=${courseSlug}&search=Beta`, { headers: KEY });
  assert.deepEqual(bySearch.body.data.map((x) => x.name), ['PB Beta']);
});

test('admin batch roster carries the enrollment identity', async () => {
  const owner = await signIn('adminroster');
  const created = await adminCreate({ courseSlug, name: 'PB Roster', teacherEmail: owner.user.email });
  const batchId = created.body.data.id;

  await api('POST', '/api/internal/batches/place', {
    headers: KEY,
    body: { studentCourseSlug: courseSlug, enrollmentId: 'ENR-2026-790001', studentName: 'Rostered Student' },
  });

  const res = await api('GET', `/api/internal/batches/${batchId}/students`, { headers: KEY });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].enrollmentId, 'ENR-2026-790001', 'admin must be able to trace a student by enrollment');
  assert.equal(res.body.data[0].verified, false, 'placed but not yet synced is not verified');
});

test('occupancy reported to admin comes from the counter capacity is claimed against', async () => {
  const owner = await signIn('adminseats');
  const created = await adminCreate({ courseSlug, name: 'PB Seats', teacherEmail: owner.user.email, capacity: 3 });
  const batchId = created.body.data.id;

  for (let i = 1; i <= 3; i += 1) {
    await api('POST', '/api/internal/batches/place', {
      headers: KEY,
      body: { studentCourseSlug: courseSlug, enrollmentId: `ENR-2026-80000${i}`, studentName: `Seat ${i}` },
    });
  }

  const res = await api('GET', `/api/internal/batches/${batchId}`, { headers: KEY });
  assert.equal(res.body.data.enrolledCount, 3);
  assert.equal(res.body.data.seatsRemaining, 0);
  assert.equal(res.body.data.isFull, true, 'FULL is derived, not a stored status');
  assert.equal(res.body.data.status, 'active', 'and it does not corrupt the real lifecycle status');
});

test('archiving through admin takes the batch out of placement', async () => {
  const owner = await signIn('adminarchive');
  const created = await adminCreate({ courseSlug, name: 'PB Archive', teacherEmail: owner.user.email, capacity: 60 });
  const batchId = created.body.data.id;

  const archived = await api('PATCH', `/api/internal/batches/${batchId}`, { headers: KEY, body: { status: 'archived' } });
  assert.equal(archived.status, 200, JSON.stringify(archived.body));
  assert.equal(archived.body.data.status, 'archived');

  const placement = await api('POST', '/api/internal/batches/place', {
    headers: KEY,
    body: { studentCourseSlug: courseSlug, enrollmentId: 'ENR-2026-810001', studentName: 'After Archive' },
  });
  assert.equal(placement.body.data, null, 'an archived batch must never receive a student');
});
