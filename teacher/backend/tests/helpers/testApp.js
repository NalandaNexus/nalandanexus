import http from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Boots the real teacher API against a throwaway in-memory MongoDB AND a
 * stand-in student portal, so the cross-portal course/enrollment bridge can be
 * exercised for real instead of mocked at the module boundary.
 *
 * The stand-in matters: the behaviour under test is precisely what this backend
 * does when the student portal answers, answers with nothing, or does not
 * answer at all — and those three cases used to be indistinguishable to it.
 * Stubbing the bridge functions would assume away the very bug.
 *
 * config/env.js reads process.env once at import time, so every variable
 * (including the stand-in's port, which is only known after it listens) must be
 * set before the first dynamic import below.
 */
export async function bootTestApp({ bridgeConfigured = true } = {}) {
  const student = await startFakeStudentPortal();
  const mongod = await MongoMemoryServer.create();

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test_teacher_jwt_secret';
  process.env.MONGODB_URI = mongod.getUri();
  process.env.CLIENT_URL = 'http://localhost:5174';
  // The auth limiter keys on IP and every request in a file comes from the same
  // one, so a suite that logs in repeatedly would collect 429s unrelated to what
  // it asserts. Raised for tests only; production values are untouched.
  process.env.AUTH_RATE_LIMIT_MAX = '100000';
  process.env.RATE_LIMIT_MAX = '100000';
  process.env.STUDENT_BACKEND_URL = bridgeConfigured ? student.url : '';
  process.env.STUDENT_BACKEND_SERVICE_KEY = bridgeConfigured ? 'test_service_key' : '';

  const { connectDatabase, disconnectDatabase } = await import('../../src/config/db.js');
  await connectDatabase({ retries: 1 });

  const { createApp } = await import('../../src/app.js');
  const app = createApp();
  const server = await listen(app);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  return {
    student,
    baseUrl,
    api: makeClient(baseUrl),
    async teardown() {
      await new Promise((resolve) => server.close(resolve));
      await disconnectDatabase();
      await mongod.stop();
      await student.close();
    },
  };
}

function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/**
 * A controllable stand-in for student/backend.
 *
 * `state` is mutated per test to reproduce the real failure modes the teacher
 * backend has to survive: a healthy catalogue, an empty one, a 500, and a hard
 * network failure (`down`, which refuses the request outright).
 */
async function startFakeStudentPortal() {
  const state = {
    down: false,
    catalogStatus: 200,
    courses: [],
    enrolledStatus: 200,
    enrolledBySlug: {},
    requireServiceKey: true,
    calls: [],
  };

  const server = http.createServer((req, res) => {
    state.calls.push({ method: req.method, url: req.url });

    if (state.down) {
      req.socket.destroy();
      return;
    }

    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    const url = new URL(req.url, 'http://localhost');

    if (url.pathname === '/api/public/courses') {
      if (state.catalogStatus !== 200) return send(state.catalogStatus, { success: false });
      return send(200, { success: true, data: state.courses });
    }

    const enrolled = url.pathname.match(/^\/api\/internal\/courses\/([^/]+)\/enrolled-students$/);
    if (enrolled) {
      if (state.requireServiceKey && req.headers['x-internal-service-key'] !== 'test_service_key') {
        return send(401, { success: false, message: 'Bad service key' });
      }
      if (state.enrolledStatus !== 200) return send(state.enrolledStatus, { success: false });
      const slug = decodeURIComponent(enrolled[1]);
      const all = state.enrolledBySlug[slug] || [];
      // Mirrors the real endpoint: ?batchId scopes the answer to one batch of
      // the course, so each batch only ever sees its own placed students.
      const batchId = url.searchParams.get('batchId');
      const data = batchId ? all.filter((e) => String(e.batchId || '') === batchId) : all;
      return send(200, { success: true, data });
    }

    // Every other bridge call (announcements, materials, ...) is a best-effort
    // side channel that must never fail the action that triggered it.
    return send(200, { success: true, data: null });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  return {
    state,
    url: `http://127.0.0.1:${server.address().port}`,
    reset() {
      state.down = false;
      state.catalogStatus = 200;
      state.courses = [];
      state.enrolledStatus = 200;
      state.enrolledBySlug = {};
      state.calls = [];
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/** Minimal fetch wrapper that carries the httpOnly session cookie, which is the only transport login issues. */
function makeClient(baseUrl) {
  return async function api(method, path, { body, cookie, headers = {} } = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
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
    return {
      status: res.status,
      body: json,
      cookie: setCookie.map((c) => c.split(';')[0]).join('; '),
    };
  };
}

/** Creates a real teacher (User + Teacher) and signs in, returning the session cookie the app itself issued. */
export async function createTeacherAndLogin(api, { name, email, password = 'TestPass123!' }) {
  const { User } = await import('../../src/models/User.js');
  const { Teacher } = await import('../../src/models/Teacher.js');

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({ name, email, passwordHash, role: 'teacher', status: 'active' });
  const teacher = await Teacher.create({ user: user._id, teacherId: `TCH-${Math.random().toString(36).slice(2, 9)}` });

  const res = await api('POST', '/api/teacher/auth/login', { body: { email, password } });
  if (res.status !== 200 || !res.cookie) {
    throw new Error(`createTeacherAndLogin: login failed (${res.status}) ${JSON.stringify(res.body)}`);
  }
  return { user, teacher, cookie: res.cookie };
}
