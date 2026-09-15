import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
process.env.CLIENT_URL = 'http://localhost:3000';

// The auth limiter keys on IP, and every request in a test file comes from the
// same one - so a suite that registers more than AUTH_RATE_LIMIT_MAX students
// starts collecting 429s that have nothing to do with what it is asserting.
// Raised here only; production values are untouched, and no test asserts on
// rate limiting (that behaviour is verified against the live deployment).
process.env.AUTH_RATE_LIMIT_MAX = '100000';
process.env.RATE_LIMIT_MAX = '100000';

// The admin portal reaches coupon and roster administration through the
// service-key router, so tests that exercise those endpoints need a key to
// present. The outbound bridge URLs stay empty, so setting this enables the
// inbound routes without pointing anything at a real service.
process.env.INTERNAL_SERVICE_KEY = 'test_internal_key';

/**
 * Boots a real Express app against a throwaway in-memory MongoDB instance
 * (an ephemeral, auto-assigned port per call, so test files running in
 * parallel never collide). Used by the *.integration.test.js files for
 * scenarios the app.smoke.test.js file can't cover - anything that needs to
 * actually read/write data (multi-student isolation, quiz grading, admin
 * RBAC), not just reject unauthenticated requests before touching the DB.
 */
export async function bootTestApp() {
  // Several suites boot a server at once, and mongod's default 10s start
  // window is occasionally missed under that contention - producing a failure
  // that looks like a test failure and is really a resource one. The wait is
  // generous rather than tight; a slow start costs seconds, a spurious failure
  // costs an investigation.
  const mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });

  const { connectDB, disconnectDB } = await import('../../src/config/db.js');
  await connectDB(mongod.getUri());

  const { default: supertest } = await import('supertest');
  const { createApp } = await import('../../src/app.js');
  const app = createApp();
  const request = supertest(app);

  return {
    request,
    async teardown() {
      await disconnectDB();
      await mongod.stop();
    },
  };
}

/**
 * Registers a student and returns an authenticated session.
 *
 * Registration deliberately does NOT issue a session any more - the account
 * stays unverified until the emailed link is opened (see
 * auth.controller.register / validateCredentials' EMAIL_NOT_VERIFIED check),
 * so reading res.body.data.accessToken here yielded `undefined` and every
 * integration test then sent "Bearer undefined" and got 401. Complete the
 * real verification step instead of weakening the check: with no mail
 * transport configured under NODE_ENV=test the API returns the working link
 * as `verificationUrlFallback`, and verifying logs the student straight in.
 */
export async function registerAndLogin(request, { name, email, password = 'TestPass123!', completeProfile = false }) {
  const res = await request.post('/api/auth/register').send({ name, email, password });

  const fallbackUrl = res.body?.data?.verificationUrlFallback;
  if (!fallbackUrl) {
    throw new Error(
      `registerAndLogin: no verificationUrlFallback for ${email} (status ${res.status}). ` +
        'Registration must expose it when the mail transport is unconfigured.'
    );
  }

  const token = new URL(fallbackUrl).searchParams.get('token');
  const verified = await request.post('/api/auth/verify-email').send({ token });

  const session = { accessToken: verified.body.data.accessToken, user: verified.body.data.user };
  if (completeProfile) await completeStudentProfile(request, session);
  return session;
}

const DIGIT_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

/**
 * Completes the student profile a course requires - full name, parent or
 * guardian, class and phone - through the real endpoint.
 *
 * Any suite whose students open course content needs this: an enrolled student
 * whose profile is incomplete is refused that content by design (see
 * services/studentProfile.service.js). The account's own name is kept, except
 * that digits, which a person's name cannot contain, are spelled out - so
 * "Rater 3" becomes "Rater Three".
 */
export async function completeStudentProfile(request, session, overrides = {}) {
  const fullName = String(session.user.name)
    .replace(/\d/g, (d) => ` ${DIGIT_WORDS[Number(d)]}`)
    .replace(/\s+/g, ' ')
    .trim();
  const res = await request
    .put('/api/student/profile/completion')
    .set(bearer(session.accessToken))
    .send({ fullName, guardianName: 'Test Guardian', grade: 'Class 9', phone: '9876543210', ...overrides });
  if (res.status !== 200) {
    throw new Error(`completeStudentProfile: ${res.status} ${JSON.stringify(res.body)}`);
  }
  session.user = { ...session.user, name: fullName };
  return res.body.data;
}

export function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}
