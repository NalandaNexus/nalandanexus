import { MongoMemoryServer } from 'mongodb-memory-server';

// Must be set before config/env.js is imported, since it reads process.env
// at module load and refuses to boot without JWT_SECRET.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_teacher_secret_not_used_anywhere_real';
process.env.CLIENT_URL = 'http://localhost:5174';
// config/env.js calls dotenv.config(), which fills in anything this file has
// not already claimed - without pinning these, the suite would pick up the
// developer's real SMTP credentials and cross-portal bridge URLs and start
// making live network calls during tests.
process.env.SMTP_HOST = '';
process.env.STUDENT_BACKEND_URL = '';
process.env.ADMIN_BACKEND_URL = '';

/**
 * Boots the real Express app against a throwaway in-memory MongoDB.
 * Mirrors student/backend's equivalent helper.
 */
export async function bootTestApp() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('nalanda_teacher_test');

  const { connectDatabase, disconnectDatabase } = await import('../../src/config/db.js');
  await connectDatabase({ retries: 1, retryDelayMs: 0 });

  const { default: supertest } = await import('supertest');
  const { createApp } = await import('../../src/app.js');

  return {
    request: supertest(createApp()),
    async teardown() {
      await disconnectDatabase();
      await mongod.stop();
    },
  };
}

export default bootTestApp;
