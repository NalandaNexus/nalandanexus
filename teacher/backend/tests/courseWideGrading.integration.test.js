import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { bootTestApp, createTeacherAndLogin } from './helpers/testApp.js';

/**
 * Full shared course-wide teacher authority.
 *
 * Until now, a `Student` roster row (and everything keyed off it - grading,
 * attendance, messaging, monitoring) was reachable only by the one teacher
 * named on `SchoolClass.teacher`. This is the other half of the lesson-video
 * feature's CourseAccess gate (see courseAccess.service.js): any teacher an
 * administrator has assigned to a course - not only the batch's own teacher
 * - may now grade, mark attendance for, message and monitor every student
 * enrolled in it.
 *
 * Three things matter enough to pin down explicitly:
 *   - the grant is real and admin-driven (CourseAccess, via the same
 *     internal endpoint the Admin portal calls), not implied by two batches
 *     merely sharing a course slug;
 *   - a teacher with neither ownership nor a grant is still refused, so the
 *     widening is additive and does not accidentally open the roster to
 *     every teacher in the institution;
 *   - Attendance.teacher keeps meaning "this batch's own teacher" even after
 *     a second teacher marks it, which is the bug this feature depended on
 *     fixing first (see attendance.service.js#markAttendance).
 */

let ctx;
let api;
let student;

const KEY = { 'X-Internal-Service-Key': 'test_service_key' };

before(async () => {
  ctx = await bootTestApp();
  api = ctx.api;
  student = ctx.student;
});

after(async () => {
  await ctx.teardown();
});

beforeEach(() => {
  student.reset();
  student.state.courses = [{ slug: 'garud', title: 'GARUD', category: 'Core', isPurchasable: true }];
});

async function signIn(label) {
  const email = `${label}.${Math.random().toString(36).slice(2, 8)}@nalanda.test`;
  return createTeacherAndLogin(api, { name: `Teacher ${label}`, email });
}

/** Mirrors the Admin portal's own call when it assigns a course to a teacher - the only real way a CourseAccess row is ever created. */
async function grantCourseAccess(teacherEmail, slug = 'garud', title = 'GARUD') {
  const res = await api('PUT', '/api/internal/teachers/courses', {
    headers: KEY,
    body: { teacherEmail, courses: [{ slug, title }] },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res;
}

/** Owner creates a batch, a verified student in it, and one published assignment with its auto-seeded submission. */
async function seedClassWithGradableSubmission(ownerLabel) {
  const owner = await signIn(ownerLabel);
  const classRes = await api('POST', '/api/teacher/classes', {
    cookie: owner.cookie,
    body: { name: `${ownerLabel} Batch`, studentCourseSlug: 'garud', capacity: 60 },
  });
  assert.equal(classRes.status, 201, JSON.stringify(classRes.body));
  const classId = classRes.body.data.id;

  const { Student } = await import('../src/models/Student.js');
  const roster = await Student.create({
    name: `${ownerLabel} Student`,
    email: `${ownerLabel}.student.${Math.random().toString(36).slice(2, 6)}@example.com`,
    teacher: owner.teacher._id,
    class: classId,
    linkedUserId: new mongoose.Types.ObjectId(),
  });

  const assignmentRes = await api('POST', '/api/teacher/assignments', {
    cookie: owner.cookie,
    body: { title: 'Threat Modelling Essay', classId, dueDate: '2026-12-01T00:00:00.000Z', maxScore: 100, status: 'published' },
  });
  assert.equal(assignmentRes.status, 201, JSON.stringify(assignmentRes.body));

  const { Submission } = await import('../src/models/Submission.js');
  const submission = await Submission.findOne({ assignment: assignmentRes.body.data.id, student: roster._id });
  assert.ok(submission, 'the assignment publish must have seeded a pending submission stub');

  return { owner, classId, student: roster, assignment: assignmentRes.body.data, submission };
}

test('a course-access teacher grades a student they do not own', async () => {
  const { owner, submission } = await seedClassWithGradableSubmission('owner-grade');
  const helper = await signIn('helper-grade');
  await grantCourseAccess(helper.user.email);

  const res = await api('PATCH', `/api/teacher/submissions/${submission._id}/grade`, {
    cookie: helper.cookie,
    body: { score: 88, feedback: 'Strong analysis.' },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.score, 88);

  const { Submission } = await import('../src/models/Submission.js');
  const graded = await Submission.findById(submission._id).lean();
  assert.equal(String(graded.gradedBy), String(helper.teacher._id), 'gradedBy records the real acting teacher, not the assignment owner');
  assert.ok(owner.teacher._id, 'owner is still the assignment/class author, unaffected');
});

test('a teacher with no ownership and no grant still cannot grade the same submission', async () => {
  const { submission } = await seedClassWithGradableSubmission('owner-deny');
  const stranger = await signIn('stranger-deny');
  // Deliberately no grantCourseAccess call - this is the negative case the
  // feature's union design depends on: sharing a course slug is not enough
  // on its own, only a real CourseAccess row is.

  const res = await api('PATCH', `/api/teacher/submissions/${submission._id}/grade`, {
    cookie: stranger.cookie,
    body: { score: 50 },
  });
  assert.equal(res.status, 404, JSON.stringify(res.body));
  assert.equal(res.body.error?.code || res.body.code, 'SUBMISSION_NOT_FOUND');
});

test('grading the same submission with a stale version is refused as a conflict, not silently overwritten', async () => {
  const { submission } = await seedClassWithGradableSubmission('owner-conflict');
  const helper = await signIn('helper-conflict');
  await grantCourseAccess(helper.user.email);

  const first = await api('PATCH', `/api/teacher/submissions/${submission._id}/grade`, {
    cookie: helper.cookie,
    body: { score: 70 },
  });
  assert.equal(first.status, 200, JSON.stringify(first.body));

  // A second teacher who loaded the submission before the first grade landed
  // tries to save against the version they saw (expectedUpdatedAt: null, since
  // it was ungraded when they opened it).
  const second = await api('PATCH', `/api/teacher/submissions/${submission._id}/grade`, {
    cookie: helper.cookie,
    body: { score: 95, expectedUpdatedAt: null },
  });
  assert.equal(second.status, 409, JSON.stringify(second.body));
  assert.equal(second.body.error?.code || second.body.code, 'SUBMISSION_CHANGED');

  const { Submission } = await import('../src/models/Submission.js');
  const stillSeventy = await Submission.findById(submission._id).lean();
  assert.equal(stillSeventy.score, 70, 'the earlier real grade must survive the refused write');
});

test('a graded submission is audited under the teacher who actually graded it', async () => {
  const { submission } = await seedClassWithGradableSubmission('owner-audit');
  const helper = await signIn('helper-audit');
  await grantCourseAccess(helper.user.email);

  await api('PATCH', `/api/teacher/submissions/${submission._id}/grade`, { cookie: helper.cookie, body: { score: 60 } });

  const { AuditLog } = await import('../src/models/AuditLog.js');
  const entry = await AuditLog.findOne({ action: 'submission.graded', targetId: submission._id }).lean();
  assert.ok(entry, 'the grading action is audited');
  // AuditLog stores the acting teacher as `actor` (audit.service.js#logAudit maps actorId -> actor).
  assert.equal(String(entry.actor), String(helper.teacher._id), 'the audited actor is whoever actually graded it');
});

test('a course-access teacher marks attendance for a batch they do not own, and the batch keeps its own home teacher', async () => {
  const { owner, classId, student: roster } = await seedClassWithGradableSubmission('owner-attendance');
  const helper = await signIn('helper-attendance');
  await grantCourseAccess(helper.user.email);

  const res = await api('POST', '/api/teacher/attendance', {
    cookie: helper.cookie,
    body: { classId, date: '2026-11-20', records: [{ studentId: String(roster._id), status: 'present' }] },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const { Attendance } = await import('../src/models/Attendance.js');
  const row = await Attendance.findOne({ student: roster._id, class: classId }).lean();
  assert.ok(row, 'the mark was saved');
  assert.equal(row.markedBy ? String(row.markedBy) : null, String(helper.teacher._id), 'markedBy records who actually marked it');
  assert.equal(
    String(row.teacher),
    String(owner.teacher._id),
    "teacher stays the batch's own home teacher even though a different, course-access teacher marked it - the bug this feature depended on fixing first"
  );

  // The owner can still read it too - a shared view, not a handover.
  const ownerRead = await api('GET', `/api/teacher/attendance?classId=${classId}&date=2026-11-20`, { cookie: owner.cookie });
  assert.equal(ownerRead.status, 200);
  assert.equal(ownerRead.body.data.length, 1);
});

test('attendance for the same class/day is refused as a conflict when the loaded version is stale', async () => {
  const { classId, student: roster } = await seedClassWithGradableSubmission('owner-att-conflict');
  const helper = await signIn('helper-att-conflict');
  await grantCourseAccess(helper.user.email);

  const first = await api('POST', '/api/teacher/attendance', {
    cookie: helper.cookie,
    body: { classId, date: '2026-11-21', records: [{ studentId: String(roster._id), status: 'present' }] },
  });
  assert.equal(first.status, 200, JSON.stringify(first.body));

  // A second save believing the record was never marked (expectedUpdatedAt:
  // null) is now wrong, since the write above already set it.
  const second = await api('POST', '/api/teacher/attendance', {
    cookie: helper.cookie,
    body: { classId, date: '2026-11-21', records: [{ studentId: String(roster._id), status: 'absent', expectedUpdatedAt: null }] },
  });
  assert.equal(second.status, 409, JSON.stringify(second.body));
  assert.equal(second.body.error?.code || second.body.code, 'ATTENDANCE_CHANGED');

  const { Attendance } = await import('../src/models/Attendance.js');
  const row = await Attendance.findOne({ student: roster._id, class: classId }).lean();
  assert.equal(row.status, 'present', 'the refused write must not have changed the real record');
});

test('a teacher with no ownership and no grant cannot mark attendance for the same batch', async () => {
  const { classId, student: roster } = await seedClassWithGradableSubmission('owner-att-deny');
  const stranger = await signIn('stranger-att-deny');

  const res = await api('POST', '/api/teacher/attendance', {
    cookie: stranger.cookie,
    body: { classId, date: '2026-11-20', records: [{ studentId: String(roster._id), status: 'present' }] },
  });
  assert.equal(res.status, 403, JSON.stringify(res.body));
  assert.equal(res.body.error?.code || res.body.code, 'COURSE_NOT_ASSIGNED');
});

test('a course-access teacher can open a conversation with a student they do not own', async () => {
  const { student: roster } = await seedClassWithGradableSubmission('owner-message');
  const helper = await signIn('helper-message');
  await grantCourseAccess(helper.user.email);

  const res = await api('POST', '/api/teacher/messages/conversations', {
    cookie: helper.cookie,
    body: { studentId: String(roster._id) },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.ok(res.body.data.id);
});

test('a teacher with no ownership and no grant cannot start a conversation with the same student', async () => {
  const { student: roster } = await seedClassWithGradableSubmission('owner-message-deny');
  const stranger = await signIn('stranger-message-deny');

  const res = await api('POST', '/api/teacher/messages/conversations', {
    cookie: stranger.cookie,
    body: { studentId: String(roster._id) },
  });
  assert.equal(res.status, 404, JSON.stringify(res.body));
  assert.equal(res.body.error?.code || res.body.code, 'STUDENT_NOT_FOUND');
});

test('a course-access teacher sees the batch on the roster, leaderboard, and student-progress views', async () => {
  const { classId, student: roster } = await seedClassWithGradableSubmission('owner-views');
  const helper = await signIn('helper-views');
  await grantCourseAccess(helper.user.email);

  const roster1 = await api('GET', `/api/teacher/classes/${classId}/students`, { cookie: helper.cookie });
  assert.equal(roster1.status, 200, JSON.stringify(roster1.body));
  assert.deepEqual(roster1.body.data.map((s) => s.id), [String(roster._id)]);

  const leaderboard = await api('GET', `/api/teacher/classes/${classId}/leaderboard`, { cookie: helper.cookie });
  assert.equal(leaderboard.status, 200, JSON.stringify(leaderboard.body));
  assert.equal(leaderboard.body.data.length, 1);

  const progressDetail = await api('GET', `/api/teacher/students/progress/${roster._id}`, { cookie: helper.cookie });
  assert.equal(progressDetail.status, 200, JSON.stringify(progressDetail.body));

  // The general "my students" list, with no classId filter, also widens to
  // every class this teacher may act on - not only classes this teacher
  // personally created.
  const everyone = await api('GET', '/api/teacher/students', { cookie: helper.cookie });
  assert.equal(everyone.status, 200);
  assert.ok(everyone.body.data.some((s) => s.id === String(roster._id)));
});

test('a teacher with no ownership and no grant sees none of it', async () => {
  const { classId, student: roster } = await seedClassWithGradableSubmission('owner-views-deny');
  const stranger = await signIn('stranger-views-deny');

  const roster1 = await api('GET', `/api/teacher/classes/${classId}/students`, { cookie: stranger.cookie });
  assert.equal(roster1.status, 403, JSON.stringify(roster1.body));

  const everyone = await api('GET', '/api/teacher/students', { cookie: stranger.cookie });
  assert.equal(everyone.status, 200);
  assert.ok(!everyone.body.data.some((s) => s.id === String(roster._id)), 'a stranger\'s general list must never include this student');
});

test('revoking the course access takes the shared authority away as soon as it is gone', async () => {
  const { classId } = await seedClassWithGradableSubmission('owner-revoke');
  const helper = await signIn('helper-revoke');
  await grantCourseAccess(helper.user.email);

  const before1 = await api('GET', `/api/teacher/classes/${classId}/students`, { cookie: helper.cookie });
  assert.equal(before1.status, 200);

  // The Admin portal sends the full set every time (see
  // courseRoster.service.js#setTeacherCourses) - an empty list revokes everything
  // previously granted by this same source.
  await api('PUT', '/api/internal/teachers/courses', { headers: KEY, body: { teacherEmail: helper.user.email, courses: [] } });

  const after1 = await api('GET', `/api/teacher/classes/${classId}/students`, { cookie: helper.cookie });
  assert.equal(after1.status, 403, JSON.stringify(after1.body));
});
