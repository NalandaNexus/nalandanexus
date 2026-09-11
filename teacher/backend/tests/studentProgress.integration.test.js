import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { bootTestApp, createTeacherAndLogin } from './helpers/testApp.js';

/**
 * A teacher's view of student progression.
 *
 * Two things are worth proving here and neither is about arithmetic: that a
 * teacher sees exactly their own students and no others, and that they have no
 * way to author a score. The numbers themselves are produced by the student
 * service's engine and tested there; what this file guards is the boundary.
 */

let ctx;
let api;
let portal;

before(async () => {
  ctx = await bootTestApp();
  api = ctx.api;
  // The harness already runs a stand-in student service and points the bridge
  // at it before the env module loads; starting a second one here would be
  // ignored, since that URL is read once at import time.
  portal = ctx.student;
});

after(async () => {
  await ctx.teardown();
});

beforeEach(() => {
  portal.reset();
});

const seedProgress = (rows) => {
  for (const row of rows) portal.state.progressByUser[row.userId] = row;
};

const progressCalls = () => portal.state.calls.filter((c) => c.url.includes('/progression/students'));

async function makeTeacherWithStudents(label, students) {
  const { Student } = await import('../src/models/Student.js');
  const { SchoolClass } = await import('../src/models/SchoolClass.js');
  const mongoose = (await import('mongoose')).default;

  const { teacher, cookie } = await createTeacherAndLogin(api, {
    name: `Teacher ${label}`,
    email: `teacher.${label}.${Math.random().toString(36).slice(2, 7)}@test.local`,
  });

  const klass = await SchoolClass.create({
    name: `Class ${label}`,
    code: `CLS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    teacher: teacher._id,
    status: 'active',
  });

  const created = [];
  for (const s of students) {
    created.push(
      await Student.create({
        name: s.name,
        email: `${s.name.toLowerCase().replace(/\s+/g, '.')}.${Math.random().toString(36).slice(2, 6)}@test.local`,
        teacher: teacher._id,
        class: klass._id,
        linkedUserId: s.linked === false ? null : new mongoose.Types.ObjectId(),
      })
    );
  }
  return { teacher, cookie, klass, students: created };
}

test('a teacher sees their own students, with progression attached', async () => {
  const { cookie, students } = await makeTeacherWithStudents('own', [{ name: 'Student One' }, { name: 'Student Two' }]);

  seedProgress(students.map((s, i) => ({
    userId: String(s.linkedUserId),
    level: 8 + i,
    rankCode: 'C',
    xp: 2850,
    stageCode: 'PRARAMBH',
    stageProgress: 60,
    overallPower: 75,
    attendanceScore: 94,
    classesConducted: 50,
    skills: [{ subjectCode: 'ENGLISH', score: 72, activityCount: 4 }],
    lastActivityAt: new Date().toISOString(),
    eligibility: [],
  })));

  const res = await api('GET', '/api/teacher/students/progress', { cookie });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.length, 2);
  assert.equal(res.body.meta.progressionAvailable, true);

  const row = res.body.data[0];
  assert.ok(row.progress, 'progression is attached');
  assert.equal(row.progress.rankCode, 'C');
  assert.equal(row.progress.overallPower, 75);
  assert.ok(row.flags, 'and the teacher gets the flags, not raw thresholds to apply themselves');
});

test('the roster is read in one batched call, not one per student', async () => {
  const { cookie, students } = await makeTeacherWithStudents('batch', [
    { name: 'A A' }, { name: 'B B' }, { name: 'C C' }, { name: 'D D' }, { name: 'E E' },
  ]);
  seedProgress(students.map((s) => ({ userId: String(s.linkedUserId), level: 1, skills: [], eligibility: [] })));

  await api('GET', '/api/teacher/students/progress', { cookie });

  assert.equal(progressCalls().length, 1, `five students must cost one call, not five (got ${progressCalls().length})`);
});

test('another teacher students are neither listed nor reachable by id', async () => {
  const mine = await makeTeacherWithStudents('mine', [{ name: 'My Student' }]);
  const theirs = await makeTeacherWithStudents('theirs', [{ name: 'Their Student' }]);

  const list = await api('GET', '/api/teacher/students/progress', { cookie: mine.cookie });
  const names = list.body.data.map((r) => r.name);
  assert.deepEqual(names, ['My Student'], 'only my roster');

  // Asking for theirs by id must not work, and must not reveal that they exist.
  const detail = await api('GET', `/api/teacher/students/progress/${theirs.students[0]._id}`, { cookie: mine.cookie });
  assert.equal(detail.status, 404, 'same answer as a student that does not exist');
});

test('a student with no portal account is shown as unlinked, not as zeroes', async () => {
  const { cookie } = await makeTeacherWithStudents('unlinked', [{ name: 'Offline Student', linked: false }]);

  const res = await api('GET', '/api/teacher/students/progress', { cookie });
  const row = res.body.data[0];

  assert.equal(row.linked, false);
  assert.equal(row.progress, null, 'no invented figures');
  assert.equal(row.flags.unlinked, true, 'and the reason is explicit');
  // Nothing was asked of the peer for a student it could not know about.
  assert.equal(progressCalls().length, 0);
});

test('an unreachable student service costs the columns, not the page', async () => {
  const { cookie } = await makeTeacherWithStudents('offline-peer', [{ name: 'Someone' }]);

  // The stand-in drops the connection, which is what a sleeping peer looks like.
  portal.state.down = true;
  try {
    const res = await api('GET', '/api/teacher/students/progress', { cookie });
    assert.equal(res.status, 200, 'the roster still renders');
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.meta.progressionAvailable, false, 'and says the figures are missing');
  } finally {
    portal.state.down = false;
  }
});

test('there is no route by which a teacher can write a progression value', async () => {
  const { cookie, students } = await makeTeacherWithStudents('readonly', [{ name: 'Target' }]);
  const id = students[0]._id;

  for (const [method, path, body] of [
    ['POST', '/api/teacher/students/progress', { xp: 9999 }],
    ['PATCH', `/api/teacher/students/progress/${id}`, { xp: 9999, rankCode: 'S' }],
    ['PUT', `/api/teacher/students/progress/${id}`, { overallPower: 100 }],
    ['POST', `/api/teacher/students/progress/${id}/xp`, { amount: 5000 }],
  ]) {
    const res = await api(method, path, { cookie, body });
    assert.ok(res.status >= 400, `${method} ${path} must not be a write route (got ${res.status})`);
  }
});

test('unauthenticated callers see nothing', async () => {
  const res = await api('GET', '/api/teacher/students/progress');
  assert.equal(res.status, 401);
});

test('filters narrow the roster by the configured thresholds', async () => {
  const { cookie, students } = await makeTeacherWithStudents('filters', [{ name: 'Quiet One' }, { name: 'Busy One' }]);

  const longAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  seedProgress([
    { userId: String(students[0].linkedUserId), level: 2, overallPower: 20, attendanceScore: 40, classesConducted: 10, stageProgress: 10, skills: [], eligibility: [], lastActivityAt: longAgo },
    { userId: String(students[1].linkedUserId), level: 12, overallPower: 88, attendanceScore: 96, classesConducted: 10, stageProgress: 90, skills: [], eligibility: [], lastActivityAt: new Date().toISOString() },
  ]);

  const inactive = await api('GET', '/api/teacher/students/progress?filter=inactive', { cookie });
  assert.deepEqual(inactive.body.data.map((r) => r.name), ['Quiet One']);

  const strong = await api('GET', '/api/teacher/students/progress?filter=high-performers', { cookie });
  assert.deepEqual(strong.body.data.map((r) => r.name), ['Busy One']);

  const near = await api('GET', '/api/teacher/students/progress?filter=near-completion', { cookie });
  assert.deepEqual(near.body.data.map((r) => r.name), ['Busy One']);
});
