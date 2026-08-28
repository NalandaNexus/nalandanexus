import test from 'node:test';
import assert from 'node:assert/strict';
import { bootTestApp, registerAndLogin, bearer } from './helpers/testApp.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

async function seedCourse() {
  const { Course } = await import('../src/models/Course.js');
  return Course.create({
    slug: 'purge-course',
    title: 'Purge Course',
    description: 'Used to exercise cascade cleanup.',
    priceInPaise: 100000,
    isPurchasable: true,
    isPublished: true,
    modules: [],
  });
}

/**
 * Deleting a user used to leave their rows behind: posts kept pointing at a
 * User document that no longer existed, so the public feed silently dropped
 * them while the counter above still counted them.
 */

test('purging a user removes every record they owned', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const course = await seedCourse();
  const student = await registerAndLogin(request, { name: 'Purge Me', email: 'purge@example.com' });
  const uid = student.user._id;

  const { createEnrollment } = await import('../src/services/enrollment.service.js');
  await createEnrollment({ userId: uid, courseId: course._id, course });

  await request.post('/api/student/community/posts').set(bearer(student.accessToken)).send({ body: 'A post that should not outlive me.' });
  await request.post('/api/student/notes').set(bearer(student.accessToken)).send({ title: 'A note', content: 'text' });
  await request.post(`/api/student/courses/${course.slug}/review`).set(bearer(student.accessToken)).send({ rating: 5 });
  await request.post('/api/student/profile/avatar').set(bearer(student.accessToken)).attach('avatar', PNG, { filename: 'a.png', contentType: 'image/png' });

  const { Course } = await import('../src/models/Course.js');
  assert.equal((await Course.findById(course._id).lean()).reviewsCount, 1, 'precondition: the review counts');

  const { purgeUser } = await import('../src/services/userPurge.service.js');
  const removed = await purgeUser(uid);

  assert.ok(removed, 'purge should report what it removed');
  assert.equal(removed.user, 1);

  const { User } = await import('../src/models/User.js');
  const { Post } = await import('../src/models/Post.js');
  const { Note } = await import('../src/models/Note.js');
  const { Review } = await import('../src/models/Review.js');
  const { Enrollment } = await import('../src/models/Enrollment.js');
  const { StoredFile } = await import('../src/models/StoredFile.js');

  assert.equal(await User.countDocuments({ _id: uid }), 0, 'user gone');
  assert.equal(await Post.countDocuments({ userId: uid }), 0, 'posts gone');
  assert.equal(await Note.countDocuments({ userId: uid }), 0, 'notes gone');
  assert.equal(await Review.countDocuments({ userId: uid }), 0, 'reviews gone');
  assert.equal(await Enrollment.countDocuments({ userId: uid }), 0, 'enrollment gone');
  assert.equal(await StoredFile.countDocuments({ ownerId: uid }), 0, 'avatar bytes gone');
});

test('purging a reviewer recalculates the course rating they contributed to', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const course = await seedCourse();
  const { createEnrollment } = await import('../src/services/enrollment.service.js');
  const { Course } = await import('../src/models/Course.js');

  const keep = await registerAndLogin(request, { name: 'Keep', email: 'keep@example.com' });
  const drop = await registerAndLogin(request, { name: 'Drop', email: 'drop@example.com' });
  await createEnrollment({ userId: keep.user._id, courseId: course._id, course });
  await createEnrollment({ userId: drop.user._id, courseId: course._id, course });

  await request.post(`/api/student/courses/${course.slug}/review`).set(bearer(keep.accessToken)).send({ rating: 5 });
  await request.post(`/api/student/courses/${course.slug}/review`).set(bearer(drop.accessToken)).send({ rating: 1 });

  assert.equal((await Course.findById(course._id).lean()).rating, 3, 'precondition: (5+1)/2');

  const { purgeUser } = await import('../src/services/userPurge.service.js');
  await purgeUser(drop.user._id);

  const after = await Course.findById(course._id).lean();
  assert.equal(after.rating, 5, "the departed student's rating must stop counting");
  assert.equal(after.reviewsCount, 1);
});

test('purging an unknown user is a no-op rather than an error', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const mongoose = (await import('mongoose')).default;
  const { purgeUser } = await import('../src/services/userPurge.service.js');
  assert.equal(await purgeUser(new mongoose.Types.ObjectId()), null);
});

test('orphan sweep removes rows whose owner is already gone, and nothing else', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const living = await registerAndLogin(request, { name: 'Living', email: 'living@example.com' });
  await request.post('/api/student/community/posts').set(bearer(living.accessToken)).send({ body: 'A post with a real author.' });

  // Simulate the historical bug: delete the User row directly, leaving the post.
  const ghost = await registerAndLogin(request, { name: 'Ghost', email: 'ghost@example.com' });
  await request.post('/api/student/community/posts').set(bearer(ghost.accessToken)).send({ body: 'A post whose author vanishes.' });
  const { User } = await import('../src/models/User.js');
  await User.deleteOne({ _id: ghost.user._id });

  const { Post } = await import('../src/models/Post.js');
  assert.equal(await Post.countDocuments({}), 2, 'precondition: one real post, one orphan');

  const { purgeOrphanedRecords } = await import('../src/services/userPurge.service.js');

  const dry = await purgeOrphanedRecords({ dryRun: true });
  assert.equal(dry.posts, 1, 'dry run should find exactly one orphaned post');
  assert.equal(await Post.countDocuments({}), 2, 'dry run must not delete anything');

  const applied = await purgeOrphanedRecords();
  assert.equal(applied.posts, 1);
  assert.equal(await Post.countDocuments({}), 1, 'only the orphan is removed');

  const survivor = await Post.findOne({}).lean();
  assert.equal(String(survivor.userId), String(living.user._id), "the living student's post survives");
});
