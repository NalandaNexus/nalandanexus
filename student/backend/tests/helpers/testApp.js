import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
process.env.CLIENT_URL = 'http://localhost:3000';

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
  return { accessToken: res.body.data.accessToken, user: res.body.data.user };
}

export function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}
