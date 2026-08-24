import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { bootTestApp, registerAndLogin, bearer } from './helpers/testApp.js';

let app;
let studentA;
let studentB;

before(async () => {
  app = await bootTestApp();
  studentA = await registerAndLogin(app.request, { name: 'Student A', email: 'a@isolation.test' });
  studentB = await registerAndLogin(app.request, { name: 'Student B', email: 'b@isolation.test' });
});

after(async () => {
  await app.teardown();
});

test('registration + login round trip produces distinct, usable tokens for each student', () => {
  assert.ok(studentA.accessToken);
  assert.ok(studentB.accessToken);
  assert.notEqual(studentA.accessToken, studentB.accessToken);
  assert.notEqual(studentA.user._id, studentB.user._id);
});

test('a student cannot read, update, or delete another student\'s note (IDOR protection)', async () => {
  const createRes = await app.request
    .post('/api/student/notes')
    .set(bearer(studentA.accessToken))
    .send({ title: 'A private note', content: 'secret to A' });
  assert.equal(createRes.status, 201);
  const noteId = createRes.body.data._id;

  const updateAsB = await app.request
    .patch(`/api/student/notes/${noteId}`)
    .set(bearer(studentB.accessToken))
    .send({ title: 'HACKED', content: 'pwned' });
  assert.equal(updateAsB.status, 404);
  assert.equal(updateAsB.body.error.code, 'NOTE_NOT_FOUND');

  const deleteAsB = await app.request.delete(`/api/student/notes/${noteId}`).set(bearer(studentB.accessToken));
  assert.equal(deleteAsB.status, 404);

  const listAsA = await app.request.get('/api/student/notes').set(bearer(studentA.accessToken));
  assert.equal(listAsA.body.data[0].title, 'A private note');
});

test('each student only sees their own mentor message thread', async () => {
  await app.request.post('/api/student/messages').set(bearer(studentA.accessToken)).send({ body: 'Hello from A' });

  const messagesA = await app.request.get('/api/student/messages').set(bearer(studentA.accessToken));
  const messagesB = await app.request.get('/api/student/messages').set(bearer(studentB.accessToken));

  assert.ok(messagesA.body.data.some((m) => m.body === 'Hello from A'));
  assert.ok(!messagesB.body.data.some((m) => m.body === 'Hello from A'));
});

test('a spoofed userId in a request body is ignored in favor of the authenticated identity', async () => {
  const res = await app.request
    .post('/api/student/community/posts')
    .set(bearer(studentB.accessToken))
    .send({ body: 'Real post from B', userId: 'not-a-real-id-trying-to-spoof' });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.author.id, studentB.user._id);
});

test('profile updates as one student never affect another student\'s profile', async () => {
  await app.request.patch('/api/student/profile').set(bearer(studentB.accessToken)).send({ name: 'Student B Renamed' });

  const profileA = await app.request.get('/api/student/profile').set(bearer(studentA.accessToken));
  assert.equal(profileA.body.data.user.name, 'Student A');
});
