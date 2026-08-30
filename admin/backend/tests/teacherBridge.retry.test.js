import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

/**
 * The Admin -> Teacher bridge under a cold peer.
 *
 * Both services sleep on Render's free tier and wake in 22-32 seconds. The
 * bridge used to give up at 8, so a course assignment made while the teacher
 * portal happened to be asleep was lost silently and permanently - confirmed
 * live: cold peer wrote REQUEST_FAILED to the audit log, warm peer wrote
 * SUCCESS.
 *
 * These run against a real HTTP server that reproduces each failure mode, so
 * the retry, its bound, and what it refuses to retry are all actually
 * exercised rather than asserted about a mock.
 */

let peer;
let pushCourseAssignment;

/** A stand-in teacher backend whose behaviour each test sets. */
async function startPeer() {
  const state = { mode: 'ok', requests: [], slowFirstMs: 0 };

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => {
      body += c;
    });
    req.on('end', () => {
      const n = state.requests.length + 1;
      state.requests.push({ url: req.url, body, key: req.headers['x-internal-service-key'] });

      const reply = (status, payload) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      };

      if (state.mode === 'hang') return; // never answers: reproduces a cold start
      if (state.mode === 'slow-first' && n === 1) {
        // Answers, but only after the first attempt's budget has expired.
        setTimeout(() => reply(200, { success: true, data: { assigned: true } }), state.slowFirstMs);
        return;
      }
      if (state.mode === 'error-then-ok' && n === 1) return reply(503, { success: false });
      if (state.mode === 'always-500') return reply(500, { success: false });
      if (state.mode === 'not-found') return reply(200, { success: true, data: { assigned: false, reason: 'TEACHER_NOT_FOUND' } });
      if (state.mode === 'bad-request') return reply(400, { success: false, message: 'nope' });

      return reply(200, { success: true, data: { assigned: true } });
    });
  });

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    state,
    url: `http://127.0.0.1:${server.address().port}`,
    reset() {
      state.mode = 'ok';
      state.requests = [];
      state.slowFirstMs = 0;
    },
    close: () => new Promise((r) => server.close(r)),
  };
}

before(async () => {
  peer = await startPeer();
  // config/env.js reads process.env once at import, so this must precede it.
  process.env.NODE_ENV = 'test';
  process.env.TEACHER_BACKEND_URL = peer.url;
  process.env.TEACHER_BACKEND_SERVICE_KEY = 'test_key';
  process.env.JWT_SECRET = 'test_admin_secret';
  ({ pushCourseAssignment } = await import('../src/services/teacherBridge.service.js'));
});

after(async () => {
  await peer.close();
});

beforeEach(() => peer.reset());

function assign(sourceId = 'course-1') {
  return pushCourseAssignment({
    sourceId,
    teacherEmail: 'teacher@example.com',
    title: 'PRARAMBH',
    courseCode: 'PR-01',
    description: '',
    image: null,
    priceInPaise: 0,
    status: 'PENDING_REVIEW',
  });
}

test('a warm peer answers on the first attempt', async () => {
  const started = Date.now();
  const res = await assign();

  assert.equal(res.assigned, true);
  assert.equal(peer.state.requests.length, 1, 'a healthy peer must not be retried');
  assert.ok(Date.now() - started < 3000, 'the common case must stay fast');
});

test('a cold peer that wakes mid-call is retried into success', async () => {
  peer.state.mode = 'slow-first';
  peer.state.slowFirstMs = 9500; // outlasts the 8s first attempt, like a real cold start

  const res = await assign('course-cold');

  assert.equal(res.assigned, true, 'the assignment must survive a cold start');
  assert.ok(peer.state.requests.length >= 2, 'it took a retry to get there');
});

test('a 5xx is retried and then succeeds', async () => {
  peer.state.mode = 'error-then-ok';

  const res = await assign('course-5xx');

  assert.equal(res.assigned, true);
  assert.equal(peer.state.requests.length, 2, 'exactly one retry was needed');
});

test('retrying is bounded - a dead peer does not loop', async () => {
  peer.state.mode = 'always-500';

  const res = await assign('course-dead');

  assert.equal(res.assigned, false, 'failure must be reported, never invented');
  assert.equal(res.reason, 'REQUEST_FAILED');
  assert.equal(peer.state.requests.length, 3, 'three attempts, then stop');
});

test('a 4xx is the peer answering clearly and is not retried', async () => {
  peer.state.mode = 'bad-request';

  const res = await assign('course-4xx');

  assert.equal(res.assigned, false);
  assert.equal(peer.state.requests.length, 1, 'repeating a rejected request only wastes time');
});

test('a peer that says the teacher is unknown is reported as such, not as a transport failure', async () => {
  peer.state.mode = 'not-found';

  const res = await assign('course-unknown-teacher');

  assert.equal(res.assigned, false);
  assert.equal(res.reason, 'TEACHER_NOT_FOUND', 'the admin needs the real reason to act on it');
  assert.equal(peer.state.requests.length, 1);
});

/**
 * The retry-safety requirement: if the first attempt timed out but actually
 * ARRIVED, the retry must not create a second assignment.
 */
test('every attempt carries the same sourceId, so a retry cannot duplicate an assignment', async () => {
  peer.state.mode = 'error-then-ok';

  await assign('course-idempotent');

  assert.equal(peer.state.requests.length, 2);
  const paths = new Set(peer.state.requests.map((r) => r.url));
  assert.equal(paths.size, 1, 'both attempts address the same course');
  assert.match([...paths][0], /course-idempotent/);
  // The teacher side upserts on this sourceId (assignedCourse.service.js
  // findOneAndUpdate with upsert), so an arriving duplicate is absorbed as an
  // update rather than inserted a second time.
});

test('every attempt is authenticated', async () => {
  peer.state.mode = 'error-then-ok';
  await assign('course-auth');

  assert.equal(peer.state.requests.length, 2);
  for (const r of peer.state.requests) {
    assert.equal(r.key, 'test_key', 'a retry must not drop the service key');
  }
});
