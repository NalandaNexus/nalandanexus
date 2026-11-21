/**
 * Teacher onboarding and sign-in, end to end across the real backends.
 *
 *   node e2e/teacherAuth.e2e.mjs
 *
 * Boots the student, teacher and admin backends as separate processes (see
 * boot.mjs), each on its own in-memory database, wired together with one shared
 * service key exactly as in production. The only stand-in is SendGrid: a local
 * server that records every email, so the run can read the temporary password
 * and the reset link out of the messages a teacher would actually receive.
 * Nothing here talks to a deployed service - every child runs with
 * NODE_ENV=test, which makes it ignore this machine's .env.
 *
 * The scenario is the acceptance list for "a teacher created in Admin can sign
 * in with exactly what they were emailed", including the production failure: a
 * teacher deleted in Admin and created again with the same email.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import net from 'node:net';
import nodeHttp from 'node:http';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY = 'e2e_service_key';
const PASSWORD = 'E2e-Pass-123!';
const TEACHER_PORTAL = 'http://localhost:5174';

// Nothing from the parent shell that could name a real database or service.
function cleanEnv(extra) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (/MONGO|_URL$|_URI$|KEY|SECRET|TOKEN|SMTP|MAIL|RAZORPAY|CLOUDINARY|GOOGLE|RESEND|BACKEND|SENDGRID/i.test(k)) continue;
    env[k] = v;
  }
  return { ...env, NODE_ENV: 'test', E2E_PASSWORD: PASSWORD, AUTH_RATE_LIMIT_MAX: '100000', RATE_LIMIT_MAX: '100000', ...extra };
}

const children = [];
function boot(portal, port, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'e2e', 'boot.mjs'), portal, String(port)], { env: cleanEnv(env), stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(child);
    let out = '';
    const timer = setTimeout(() => reject(new Error(`${portal} did not start:\n${out}`)), 120_000);
    child.stdout.on('data', (d) => {
      out += d;
      if (process.env.E2E_VERBOSE) process.stderr.write(`[${portal}] ${d}`);
      const m = /READY (\d+) (\S+)/.exec(out);
      if (m) {
        clearTimeout(timer);
        resolve({ url: `http://127.0.0.1:${m[1]}`, mongoUri: m[2], logs: () => out });
      }
    });
    child.stderr.on('data', (d) => {
      out += d;
      if (process.env.E2E_VERBOSE) process.stderr.write(`[${portal}] ${d}`);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (!/READY/.test(out)) reject(new Error(`${portal} exited (${code}):\n${out}`));
    });
  });
}

function stopAll() {
  for (const c of children) c.kill('SIGTERM');
}

/** A free local port, so the admin and teacher services can be told each other's address before either starts. */
function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/** SendGrid's mail/send endpoint, recording every message. `status` makes it refuse. */
function fakeSendGrid() {
  const state = { mails: [], status: 202 };
  const server = nodeHttp.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      if (state.status !== 202) {
        res.writeHead(state.status, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ errors: [{ message: 'Simulated provider outage' }] }));
      }
      const body = JSON.parse(raw);
      state.mails.push({
        to: body.personalizations[0].to[0].email,
        subject: body.subject,
        text: body.content.find((c) => c.type === 'text/plain').value,
      });
      res.writeHead(202, { 'X-Message-Id': `msg-${state.mails.length}` });
      res.end();
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ state, url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}

async function http(base, method, p, { body, cookie, bearer } = {}) {
  const res = await fetch(`${base}${p}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
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
  const setCookie = res.headers.getSetCookie?.() || [];
  return { status: res.status, body: json, cookie: setCookie.map((c) => c.split(';')[0]).join('; ') };
}

let step = 0;
async function check(name, fn) {
  step += 1;
  try {
    await fn();
    console.log(`  ok ${step} - ${name}`);
  } catch (err) {
    console.log(`  not ok ${step} - ${name}`);
    throw err;
  }
}

async function waitFor(fn, timeoutMs = 10_000) {
  const started = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting');
    await new Promise((r) => setTimeout(r, 50));
  }
}

const field = (text, label) => (text.match(new RegExp(`^${label}: (\\S+)$`, 'm')) || [])[1];

async function main() {
  const sendgrid = await fakeSendGrid();
  const [teacherPort, adminPort] = await Promise.all([freePort(), freePort()]);

  console.log('Booting student, teacher and admin backends (in-memory databases)…');
  const student = await boot('student', 0, {
    JWT_ACCESS_SECRET: 'e2e_access',
    JWT_REFRESH_SECRET: 'e2e_refresh',
    CLIENT_URL: 'http://localhost:5173',
    INTERNAL_SERVICE_KEY: KEY,
  });
  const [teacher, admin] = await Promise.all([
    boot('teacher', teacherPort, {
      JWT_SECRET: 'e2e_teacher_jwt',
      CLIENT_URL: TEACHER_PORTAL,
      COOKIE_SAMESITE: 'lax',
      STUDENT_BACKEND_URL: student.url,
      STUDENT_BACKEND_SERVICE_KEY: KEY,
      ADMIN_BACKEND_URL: `http://127.0.0.1:${adminPort}`,
    }),
    boot('admin', adminPort, {
      JWT_SECRET: 'e2e_admin_jwt',
      CLIENT_URL: 'http://localhost:5175',
      COOKIE_SAMESITE: 'lax',
      STUDENT_BACKEND_URL: student.url,
      STUDENT_BACKEND_SERVICE_KEY: KEY,
      TEACHER_BACKEND_URL: `http://127.0.0.1:${teacherPort}`,
      TEACHER_BACKEND_SERVICE_KEY: KEY,
      SENDGRID_API_KEY: 'SG.e2e-fake',
      SENDGRID_API_URL: `${sendgrid.url}/v3/mail/send`,
      SMTP_FROM: 'Nalanda Nexus <nalandanexus@gmail.com>',
    }),
  ]);
  console.log(`  student ${student.url}  teacher ${teacher.url}  admin ${admin.url}\n`);

  const requireFromAdmin = createRequire(path.join(root, 'admin', 'backend', 'package.json'));
  const { MongoClient } = await import(pathToFileURL(requireFromAdmin.resolve('mongodb')).href);
  const adminDb = new MongoClient(admin.mongoUri);
  await adminDb.connect();
  const teacherDb = new MongoClient(teacher.mongoUri);
  await teacherDb.connect();
  // "Resend" refuses a second click inside 30s; a test does not wait that out.
  const ageLastAttempt = (email) => adminDb.db().collection('teachers').updateOne({ email }, { $set: { emailLastAttemptAt: new Date(Date.now() - 60_000) } });

  const adminCookie = (await http(admin.url, 'POST', '/api/admin/auth/login', { body: { email: 'admin@e2e.test', password: PASSWORD } })).cookie;
  assert.ok(adminCookie, 'admin login');
  const tLogin = (email, password) => http(teacher.url, 'POST', '/api/teacher/auth/login', { body: { email, password } });
  const mailTo = (email, n = 1) => waitFor(() => {
    const m = sendgrid.state.mails.filter((x) => x.to === email);
    return m.length >= n ? m[n - 1] : null;
  });

  const EMAIL = 'kavya.nair@e2e.test';
  let createdId;
  let tempPassword;
  let teacherId;

  console.log('Admin creates a teacher');
  await check('admin creates a teacher; the email is normalised and the account is provisioned and verified', async () => {
    const r = await http(admin.url, 'POST', '/api/admin/teachers', {
      cookie: adminCookie,
      body: { name: 'Kavya Nair', email: '  Kavya.Nair@E2E.test ', subject: 'Mathematics', phone: '9876543210', courseSlugs: ['garud'] },
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.deepEqual(r.body.meta.warnings, []);
    assert.equal(r.body.data.email, EMAIL);
    assert.equal(r.body.data.portalProvisioned, true);
    assert.equal(r.body.data.emailDeliveryStatus, 'sent');
    assert.ok(!/tempPassword|passwordHash/.test(JSON.stringify(r.body)), 'no password in the response');
    createdId = r.body.data._id;
    teacherId = r.body.data.teacherId;
  });

  await check('the teacher receives one email with the sign-in page, email, Teacher ID and a temporary password', async () => {
    const mail = await mailTo(EMAIL);
    assert.equal(field(mail.text, 'Sign in at'), `${TEACHER_PORTAL}/login`);
    assert.equal(field(mail.text, 'Email'), EMAIL);
    assert.equal(field(mail.text, 'Teacher ID'), teacherId);
    tempPassword = field(mail.text, 'Temporary password');
    assert.ok(tempPassword && tempPassword.length >= 12, mail.text);
  });

  await check('the Teacher service stores one login for that email, as a bcrypt hash, teacher role, forced change', async () => {
    const users = await teacherDb.db().collection('users').find({ email: EMAIL }).toArray();
    assert.equal(users.length, 1);
    assert.equal(users[0].role, 'teacher');
    assert.ok(users[0].passwordHash.startsWith('$2'));
    assert.notEqual(users[0].passwordHash, tempPassword);
    assert.equal(users[0].mustChangePassword, true);
    const profile = await teacherDb.db().collection('teachers').findOne({ user: users[0]._id });
    assert.equal(profile.teacherId, teacherId, 'one Teacher ID across both portals');
  });

  await check('the teacher appears in the Admin teacher list straight away', async () => {
    const r = await http(admin.url, 'GET', `/api/admin/teachers?search=Kavya`, { cookie: adminCookie });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.ok(r.body.data.some((t) => t.email === EMAIL));
  });

  console.log('Teacher signs in with exactly what was emailed');
  let teacherCookie;
  await check('the emailed email and temporary password sign in', async () => {
    const r = await tLogin(EMAIL, tempPassword);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    teacherCookie = r.cookie;
  });

  await check('upper-case email, surrounding spaces, and the Teacher ID sign in too', async () => {
    for (const id of [EMAIL.toUpperCase(), `  ${EMAIL}   `, teacherId]) {
      const r = await tLogin(id, tempPassword);
      assert.equal(r.status, 200, `${id}: ${JSON.stringify(r.body)}`);
    }
  });

  await check('a wrong password and an unregistered email are refused with the same answer', async () => {
    const wrong = await tLogin(EMAIL, 'Wrong-Pass-123');
    const unknown = await tLogin('nobody@e2e.test', tempPassword);
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.message, unknown.body.message);
  });

  await check('until the temporary password is changed, only the change-password step is reachable', async () => {
    const dash = await http(teacher.url, 'GET', '/api/teacher/dashboard/overview', { cookie: teacherCookie });
    assert.equal(dash.status, 403);
    assert.equal(dash.body.error.code, 'PASSWORD_CHANGE_REQUIRED');
    const me = await http(teacher.url, 'GET', '/api/teacher/auth/me', { cookie: teacherCookie });
    assert.equal(me.status, 200);
  });

  const CHOSEN = 'Kavya-Chosen-42';
  await check('the teacher sets a new password; the dashboard and the assigned course open', async () => {
    const r = await http(teacher.url, 'POST', '/api/teacher/auth/change-password', { cookie: teacherCookie, body: { currentPassword: tempPassword, newPassword: CHOSEN } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    teacherCookie = r.cookie;
    const dash = await http(teacher.url, 'GET', '/api/teacher/dashboard/overview', { cookie: teacherCookie });
    assert.equal(dash.status, 200, JSON.stringify(dash.body));
    const courses = await http(teacher.url, 'GET', '/api/teacher/courses/assigned', { cookie: teacherCookie });
    assert.equal(courses.status, 200, JSON.stringify(courses.body));
    assert.ok(JSON.stringify(courses.body.data).toLowerCase().includes('garud'), 'the course Admin assigned is there');
  });

  await check('the session survives a refresh; the temporary password no longer works', async () => {
    assert.equal((await http(teacher.url, 'GET', '/api/teacher/auth/me', { cookie: teacherCookie })).status, 200);
    assert.equal((await tLogin(EMAIL, tempPassword)).status, 401);
  });

  console.log('Portal separation');
  await check('a teacher session is refused by the Admin API, by cookie and by bearer token', async () => {
    assert.equal((await http(admin.url, 'GET', '/api/admin/teachers', { cookie: teacherCookie })).status, 401);
    const token = teacherCookie.split('=').slice(1).join('=');
    assert.equal((await http(admin.url, 'GET', '/api/admin/teachers', { bearer: token })).status, 401);
  });

  await check('student credentials and a student token are refused by the Teacher Portal', async () => {
    const reg = await http(student.url, 'POST', '/api/auth/register', { body: { name: 'Asha Verma', email: 'asha@e2e.test', password: PASSWORD } });
    const token = new URL(reg.body.data.verificationUrlFallback).searchParams.get('token');
    const verified = await http(student.url, 'POST', '/api/auth/verify-email', { body: { token } });
    assert.equal(verified.status, 200, JSON.stringify(verified.body));
    assert.equal((await tLogin('asha@e2e.test', PASSWORD)).status, 401);
    const r = await http(teacher.url, 'GET', '/api/teacher/dashboard/overview', { bearer: verified.body.data.accessToken });
    assert.equal(r.status, 401);
  });

  await check('an Admin account cannot sign in to the Teacher Portal', async () => {
    assert.equal((await tLogin('admin@e2e.test', PASSWORD)).status, 401);
  });

  await check('a duplicate teacher email is refused by Admin', async () => {
    const r = await http(admin.url, 'POST', '/api/admin/teachers', { cookie: adminCookie, body: { name: 'Copy', email: EMAIL.toUpperCase(), subject: 'Maths', courseSlugs: ['garud'] } });
    assert.equal(r.status, 409);
    assert.equal(await adminDb.db().collection('teachers').countDocuments({ email: EMAIL }), 1);
  });

  await check('logout ends the session', async () => {
    const out = await http(teacher.url, 'POST', '/api/teacher/auth/logout', { cookie: teacherCookie });
    assert.equal(out.status, 200);
    assert.equal((await http(teacher.url, 'GET', '/api/teacher/auth/me', { cookie: out.cookie })).status, 401);
  });

  console.log('Forgot password');
  const RESET = 'Kavya-Reset-77';
  await check('the teacher requests a reset; Admin emails a single-use link to the Teacher Portal', async () => {
    const before = sendgrid.state.mails.length;
    const r = await http(teacher.url, 'POST', '/api/teacher/auth/forgot-password', { body: { email: EMAIL.toUpperCase() } });
    assert.equal(r.status, 200);
    const mail = await waitFor(() => sendgrid.state.mails.slice(before).find((m) => m.to === EMAIL));
    assert.match(mail.subject, /Reset your Nalanda Nexus Teacher Portal password/);
    const link = new URL(mail.text.match(/(http\S+setup-password\S+)/)[1]);
    assert.equal(link.origin, TEACHER_PORTAL);
    const token = link.searchParams.get('token');

    assert.equal((await http(teacher.url, 'GET', `/api/teacher/auth/setup-password/${token}`)).status, 200);
    const done = await http(teacher.url, 'POST', '/api/teacher/auth/setup-password', { body: { token, password: RESET } });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.equal((await http(teacher.url, 'POST', '/api/teacher/auth/setup-password', { body: { token, password: 'Again-Pass-99' } })).status, 400, 'once only');
  });

  await check('the new password signs in and the old one is rejected', async () => {
    assert.equal((await tLogin(EMAIL, RESET)).status, 200);
    assert.equal((await tLogin(EMAIL, CHOSEN)).status, 401);
  });

  await check('an unregistered email gets the same reset answer and no email', async () => {
    const before = sendgrid.state.mails.length;
    const r = await http(teacher.url, 'POST', '/api/teacher/auth/forgot-password', { body: { email: 'nobody@e2e.test' } });
    assert.equal(r.status, 200);
    await new Promise((res) => setTimeout(res, 500));
    assert.equal(sendgrid.state.mails.length, before);
  });

  console.log('Email delivery fails');
  const EMAIL2 = 'rohan.das@e2e.test';
  await check('when the email provider refuses, the account is kept and the failure is reported', async () => {
    sendgrid.state.status = 503;
    const r = await http(admin.url, 'POST', '/api/admin/teachers', { cookie: adminCookie, body: { name: 'Rohan Das', email: EMAIL2, department: 'Science', courseSlugs: ['yoddha'] } });
    sendgrid.state.status = 202;
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.ok(r.body.meta.warnings.includes('EMAIL_DELIVERY_FAILED'));
    assert.equal(r.body.data.portalProvisioned, true);
    assert.equal(r.body.data.emailDeliveryStatus, 'failed');
  });

  await check('"Resend login details" delivers a working password without creating a second account', async () => {
    const t = await adminDb.db().collection('teachers').findOne({ email: EMAIL2 });
    await ageLastAttempt(EMAIL2);
    const r = await http(admin.url, 'POST', `/api/admin/teachers/${t._id}/resend-credentials`, { cookie: adminCookie });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body.meta.warnings, []);
    const mail = await mailTo(EMAIL2);
    const pw = field(mail.text, 'Temporary password');
    assert.equal((await tLogin(EMAIL2, pw)).status, 200);
    assert.equal(await adminDb.db().collection('teachers').countDocuments({ email: EMAIL2 }), 1);
    assert.equal(await teacherDb.db().collection('users').countDocuments({ email: EMAIL2 }), 1);
  });

  console.log('The production failure: deleted in Admin, then created again');
  await check('a deleted teacher is locked out of the Teacher Portal', async () => {
    const r = await http(admin.url, 'DELETE', `/api/admin/teachers/${createdId}`, { cookie: adminCookie });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal((await tLogin(EMAIL, RESET)).status, 403);
  });

  await check('created again with the same email: restored, re-linked, and the emailed password signs in', async () => {
    const before = sendgrid.state.mails.filter((m) => m.to === EMAIL).length;
    const r = await http(admin.url, 'POST', '/api/admin/teachers', { cookie: adminCookie, body: { name: 'Kavya Nair', email: EMAIL, subject: 'Mathematics', courseSlugs: ['garud', 'yoddha'] } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.deepEqual(r.body.meta.warnings, []);
    assert.equal(r.body.meta.restored, true);
    assert.equal(r.body.meta.relinked, true);
    assert.equal(r.body.data._id, createdId, 'the same Admin record');
    assert.equal(r.body.data.teacherId, teacherId, 'the same Teacher ID');

    const mail = await mailTo(EMAIL, before + 1);
    const pw = field(mail.text, 'Temporary password');
    const login = await tLogin(EMAIL, pw);
    assert.equal(login.status, 200, `the password in the new email works: ${JSON.stringify(login.body)}`);
    assert.equal((await tLogin(EMAIL, RESET)).status, 401, 'the old password does not');
    assert.equal(await teacherDb.db().collection('users').countDocuments({ email: EMAIL }), 1, 'still one login');
  });

  console.log('Existing teachers');
  await check('teacher accounts that existed before this change still sign in', async () => {
    const r = await tLogin('alice@e2e.test', PASSWORD);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal((await http(teacher.url, 'GET', '/api/teacher/dashboard/overview', { cookie: r.cookie })).status, 200);
  });

  await check('no temporary password or reset token appears in any service log', async () => {
    const logs = admin.logs() + teacher.logs();
    for (const m of sendgrid.state.mails) {
      const pw = field(m.text, 'Temporary password');
      if (pw) assert.ok(!logs.includes(pw), 'a temporary password was logged');
      const link = m.text.match(/token=([A-Za-z0-9_-]{32,})/);
      if (link) assert.ok(!logs.includes(link[1]), 'a reset token was logged');
    }
  });

  await adminDb.close();
  await teacherDb.close();
  sendgrid.close();
  console.log(`\nAll ${step} checks passed.`);
}

main()
  .then(() => {
    stopAll();
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nFAILED:', err);
    stopAll();
    process.exit(1);
  });
