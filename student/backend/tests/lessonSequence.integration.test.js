import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { bootTestApp, registerAndLogin, bearer } from './helpers/testApp.js';

/**
 * Draft lessons and the lesson sequence a student walks through.
 *
 * A draft (isPublished: false) is withheld from students. It used to stay in
 * the per-lesson gate's chain anyway, so the published lesson after a draft
 * was locked behind something no student could ever open; it was counted in
 * the course's lesson total, so progress could never reach 100%; and nothing
 * stopped it being picked as a student's "next lesson".
 */

let ctx;
let request;
let student;

before(async () => {
  ctx = await bootTestApp();
  request = ctx.request;
  const { Course } = await import('../src/models/Course.js');
  const { Enrollment } = await import('../src/models/Enrollment.js');

  await Course.create({
    slug: 'sequence-course',
    title: 'Sequence Course',
    priceInPaise: 0,
    isPublished: true,
    pillar: 'communicate',
    progressionGatingEnabled: true,
    modules: [
      {
        moduleId: 'seq-m-1',
        title: 'One',
        order: 1,
        lessons: [
          { lessonId: 'seq-l-1', title: 'First', order: 1 },
          { lessonId: 'seq-l-2', title: 'Unfinished draft', order: 2, isPublished: false },
          { lessonId: 'seq-l-3', title: 'Third', order: 3 },
        ],
      },
    ],
  });
  const course = await Course.findOne({ slug: 'sequence-course' });
  student = await registerAndLogin(request, { name: 'Sequence Student', email: `sequence.${Date.now()}@example.com`, completeProfile: true });
  await Enrollment.create({ userId: student.user.id || student.user._id, courseId: course._id, status: 'active', enrollmentId: 'ENR-2026-990201' });
});

after(async () => {
  await ctx.teardown();
});

const content = () => request.get('/api/student/courses/sequence-course/content').set(bearer(student.accessToken));
const complete = (lessonId) => request.post(`/api/student/courses/lessons/${lessonId}/progress`).set(bearer(student.accessToken));
const lessonOf = (res, id) => res.body.data.modules.flatMap((m) => m.lessons).find((l) => l.lessonId === id);

test('the catalogue counts only the lessons a student can take', async () => {
  const res = await request.get('/api/public/courses');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const course = res.body.data.find((c) => c.slug === 'sequence-course');
  assert.equal(course.totalLessons, 2, 'the draft is not counted');
});

test('a draft is withheld from the student', async () => {
  const res = await content();
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(lessonOf(res, 'seq-l-2'), undefined, 'the student never sees the draft');
});

test('the lesson after a draft unlocks once the lesson before the draft is done, the draft stays closed, and progress reaches 100%', async () => {
  const before = await content();
  assert.equal(lessonOf(before, 'seq-l-3').isLocked, true, 'still gated behind the first lesson');

  const first = await complete('seq-l-1');
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.data.enrollment.progressPercent, 50);
  assert.equal(first.body.data.enrollment.currentLessonId, 'seq-l-3', 'the next lesson skips the draft');

  const after = await content();
  assert.equal(lessonOf(after, 'seq-l-3').isLocked, false, 'not locked behind a lesson nobody can open');

  // With the lesson before it done, only being a draft keeps this closed.
  const draft = await complete('seq-l-2');
  assert.equal(draft.status, 403, JSON.stringify(draft.body));
  assert.equal(draft.body.error.code, 'LESSON_LOCKED');

  const third = await complete('seq-l-3');
  assert.equal(third.status, 200, JSON.stringify(third.body));
  assert.equal(third.body.data.enrollment.progressPercent, 100);
});
