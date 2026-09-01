import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Admin authentication over an httpOnly session cookie.
 *
 * The token used to be returned in the response body and kept in localStorage,
 * which put a SUPER_ADMIN credential where any script on the page could read
 * it - one XSS anywhere in the bundle, or in a dependency, and full
 * administrative access walks out. The Student and Teacher portals already used
 * httpOnly cookies, and this backend's auth middleware already accepted one; it
 * simply was never issued.
 *
 * This is the login every administrator depends on, so the whole cycle is
 * exercised for real - issue, use, refresh, invalidate - against the actual app.
 */

let mongod;
let server;
let base;
let Admin;

before(async () => {
  mongod = await MongoMemoryServer.create();

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'test_admin_jwt_secret';
  process.env.CLIENT_URL = 'http://localhost:5175';
  // Same-site in tests: SameSite=None demands Secure, and there is no TLS here.
  process.env.COOKIE_SAMESITE = 'lax';

  const { connectDatabase } = await import('../src/config/db.js');
  await connectDatabase();

  const { createApp } = await import('../src/app.js');
  const app = createApp();
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;

  ({ Admin } = await import('../src/models/Admin.js'));
  await Admin.create({
    name: 'Cookie Test Admin',
    email: 'cookie.admin@test.local',
    passwordHash: await Admin.hashPassword('TestPass123!'),
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
  });
});

after(async () => {
  await new Promise((r) => server.close(r));
  const mongoose = (await import('mongoose')).default;
  await mongoose.connection.close();
  await mongod.stop();
});

async function call(path, { method = 'GET', body, cookie, headers = {} } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  return { status: res.status, body: json, setCookie, cookie: setCookie.map((c) => c.split(';')[0]).join('; ') };
}

function login(password = 'TestPass123!') {
  return call('/api/admin/auth/login', { method: 'POST', body: { email: 'cookie.admin@test.local', password } });
}

test('login issues an httpOnly session cookie', async () => {
  const res = await login();
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const raw = res.setCookie.find((c) => c.startsWith('nalanda_admin_token='));
  assert.ok(raw, 'a session cookie must be set');
  assert.match(raw, /HttpOnly/i, 'the token must be unreadable from JavaScript');
  assert.match(raw, /Path=\//i);
  assert.match(raw, /SameSite=Lax/i, 'test config; production uses None+Secure for the cross-site deploy');
});

test('the cookie alone authenticates a protected route', async () => {
  const { cookie } = await login();

  // No Authorization header anywhere - the cookie is the only credential.
  const me = await call('/api/admin/auth/me', { cookie });
  assert.equal(me.status, 200, JSON.stringify(me.body));
  assert.equal(me.body.data.email, 'cookie.admin@test.local');

  const courses = await call('/api/admin/courses', { cookie });
  assert.equal(courses.status, 200, 'a real data route works on the cookie too');
});

test('no credential at all is rejected', async () => {
  const me = await call('/api/admin/auth/me');
  assert.equal(me.status, 401);
});

test('the session survives a page refresh', async () => {
  const { cookie } = await login();
  // A refresh is simply the same cookie presented again on a fresh request.
  for (let i = 0; i < 3; i += 1) {
    const me = await call('/api/admin/auth/me', { cookie });
    assert.equal(me.status, 200, `refresh ${i + 1} lost the session`);
  }
});

test('logout clears the cookie and the old one stops working', async () => {
  const { cookie } = await login();
  assert.equal((await call('/api/admin/auth/me', { cookie })).status, 200);

  const out = await call('/api/admin/auth/logout', { method: 'POST', cookie });
  assert.equal(out.status, 200, JSON.stringify(out.body));

  const cleared = out.setCookie.find((c) => c.startsWith('nalanda_admin_token='));
  assert.ok(cleared, 'logout must send a clearing cookie');
  assert.match(cleared, /HttpOnly/i, 'cleared with the same attributes, or the browser keeps the old one');

  const after = await call('/api/admin/auth/me', { cookie });
  assert.equal(after.status, 401, 'the presented session must be dead server-side, not merely cleared in the browser');
});

/**
 * tokenVersion is what makes "sign out everywhere" real. A password change
 * bumps it, so every session issued before must stop working - including one
 * held by an attacker who already stole a token.
 */
test('changing the password invalidates other sessions but keeps this one', async () => {
  const first = await login();
  const second = await login();

  const changed = await call('/api/admin/auth/change-password', {
    method: 'POST',
    cookie: second.cookie,
    body: { currentPassword: 'TestPass123!', newPassword: 'RotatedPass456!' },
  });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));

  const reissued = changed.setCookie.find((c) => c.startsWith('nalanda_admin_token='));
  assert.ok(reissued, 'the acting browser must be re-issued a cookie, or it signs itself out');

  const stale = await call('/api/admin/auth/me', { cookie: first.cookie });
  assert.equal(stale.status, 401, 'every other session must be invalidated');

  const stillIn = await call('/api/admin/auth/me', { cookie: reissued.split(';')[0] });
  assert.equal(stillIn.status, 200, 'the admin who changed it stays signed in');

  // Restore, so this file can be re-run.
  await call('/api/admin/auth/change-password', {
    method: 'POST',
    cookie: reissued.split(';')[0],
    body: { currentPassword: 'RotatedPass456!', newPassword: 'TestPass123!' },
  });
});

/**
 * The already-deployed admin frontend authenticates with a bearer token, and
 * frontend and backend deploy independently. If the cookie change removed
 * bearer support, every administrator would be locked out during the window
 * between the two deploys.
 */
test('bearer tokens still work, so the two deploys can land in either order', async () => {
  const res = await login();
  const token = res.body.data.token;
  assert.ok(token, 'transitional: the body still carries a token for the older frontend');

  const me = await call('/api/admin/auth/me', { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(me.status, 200, 'an older deployed frontend must keep working');
});

test('a forged or tampered token is rejected', async () => {
  const { cookie } = await login();
  const tampered = `${cookie.slice(0, -6)}AAAAAA`;

  const res = await call('/api/admin/auth/me', { cookie: tampered });
  assert.equal(res.status, 401, 'a signature that does not verify must never authenticate');
});

/**
 * Health must report whether the shared rate-limit counter is actually
 * reachable from this instance.
 *
 * The store degrades quietly when the database is unreachable - it lets the
 * request through rather than taking the API down - which is the right trade but
 * made a real production problem invisible from outside. `instanceId` is
 * per-process, so repeated calls returning different ids reveal how many
 * containers are serving, the other half of diagnosing an unshared counter.
 */
test('health reports the rate-limit store and the answering instance', async () => {
  const res = await call('/api/health');
  assert.equal(res.status, 200, JSON.stringify(res.body));

  assert.equal(res.body.database, 'connected');
  assert.ok(res.body.rateLimitStore, 'health must describe the store');
  assert.equal(res.body.rateLimitStore.reachable, true, 'the store must be reachable when the database is');
  assert.equal(res.body.rateLimitStore.collection, 'ratelimits');
  assert.ok(res.body.rateLimitStore.instanceId, 'the answering instance must identify itself');

  // Same process, so the same id - a differing id across calls in production is
  // what proves more than one container is live.
  const again = await call('/api/health');
  assert.equal(again.body.rateLimitStore.instanceId, res.body.rateLimitStore.instanceId);
});

test('the probe leaves no residue in the counter collection', async () => {
  const mongoose = (await import('mongoose')).default;
  await call('/api/health');
  const leftovers = await mongoose.connection.collection('ratelimits').countDocuments({ _id: /^probe:/ });
  assert.equal(leftovers, 0, 'a diagnostic must not accumulate documents');
});
