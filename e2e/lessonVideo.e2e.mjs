/**
 * Lesson videos, end to end across all three real backends.
 *
 *   node e2e/lessonVideo.e2e.mjs          run the scenario, then stop everything
 *   node e2e/lessonVideo.e2e.mjs --keep   leave the services up for a browser check
 *
 * Starts the student, admin and teacher backends as separate processes (see
 * boot.mjs), each on its own in-memory database, wired together with one
 * shared service key exactly as in production. Nothing here talks to a
 * deployed service: every child runs with NODE_ENV=test, which makes it ignore
 * this machine's .env, and every outbound URL is either one of these three or
 * empty.
 *
 * The scenario is the acceptance list: an administrator adds and publishes a
 * video, the enrolled student sees the right thumbnail and embed, the URL is
 * changed and the student sees the new one, a draft stays hidden, an assigned
 * teacher does the same for their course, an unassigned teacher is refused,
 * and none of it touches the student's completion or XP.
 *
 * Module videos then run every source and every direction of the live sync:
 * files uploaded in parts to an S3-compatible store (an in-process stand-in,
 * driven through real presigned URLs) and Google Drive links, with real
 * Socket.IO clients for the student, the administrator and two teachers -
 * Teacher -> Student and Admin, Admin -> Teacher and Student - checking that
 * each portal is told, that only the right people are told, and that what the
 * student then reads is what was saved.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import net from 'node:net';

const KEEP = process.argv.includes('--keep');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY = 'e2e_service_key';
const PASSWORD = 'E2e-Pass-123!';
const PORTS = KEEP ? { student: 5101, teacher: 5102, admin: 5103 } : null;
const MiB = 1024 * 1024;
const DRIVE = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';

// Each backend must know the others' addresses before it starts (the student
// service notifies the two staff portals), so ports are chosen up front.
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}
const ID_1 = 'dQw4w9WgXcQ';
const ID_2 = 'M7lc1UVf-VE';
const ID_3 = 'aqz-KE-bpKQ';

// Nothing from the parent shell that could name a real database or service.
function cleanEnv(extra) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (/MONGO|_URL$|_URI$|KEY|SECRET|TOKEN|SMTP|MAIL|RAZORPAY|CLOUDINARY|GOOGLE|RESEND|BACKEND/i.test(k)) continue;
    env[k] = v;
  }
  return { ...env, NODE_ENV: 'test', E2E_PASSWORD: PASSWORD, AUTH_RATE_LIMIT_MAX: '100000', RATE_LIMIT_MAX: '100000', ...extra };
}

const children = [];
function boot(portal, port, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'e2e', 'boot.mjs'), portal, String(port)], {
      env: cleanEnv(env),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.push(child);
    let out = '';
    const timer = setTimeout(() => reject(new Error(`${portal} did not start:\n${out}`)), 120_000);
    child.stdout.on('data', (d) => {
      out += d;
      const m = /READY (\d+) (\S+)/.exec(out);
      if (m) {
        clearTimeout(timer);
        resolve({ url: `http://127.0.0.1:${m[1]}`, mongoUri: m[2] });
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

async function http(base, method, p, { body, cookie, bearer, headers = {} } = {}) {
  const res = await fetch(`${base}${p}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
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

const lessonOf = (content, id) => content.modules.flatMap((m) => m.lessons).find((l) => l.lessonId === id);

async function main() {
  const ports = PORTS || { student: await freePort(), teacher: await freePort(), admin: await freePort() };
  const fakeS3Module = await import(pathToFileURL(path.join(root, 'student', 'backend', 'tests', 'helpers', 'fakeS3.js')).href);
  const s3 = await fakeS3Module.startFakeS3({ bucket: 'e2e-videos' });
  console.log('Booting student, teacher and admin backends (in-memory databases, in-process object storage)…');
  const student = await boot('student', ports.student, {
    JWT_ACCESS_SECRET: 'e2e_access',
    JWT_REFRESH_SECRET: 'e2e_refresh',
    CLIENT_URL: 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000',
    INTERNAL_SERVICE_KEY: KEY,
    // Video change notices to the two staff portals.
    ADMIN_BACKEND_URL: `http://127.0.0.1:${ports.admin}`,
    TEACHER_BACKEND_URL: `http://127.0.0.1:${ports.teacher}`,
    VIDEO_STORAGE_ENDPOINT: s3.endpoint,
    VIDEO_STORAGE_REGION: 'auto',
    VIDEO_STORAGE_BUCKET: s3.bucket,
    VIDEO_STORAGE_ACCESS_KEY_ID: 'e2e-access-key',
    VIDEO_STORAGE_SECRET_ACCESS_KEY: 'e2e-secret-key',
  });
  const [teacher, admin] = await Promise.all([
    boot('teacher', ports.teacher, {
      JWT_SECRET: 'e2e_teacher_jwt',
      CLIENT_URL: 'http://localhost:5174',
      COOKIE_SAMESITE: 'lax',
      STUDENT_BACKEND_URL: student.url,
      STUDENT_BACKEND_SERVICE_KEY: KEY,
    }),
    boot('admin', ports.admin, {
      JWT_SECRET: 'e2e_admin_jwt',
      CLIENT_URL: 'http://localhost:5175',
      COOKIE_SAMESITE: 'lax',
      STUDENT_BACKEND_URL: student.url,
      STUDENT_BACKEND_SERVICE_KEY: KEY,
    }),
  ]);
  console.log(`  student ${student.url}  teacher ${teacher.url}  admin ${admin.url}\n`);

  // --- A real, verified, profile-complete, enrolled student ---------------
  const email = 'student@e2e.test';
  const reg = await http(student.url, 'POST', '/api/auth/register', { body: { name: 'Asha Verma', email, password: PASSWORD } });
  const token = new URL(reg.body.data.verificationUrlFallback).searchParams.get('token');
  const verified = await http(student.url, 'POST', '/api/auth/verify-email', { body: { token } });
  const studentToken = verified.body.data.accessToken;
  const userId = verified.body.data.user.id || verified.body.data.user._id;
  const prof = await http(student.url, 'PUT', '/api/student/profile/completion', {
    bearer: studentToken,
    body: { fullName: 'Asha Verma', guardianName: 'Ravi Verma', grade: 'Class 9', phone: '9876543210' },
  });
  assert.equal(prof.status, 200, JSON.stringify(prof.body));

  // Enrolment is written straight to the student database, as the payment
  // flow would - purchases are not what this run is about.
  const requireFromStudent = createRequire(path.join(root, 'student', 'backend', 'package.json'));
  const { MongoClient, ObjectId } = await import(pathToFileURL(requireFromStudent.resolve('mongodb')).href);
  const mongo = new MongoClient(student.mongoUri);
  await mongo.connect();
  const sdb = mongo.db();
  const prarambh = await sdb.collection('courses').findOne({ slug: 'prarambh' });
  await sdb.collection('enrollments').insertOne({
    userId: new ObjectId(userId),
    courseId: prarambh._id,
    status: 'active',
    enrollmentId: 'ENR-2026-000001',
    enrolledAt: new Date(),
    progressPercent: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const studentView = async () => {
    const r = await http(student.url, 'GET', '/api/student/courses/prarambh/content', { bearer: studentToken });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.data;
  };

  const adminCookie = (await http(admin.url, 'POST', '/api/admin/auth/login', { body: { email: 'admin@e2e.test', password: PASSWORD } })).cookie;
  assert.ok(adminCookie, 'admin login');
  const adminPut = (slug, lessonId, body) => http(admin.url, 'PUT', `/api/admin/lesson-videos/courses/${slug}/lessons/${lessonId}`, { cookie: adminCookie, body });

  console.log('Admin');
  await check('admin sees every catalogue course, including GARUD and YODDHA', async () => {
    const r = await http(admin.url, 'GET', '/api/admin/lesson-videos/courses', { cookie: adminCookie });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body.data.map((c) => c.slug).sort(), ['garud', 'prarambh', 'yoddha']);
  });

  await check('admin adds and publishes a YouTube video on a lesson', async () => {
    const r = await adminPut('prarambh', 'l-1', { url: `https://www.youtube.com/watch?v=${ID_1}`, title: 'Welcome to Nalanda', isPublished: true });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.data.video.videoId, ID_1);
    assert.equal(r.body.data.video.updatedBy.portal, 'admin');
  });

  console.log('Student');
  await check('the enrolled student sees the correct thumbnail and embed', async () => {
    const l = lessonOf(await studentView(), 'l-1');
    assert.equal(l.video.videoId, ID_1);
    assert.equal(l.video.title, 'Welcome to Nalanda');
    assert.equal(l.video.thumbnailUrl, `https://img.youtube.com/vi/${ID_1}/hqdefault.jpg`);
    assert.equal(l.video.thumbnailMaxUrl, `https://img.youtube.com/vi/${ID_1}/maxresdefault.jpg`);
    assert.ok(l.video.embedUrl.startsWith(`https://www.youtube-nocookie.com/embed/${ID_1}?`));
    assert.equal(l.video.watchUrl, `https://www.youtube.com/watch?v=${ID_1}`);
  });

  let xpBefore;
  await check('the student completes the lesson and earns XP once', async () => {
    const r = await http(student.url, 'POST', '/api/student/courses/lessons/l-1/progress', { bearer: studentToken });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.data.xpAwarded, 10);
    xpBefore = await sdb.collection('xpevents').countDocuments({ userId: new ObjectId(userId) });
  });

  console.log('Admin changes the video');
  await check('admin replaces the URL (youtu.be form) and the student sees the new video', async () => {
    const r = await adminPut('prarambh', 'l-1', { url: `https://youtu.be/${ID_2}`, title: 'Welcome, take two', isPublished: true });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.previousVideoId, ID_1);
    const l = lessonOf(await studentView(), 'l-1');
    assert.equal(l.video.videoId, ID_2);
    assert.equal(l.video.title, 'Welcome, take two');
  });

  await check('the change did not reset completion or award XP again', async () => {
    const l = lessonOf(await studentView(), 'l-1');
    assert.equal(l.completed, true);
    assert.equal(await sdb.collection('xpevents').countDocuments({ userId: new ObjectId(userId) }), xpBefore);
  });

  await check('a draft stays hidden from the student', async () => {
    const r = await adminPut('prarambh', 'l-2', { url: `https://www.youtube.com/shorts/${ID_3}`, isPublished: false });
    assert.equal(r.status, 200);
    const l = lessonOf(await studentView(), 'l-2');
    assert.equal(l.video, null);
    assert.equal(JSON.stringify(l).includes(ID_3), false);
  });

  await check('an invalid link is refused end to end with its reason', async () => {
    const r = await adminPut('prarambh', 'l-3', { url: 'https://vimeo.com/76979871', isPublished: true });
    assert.equal(r.status, 422);
    assert.equal(r.body.error?.code || r.body.code, 'UNSUPPORTED_PROVIDER');
  });

  console.log('Teacher');
  // Exactly what the Admin portal sends when it assigns a catalogue course.
  const assign = await http(teacher.url, 'PUT', '/api/internal/teachers/courses', {
    headers: { 'X-Internal-Service-Key': KEY },
    body: { teacherEmail: 'alice@e2e.test', courses: [{ slug: 'prarambh', title: 'PRARAMBH' }] },
  });
  assert.equal(assign.status, 200, JSON.stringify(assign.body));
  const alice = (await http(teacher.url, 'POST', '/api/teacher/auth/login', { body: { email: 'alice@e2e.test', password: PASSWORD } })).cookie;
  const bob = (await http(teacher.url, 'POST', '/api/teacher/auth/login', { body: { email: 'bob@e2e.test', password: PASSWORD } })).cookie;
  assert.ok(alice && bob, 'teacher logins');

  await check('an assigned teacher sees only their course', async () => {
    const r = await http(teacher.url, 'GET', '/api/teacher/lesson-videos/courses', { cookie: alice });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body.data.map((c) => c.slug), ['prarambh']);
    assert.equal(r.body.data[0].lessonCount, 5);
  });

  await check('the assigned teacher publishes a video and the student sees it', async () => {
    const r = await http(teacher.url, 'PUT', '/api/teacher/lesson-videos/courses/prarambh/lessons/m-1', {
      cookie: alice,
      body: { url: `https://www.youtube.com/live/${ID_3}`, title: 'Mindset live session', isPublished: true },
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const l = lessonOf(await studentView(), 'm-1');
    assert.equal(l.video.videoId, ID_3);
    assert.equal(l.video.title, 'Mindset live session');
    const editorView = await http(admin.url, 'GET', '/api/admin/lesson-videos/courses/prarambh', { cookie: adminCookie });
    const m1 = lessonOf(editorView.body.data, 'm-1');
    assert.equal(m1.video.updatedBy.portal, 'teacher');
    assert.equal(m1.video.updatedBy.name, 'Alice Rao');
  });

  await check('an unassigned teacher cannot modify the course', async () => {
    const before = await studentView();
    for (const [method, p] of [
      ['PUT', '/api/teacher/lesson-videos/courses/prarambh/lessons/l-1'],
      ['DELETE', '/api/teacher/lesson-videos/courses/prarambh/lessons/l-1'],
      ['GET', '/api/teacher/lesson-videos/courses/prarambh'],
    ]) {
      const r = await http(teacher.url, method, p, { cookie: bob, body: method === 'PUT' ? { url: `https://youtu.be/${ID_1}`, isPublished: true } : undefined });
      assert.equal(r.status, 403, `${method} ${p}: ${JSON.stringify(r.body)}`);
    }
    assert.deepEqual(lessonOf(await studentView(), 'l-1').video, lessonOf(before, 'l-1').video);
  });

  await check('the assigned teacher cannot modify a course outside their assignment', async () => {
    const r = await http(teacher.url, 'PUT', '/api/teacher/lesson-videos/courses/garud/lessons/g-1', {
      cookie: alice,
      body: { url: `https://youtu.be/${ID_1}`, isPublished: true },
    });
    assert.equal(r.status, 403);
  });

  await check('the student service refuses the bridge without the key', async () => {
    const r = await http(student.url, 'PUT', '/api/internal/lesson-videos/courses/prarambh/lessons/l-1', { body: { url: `https://youtu.be/${ID_1}` } });
    assert.equal(r.status, 401);
  });

  console.log('Module introductions and concurrent edits');
  await check('admin publishes a module introduction; the student sees it on the module', async () => {
    const r = await http(admin.url, 'PUT', '/api/admin/lesson-videos/courses/prarambh/modules/mod-2', {
      cookie: adminCookie,
      body: { url: `https://youtu.be/${ID_1}`, title: 'Mindset, introduced', isPublished: true },
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const mod = (await studentView()).modules.find((m) => m.moduleId === 'mod-2');
    assert.equal(mod.video.videoId, ID_1);
    assert.equal(mod.video.title, 'Mindset, introduced');
  });

  await check('a teacher editing from an outdated version is refused with who changed it; nothing is overwritten', async () => {
    const editor = await http(teacher.url, 'GET', '/api/teacher/lesson-videos/courses/prarambh', { cookie: alice });
    const loaded = editor.body.data.modules.find((m) => m.moduleId === 'mod-2').video.updatedAt;
    // The admin changes it after the teacher opened it...
    const adminSave = await http(admin.url, 'PUT', '/api/admin/lesson-videos/courses/prarambh/modules/mod-2', {
      cookie: adminCookie,
      body: { url: `https://youtu.be/${ID_2}`, title: 'Admin version', isPublished: true, expectedUpdatedAt: loaded },
    });
    assert.equal(adminSave.status, 200);
    // ...so the teacher's save, based on the old version, is refused.
    const stale = await http(teacher.url, 'PUT', '/api/teacher/lesson-videos/courses/prarambh/modules/mod-2', {
      cookie: alice,
      body: { url: `https://youtu.be/${ID_3}`, title: 'Teacher version', isPublished: true, expectedUpdatedAt: loaded },
    });
    assert.equal(stale.status, 409, JSON.stringify(stale.body));
    assert.match(stale.body.error?.message || stale.body.message, /changed by E2E Admin/);
    assert.equal(stale.body.error?.details?.current?.title, 'Admin version');
    assert.equal((await studentView()).modules.find((m) => m.moduleId === 'mod-2').video.title, 'Admin version');
  });

  await check('the admin sees the same conflict shape when the teacher got there first', async () => {
    const before = (await http(admin.url, 'GET', '/api/admin/lesson-videos/courses/prarambh', { cookie: adminCookie })).body.data;
    const loaded = before.modules.find((m) => m.moduleId === 'mod-2').video.updatedAt;
    const teacherSave = await http(teacher.url, 'PUT', '/api/teacher/lesson-videos/courses/prarambh/modules/mod-2', {
      cookie: alice,
      body: { url: `https://youtu.be/${ID_3}`, title: 'Teacher version', isPublished: true, expectedUpdatedAt: loaded },
    });
    assert.equal(teacherSave.status, 200);
    const stale = await http(admin.url, 'DELETE', '/api/admin/lesson-videos/courses/prarambh/modules/mod-2', {
      cookie: adminCookie,
      body: { expectedUpdatedAt: loaded },
    });
    assert.equal(stale.status, 409);
    assert.equal((stale.body.errors || stale.body.error?.details).current.title, 'Teacher version');
  });

  console.log('Removal');
  await check('admin unpublishes, then removes; the student sees no video and keeps completion', async () => {
    let r = await adminPut('prarambh', 'l-1', { url: `https://youtu.be/${ID_2}`, isPublished: false });
    assert.equal(r.status, 200);
    assert.equal(lessonOf(await studentView(), 'l-1').video, null);
    r = await http(admin.url, 'DELETE', '/api/admin/lesson-videos/courses/prarambh/lessons/l-1', { cookie: adminCookie });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.removed, true);
    const l = lessonOf(await studentView(), 'l-1');
    assert.equal(l.video, null);
    assert.equal(l.completed, true);
  });

  await check('other lessons were never touched', async () => {
    const view = await studentView();
    assert.equal(lessonOf(view, 'm-1').video.videoId, ID_3);
    assert.equal(lessonOf(view, 'l-3').video, null);
    assert.equal(lessonOf(view, 'l-3').content, 'Written material for l lesson 3.');
  });

  // --- Module videos: every source, every direction of the live sync ----------
  const { io } = await import(pathToFileURL(createRequire(path.join(root, 'admin', 'frontend', 'package.json')).resolve('socket.io-client')).href);
  const sockets = [];
  const listen = (url, options) =>
    new Promise((resolve, reject) => {
      const socket = io(url, { transports: ['websocket'], reconnection: false, ...options });
      const log = [];
      socket.onAny((event, payload) => log.push({ event, payload }));
      sockets.push(socket);
      socket.on('connect', () => resolve({ socket, log }));
      socket.on('connect_error', reject);
    });
  const until = async (what, fn, ms = 6000) => {
    const end = Date.now() + ms;
    for (;;) {
      const v = fn();
      if (v) return v;
      if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
      await new Promise((r) => setTimeout(r, 50));
    }
  };
  const quiet = async (ms = 800) => new Promise((r) => setTimeout(r, ms));

  // Bob is assigned GARUD, Alice keeps PRARAMBH.
  const assignBob = await http(teacher.url, 'PUT', '/api/internal/teachers/courses', {
    headers: { 'X-Internal-Service-Key': KEY },
    body: { teacherEmail: 'bob@e2e.test', courses: [{ slug: 'garud', title: 'GARUD' }] },
  });
  assert.equal(assignBob.status, 200, JSON.stringify(assignBob.body));

  const studentSock = await listen(student.url, { auth: { token: studentToken } });
  const adminSock = await listen(admin.url, { extraHeaders: { Cookie: adminCookie } });
  const aliceSock = await listen(teacher.url, { extraHeaders: { Cookie: alice } });
  const bobSock = await listen(teacher.url, { extraHeaders: { Cookie: bob } });
  const clear = () => [studentSock, adminSock, aliceSock, bobSock].forEach((s) => (s.log.length = 0));
  const got = (who, event, pred = () => true) => who.log.find((e) => e.event === event && pred(e.payload));

  const moduleOf = async (id) => (await studentView()).modules.find((m) => m.moduleId === id);

  /** Uploads `bytes` through a portal exactly as its browser editor does. */
  async function uploadThrough(base, cookie, prefix, slug, moduleId, bytes, fileName, extra = {}) {
    const start = await http(base, 'POST', `${prefix}/lesson-videos/courses/${slug}/modules/${moduleId}/uploads`, {
      cookie,
      body: { fileName, fileSize: bytes.length, mimeType: 'video/mp4', title: fileName, isPublished: true, ...extra },
    });
    assert.equal(start.status, 201, JSON.stringify(start.body));
    const session = start.body.data;
    const numbers = Array.from({ length: session.totalParts }, (_, i) => i + 1);
    const urls = await http(base, 'POST', `${prefix}/lesson-videos/courses/${slug}/uploads/${session.uploadId}/parts`, { cookie, body: { partNumbers: numbers } });
    assert.equal(urls.status, 200, JSON.stringify(urls.body));
    return { session, urls: urls.body.data.parts, complete: () => http(base, 'POST', `${prefix}/lesson-videos/courses/${slug}/uploads/${session.uploadId}/complete`, { cookie, body: { duration: 42 } }) };
  }
  const sendAll = async ({ session, urls }, bytes) => {
    for (const part of urls) {
      const startByte = (part.partNumber - 1) * session.partSize;
      await s3.putPart(part.url, bytes.subarray(startByte, startByte + session.partSize));
    }
  };

  console.log('Module videos: Teacher -> Student and Admin');
  let firstKey;
  await check('a teacher uploads a large file in parts; students see nothing until it is verified', async () => {
    clear();
    const bytes = fakeS3Module.fakeVideoBytes(10 * MiB + 4321, 'mp4');
    const up = await uploadThrough(teacher.url, alice, '/api/teacher', 'prarambh', 'mod-1', bytes, 'awakening.mp4');
    assert.equal(up.session.totalParts, 2);
    // Staff hear that an upload started; students do not.
    await until('admin hears upload_started', () => got(adminSock, 'course_video.changed', (p) => p.action === 'upload_started'));
    await sendAll(up, bytes);
    assert.equal((await moduleOf('mod-1')).video, null, 'not visible while uploading');
    const done = await up.complete();
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.equal(done.body.data.video.provider, 'upload');
    assert.equal(done.body.data.video.processingStatus, 'verified');
    assert.equal(got(studentSock, 'course:content_updated', (p) => p.action === 'upload_started'), undefined);
  });

  await check('the student is told and then streams the verified file with range requests', async () => {
    await until('student notice', () => got(studentSock, 'course:content_updated', (p) => p.slug === 'prarambh' && p.moduleId === 'mod-1'));
    const mod = await moduleOf('mod-1');
    assert.equal(mod.video.provider, 'upload');
    assert.equal(mod.video.title, 'awakening.mp4');
    const ranged = await fetch(mod.video.streamUrl, { headers: { Range: 'bytes=0-99' } });
    assert.equal(ranged.status, 206);
    assert.equal((await ranged.arrayBuffer()).byteLength, 100);
    firstKey = [...s3.objects.keys()][0];
  });

  await check('the administrator is told who did it; only the course’s teacher is told, not Bob', async () => {
    const notice = await until('admin notice', () => got(adminSock, 'course_video.changed', (p) => p.action === 'upload_completed'));
    assert.equal(notice.payload.slug, 'prarambh');
    assert.equal(notice.payload.moduleId, 'mod-1');
    assert.equal(notice.payload.actor.name, 'Alice Rao');
    assert.equal(notice.payload.actor.portal, 'teacher');
    assert.ok(!JSON.stringify(notice.payload).includes('X-Amz'), 'notices carry no URL');
    await until('alice notice', () => got(aliceSock, 'course_video.changed', (p) => p.action === 'upload_completed'));
    await quiet();
    assert.equal(got(bobSock, 'course_video.changed'), undefined, 'Bob does not teach PRARAMBH');
    const adminView = await http(admin.url, 'GET', '/api/admin/lesson-videos/courses/prarambh', { cookie: adminCookie });
    const m1 = adminView.body.data.modules.find((m) => m.moduleId === 'mod-1');
    assert.equal(m1.video.provider, 'upload');
    assert.equal(m1.video.updatedBy.name, 'Alice Rao');
    assert.equal(m1.video.fileSize, 10 * MiB + 4321);
  });

  console.log('Module videos: Admin -> Teacher and Student');
  await check('the administrator replaces the upload with a Google Drive link; teacher and student are told', async () => {
    clear();
    const before = (await http(admin.url, 'GET', '/api/admin/lesson-videos/courses/prarambh', { cookie: adminCookie })).body.data;
    const version = before.modules.find((m) => m.moduleId === 'mod-1').video.updatedAt;
    const r = await http(admin.url, 'PUT', '/api/admin/lesson-videos/courses/prarambh/modules/mod-1', {
      cookie: adminCookie,
      body: { provider: 'google_drive', url: `https://drive.google.com/file/d/${DRIVE}/view?usp=sharing`, title: 'Awakening (Drive)', isPublished: true, expectedUpdatedAt: version },
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.data.previousProvider, 'upload');
    const teacherNotice = await until('alice notice', () => got(aliceSock, 'course_video.changed', (p) => p.action === 'published'));
    assert.equal(teacherNotice.payload.actor.portal, 'admin');
    assert.equal(teacherNotice.payload.provider, 'google_drive');
    await until('student notice', () => got(studentSock, 'course:content_updated', (p) => p.moduleId === 'mod-1'));
    const mod = await moduleOf('mod-1');
    assert.equal(mod.video.provider, 'google_drive');
    assert.equal(mod.video.externalVideoId, DRIVE);
    assert.equal(mod.video.embedUrl, `https://drive.google.com/file/d/${DRIVE}/preview`);
    assert.equal(mod.video.streamUrl, undefined, 'no stale upload URL is left behind');
    assert.ok(s3.objects.has(firstKey), 'the replaced file is kept until no student can still be playing it');
  });

  await check('the teacher, who loaded the old version, cannot overwrite the administrator’s change', async () => {
    const stale = await http(teacher.url, 'DELETE', '/api/teacher/lesson-videos/courses/prarambh/modules/mod-1', {
      cookie: alice,
      body: { expectedUpdatedAt: '2026-01-01T00:00:00.000Z' },
    });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error?.details?.current?.provider, 'google_drive');
  });

  await check('the administrator uploads to another module, replacing its YouTube video; the teacher is told', async () => {
    clear();
    const bytes = fakeS3Module.fakeVideoBytes(256 * 1024, 'mp4');
    const up = await uploadThrough(admin.url, adminCookie, '/api/admin', 'prarambh', 'mod-2', bytes, 'mindset.mp4');
    await sendAll(up, bytes);
    const done = await up.complete();
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.equal(done.body.data.previousProvider, 'youtube');
    const notice = await until('alice notice', () => got(aliceSock, 'course_video.changed', (p) => p.moduleId === 'mod-2' && p.action === 'upload_completed'));
    assert.equal(notice.payload.actor.name, 'E2E Admin');
    await until('student notice', () => got(studentSock, 'course:content_updated', (p) => p.moduleId === 'mod-2'));
    assert.equal((await moduleOf('mod-2')).video.provider, 'upload');
  });

  console.log('Module videos: deletion, permissions, other courses');
  await check('the teacher deletes a module video; the student loses it at once and the administrator sees the deletion', async () => {
    clear();
    const current = (await http(teacher.url, 'GET', '/api/teacher/lesson-videos/courses/prarambh', { cookie: alice })).body.data;
    const version = current.modules.find((m) => m.moduleId === 'mod-2').video.updatedAt;
    const r = await http(teacher.url, 'DELETE', '/api/teacher/lesson-videos/courses/prarambh/modules/mod-2', { cookie: alice, body: { expectedUpdatedAt: version } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    await until('student notice', () => got(studentSock, 'course:content_updated', (p) => p.moduleId === 'mod-2'));
    assert.equal((await moduleOf('mod-2')).video, null);
    const notice = await until('admin notice', () => got(adminSock, 'course_video.changed', (p) => p.action === 'removed'));
    assert.equal(notice.payload.actor.name, 'Alice Rao');
    const activity = await http(admin.url, 'GET', '/api/admin/lesson-videos/activity?slug=prarambh&limit=50', { cookie: adminCookie });
    assert.equal(activity.status, 200);
    assert.ok(activity.body.data.some((e) => e.action === 'removed' && e.targetId === 'mod-2' && e.actor.name === 'Alice Rao'));
  });

  await check('a file that is not a video is refused after upload, and the administrator sees the failure', async () => {
    clear();
    const bytes = fakeS3Module.fakeVideoBytes(64 * 1024, 'pdf');
    const up = await uploadThrough(teacher.url, alice, '/api/teacher', 'prarambh', 'mod-2', bytes, 'slides.mp4');
    await sendAll(up, bytes);
    const done = await up.complete();
    assert.equal(done.status, 422);
    assert.equal(done.body.error?.code, 'VIDEO_VERIFICATION_FAILED');
    assert.equal((await moduleOf('mod-2')).video, null);
    const problems = await http(admin.url, 'GET', '/api/admin/lesson-videos/activity?level=problems', { cookie: adminCookie });
    assert.ok(problems.body.data.some((e) => e.action === 'upload_failed' && e.level === 'error' && e.actor.name === 'Alice Rao'));
  });

  await check('another teacher cannot upload to, or steer an upload in, a course not assigned to them', async () => {
    const started = await uploadThrough(teacher.url, alice, '/api/teacher', 'prarambh', 'mod-2', fakeS3Module.fakeVideoBytes(1000, 'mp4'), 'a.mp4');
    const steer = await http(teacher.url, 'POST', `/api/teacher/lesson-videos/courses/prarambh/uploads/${started.session.uploadId}/complete`, { cookie: bob, body: {} });
    assert.equal(steer.status, 403);
    const own = await http(teacher.url, 'POST', '/api/teacher/lesson-videos/courses/prarambh/modules/mod-1/uploads', {
      cookie: bob,
      body: { fileName: 'x.mp4', fileSize: 1000, mimeType: 'video/mp4' },
    });
    assert.equal(own.status, 403);
    const cancel = await http(teacher.url, 'DELETE', `/api/teacher/lesson-videos/courses/prarambh/uploads/${started.session.uploadId}`, { cookie: alice });
    assert.equal(cancel.status, 200);
  });

  await check('several teachers and modules: Bob’s GARUD video reaches the admin, never Alice or PRARAMBH students', async () => {
    clear();
    const bytes = fakeS3Module.fakeVideoBytes(128 * 1024, 'webm');
    const start = await http(teacher.url, 'POST', '/api/teacher/lesson-videos/courses/garud/modules/g-mod-1/uploads', {
      cookie: bob,
      body: { fileName: 'flight.webm', fileSize: bytes.length, mimeType: 'video/webm', isPublished: true },
    });
    assert.equal(start.status, 201, JSON.stringify(start.body));
    const urls = await http(teacher.url, 'POST', `/api/teacher/lesson-videos/courses/garud/uploads/${start.body.data.uploadId}/parts`, { cookie: bob, body: { partNumbers: [1] } });
    await s3.putPart(urls.body.data.parts[0].url, bytes);
    const done = await http(teacher.url, 'POST', `/api/teacher/lesson-videos/courses/garud/uploads/${start.body.data.uploadId}/complete`, { cookie: bob, body: {} });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    const notice = await until('admin notice', () => got(adminSock, 'course_video.changed', (p) => p.slug === 'garud'));
    assert.equal(notice.payload.actor.name, 'Bob Iyer');
    await until('bob notice', () => got(bobSock, 'course_video.changed', (p) => p.slug === 'garud'));
    await quiet();
    assert.equal(got(aliceSock, 'course_video.changed', (p) => p.slug === 'garud'), undefined);
    assert.equal(got(studentSock, 'course:content_updated', (p) => p.slug === 'garud'), undefined, 'the student is not enrolled in GARUD');
    const prarambhNow = await moduleOf('mod-1');
    assert.equal(prarambhNow.video.provider, 'google_drive', 'other courses were not touched');
  });

  await check('every module of PRARAMBH is configured on its own', async () => {
    const view = await studentView();
    const sources = Object.fromEntries(view.modules.map((m) => [m.moduleId, m.video?.provider || null]));
    assert.deepEqual(sources, { 'mod-1': 'google_drive', 'mod-2': null });
    const l1 = lessonOf(view, 'l-1');
    assert.equal(l1.completed, true, 'completion survived every video change');
    assert.equal(await sdb.collection('xpevents').countDocuments({ userId: new ObjectId(userId) }), xpBefore);
  });

  for (const sock of sockets) sock.close();
  // In --keep mode the store stays up so uploads work in a browser check.
  if (!KEEP) await s3.close();

  if (KEEP) {
    // Leave something to look at in a browser.
    await adminPut('prarambh', 'l-1', { url: `https://www.youtube.com/watch?v=${ID_1}`, title: 'Welcome to Nalanda', isPublished: true });
    await sdb.collection('enrollments').updateOne({ userId: new ObjectId(userId) }, { $set: { currentLessonId: 'l-1', currentModuleId: 'mod-1' } });
  }
  await mongo.close();

  console.log(`\n${step} checks passed.`);
  if (KEEP) {
    console.log(`\nServices left running (Ctrl+C to stop):
  student API ${student.url}/api   (student@e2e.test)
  teacher API ${teacher.url}/api/teacher   (alice@e2e.test assigned PRARAMBH, bob@e2e.test unassigned)
  admin API   ${admin.url}/api/admin   (admin@e2e.test)
  password for all: the E2E_PASSWORD constant in this file`);
    process.on('SIGINT', () => {
      stopAll();
      process.exit(0);
    });
    return;
  }
  stopAll();
}

main().catch((err) => {
  console.error(err);
  stopAll();
  process.exit(1);
});
