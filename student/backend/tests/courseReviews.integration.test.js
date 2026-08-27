import test from 'node:test';
import assert from 'node:assert/strict';
import { bootTestApp, registerAndLogin, bearer } from './helpers/testApp.js';

/**
 * Course ratings are computed from real Review documents written by genuinely
 * enrolled students. Previously Course.rating/reviewsCount were seeded
 * marketing numbers (4.7-5.0 over 1,200-3,200 "reviews") with no records
 * behind them, and the Landing Page's satisfaction figure was averaged from
 * those invented values.
 */

const PRICE = 500000;

async function seedCourse(overrides = {}) {
  const { Course } = await import('../src/models/Course.js');
  return Course.create({
    slug: 'reviewable-course',
    title: 'Reviewable Course',
    description: 'A course used to exercise the review system.',
    priceInPaise: PRICE,
    currency: 'INR',
    isPurchasable: true,
    isPublished: true,
    modules: [],
    ...overrides,
  });
}

async function enroll(userId, course) {
  const { createEnrollment } = await import('../src/services/enrollment.service.js');
  return createEnrollment({ userId, courseId: course._id, course });
}

async function makeEnrolledStudent(request, course, { name, email }) {
  const student = await registerAndLogin(request, { name, email });
  await enroll(student.user._id, course);
  return student;
}

test('a new course has no rating at all - not a default star value', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const course = await seedCourse();
  assert.equal(course.rating, 0, 'a course must not be born with a rating');
  assert.equal(course.reviewsCount, 0);

  const res = await request.get(`/api/public/courses/${course.slug}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.rating, 0);
  assert.equal(res.body.data.reviewsCount, 0);
});

test('an enrolled student can submit a rating, and the course average updates', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const course = await seedCourse();
  const student = await makeEnrolledStudent(request, course, { name: 'Rater One', email: 'rater1@example.com' });

  const res = await request
    .post(`/api/student/courses/${course.slug}/review`)
    .set(bearer(student.accessToken))
    .send({ rating: 4, comment: 'Genuinely useful foundation course.' });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.review.rating, 4);
  assert.equal(res.body.data.course.rating, 4);
  assert.equal(res.body.data.course.reviewsCount, 1);

  // Persisted on the Course document, not just echoed in the response.
  const { Course } = await import('../src/models/Course.js');
  const stored = await Course.findById(course._id).lean();
  assert.equal(stored.rating, 4);
  assert.equal(stored.reviewsCount, 1);

  // And visible on the public course endpoint.
  const pub = await request.get(`/api/public/courses/${course.slug}`);
  assert.equal(pub.body.data.rating, 4);
  assert.equal(pub.body.data.reviewsCount, 1);
});

test('the average is the real mean of every review', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const course = await seedCourse();
  const ratings = [5, 4, 3];
  for (const [i, rating] of ratings.entries()) {
    const s = await makeEnrolledStudent(request, course, {
      name: `Rater ${i}`,
      email: `avg${i}@example.com`,
    });
    const r = await request
      .post(`/api/student/courses/${course.slug}/review`)
      .set(bearer(s.accessToken))
      .send({ rating });
    assert.equal(r.status, 201);
  }

  const { Course } = await import('../src/models/Course.js');
  const stored = await Course.findById(course._id).lean();
  assert.equal(stored.reviewsCount, 3);
  assert.equal(stored.rating, 4, '(5+4+3)/3 = 4');
});

test('a student who is NOT enrolled cannot review the course', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const course = await seedCourse();
  const outsider = await registerAndLogin(request, { name: 'Outsider', email: 'outsider@example.com' });

  const res = await request
    .post(`/api/student/courses/${course.slug}/review`)
    .set(bearer(outsider.accessToken))
    .send({ rating: 5, comment: 'Never took this course.' });

  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'COURSE_NOT_PURCHASED');

  const { Course } = await import('../src/models/Course.js');
  const stored = await Course.findById(course._id).lean();
  assert.equal(stored.reviewsCount, 0, 'a rejected review must not affect the average');
});

test('an unauthenticated visitor cannot review the course', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const course = await seedCourse();
  const res = await request.post(`/api/student/courses/${course.slug}/review`).send({ rating: 5 });
  assert.equal(res.status, 401);
});

test('a student cannot review the same course twice', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const course = await seedCourse();
  const student = await makeEnrolledStudent(request, course, { name: 'Dup', email: 'dup@example.com' });

  const first = await request
    .post(`/api/student/courses/${course.slug}/review`)
    .set(bearer(student.accessToken))
    .send({ rating: 5 });
  assert.equal(first.status, 201);

  const second = await request
    .post(`/api/student/courses/${course.slug}/review`)
    .set(bearer(student.accessToken))
    .send({ rating: 1 });
  assert.equal(second.status, 409);
  assert.equal(second.body.error.code, 'REVIEW_ALREADY_EXISTS');

  const { Course } = await import('../src/models/Course.js');
  const stored = await Course.findById(course._id).lean();
  assert.equal(stored.reviewsCount, 1, 'the duplicate must not be counted');
  assert.equal(stored.rating, 5, 'the duplicate must not drag the average down');
});

test('ratings outside 1-5, fractional, or the wrong type are rejected', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const course = await seedCourse();
  const student = await makeEnrolledStudent(request, course, { name: 'Val', email: 'val@example.com' });

  for (const bad of [0, 6, -1, 4.5, '5', null, true, undefined, 100]) {
    const res = await request
      .post(`/api/student/courses/${course.slug}/review`)
      .set(bearer(student.accessToken))
      .send({ rating: bad });
    assert.equal(res.status, 422, `rating ${JSON.stringify(bad)} must be rejected`);
  }

  const { Course } = await import('../src/models/Course.js');
  assert.equal((await Course.findById(course._id).lean()).reviewsCount, 0);
});

test('a student can update their own review and the average follows', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const course = await seedCourse();
  const student = await makeEnrolledStudent(request, course, { name: 'Upd', email: 'upd@example.com' });

  await request
    .post(`/api/student/courses/${course.slug}/review`)
    .set(bearer(student.accessToken))
    .send({ rating: 2, comment: 'Struggled at first.' });

  const updated = await request
    .patch(`/api/student/courses/${course.slug}/review`)
    .set(bearer(student.accessToken))
    .send({ rating: 5, comment: 'It clicked by module 3.' });

  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.review.rating, 5);
  assert.equal(updated.body.data.course.rating, 5);
  assert.equal(updated.body.data.course.reviewsCount, 1, 'updating must not create a second review');

  const { Course } = await import('../src/models/Course.js');
  const stored = await Course.findById(course._id).lean();
  assert.equal(stored.rating, 5);
  assert.equal(stored.reviewsCount, 1);
});

test('deleting a review removes it from the average', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const course = await seedCourse();
  const a = await makeEnrolledStudent(request, course, { name: 'Del A', email: 'del.a@example.com' });
  const b = await makeEnrolledStudent(request, course, { name: 'Del B', email: 'del.b@example.com' });

  await request.post(`/api/student/courses/${course.slug}/review`).set(bearer(a.accessToken)).send({ rating: 5 });
  await request.post(`/api/student/courses/${course.slug}/review`).set(bearer(b.accessToken)).send({ rating: 1 });

  const { Course } = await import('../src/models/Course.js');
  assert.equal((await Course.findById(course._id).lean()).rating, 3, '(5+1)/2 = 3');

  const del = await request.delete(`/api/student/courses/${course.slug}/review`).set(bearer(b.accessToken));
  assert.equal(del.status, 200);
  assert.equal(del.body.data.course.rating, 5);
  assert.equal(del.body.data.course.reviewsCount, 1);

  // Deleting the last review returns the course to "no rating yet".
  await request.delete(`/api/student/courses/${course.slug}/review`).set(bearer(a.accessToken));
  const empty = await Course.findById(course._id).lean();
  assert.equal(empty.rating, 0);
  assert.equal(empty.reviewsCount, 0);
});

test('deleting or updating a review that does not exist is a 404', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const course = await seedCourse();
  const student = await makeEnrolledStudent(request, course, { name: 'None', email: 'none@example.com' });

  const del = await request.delete(`/api/student/courses/${course.slug}/review`).set(bearer(student.accessToken));
  assert.equal(del.status, 404);

  const patch = await request
    .patch(`/api/student/courses/${course.slug}/review`)
    .set(bearer(student.accessToken))
    .send({ rating: 3 });
  assert.equal(patch.status, 404);
});

test('one student cannot alter another student\'s review', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const course = await seedCourse();
  const a = await makeEnrolledStudent(request, course, { name: 'Own A', email: 'own.a@example.com' });
  const b = await makeEnrolledStudent(request, course, { name: 'Own B', email: 'own.b@example.com' });

  await request.post(`/api/student/courses/${course.slug}/review`).set(bearer(a.accessToken)).send({ rating: 5 });

  // B has no review of their own, so both operations must miss - they can only
  // ever address their own record, never A's.
  assert.equal((await request.patch(`/api/student/courses/${course.slug}/review`).set(bearer(b.accessToken)).send({ rating: 1 })).status, 404);
  assert.equal((await request.delete(`/api/student/courses/${course.slug}/review`).set(bearer(b.accessToken))).status, 404);

  const { Course } = await import('../src/models/Course.js');
  const stored = await Course.findById(course._id).lean();
  assert.equal(stored.rating, 5, "A's review must be untouched");
  assert.equal(stored.reviewsCount, 1);
});

test('reviews are publicly readable and markup in a comment is stripped', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const course = await seedCourse();
  const student = await makeEnrolledStudent(request, course, { name: 'Pub Reader', email: 'pub@example.com' });

  await request
    .post(`/api/student/courses/${course.slug}/review`)
    .set(bearer(student.accessToken))
    .send({ rating: 4, comment: '<script>alert(1)</script>Solid content.' });

  const res = await request.get(`/api/public/courses/${course.slug}/reviews`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 1);
  assert.ok(!res.body.data[0].comment.includes('<script'), 'markup must not survive');
  assert.ok(res.body.data[0].comment.includes('Solid content.'));
  assert.equal(res.body.data[0].author, 'Pub', 'only the first name is exposed');
  assert.equal(res.body.meta.rating, 4);
  assert.equal(res.body.meta.reviewsCount, 1);
});

test('platform satisfaction is null until there are enough real reviews', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const course = await seedCourse();

  // No reviews at all.
  let stats = await request.get('/api/public/stats');
  assert.equal(stats.body.data.avgRatingPercent, null, 'no reviews means no percentage');
  assert.equal(stats.body.data.satisfactionReviewsCount, 0);

  // Below the threshold - still withheld rather than published from 3 votes.
  for (let i = 0; i < 3; i++) {
    const s = await makeEnrolledStudent(request, course, { name: `Few ${i}`, email: `few${i}@example.com` });
    await request.post(`/api/student/courses/${course.slug}/review`).set(bearer(s.accessToken)).send({ rating: 5 });
  }
  stats = await request.get('/api/public/stats');
  assert.equal(stats.body.data.avgRatingPercent, null, 'below threshold must stay null');
  assert.equal(stats.body.data.satisfactionReviewsCount, 3);

  // At the threshold it becomes publishable, computed from the real ratings.
  for (let i = 3; i < 5; i++) {
    const s = await makeEnrolledStudent(request, course, { name: `Few ${i}`, email: `few${i}@example.com` });
    await request.post(`/api/student/courses/${course.slug}/review`).set(bearer(s.accessToken)).send({ rating: 5 });
  }
  stats = await request.get('/api/public/stats');
  assert.equal(stats.body.data.satisfactionReviewsCount, 5);
  assert.equal(stats.body.data.avgRatingPercent, 100, 'five 5-star reviews = 100%');
});
