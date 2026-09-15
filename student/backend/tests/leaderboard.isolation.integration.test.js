import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { bootTestApp, registerAndLogin, bearer } from './helpers/testApp.js';

let app;
let studentA, studentB, studentC;
let courseX, courseY;

before(async () => {
  app = await bootTestApp();

  const { Course } = await import('../src/models/Course.js');
  const { createEnrollment } = await import('../src/services/enrollment.service.js');
  const { awardXp } = await import('../src/services/xp.service.js');

  courseX = await Course.create({ slug: 'course-x', title: 'Course X', priceInPaise: 0, isPurchasable: true, isPublished: true });
  courseY = await Course.create({ slug: 'course-y', title: 'Course Y', priceInPaise: 0, isPurchasable: true, isPublished: true });

  studentA = await registerAndLogin(app.request, { completeProfile: true, name: 'Student A', email: 'a@leaderboard.test' });
  studentB = await registerAndLogin(app.request, { completeProfile: true, name: 'Student B', email: 'b@leaderboard.test' });
  studentC = await registerAndLogin(app.request, { completeProfile: true, name: 'Student C', email: 'c@leaderboard.test' });

  // A and B share Course X; C is enrolled only in Course Y.
  await createEnrollment({ userId: studentA.user._id, courseId: courseX._id, course: courseX });
  await createEnrollment({ userId: studentB.user._id, courseId: courseX._id, course: courseX });
  await createEnrollment({ userId: studentC.user._id, courseId: courseY._id, course: courseY });

  await awardXp(studentA.user._id, { amount: 50, source: 'lesson', refId: 'l1', courseId: courseX._id });
  await awardXp(studentB.user._id, { amount: 30, source: 'lesson', refId: 'l1', courseId: courseX._id });
  await awardXp(studentC.user._id, { amount: 999, source: 'lesson', refId: 'l1', courseId: courseY._id });
});

after(async () => {
  await app.teardown();
});

test('students enrolled in the same course appear together on that course leaderboard', async () => {
  const res = await app.request.get(`/api/leaderboard/${courseX.slug}`).set(bearer(studentA.accessToken));
  assert.equal(res.status, 200);
  const names = res.body.data.entries.map((e) => e.name);
  assert.ok(names.includes('Student A'));
  assert.ok(names.includes('Student B'));
});

test('a student enrolled in a different course never appears on another course leaderboard, regardless of XP', async () => {
  const res = await app.request.get(`/api/leaderboard/${courseX.slug}`).set(bearer(studentA.accessToken));
  assert.equal(res.status, 200);
  const names = res.body.data.entries.map((e) => e.name);
  assert.ok(!names.includes('Student C'), 'Student C (999 XP in a different course) leaked into Course X leaderboard');
});

test('a student cannot view the leaderboard for a course they are not enrolled in (IDOR)', async () => {
  const res = await app.request.get(`/api/leaderboard/${courseX.slug}`).set(bearer(studentC.accessToken));
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'COURSE_NOT_PURCHASED');
});

test('Course Y leaderboard only shows Student C, not A or B', async () => {
  const res = await app.request.get(`/api/leaderboard/${courseY.slug}`).set(bearer(studentC.accessToken));
  assert.equal(res.status, 200);
  const names = res.body.data.entries.map((e) => e.name);
  assert.deepEqual(names, ['Student C']);
});
