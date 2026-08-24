import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { bootTestApp, registerAndLogin, bearer } from './helpers/testApp.js';

let app;
let student;
let quizId = 'integration-quiz';

before(async () => {
  app = await bootTestApp();

  const { Course } = await import('../src/models/Course.js');
  const { Quiz } = await import('../src/models/Quiz.js');
  const { createEnrollment } = await import('../src/services/enrollment.service.js');

  const course = await Course.create({
    slug: 'integration-course',
    title: 'Integration Test Course',
    priceInPaise: 0,
    isPurchasable: true,
    isPublished: true,
  });

  await Quiz.create({
    quizId,
    courseId: course._id,
    title: 'Integration Quiz',
    pointsReward: 100,
    questions: [
      { questionId: 'q1', question: '2 + 2?', options: ['3', '4', '5'], correctIndex: 1 },
      { questionId: 'q2', question: 'Capital of France?', options: ['Berlin', 'Paris'], correctIndex: 1 },
    ],
  });

  student = await registerAndLogin(app.request, { name: 'Quiz Student', email: 'quiz@integration.test' });
  await createEnrollment({ userId: student.user._id, courseId: course._id, course });
});

after(async () => {
  await app.teardown();
});

test('GET quiz never exposes correctIndex or explanation to the client', async () => {
  const res = await app.request.get(`/api/student/quizzes/${quizId}`).set(bearer(student.accessToken));
  assert.equal(res.status, 200);
  for (const q of res.body.data.questions) {
    assert.equal(q.correctIndex, undefined);
    assert.equal(q.explanation, undefined);
  }
});

test('submitting all-wrong answers plus a spoofed score/points in the body is still graded server-side as 0', async () => {
  // The server-authoritative timer (master doc section 8-10) requires a
  // live /start attempt before /submit will accept anything - a client
  // that skips straight to /submit is rejected (see quizTimer.integration.test.js).
  await app.request.post(`/api/student/quizzes/${quizId}/start`).set(bearer(student.accessToken));

  const res = await app.request
    .post(`/api/student/quizzes/${quizId}/submit`)
    .set(bearer(student.accessToken))
    .send({
      answers: { q1: 99, q2: 99 }, // deliberately wrong
      scorePercentage: 100,
      pointsAwarded: 9999,
      correctCount: 999,
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.scorePercentage, 0);
  assert.equal(res.body.data.pointsAwarded, 0);
  assert.equal(res.body.data.correctCount, 0);
});

test('a fresh student answering everything correctly earns the full server-computed score and points', async () => {
  const secondStudent = await registerAndLogin(app.request, { name: 'Quiz Student 2', email: 'quiz2@integration.test' });
  const { Course } = await import('../src/models/Course.js');
  const { createEnrollment } = await import('../src/services/enrollment.service.js');
  const course = await Course.findOne({ slug: 'integration-course' });
  await createEnrollment({ userId: secondStudent.user._id, courseId: course._id, course });

  await app.request.post(`/api/student/quizzes/${quizId}/start`).set(bearer(secondStudent.accessToken));

  const res = await app.request
    .post(`/api/student/quizzes/${quizId}/submit`)
    .set(bearer(secondStudent.accessToken))
    .send({ answers: { q1: 1, q2: 1 } });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.scorePercentage, 100);
  assert.equal(res.body.data.correctCount, 2);
  assert.equal(res.body.data.pointsAwarded, 100);
});

test('a second attempt at the same quiz never awards points again, even with correct answers', async () => {
  await app.request.post(`/api/student/quizzes/${quizId}/start`).set(bearer(student.accessToken));

  const res = await app.request
    .post(`/api/student/quizzes/${quizId}/submit`)
    .set(bearer(student.accessToken))
    .send({ answers: { q1: 1, q2: 1 } });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.scorePercentage, 100);
  assert.equal(res.body.data.isFirstAttempt, false);
  assert.equal(res.body.data.pointsAwarded, 0);
});
