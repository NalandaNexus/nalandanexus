/**
 * Wiring smoke test — NOT a substitute for real integration testing against
 * a live MongoDB.
 *
 * This script boots the real Express app (the exact `createApp()` used by
 * server.js) but deliberately never calls `connectDatabase()`. That means it
 * can only verify the parts of the request pipeline that are — and must be —
 * decided *before* any database access happens:
 *
 *   - the health endpoint responds and honestly reports the DB as disconnected
 *   - unknown routes fall through to the centralized 404 handler
 *   - protected routes reject requests with no/invalid credentials (401)
 *     before ever reaching a controller
 *   - request validation rejects bad payloads (422) before ever reaching a
 *     controller
 *   - malformed JSON bodies are rejected (400)
 *   - security headers (helmet) and CORS are attached to every response
 *   - route ordering is correct (auth middleware runs before per-route
 *     validators, which is what makes the 401-before-422 case below prove
 *     anything)
 *
 * It does NOT and CANNOT verify: successful login, session cookies, reads,
 * writes, aggregations, Socket.IO events, or anything else that needs a real
 * MongoDB — there is no reachable MongoDB in the environment this script was
 * authored in. Run `npm run seed` against a real MongoDB and exercise the
 * app from the frontend (or Postman/curl) for that coverage; see the
 * backend README's "Verification performed / not performed" section for the
 * full, honest breakdown of what has and hasn't been exercised end-to-end.
 *
 * Usage: npm run test:smoke
 */
import http from 'node:http';
import { createApp } from '../app.js';
import { env } from '../config/env.js';

let server;
let baseUrl;
let passed = 0;
let failed = 0;
const failures = [];

function request(method, path, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined;
    const req = http.request(
      `${baseUrl}${path}`,
      {
        method,
        headers: {
          Connection: 'close',
          ...(payload !== undefined
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {
            /* non-JSON body, leave json null */
          }
          resolve({ status: res.statusCode, headers: res.headers, body: json, raw });
        });
      }
    );
    req.on('error', reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    failures.push({ name, error: err.message });
    console.log(`  ✗ ${name}`);
    console.log(`      ${err.message}`);
  }
}

async function main() {
  const app = createApp();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  console.log('Nalanda Teacher Backend — wiring smoke test');
  console.log('(No MongoDB connection is made; DB-dependent behavior is out of scope for this script.)\n');

  console.log('Health & routing:');
  await check('GET /api/health -> 200, honestly reports database: disconnected', async () => {
    const res = await request('GET', '/api/health');
    assert(res.status === 200, `expected 200, got ${res.status}`);
    assert(res.body?.status === 'healthy', `expected status: healthy, got ${JSON.stringify(res.body)}`);
    assert(
      res.body?.database === 'disconnected',
      `expected database: disconnected (no MongoDB in this environment), got ${res.body?.database}`
    );
  });

  await check('GET /api/completely-unknown-prefix -> 404 ROUTE_NOT_FOUND', async () => {
    const res = await request('GET', '/api/completely-unknown-prefix');
    assert(res.status === 404, `expected 404, got ${res.status}`);
    assert(res.body?.success === false, 'expected success: false');
    assert(res.body?.error?.code === 'ROUTE_NOT_FOUND', `expected ROUTE_NOT_FOUND, got ${JSON.stringify(res.body)}`);
  });

  await check(
    'GET /api/teacher/this-route-does-not-exist (unauthenticated) -> 401, not 404 (see routes/index.js comment)',
    async () => {
      // teacherRoutes is mounted at bare '/' and gates every /api/teacher/*
      // path with `authenticate` before route matching can conclude "not
      // found" — so an anonymous caller learns nothing about which routes
      // exist. This is documented, intentional-by-effect, and fail-safe;
      // this test pins that behavior so a future refactor can't silently
      // flip it (e.g. into leaking route existence to anonymous probing).
      const res = await request('GET', '/api/teacher/this-route-does-not-exist');
      assert(res.status === 401, `expected 401, got ${res.status}`);
      assert(res.body?.error?.code === 'NO_TOKEN', `expected NO_TOKEN, got ${JSON.stringify(res.body)}`);
    }
  );

  await check('GET /uploads/does-not-exist.png -> 404 (static handler present, no crash)', async () => {
    const res = await request('GET', '/uploads/does-not-exist.png');
    assert(res.status === 404, `expected 404, got ${res.status}`);
  });

  console.log('\nSecurity headers & CORS:');
  await check('helmet security headers present on every response', async () => {
    const res = await request('GET', '/api/health');
    assert(res.headers['x-content-type-options'] === 'nosniff', 'missing x-content-type-options: nosniff');
    assert('x-dns-prefetch-control' in res.headers, 'missing helmet header x-dns-prefetch-control');
  });

  await check('CORS reflects the configured client origin with credentials enabled', async () => {
    const res = await request('GET', '/api/health', { headers: { Origin: env.clientUrl } });
    assert(
      res.headers['access-control-allow-origin'] === env.clientUrl,
      `expected access-control-allow-origin: ${env.clientUrl}, got ${res.headers['access-control-allow-origin']}`
    );
    assert(res.headers['access-control-allow-credentials'] === 'true', 'expected access-control-allow-credentials: true');
  });

  console.log('\nAuth gate (must reject before touching the database):');
  await check('GET /api/teacher/dashboard/overview with no cookie/token -> 401 NO_TOKEN', async () => {
    const res = await request('GET', '/api/teacher/dashboard/overview');
    assert(res.status === 401, `expected 401, got ${res.status}`);
    assert(res.body?.error?.code === 'NO_TOKEN', `expected NO_TOKEN, got ${JSON.stringify(res.body)}`);
  });

  await check('GET /api/teacher/students with a garbage Bearer token -> 401 INVALID_TOKEN', async () => {
    const res = await request('GET', '/api/teacher/students', { headers: { Authorization: 'Bearer not-a-real-jwt' } });
    assert(res.status === 401, `expected 401, got ${res.status}`);
    assert(res.body?.error?.code === 'INVALID_TOKEN', `expected INVALID_TOKEN, got ${JSON.stringify(res.body)}`);
  });

  await check('POST /api/teacher/classes with no auth -> 401 (auth runs before per-route validation)', async () => {
    const res = await request('POST', '/api/teacher/classes', { body: {} });
    assert(res.status === 401, `expected 401, got ${res.status}`);
  });

  await check('GET /api/teacher/analytics/performance-trend with no auth -> 401 (Pro gate never reached)', async () => {
    const res = await request('GET', '/api/teacher/analytics/performance-trend');
    assert(res.status === 401, `expected 401, got ${res.status}`);
  });

  await check('POST /api/teacher/auth/logout with no auth -> 401', async () => {
    const res = await request('POST', '/api/teacher/auth/logout');
    assert(res.status === 401, `expected 401, got ${res.status}`);
  });

  await check('GET /api/teacher/schedule with no auth -> 401 (new route wired the same as every other)', async () => {
    const res = await request('GET', '/api/teacher/schedule');
    assert(res.status === 401, `expected 401, got ${res.status}`);
  });

  console.log('\nRequest validation (must reject before reaching a controller/DB):');
  await check('POST /api/teacher/auth/login with an empty body -> 422 VALIDATION_ERROR', async () => {
    const res = await request('POST', '/api/teacher/auth/login', { body: {} });
    assert(res.status === 422, `expected 422, got ${res.status}`);
    assert(res.body?.error?.code === 'VALIDATION_ERROR', `expected VALIDATION_ERROR, got ${JSON.stringify(res.body)}`);
    const fields = (res.body?.error?.details || []).map((d) => d.field);
    assert(fields.includes('email'), `expected an 'email' field error, got fields: ${fields.join(', ')}`);
  });

  await check('POST /api/teacher/auth/login with a malformed email -> 422 VALIDATION_ERROR', async () => {
    const res = await request('POST', '/api/teacher/auth/login', { body: { email: 'not-an-email', password: 'x' } });
    assert(res.status === 422, `expected 422, got ${res.status}`);
    const fields = (res.body?.error?.details || []).map((d) => d.field);
    assert(fields.includes('email'), `expected an 'email' field error, got fields: ${fields.join(', ')}`);
  });

  await check('POST /api/teacher/auth/login with malformed JSON body -> 400 INVALID_JSON', async () => {
    const res = await request('POST', '/api/teacher/auth/login', { body: '{not valid json' });
    assert(res.status === 400, `expected 400, got ${res.status}`);
    assert(res.body?.error?.code === 'INVALID_JSON', `expected INVALID_JSON, got ${JSON.stringify(res.body)}`);
  });

  await check('GET /api/teacher/schedule?date=not-a-date with no auth -> 401 (auth before query validation)', async () => {
    const res = await request('GET', '/api/teacher/schedule?date=not-a-date');
    assert(res.status === 401, `expected 401, got ${res.status}`);
  });

  await new Promise((resolve) => server.close(resolve));

  console.log('\n──────────────────────────────────────────────');
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log('──────────────────────────────────────────────');
  if (failed > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f.name}: ${f.error}`);
  }
  console.log(
    '\nReminder: this script only covers pre-database wiring. Login success,\n' +
      'reads, writes, aggregations, and Socket.IO events still need to be\n' +
      'verified against a real MongoDB — see README.md.'
  );

  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error('[smoke] Fatal error running smoke test:', err);
  process.exitCode = 1;
});
