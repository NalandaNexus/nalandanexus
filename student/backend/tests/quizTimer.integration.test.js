import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { bootTestApp, registerAndLogin, bearer } from './helpers/testApp.js';

let app;
let student;
let quizId = 'timer-quiz';

before(async () => {
  app = await bootTestApp();

  const { Course } = await import('../src/models/Course.js');
  const { Quiz } = await import('../src/models/Quiz.js');
  const { createEnrollment } = await import('../src/services/enrollment.service.js');

  const course = await Course.create({ slug: 'timer-course', title: 'Timer Course', priceInPaise: 0, isPurchasable: true, isPublished: true });

  await Quiz.create({
    quizId,
    courseId: course._id,
    title: 'Timer Quiz',
    // A 0-minute limit means the attempt is already expired the instant
    // it's created - the fastest possible way to deterministically exercise
    // the expiry path without a real sleep in the test.
    timeLimitMins: 0,
    questions: [{ questionId: 'q1', question: '1 + 1?', options: ['1', '2'], correctIndex: 1 }],
  });

  student = await registerAndLogin(app.request, { name: 'Timer Student', email: 'timer@integration.test' });
  await createEnrollment({ userId: student.user._id, courseId: course._id, course });
});

after(async () => {
  await app.teardown();
});

test('submitting without ever calling /start is rejected', async () => {
  const res = await app.request
    .post(`/api/student/quizzes/${quizId}/submit`)
    .set(bearer(student.accessToken))
    .send({ answers: { q1: 1 } });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'QUIZ_NOT_STARTED');
});

test('a submission after the server-computed deadline is rejected even with correct answers', async () => {
  const startRes = await app.request.post(`/api/student/quizzes/${quizId}/start`).set(bearer(student.accessToken));
  assert.equal(startRes.status, 201);
  assert.ok(startRes.body.data.expiresAt);

  // timeLimitMins: 0 means expiresAt is already in the past by the time this runs.
  const submitRes = await app.request
    .post(`/api/student/quizzes/${quizId}/submit`)
    .set(bearer(student.accessToken))
    .send({ answers: { q1: 1 } }); // correct answer, manipulated client timer wouldn't matter either way
  assert.equal(submitRes.status, 400);
  assert.equal(submitRes.body.error.code, 'QUIZ_TIME_EXPIRED');
});

test('the expired attempt was finalized server-side, not left dangling', async () => {
  const { QuizAttempt } = await import('../src/models/QuizAttempt.js');
  const attempts = await QuizAttempt.find({ userId: student.user._id });
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].status, 'expired');
  assert.equal(attempts[0].scorePercentage, 0);
});

test('starting again after expiry issues a fresh attempt (attemptNumber increments)', async () => {
  const res = await app.request.post(`/api/student/quizzes/${quizId}/start`).set(bearer(student.accessToken));
  assert.equal(res.status, 201);

  const { QuizAttempt } = await import('../src/models/QuizAttempt.js');
  const attempts = await QuizAttempt.find({ userId: student.user._id }).sort({ createdAt: 1 });
  assert.equal(attempts.length, 2);
  assert.equal(attempts[1].attemptNumber, 2);
  assert.equal(attempts[1].isFirstAttempt, false);
});
