import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { bootTestApp } from './helpers/testApp.js';

/**
 * Teacher sign-in, end to end through the real routes: the login Admin issues
 * with a temporary password, the sign-in that uses it, the forced change, the
 * self-service reset, and the cases that broke in production.
 *
 * The production failure this guards against: a teacher deleted in Admin keeps
 * a deactivated login here; when Admin created them again, provisioning
 * answered 409 EMAIL_TAKEN, Admin emailed a fresh password anyway, and the login
 * kept its old password - so the teacher was told "invalid email or password".
 * Provisioning is now an idempotent upsert that re-links that login, and
 * answers `verified: true` only after reading back that the stored hash accepts
 * exactly the password Admin is about to email.
 *
 * A stand-in Admin records the "forgot password" emails it is asked to send.
 */

let ctx;
let api;
let admin;
let User;
let Teacher;

const KEY = { 'X-Internal-Service-Key': 'test_service_key' };
const uniq = () => crypto.randomBytes(3).toString('hex');
const TEMP = () => `Tmp#${crypto.randomBytes(5).toString('hex')}Q7`;
const CHOSEN = 'Chosen#Pass9';

function startFakeAdmin() {
  const state = { resetEmails: [], status: 200 };
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      if (req.url === '/api/internal/teacher-emails/password-reset' && req.method === 'POST') {
        state.resetEmails.push({ headers: req.headers, body: JSON.parse(raw || '{}') });
        res.writeHead(state.status, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: state.status < 300, data: { delivered: state.status < 300 } }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: null }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ state, url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) }));
  });
}

async function waitFor(check, { timeoutMs = 5000 } = {}) {
  const started = Date.now();
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting for the condition');
    await new Promise((r) => setTimeout(r, 40));
  }
}

before(async () => {
  admin = await startFakeAdmin();
  ctx = await bootTestApp({ adminUrl: admin.url });
  api = ctx.api;
  ({ User } = await import('../src/models/User.js'));
  ({ Teacher } = await import('../src/models/Teacher.js'));
  await Promise.all([User.init(), Teacher.init()]);
});

after(async () => {
  await ctx.teardown();
  await admin.close();
});

beforeEach(() => {
  admin.state.resetEmails.length = 0;
  admin.state.status = 200;
});

/** What Admin does when it creates a teacher or resends their details. */
function provision(email, tempPassword, extra = {}) {
  return api('POST', '/api/internal/teachers', {
    headers: KEY,
    body: { name: 'Meera Iyer', email, subject: 'Physics', tempPassword, ...extra },
  });
}

const login = (email, password) => api('POST', '/api/teacher/auth/login', { body: { email, password } });
const dashboard = (cookie) => api('GET', '/api/teacher/dashboard/overview', { cookie });

/** A freshly provisioned teacher who has signed in and changed the temporary password. */
async function onboardedTeacher() {
  const email = `meera.${uniq()}@nalanda.test`;
  const temp = TEMP();
  assert.equal((await provision(email, temp)).status, 201);
  const first = await login(email, temp);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  const changed = await api('POST', '/api/teacher/auth/change-password', { cookie: first.cookie, body: { currentPassword: temp, newPassword: CHOSEN } });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  return { email, cookie: changed.cookie };
}

// ---------------------------------------------------------------------------
// Admin creates a teacher; the teacher signs in with exactly what was emailed
// ---------------------------------------------------------------------------

test('a provisioned login accepts exactly the temporary password, and the answer never echoes it', async () => {
  const email = `meera.${uniq()}@nalanda.test`;
  const temp = TEMP();
  const res = await provision(email, temp);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.data.verified, true);
  assert.equal(res.body.data.relinked, false);
  assert.match(res.body.data.teacherCode, /^TCH-\d{4,}$/);
  assert.equal(res.body.data.portalUrl, 'http://localhost:5174');
  assert.ok(!JSON.stringify(res.body).includes(temp), 'the password must not come back');

  const stored = await User.findOne({ email }).select('+passwordHash');
  assert.ok(stored.passwordHash.startsWith('$2'), 'stored as a bcrypt hash');
  assert.notEqual(stored.passwordHash, temp);
  assert.equal(stored.role, 'teacher');
  assert.equal(stored.mustChangePassword, true);

  const ok = await login(email, temp);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.ok(ok.cookie, 'a session cookie is issued');
  const payload = jwt.decode(ok.cookie.split('=')[1]);
  assert.equal(payload.role, 'teacher');
  assert.equal(payload.sub, String(stored._id));
  const profile = await Teacher.findOne({ user: stored._id });
  assert.equal(payload.teacherId, String(profile._id));
});

test('the email, its upper-case form, surrounding spaces, and the Teacher ID all sign in to the same account', async () => {
  const email = `meera.${uniq()}@nalanda.test`;
  const temp = TEMP();
  const res = await provision(email, temp);
  for (const identifier of [email, email.toUpperCase(), `   ${email}  `, res.body.data.teacherCode, res.body.data.teacherCode.toLowerCase()]) {
    const r = await login(identifier, temp);
    assert.equal(r.status, 200, `${identifier}: ${JSON.stringify(r.body)}`);
  }
});

test('a temporary password pasted with a trailing space or line break still works, but only while it is temporary', async () => {
  const email = `meera.${uniq()}@nalanda.test`;
  const temp = TEMP();
  await provision(email, temp);
  assert.equal((await login(email, `${temp}\n`)).status, 200);
  const first = await login(email, ` ${temp} `);
  assert.equal(first.status, 200);

  // Once the teacher has chosen a password, it is compared exactly as typed.
  const changed = await api('POST', '/api/teacher/auth/change-password', { cookie: first.cookie, body: { currentPassword: `${temp} `, newPassword: CHOSEN } });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.equal((await login(email, CHOSEN)).status, 200);
  assert.equal((await login(email, `${CHOSEN} `)).status, 401);
});

test('a wrong password and an unknown email get the same answer', async () => {
  const email = `meera.${uniq()}@nalanda.test`;
  await provision(email, TEMP());
  const wrong = await login(email, 'Not-the-password1');
  const unknown = await login(`nobody.${uniq()}@nalanda.test`, 'Not-the-password1');
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(wrong.body.error.code, 'INVALID_CREDENTIALS');
  assert.equal(unknown.body.error.code, 'INVALID_CREDENTIALS');
  assert.equal(wrong.body.message, unknown.body.message);
});

test('the temporary password reaches only the password change until it is replaced, then the dashboard opens', async () => {
  const email = `meera.${uniq()}@nalanda.test`;
  const temp = TEMP();
  await provision(email, temp);
  const first = await login(email, temp);

  const blocked = await dashboard(first.cookie);
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.error.code, 'PASSWORD_CHANGE_REQUIRED');

  const same = await api('POST', '/api/teacher/auth/change-password', { cookie: first.cookie, body: { currentPassword: temp, newPassword: temp } });
  assert.equal(same.status, 400, 'the temporary password cannot be kept as the new one');

  const changed = await api('POST', '/api/teacher/auth/change-password', { cookie: first.cookie, body: { currentPassword: temp, newPassword: CHOSEN } });
  assert.equal(changed.status, 200);
  assert.equal((await dashboard(changed.cookie)).status, 200);
  assert.equal((await dashboard(first.cookie)).status, 401, 'the session from the temporary password is revoked');
  assert.equal((await login(email, temp)).status, 401, 'the temporary password stops working');
  assert.equal((await login(email, CHOSEN)).status, 200);
});

test('the session survives a page refresh (GET /auth/me) and ends at logout', async () => {
  const { cookie } = await onboardedTeacher();
  const me = await api('GET', '/api/teacher/auth/me', { cookie });
  assert.equal(me.status, 200);
  assert.ok(me.body.data.user);
  const out = await api('POST', '/api/teacher/auth/logout', { cookie });
  assert.equal(out.status, 200);
  assert.match(out.cookie, /=$|=;|^[^=]+=$/, 'the cookie is cleared');
  assert.equal((await api('GET', '/api/teacher/auth/me')).status, 401);
});

// ---------------------------------------------------------------------------
// The production failure: the same email provisioned again
// ---------------------------------------------------------------------------

test('a teacher deleted in Admin and created again is re-linked: new password works, old one and old sessions do not', async () => {
  const { email, cookie } = await onboardedTeacher();
  const before = await User.findOne({ email });
  const code = (await Teacher.findOne({ user: before._id })).teacherId;

  // Admin deletes the teacher: the login is deactivated, not removed.
  const off = await api('PATCH', '/api/internal/teachers/status', { headers: KEY, body: { email, status: 'inactive' } });
  assert.equal(off.status, 200);
  assert.equal((await login(email, CHOSEN)).status, 403);

  // Admin creates them again. This used to answer 409, and Admin emailed a password the login never got.
  const temp = TEMP();
  const again = await provision(email, temp, { teacherId: 'TCH-9999' });
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.equal(again.body.data.relinked, true);
  assert.equal(again.body.data.verified, true);
  assert.equal(again.body.data.teacherCode, code, 'the re-linked login keeps its Teacher ID');

  const users = await User.find({ email });
  assert.equal(users.length, 1, 'still one identity for this person');
  assert.equal(String(users[0]._id), String(before._id));
  assert.equal(users[0].status, 'active');

  assert.equal((await login(email, temp)).status, 200, 'the password in the new email works');
  assert.equal((await login(email, CHOSEN)).status, 401, 'the old password does not');
  assert.equal((await dashboard(cookie)).status, 401, 'sessions from before are ended');
});

test('a login Admin no longer has a record for is re-linked too, and repeating it is safe', async () => {
  const { email } = await onboardedTeacher();
  const t1 = TEMP();
  const t2 = TEMP();
  assert.equal((await provision(email, t1)).status, 200);
  assert.equal((await provision(email, t2)).status, 200);
  assert.equal((await login(email, t1)).status, 401, 'only the latest password works');
  assert.equal((await login(email, t2)).status, 200);
  assert.equal(await User.countDocuments({ email }), 1);
});

test('two provisioning calls for the same new email at once leave exactly one login and one profile', async () => {
  const email = `meera.${uniq()}@nalanda.test`;
  const [a, b] = await Promise.all([provision(email, TEMP()), provision(email, TEMP())]);
  assert.ok([200, 201].includes(a.status), JSON.stringify(a.body));
  assert.ok([200, 201].includes(b.status), JSON.stringify(b.body));
  assert.equal(await User.countDocuments({ email }), 1);
  assert.equal(await Teacher.countDocuments({ user: (await User.findOne({ email }))._id }), 1);
});

test('an email that belongs to a non-teacher login is never taken over', async () => {
  const email = `office.${uniq()}@nalanda.test`;
  await User.create({ name: 'Office', email, passwordHash: await User.hashPassword('Office#Pass1'), role: 'admin' });
  const res = await provision(email, TEMP());
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'EMAIL_TAKEN');
  assert.equal((await User.findOne({ email })).role, 'admin');
});

test('a temporary password containing markup-like characters is stored byte for byte', async () => {
  const email = `meera.${uniq()}@nalanda.test`;
  const temp = 'Ab3<b>x#Yz9 ';
  assert.equal((await provision(email, temp)).status, 201);
  assert.equal((await login(email, temp)).status, 200);
});

// ---------------------------------------------------------------------------
// Email form: canonical (trim + lower-case), with older accounts still found
// ---------------------------------------------------------------------------

test('a new login keeps the address exactly as Admin has it (Gmail dots and +tags are not stripped)', async () => {
  const email = `first.last+${uniq()}@gmail.com`;
  await provision(email, TEMP());
  assert.ok(await User.findOne({ email }), 'stored under the same address Admin holds');
});

test('an account stored under the older normalised form still signs in, and re-provisioning moves it to the canonical form', async () => {
  const local = `old.${uniq()}`;
  const canonical = `${local}@gmail.com`;
  const legacy = `${local.replace(/\./g, '')}@gmail.com`;
  const user = await User.create({ name: 'Old Account', email: legacy, passwordHash: await User.hashPassword(CHOSEN), role: 'teacher' });
  await Teacher.create({ user: user._id, teacherId: `TCH-${String(9000 + Math.floor(Math.random() * 900)).padStart(4, '0')}` });

  assert.equal((await login(canonical, CHOSEN)).status, 200, 'found through the legacy form');
  assert.equal((await login(canonical.toUpperCase(), CHOSEN)).status, 200);

  const temp = TEMP();
  const res = await provision(canonical, temp);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.relinked, true);
  const moved = await User.findById(user._id);
  assert.equal(moved.email, canonical);
  assert.equal((await login(canonical, temp)).status, 200);
});

// ---------------------------------------------------------------------------
// Role separation
// ---------------------------------------------------------------------------

test('student credentials and student tokens are refused by the Teacher Portal', async () => {
  const email = `student.${uniq()}@nalanda.test`;
  await User.create({ name: 'A Student', email, passwordHash: await User.hashPassword('Student#Pass1'), role: 'student' });
  const res = await login(email, 'Student#Pass1');
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');

  // A token from another portal is signed with another secret.
  const foreign = jwt.sign({ sub: crypto.randomBytes(12).toString('hex'), role: 'student' }, 'the_student_portal_secret');
  const r = await api('GET', '/api/teacher/dashboard/overview', { headers: { Authorization: `Bearer ${foreign}` } });
  assert.equal(r.status, 401);
});

test('a teacher session cannot call the service-to-service API Admin uses', async () => {
  const { cookie } = await onboardedTeacher();
  const r = await api('PATCH', '/api/internal/teachers/status', { cookie, body: { email: 'x@y.z', status: 'inactive' } });
  assert.equal(r.status, 401);
  assert.equal(r.body.error.code, 'INTERNAL_AUTH_FAILED');
});

// ---------------------------------------------------------------------------
// Forgot password
// ---------------------------------------------------------------------------

test('forgot password emails a single-use link through Admin; using it replaces the password and ends sessions', async () => {
  const { email, cookie } = await onboardedTeacher();
  const res = await api('POST', '/api/teacher/auth/forgot-password', { body: { email: `  ${email.toUpperCase()} ` } });
  assert.equal(res.status, 200);

  const sent = await waitFor(() => admin.state.resetEmails[0]);
  assert.equal(sent.headers['x-internal-service-key'], 'test_service_key');
  assert.equal(sent.body.email, email);
  const url = new URL(sent.body.resetUrl);
  assert.equal(url.origin, 'http://localhost:5174');
  assert.equal(url.pathname, '/setup-password');
  assert.equal(url.searchParams.get('purpose'), 'reset');
  const token = url.searchParams.get('token');
  assert.ok(new Date(sent.body.expiresAt) - Date.now() <= 60 * 60 * 1000 + 5000, 'expires within an hour');

  const stored = await User.findOne({ email }).select('+setupTokenHash');
  assert.notEqual(stored.setupTokenHash, token, 'only a hash of the token is stored');

  assert.equal((await login(email, CHOSEN)).status, 200, 'asking for a link changes nothing by itself');

  const NEW = 'Brand#New42';
  const done = await api('POST', '/api/teacher/auth/setup-password', { body: { token, password: NEW } });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal((await login(email, NEW)).status, 200, 'the new password works');
  assert.equal((await login(email, CHOSEN)).status, 401, 'the old password is rejected');
  assert.equal((await dashboard(cookie)).status, 401, 'existing sessions are ended');

  const reuse = await api('POST', '/api/teacher/auth/setup-password', { body: { token, password: 'Another#Pass7' } });
  assert.equal(reuse.status, 400, 'the link works once');
});

test('forgot password answers the same for an unknown or deactivated account, and sends nothing', async () => {
  const known = await onboardedTeacher();
  const real = await api('POST', '/api/teacher/auth/forgot-password', { body: { email: known.email } });
  await waitFor(() => admin.state.resetEmails.length === 1);

  const unknown = await api('POST', '/api/teacher/auth/forgot-password', { body: { email: `nobody.${uniq()}@nalanda.test` } });
  assert.equal(unknown.status, real.status);
  assert.equal(unknown.body.message, real.body.message);

  const off = await onboardedTeacher();
  await api('PATCH', '/api/internal/teachers/status', { headers: KEY, body: { email: off.email, status: 'suspended' } });
  const suspended = await api('POST', '/api/teacher/auth/forgot-password', { body: { email: off.email } });
  assert.equal(suspended.status, 200);
  assert.equal(suspended.body.message, real.body.message);

  await new Promise((r) => setTimeout(r, 300));
  assert.equal(admin.state.resetEmails.length, 1, 'only the active account was emailed');
});

test('a burst of forgot-password requests sends one email', async () => {
  const { email } = await onboardedTeacher();
  const replies = await Promise.all(Array.from({ length: 5 }, () => api('POST', '/api/teacher/auth/forgot-password', { body: { email } })));
  assert.ok(replies.every((r) => r.status === 200));
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(admin.state.resetEmails.length, 1);
});

test('forgot password validates the address', async () => {
  const r = await api('POST', '/api/teacher/auth/forgot-password', { body: { email: 'not-an-email' } });
  assert.equal(r.status, 422);
});
