import test from 'node:test';
import assert from 'node:assert/strict';
import { bootTestApp, registerAndLogin, bearer } from './helpers/testApp.js';

// A 1x1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

/**
 * Avatars used to be written to the container's local disk, which Render wipes
 * on every redeploy - the URL stayed on the User document and the image 404'd
 * forever after. They are now stored in MongoDB and served from there.
 */

test('an uploaded avatar is stored in the database, not on disk', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const student = await registerAndLogin(request, { name: 'Avatar One', email: 'avatar1@example.com' });

  const res = await request
    .post('/api/student/profile/avatar')
    .set(bearer(student.accessToken))
    .attach('avatar', PNG, { filename: 'me.png', contentType: 'image/png' });

  assert.equal(res.status, 200);
  const url = res.body.data.user.avatar;
  assert.match(url, /^\/uploads\/avatars\/.+\.png$/);

  const { StoredFile } = await import('../src/models/StoredFile.js');
  const stored = await StoredFile.findOne({ ownerId: student.user._id }).lean();
  assert.ok(stored, 'the bytes must be persisted in MongoDB');
  assert.equal(stored.contentType, 'image/png');
  assert.equal(stored.sizeBytes, PNG.length);
  // .lean() yields a BSON Binary, not a Node Buffer - normalise before comparing.
  const bytes = Buffer.isBuffer(stored.data) ? stored.data : Buffer.from(stored.data.buffer);
  assert.ok(bytes.equals(PNG), 'the exact bytes must be persisted');
});

test('the stored avatar is served back with the right headers', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const student = await registerAndLogin(request, { name: 'Avatar Two', email: 'avatar2@example.com' });
  const upload = await request
    .post('/api/student/profile/avatar')
    .set(bearer(student.accessToken))
    .attach('avatar', PNG, { filename: 'me.png', contentType: 'image/png' });

  const res = await request.get(upload.body.data.user.avatar);
  assert.equal(res.status, 200);
  assert.equal(res.headers['content-type'], 'image/png');
  // nosniff is what stops a browser re-interpreting the bytes as HTML if
  // someone uploads markup with a spoofed image Content-Type.
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.ok(res.body.equals(PNG), 'the exact bytes must come back');
});

test('requesting an unknown avatar key is a clean 404, not a crash', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const res = await request.get('/uploads/avatars/does-not-exist.png');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'FILE_NOT_FOUND');
});

test('re-uploading replaces the old avatar instead of accumulating blobs', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const student = await registerAndLogin(request, { name: 'Avatar Three', email: 'avatar3@example.com' });
  const { StoredFile } = await import('../src/models/StoredFile.js');

  const first = await request
    .post('/api/student/profile/avatar')
    .set(bearer(student.accessToken))
    .attach('avatar', PNG, { filename: 'a.png', contentType: 'image/png' });

  const second = await request
    .post('/api/student/profile/avatar')
    .set(bearer(student.accessToken))
    .attach('avatar', PNG, { filename: 'b.png', contentType: 'image/png' });

  assert.notEqual(first.body.data.user.avatar, second.body.data.user.avatar, 'a new key each time');
  assert.equal(await StoredFile.countDocuments({ ownerId: student.user._id }), 1, 'only the current avatar is kept');

  // The superseded URL must stop resolving.
  assert.equal((await request.get(first.body.data.user.avatar)).status, 404);
  assert.equal((await request.get(second.body.data.user.avatar)).status, 200);
});

test('a non-image upload is still rejected', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const student = await registerAndLogin(request, { name: 'Avatar Four', email: 'avatar4@example.com' });
  const res = await request
    .post('/api/student/profile/avatar')
    .set(bearer(student.accessToken))
    .attach('avatar', Buffer.from('<?php echo 1; ?>'), { filename: 'x.php', contentType: 'application/x-php' });

  assert.equal(res.status, 400);
  const { StoredFile } = await import('../src/models/StoredFile.js');
  assert.equal(await StoredFile.countDocuments({}), 0, 'nothing may be persisted for a rejected type');
});
