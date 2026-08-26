import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
process.env.CLIENT_URL = 'http://localhost:3000';
// config/env.js calls dotenv.config(), and dotenv fills in any variable this
// file has not already claimed - so without this the suite silently picks up
// the developer's real SMTP credentials and every registration in every test
// makes a live connection attempt to Gmail. Pinning it empty keeps the tests
// hermetic (and fast: it was costing ~45s a run), and puts sendEmail on its
// stub path so registration always returns verificationUrlFallback.
process.env.SMTP_HOST = '';

/**
 * Boots a real Express app against a throwaway in-memory MongoDB instance
 * (an ephemeral, auto-assigned port per call, so test files running in
 * parallel never collide). Used by the *.integration.test.js files for
 * scenarios the app.smoke.test.js file can't cover - anything that needs to
 * actually read/write data (multi-student isolation, quiz grading, admin
 * RBAC), not just reject unauthenticated requests before touching the DB.
 */
export async function bootTestApp() {
  const mongod = await MongoMemoryServer.create();

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

export async function registerAndLogin(request, { name, email, password = 'TestPass123!' }) {
  const res = await request.post('/api/auth/register').send({ name, email, password });
  if (res.status !== 201) {
    throw new Error(`registerAndLogin: register failed (${res.status}) ${JSON.stringify(res.body)}`);
  }

  // Registration deliberately issues no session any more - the account exists
  // but login is refused until the student proves ownership of the address
  // (auth.controller.js register / validateCredentials EMAIL_NOT_VERIFIED).
  // Walk the real verification endpoint rather than flipping isVerified
  // behind the app's back, so these tests keep exercising the actual flow.
  const fallbackUrl = res.body.data?.verificationUrlFallback;
  if (!fallbackUrl) {
    throw new Error('registerAndLogin: no verificationUrlFallback - is SMTP stubbed for tests?');
  }
  const token = new URL(fallbackUrl).searchParams.get('token');

  const verified = await request.post('/api/auth/verify-email').send({ token });
  if (verified.status !== 200) {
    throw new Error(`registerAndLogin: verify-email failed (${verified.status}) ${JSON.stringify(verified.body)}`);
  }

  return { accessToken: verified.body.data.accessToken, user: verified.body.data.user };
}

export function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}
