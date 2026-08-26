import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { bootTestApp } from './helpers/testApp.js';

/**
 * Smoke coverage for the admin backend, which had no test suite at all
 * before this. Focused on the guarantees this service must never lose: it
 * is the highest-privilege portal, so "nothing is reachable without a
 * session" is the property most worth pinning down.
 */
let request;
let teardown;

const ADMIN_ORIGIN = 'http://localhost:5175';

before(async () => {
  ({ request, teardown } = await bootTestApp());
});

after(async () => {
  if (teardown) await teardown();
});

describe('admin backend smoke', () => {
  test('health endpoint reports a connected database', async () => {
    const res = await request.get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.database, 'connected');
  });

  test('every governance route refuses an unauthenticated request', async () => {
    const routes = [
      '/api/admin/overview',
      '/api/admin/teachers',
      '/api/admin/students',
      '/api/admin/courses',
      '/api/admin/announcements',
      '/api/admin/payments',
      '/api/admin/audit-logs',
      '/api/admin/settings',
    ];

    for (const route of routes) {
      const res = await request.get(route);
      assert.equal(res.status, 401, `${route} should require authentication`);
      assert.equal(res.body.success, false);
    }
  });

  test('the live telemetry stream is no longer public', async () => {
    // It used to be deliberately unauthenticated because EventSource cannot
    // set an Authorization header, which leaked account totals, the
    // suspended-teacher count and database status to anyone. The session now
    // travels in a cookie the browser attaches itself, so it can be guarded.
    const res = await request.get('/api/admin/live-telemetry');
    assert.equal(res.status, 401);
  });

  test('a forged JWT is rejected rather than trusted', async () => {
    const forged = [
      Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
      Buffer.from(JSON.stringify({ id: 'x', role: 'SUPER_ADMIN' })).toString('base64url'),
      '',
    ].join('.');

    const res = await request.get('/api/admin/teachers').set('Authorization', `Bearer ${forged}`);
    assert.equal(res.status, 401);
  });

  test('login rejects a malformed body', async () => {
    const res = await request.post('/api/admin/auth/login').send({ email: 'not-an-email', password: '' });
    assert.equal(res.status, 422);
    assert.equal(res.body.code, 'VALIDATION_ERROR');
  });

  test('login rejects unknown credentials', async () => {
    const res = await request
      .post('/api/admin/auth/login')
      .send({ email: 'nobody@example.com', password: 'WrongPassword1' });
    assert.equal(res.status, 401);
  });

  test('an unknown route answers 404, not 500', async () => {
    const res = await request.get('/api/definitely-not-a-route');
    assert.equal(res.status, 404);
    assert.equal(res.body.code, 'ROUTE_NOT_FOUND');
  });

  test('malformed JSON is a client error, not a server error', async () => {
    const res = await request
      .post('/api/admin/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": broken');
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'INVALID_JSON');
  });

  test('an over-sized body is answered 413, not 500', async () => {
    const res = await request
      .post('/api/admin/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(4 * 1024 * 1024) }));
    assert.equal(res.status, 413);
    assert.equal(res.body.code, 'PAYLOAD_TOO_LARGE');
  });

  test('an untrusted origin is never echoed back in the CORS header', async () => {
    // This service configures cors() with a fixed origin string rather than
    // a callback, so a foreign origin is not rejected server-side - the
    // request completes and the browser is the one that blocks it. The
    // property that actually protects a user is therefore not the status
    // code but the header: Access-Control-Allow-Origin must never reflect
    // the caller's origin, because that is what would let an attacker's page
    // read an authenticated response.
    const hostileOrigin = 'https://not-the-admin-portal.example.com';
    const res = await request.get('/api/health').set('Origin', hostileOrigin);
    assert.notEqual(res.headers['access-control-allow-origin'], hostileOrigin);
    assert.notEqual(res.headers['access-control-allow-origin'], '*');
  });

  test('the configured admin origin is allowed', async () => {
    const res = await request.get('/api/health').set('Origin', ADMIN_ORIGIN);
    assert.equal(res.status, 200);
    assert.equal(res.headers['access-control-allow-origin'], ADMIN_ORIGIN);
  });

  test('internal service routes refuse calls without the shared secret', async () => {
    const res = await request.post('/api/internal/announcements').send({ title: 'x', content: 'y' });
    assert.ok(res.status === 401 || res.status === 403, `expected 401/403, got ${res.status}`);
  });

  test('no response leaks a stack trace', async () => {
    const res = await request.get('/api/admin/teachers');
    assert.equal(res.status, 401);
    assert.ok(!JSON.stringify(res.body).includes('at '), 'response should not contain a stack trace');
  });
});
