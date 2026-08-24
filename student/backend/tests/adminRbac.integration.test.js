import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { bootTestApp, registerAndLogin, bearer } from './helpers/testApp.js';

let app;
let student;
let adminToken;
let adminId;

before(async () => {
  app = await bootTestApp();

  student = await registerAndLogin(app.request, { name: 'RBAC Student', email: 'rbac@integration.test' });

  const { User } = await import('../src/models/User.js');
  const { hashPassword } = await import('../src/services/auth.service.js');
  const passwordHash = await hashPassword('AdminPass123!');
  const admin = await User.create({ name: 'RBAC Admin', email: 'admin@integration.test', passwordHash, role: 'admin', isVerified: true });
  adminId = String(admin._id);

  const loginRes = await app.request.post('/api/auth/login').send({ email: 'admin@integration.test', password: 'AdminPass123!' });
  adminToken = loginRes.body.data.accessToken;
});

after(async () => {
  await app.teardown();
});

test('a student is forbidden from every /api/admin route', async () => {
  const res = await app.request.get('/api/admin/announcements').set(bearer(student.accessToken));
  assert.equal(res.status, 403);
});

test('an admin can publish an announcement, and it is attributed to them by name+role', async () => {
  const createRes = await app.request
    .post('/api/admin/announcements')
    .set(bearer(adminToken))
    .send({ title: 'Integration announcement', content: 'Created via the real admin API.' });

  assert.equal(createRes.status, 201);
  // createAnnouncementService populates createdBy before returning it.
  assert.equal(createRes.body.data.createdBy._id, adminId);
  assert.equal(createRes.body.data.createdBy.name, 'RBAC Admin');

  const studentView = await app.request.get('/api/student/announcements').set(bearer(student.accessToken));
  const found = studentView.body.data.find((a) => a.title === 'Integration announcement');
  assert.ok(found, 'student should see the admin-created announcement');
  assert.equal(found.author.name, 'RBAC Admin');
  assert.equal(found.author.role, 'admin');
});

test('a student cannot spoof their way into creating an announcement by posting to the admin route', async () => {
  const res = await app.request
    .post('/api/admin/announcements')
    .set(bearer(student.accessToken))
    .send({ title: 'Should not exist', content: 'Student trying to self-promote.' });
  assert.equal(res.status, 403);

  const studentView = await app.request.get('/api/student/announcements').set(bearer(student.accessToken));
  assert.ok(!studentView.body.data.some((a) => a.title === 'Should not exist'));
});

test('full admin CRUD lifecycle for live classes is real, not seed-only', async () => {
  const createRes = await app.request
    .post('/api/admin/live-classes')
    .set(bearer(adminToken))
    .send({ title: 'Integration Live Class', instructor: 'Test Instructor', scheduledAt: new Date(Date.now() + 86400000).toISOString() });
  assert.equal(createRes.status, 201);
  const liveClassId = createRes.body.data._id;

  const studentSees = await app.request.get('/api/student/live-classes').set(bearer(student.accessToken));
  assert.ok(studentSees.body.data.upcoming.some((c) => c._id === liveClassId));

  const updateRes = await app.request
    .patch(`/api/admin/live-classes/${liveClassId}`)
    .set(bearer(adminToken))
    .send({ status: 'cancelled' });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.data.status, 'cancelled');

  const deleteRes = await app.request.delete(`/api/admin/live-classes/${liveClassId}`).set(bearer(adminToken));
  assert.equal(deleteRes.status, 200);

  const afterDelete = await app.request.get('/api/admin/live-classes').set(bearer(adminToken));
  assert.ok(!afterDelete.body.data.some((c) => c._id === liveClassId));
});
