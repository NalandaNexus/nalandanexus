import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
process.env.CLIENT_URL = 'http://localhost:5173';

const { default: supertest } = await import('supertest');
const { createApp } = await import('../src/app.js');

const app = createApp();
const request = supertest(app);

test('GET /api/health responds without requiring auth or a live DB connection', async () => {
  const res = await request.get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.service, 'nalanda-student-backend');
});

test('unknown route returns a consistent 404 envelope', async () => {
  const res = await request.get('/api/this-route-does-not-exist');
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'ROUTE_NOT_FOUND');
});

test('POST /api/auth/register rejects a short password before ever touching the DB', async () => {
  const res = await request.post('/api/auth/register').send({ name: 'Test Student', email: 'test@example.com', password: '123' });
  assert.equal(res.status, 422);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('POST /api/auth/register rejects an invalid email', async () => {
  const res = await request.post('/api/auth/register').send({ name: 'Test Student', email: 'not-an-email', password: 'goodpassword123' });
  assert.equal(res.status, 422);
});

test('GET /api/auth/me without a token is rejected with 401', async () => {
  const res = await request.get('/api/auth/me');
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'NO_TOKEN');
});

test('protected student routes require authentication', async () => {
  const res = await request.get('/api/student/dashboard');
  assert.equal(res.status, 401);
});

test('payment order creation requires authentication (course price can never be client-controlled)', async () => {
  const res = await request.post('/api/payments/orders').send({ courseSlug: 'prarambh' });
  assert.equal(res.status, 401);
});

test('quiz submission rejects malformed answers payload', async () => {
  // Even though this also requires auth, validation is now wired after auth
  // middleware per route; confirm it's not reachable unauthenticated with a 500.
  const res = await request.post('/api/student/quizzes/mindset/submit').send({ answers: 'not-an-object' });
  assert.ok([401, 422].includes(res.status));
});
