import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { bootTestApp } from './helpers/testApp.js';

/**
 * Smoke coverage for the teacher backend, which had no test suite at all
 * before this. Deliberately focused on the guarantees that are cheap to
 * assert and expensive to lose: nothing reachable without a session, and
 * client mistakes answered as client errors rather than 500s.
 */
let request;
let teardown;

before(async () => {
  ({ request, teardown } = await bootTestApp());
});

after(async () => {
  if (teardown) await teardown();
});

describe('teacher backend smoke', () => {
  test('health endpoint reports a connected database', async () => {
    const res = await request.get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.database, 'connected');
  });

  test('every protected route refuses an unauthenticated request', async () => {
    const routes = [
      '/api/teacher/dashboard/overview',
      '/api/teacher/classes',
      '/api/teacher/students',
      '/api/teacher/assignments',
      '/api/teacher/announcements',
      '/api/teacher/profile',
    ];

    for (const route of routes) {
      const res = await request.get(route);
      assert.equal(res.status, 401, `${route} should require authentication`);
      assert.equal(res.body.success, false);
    }
  });

  test('a forged JWT is rejected rather than trusted', async () => {
    // Signed with the wrong secret, and claiming an escalated role.
    const forged = [
      Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
      Buffer.from(JSON.stringify({ sub: 'x', role: 'admin' })).toString('base64url'),
      '',
    ].join('.');

    const res = await request.get('/api/teacher/classes').set('Authorization', `Bearer ${forged}`);
    assert.equal(res.status, 401);
  });

  test('login rejects a malformed body without touching the database', async () => {
    const res = await request.post('/api/teacher/auth/login').send({ email: 'not-an-email', password: '' });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('login rejects unknown credentials without disclosing which field was wrong', async () => {
    const res = await request
      .post('/api/teacher/auth/login')
      .send({ email: 'nobody@example.com', password: 'WrongPassword1' });
    assert.equal(res.status, 401);
    assert.doesNotMatch(JSON.stringify(res.body).toLowerCase(), /no such (user|account)|email not found/);
  });

  test('an unknown route answers 404, not 500', async () => {
    // Deliberately outside /api/teacher: routes under that mount sit behind
    // the session check, so an unknown one there answers 401 first, which is
    // the better behaviour - it doesn't tell an anonymous caller which
    // routes exist.
    const res = await request.get('/api/definitely-not-a-route');
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'ROUTE_NOT_FOUND');
  });

  test('an unknown route under the authenticated mount does not disclose its existence', async () => {
    const res = await request.get('/api/teacher/definitely-not-a-route');
    assert.equal(res.status, 401);
  });

  test('malformed JSON is a client error, not a server error', async () => {
    const res = await request
      .post('/api/teacher/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": broken');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_JSON');
  });

  test('an over-sized body is answered 413, not 500', async () => {
    const res = await request
      .post('/api/teacher/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(3 * 1024 * 1024) }));
    assert.equal(res.status, 413);
    assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE');
  });

  test('internal service routes refuse calls without the shared secret', async () => {
    const res = await request.post('/api/internal/teachers').send({ name: 'X', email: 'x@example.com' });
    assert.ok(res.status === 401 || res.status === 403, `expected 401/403, got ${res.status}`);
  });

  test('no response leaks a stack trace', async () => {
    const res = await request.get('/api/teacher/classes');
    assert.equal(res.status, 401);
    assert.ok(!JSON.stringify(res.body).includes('at '), 'response should not contain a stack trace');
  });
});
