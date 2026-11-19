import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Admin search by enrollment number.
 *
 * Students live in the student service, so this route is a proxy - and the
 * questions worth a test are all about the gate in front of it: who may search
 * at all (students.read), who additionally sees payments (payments.view), and
 * that the number is normalised before it leaves.
 *
 * The student service is a local stand-in. Every outbound destination this
 * backend's own .env might name is overridden before the app loads.
 */

let mongod;
let server;
let base;
let peer;
let peerState;

const STUDENT = {
  userId: '64b000000000000000000001',
  enrollmentNumber: 'NN26-000124',
  fullName: 'Aarav Sharma',
  guardianName: 'Sunita Sharma',
  grade: 'Class 9',
  phone: '+919876543210',
  email: 'aarav@example.com',
  profileComplete: true,
  enrollments: [{ enrollmentId: 'ENR-2026-000101', courseTitle: 'PRARAMBH', status: 'active', enrolledAt: '2026-06-01T00:00:00.000Z' }],
};

before(async () => {
  peerState = { calls: [], status: 200 };
  peer = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const parsed = body ? JSON.parse(body) : {};
      peerState.calls.push({ url: req.url, key: req.headers['x-internal-service-key'], body: parsed });
      const send = (status, payload) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      };
      if (req.url !== '/api/internal/students/lookup') return send(404, { success: false });
      if (peerState.status !== 200) return send(peerState.status, { success: false });
      if (parsed.enrollmentNumber !== STUDENT.enrollmentNumber) return send(200, { success: true, data: null });
      const data = parsed.includePayments
        ? { ...STUDENT, payments: [{ orderId: 'order-1', status: 'paid', amountInPaise: 500000 }], couponRedemptions: [] }
        : STUDENT;
      return send(200, { success: true, data });
    });
  });
  await new Promise((r) => peer.listen(0, '127.0.0.1', r));

  mongod = await MongoMemoryServer.create();
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'test_lookup_secret';
  process.env.CLIENT_URL = 'http://localhost:5175';
  process.env.COOKIE_SAMESITE = 'lax';
  process.env.AUTH_RATE_LIMIT_MAX = '100000';
  process.env.RATE_LIMIT_MAX = '100000';
  process.env.STUDENT_BACKEND_URL = `http://127.0.0.1:${peer.address().port}`;
  process.env.STUDENT_BACKEND_SERVICE_KEY = 'lookup_key';
  process.env.TEACHER_BACKEND_URL = 'http://127.0.0.1:1';
  process.env.TEACHER_BACKEND_SERVICE_KEY = 'unused';
  process.env.RESEND_API_KEY = 'unused-in-tests';

  const { connectDatabase } = await import('../src/config/db.js');
  await connectDatabase();
  const { createApp } = await import('../src/app.js');
  server = http.createServer(createApp());
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;

  const { Admin } = await import('../src/models/Admin.js');
  const passwordHash = await Admin.hashPassword('TestPass123!');
  await Admin.create({ name: 'Super', email: 'super@lookup.local', passwordHash, role: 'SUPER_ADMIN', status: 'ACTIVE' });
  await Admin.create({ name: 'Admin', email: 'admin@lookup.local', passwordHash, role: 'ADMIN', status: 'ACTIVE' });
  await Admin.create({ name: 'Staff', email: 'staff@lookup.local', passwordHash, role: 'STAFF', status: 'ACTIVE' });
  await Admin.create({ name: 'Teachers Only', email: 'narrow@lookup.local', passwordHash, role: 'STAFF', status: 'ACTIVE', permissions: ['teachers.read'] });
});

after(async () => {
  await new Promise((r) => server.close(r));
  await new Promise((r) => peer.close(r));
  const mongoose = (await import('mongoose')).default;
  await mongoose.connection.close();
  await mongod.stop();
});

beforeEach(() => {
  peerState.calls = [];
  peerState.status = 200;
});

async function call(path, { cookie } = {}) {
  const res = await fetch(`${base}${path}`, { headers: cookie ? { Cookie: cookie } : {} });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  return { status: res.status, body, cookie: setCookie.map((c) => c.split(';')[0]).join('; ') };
}

async function login(email) {
  const res = await fetch(`${base}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'TestPass123!' }),
  });
  assert.equal(res.status, 200, `${email} must genuinely log in, or the permission tests prove nothing`);
  return (res.headers.getSetCookie() || []).map((c) => c.split(';')[0]).join('; ');
}

const lookup = (number, cookie) => call(`/api/admin/students/enrollment-number/${encodeURIComponent(number)}`, { cookie });
const codeOf = (body) => body?.error?.code || body?.code;

test('no session, no search', async () => {
  const res = await lookup('NN26-000124');
  assert.equal(res.status, 401);
  assert.equal(peerState.calls.length, 0);
});

test('an admin without students.read is refused before the student service is asked', async () => {
  const res = await lookup('NN26-000124', await login('narrow@lookup.local'));
  assert.equal(res.status, 403);
  assert.equal(peerState.calls.length, 0);
});

test('STAFF may search students but is not shown payments', async () => {
  const res = await lookup('NN26-000124', await login('staff@lookup.local'));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.fullName, 'Aarav Sharma');
  assert.equal(res.body.data.guardianName, 'Sunita Sharma');
  assert.equal(res.body.data.paymentsVisible, false);
  assert.equal(res.body.data.payments, undefined);
  assert.equal(peerState.calls[0].body.includePayments, false, 'payments are not even requested');
  assert.equal(peerState.calls[0].key, 'lookup_key', 'the call carries the service key');
});

test('an admin holding payments.view sees payment and coupon details', async () => {
  for (const email of ['admin@lookup.local', 'super@lookup.local']) {
    peerState.calls = [];
    const res = await lookup('NN26-000124', await login(email));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.paymentsVisible, true);
    assert.equal(res.body.data.payments.length, 1);
    assert.equal(peerState.calls[0].body.includePayments, true, email);
    assert.equal(peerState.calls[0].body.scope, undefined, 'an admin search is not scoped to a roster');
  }
});

test('the number is normalised, malformed input never leaves, and a miss is a 404', async () => {
  const cookie = await login('super@lookup.local');

  const typed = await lookup(' nn26 000124 ', cookie);
  assert.equal(typed.status, 200);
  assert.equal(peerState.calls[0].body.enrollmentNumber, 'NN26-000124');

  peerState.calls = [];
  const malformed = await lookup('hello', cookie);
  assert.equal(malformed.status, 422);
  assert.equal(peerState.calls.length, 0);

  const missing = await lookup('NN26-999999', cookie);
  assert.equal(missing.status, 404);
  assert.equal(codeOf(missing.body), 'STUDENT_NOT_FOUND');
});

test('an unreachable student service is reported as unavailable, not as no such student', async () => {
  const cookie = await login('super@lookup.local');
  peerState.status = 400;
  const rejected = await lookup('NN26-000124', cookie);
  assert.equal(rejected.status, 400, 'a refusal from the student service keeps its status');

  peerState.status = 503;
  const down = await lookup('NN26-000124', cookie);
  assert.equal(down.status, 503);
  assert.match(down.body?.error?.message || down.body?.message || '', /looked up/);
});
