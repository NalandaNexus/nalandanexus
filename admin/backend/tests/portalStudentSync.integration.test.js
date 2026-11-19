import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Portal students on the admin Students list.
 *
 * The student portal sends each student's current record here when they enrol
 * or change their profile. Before that, this portal never heard about a portal
 * student at all: the payment ledger got a row, the Students list got nothing.
 * These tests cover what a record does when it arrives - one student per portal
 * account, the newest record winning, an admin's own fields untouched - who may
 * deliver one, and who may ask for records to be resent.
 *
 * The student service is a local stand-in, used only by the resend endpoint.
 * Every outbound destination this backend's own .env might name is overridden
 * before the app loads.
 */

const KEY = 'portal_sync_key';

let mongod;
let server;
let base;
let peer;
let peerState;
let Student;
let AuditLog;

before(async () => {
  peerState = { calls: [], status: 200 };
  peer = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {};
      peerState.calls.push({ url: req.url, key: req.headers['x-internal-service-key'], body });
      const send = (status, payload) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      };
      if (req.url !== '/api/internal/portal-students/resync') return send(404, { success: false });
      if (peerState.status !== 200) return send(peerState.status, { success: false });
      if (!body.apply) return send(200, { success: true, data: { mode: body.mode, dryRun: true, total: 3 } });
      return send(200, { success: true, data: { mode: body.mode, dryRun: false, processed: 1, synced: 1, failed: 0, skipped: 0, nextCursor: null } });
    });
  });
  await new Promise((r) => peer.listen(0, '127.0.0.1', r));

  mongod = await MongoMemoryServer.create();
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'test_portal_sync_secret';
  process.env.CLIENT_URL = 'http://localhost:5175';
  process.env.COOKIE_SAMESITE = 'lax';
  process.env.AUTH_RATE_LIMIT_MAX = '100000';
  process.env.RATE_LIMIT_MAX = '100000';
  process.env.STUDENT_BACKEND_URL = `http://127.0.0.1:${peer.address().port}`;
  process.env.STUDENT_BACKEND_SERVICE_KEY = KEY;
  process.env.TEACHER_BACKEND_URL = 'http://127.0.0.1:1';
  process.env.TEACHER_BACKEND_SERVICE_KEY = 'unused';
  process.env.RESEND_API_KEY = 'unused-in-tests';

  const { connectDatabase } = await import('../src/config/db.js');
  await connectDatabase();
  const { createApp } = await import('../src/app.js');
  server = http.createServer(createApp());
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;

  ({ Student } = await import('../src/models/Student.js'));
  ({ AuditLog } = await import('../src/models/AuditLog.js'));
  await Student.init();

  const { Admin } = await import('../src/models/Admin.js');
  const passwordHash = await Admin.hashPassword('TestPass123!');
  await Admin.create({ name: 'Staff', email: 'staff@sync.local', passwordHash, role: 'STAFF', status: 'ACTIVE' });
  await Admin.create({ name: 'Reader', email: 'reader@sync.local', passwordHash, role: 'STAFF', status: 'ACTIVE', permissions: ['students.read'] });
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

const uniq = () => crypto.randomBytes(3).toString('hex');
const objectId = () => crypto.randomBytes(12).toString('hex');
const later = (ms) => new Date(Date.now() + ms).toISOString();

function record(overrides = {}) {
  const n = String(Math.floor(Math.random() * 900000) + 100000);
  return {
    userId: objectId(),
    enrollmentNumber: `NN26-${n}`,
    fullName: 'Aarav Sharma',
    email: `aarav.${uniq()}@example.com`,
    phone: '+919876543210',
    avatar: null,
    guardianName: 'Sunita Sharma',
    grade: 'Class 9',
    profileComplete: true,
    profileCompletedAt: new Date().toISOString(),
    enrollments: [
      { enrollmentId: `ENR-2026-${n}`, courseSlug: 'prarambh', courseTitle: 'PRARAMBH', status: 'active', enrolledAt: '2026-06-01T00:00:00.000Z', endsAt: null, batchId: null, batchCode: 'PB1' },
    ],
    sourceUpdatedAt: new Date().toISOString(),
    ...overrides,
  };
}

async function http_(method, path, { cookie, body, headers = {} } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json };
}

const deliver = (rec, { key = KEY, path = rec.userId } = {}) =>
  http_('PUT', `/api/internal/portal-students/${path}`, { body: rec, headers: key ? { 'X-Internal-Service-Key': key } : {} });

async function login(email) {
  const res = await fetch(`${base}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'TestPass123!' }),
  });
  assert.equal(res.status, 200, `${email} must genuinely log in`);
  return (res.headers.getSetCookie() || []).map((c) => c.split(';')[0]).join('; ');
}

async function listStudents(cookie, query = '') {
  const res = await http_('GET', `/api/admin/students?limit=100${query}`, { cookie });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.data;
}

const codeOf = (body) => body?.error?.code || body?.code;

test('a portal student appears on the Students list with their name, number, class, guardian, phone and course', async () => {
  const rec = record();
  const res = await deliver(rec);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.data.outcome, 'created');

  const staff = await login('staff@sync.local');
  const row = (await listStudents(staff)).find((s) => s.email === rec.email);
  assert.ok(row, 'on the normal Students list, with nothing done by an admin');
  assert.equal(row.name, 'Aarav Sharma');
  assert.equal(row.source, 'student-portal');
  assert.equal(row.portalUserId, rec.userId);
  assert.equal(row.enrollmentNumber, rec.enrollmentNumber);
  assert.equal(row.rollNo, rec.enrollmentNumber, 'the enrollment number is a portal student\'s roll number');
  assert.equal(row.grade, 'Class 9');
  assert.equal(row.guardianName, 'Sunita Sharma');
  assert.equal(row.phone, '+919876543210');
  assert.equal(row.status, 'ACTIVE');
  assert.equal(row.portalEnrollments.length, 1);
  assert.equal(row.portalEnrollments[0].courseTitle, 'PRARAMBH');
  assert.equal(row.portalEnrollments[0].status, 'active');
  assert.equal(new Date(row.portalEnrollments[0].enrolledAt).toISOString(), '2026-06-01T00:00:00.000Z');

  assert.ok((await listStudents(staff, '&source=student-portal')).some((s) => s.email === rec.email));
  assert.equal((await listStudents(staff, '&source=manual')).some((s) => s.email === rec.email), false);

  const audit = await AuditLog.findOne({ action: 'student.portal_synced.created', entityId: row._id }).lean();
  assert.ok(audit, 'recorded in the audit trail');
  assert.equal(audit.actorName, 'Student Portal Sync');
  assert.equal(JSON.stringify(audit.metadata).includes('+91'), false, 'the audit entry carries identifiers, not contact details');
});

test('the same record delivered again changes nothing and never adds a second student', async () => {
  const rec = record();
  assert.equal((await deliver(rec)).status, 201);
  const again = await deliver(rec);
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.equal(again.body.data.outcome, 'unchanged');

  const [x, y] = await Promise.all([deliver({ ...rec, sourceUpdatedAt: later(10) }), deliver({ ...rec, sourceUpdatedAt: later(20) })]);
  assert.ok([200, 201].includes(x.status) && [200, 201].includes(y.status), `${x.status} ${y.status}`);
  assert.equal(await Student.countDocuments({ portalUserId: rec.userId }), 1);
});

test('simultaneous first deliveries for one student still make one record', async () => {
  const rec = record();
  const results = await Promise.all([1, 2, 3].map((i) => deliver({ ...rec, sourceUpdatedAt: later(i) })));
  for (const r of results) assert.ok([200, 201].includes(r.status), JSON.stringify(r.body));
  assert.equal(await Student.countDocuments({ portalUserId: rec.userId }), 1);
  assert.equal(await Student.countDocuments({ email: rec.email }), 1);
});

test('simultaneous first deliveries still make one record where the portalUserId index was never built', async () => {
  // Production runs with autoIndex off, so a deploy does not build the new
  // index. What remains - the long-standing email and roll-number indexes and
  // the service's own check - must still stop a double listing.
  await Student.collection.dropIndex('portalUserId_1');
  try {
    const rec = record();
    const results = await Promise.all([1, 2, 3, 4, 5].map((i) => deliver({ ...rec, sourceUpdatedAt: later(i) })));
    for (const r of results) assert.ok([200, 201].includes(r.status), JSON.stringify(r.body));
    assert.equal(await Student.countDocuments({ portalUserId: rec.userId }), 1);
    assert.equal(await Student.countDocuments({ email: rec.email }), 1);
  } finally {
    await Student.createIndexes();
  }
});

test('a later name replaces the earlier one, and an older delivery arriving late is ignored', async () => {
  const rec = record();
  await deliver(rec);
  const renamed = await deliver({ ...rec, fullName: 'Aarav Kumar Sharma', sourceUpdatedAt: later(1000) });
  assert.equal(renamed.body.data.outcome, 'updated');
  assert.deepEqual(renamed.body.data.changed, ['name']);

  const late = await deliver({ ...rec, fullName: 'Aarav Sharma' });
  assert.equal(late.status, 200);
  assert.equal(late.body.data.outcome, 'stale');
  assert.equal((await Student.findOne({ portalUserId: rec.userId }).lean()).name, 'Aarav Kumar Sharma');
});

test('a second course is added to the same student, with the same number', async () => {
  const rec = record();
  await deliver(rec);
  const second = {
    ...rec,
    enrollments: [...rec.enrollments, { enrollmentId: 'ENR-2026-990001', courseSlug: 'python', courseTitle: 'Python', status: 'active', enrolledAt: new Date().toISOString() }],
    sourceUpdatedAt: later(1000),
  };
  assert.equal((await deliver(second)).body.data.outcome, 'updated');
  const rows = await Student.find({ portalUserId: rec.userId }).lean();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].enrollmentNumber, rec.enrollmentNumber);
  assert.deepEqual(rows[0].portalEnrollments.map((e) => e.courseTitle), ['PRARAMBH', 'Python']);
});

test('a record an admin entered for the same email is linked, not duplicated, and keeps everything the admin owns', async () => {
  const rec = record();
  const manual = await Student.create({
    name: 'Typed By Admin',
    email: rec.email,
    rollNo: `2026-CSE-${uniq()}`,
    department: 'Physics',
    batch: '2026',
    semester: 3,
    status: 'SUSPENDED',
    gpa: 8.2,
    attendancePercent: 91,
  });

  const res = await deliver(rec);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.outcome, 'updated');
  assert.equal(await Student.countDocuments({ email: rec.email }), 1, 'one record, not two');

  const row = await Student.findById(manual._id).lean();
  assert.equal(row.portalUserId, rec.userId, 'linked to the portal account');
  assert.equal(row.name, 'Aarav Sharma', 'the student\'s own name');
  assert.equal(row.enrollmentNumber, rec.enrollmentNumber);
  assert.equal(row.source, 'manual', 'still an admin-entered record');
  assert.equal(row.rollNo, manual.rollNo);
  assert.equal(row.department, 'Physics');
  assert.equal(row.batch, '2026');
  assert.equal(row.semester, 3);
  assert.equal(row.status, 'SUSPENDED', 'an admin decision is not undone by a sync');
  assert.equal(row.gpa, 8.2);
  assert.equal(row.attendancePercent, 91);
});

test('an empty value on the portal does not wipe what an admin already recorded', async () => {
  const rec = record();
  await deliver(rec);
  await deliver({ ...rec, phone: null, avatar: null, sourceUpdatedAt: later(1000) });
  assert.equal((await Student.findOne({ portalUserId: rec.userId }).lean()).phone, '+919876543210');
});

test('only the student service may deliver a record, and only a well-formed one for the student it names', async () => {
  const rec = record();
  assert.equal((await deliver(rec, { key: null })).status, 401);
  assert.equal((await deliver(rec, { key: 'wrong' })).status, 401);

  const mismatch = await deliver(rec, { path: objectId() });
  assert.equal(mismatch.status, 400);
  assert.equal(codeOf(mismatch.body), 'USER_ID_MISMATCH');

  assert.equal((await deliver({ ...rec, email: { $gt: '' } })).status, 422, 'no operators in place of values');
  assert.equal((await deliver({ ...rec, enrollments: [{ status: 'refunded' }] })).status, 422);
  assert.equal((await deliver(rec, { path: 'not-an-id' })).status, 422);
  assert.equal(await Student.countDocuments({ portalUserId: rec.userId }), 0, 'nothing refused was written');
});

test('resending records: needs students.update, is dry unless asked, and an applied run is audited', async () => {
  assert.equal((await http_('POST', '/api/admin/students/portal-sync', { body: {} })).status, 401);

  const reader = await login('reader@sync.local');
  const refused = await http_('POST', '/api/admin/students/portal-sync', { cookie: reader, body: { mode: 'all', apply: true } });
  assert.equal(refused.status, 403, 'students.read alone cannot resend');
  assert.equal(peerState.calls.length, 0, 'refused before the student service is asked');

  const staff = await login('staff@sync.local');
  const dry = await http_('POST', '/api/admin/students/portal-sync', { cookie: staff, body: { mode: 'all' } });
  assert.equal(dry.status, 200, JSON.stringify(dry.body));
  assert.equal(dry.body.data.total, 3);
  assert.equal(peerState.calls[0].body.apply, false, 'dry by default');
  assert.equal(peerState.calls[0].key, KEY);
  assert.equal(await AuditLog.countDocuments({ action: 'student.portal_resync' }), 0, 'a dry run is not an action');

  const applied = await http_('POST', '/api/admin/students/portal-sync', { cookie: staff, body: { mode: 'all', apply: true } });
  assert.equal(applied.status, 200, JSON.stringify(applied.body));
  assert.equal(applied.body.data.synced, 1);
  assert.deepEqual(peerState.calls[1].body, { mode: 'all', limit: 10, apply: true });
  const audit = await AuditLog.findOne({ action: 'student.portal_resync' }).lean();
  assert.equal(audit.actorName, 'Staff');

  const noNumber = await http_('POST', '/api/admin/students/portal-sync', { cookie: staff, body: { mode: 'one', apply: true } });
  assert.equal(noNumber.status, 422);
  const one = await http_('POST', '/api/admin/students/portal-sync', { cookie: staff, body: { mode: 'one', enrollmentNumber: 'nn26 000124', apply: true } });
  assert.equal(one.status, 200, JSON.stringify(one.body));
  assert.equal(peerState.calls.at(-1).body.enrollmentNumber, 'NN26-000124', 'normalised before it leaves');

  assert.equal((await http_('POST', '/api/admin/students/portal-sync', { cookie: staff, body: { mode: 'all', dryRun: false } })).status, 422, 'unknown fields are refused');

  peerState.status = 503;
  const down = await http_('POST', '/api/admin/students/portal-sync', { cookie: staff, body: { mode: 'pending', apply: true } });
  assert.equal(down.status, 503);
  assert.equal(codeOf(down.body), 'STUDENT_SERVICE_UNAVAILABLE');
});
