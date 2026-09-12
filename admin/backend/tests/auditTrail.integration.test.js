import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * The audit trail records what it is given.
 *
 * recordAuditLog deliberately swallows its own errors so a failed audit write
 * cannot fail the action it describes. That is right, and it is also why a
 * silent drop is so dangerous: entityId is an ObjectId, and every entry that
 * identified something by slug or code - a course being retagged, a stage's
 * requirements, the GLOBAL rules document - failed the cast and vanished
 * without a trace in production.
 *
 * These are the exact identities the progression features use.
 */

let mongod;
let AuditLog;
let recordAuditLog;

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'audit_test_secret';
  process.env.CLIENT_URL = 'http://localhost:5175';

  const { connectDatabase } = await import('../src/config/db.js');
  await connectDatabase();
  ({ AuditLog } = await import('../src/models/AuditLog.js'));
  ({ recordAuditLog } = await import('../src/services/auditLog.service.js'));
});

after(async () => {
  const mongoose = (await import('mongoose')).default;
  await mongoose.connection.close();
  await mongod.stop();
});

const actor = { _id: '0123456789abcdef01234567', name: 'Test Admin', role: 'SUPER_ADMIN' };

test('an entity identified by slug or code is recorded, not dropped', async () => {
  const cases = [
    ['course.subjects.updated', 'Course', 'prarambh'],
    ['progression.rules.updated', 'ProgressionRules', 'GLOBAL'],
    ['progression.stage.updated', 'Stage', 'PRARAMBH'],
    ['progression.achievement.updated', 'Achievement', 'VOICE_OF_CONFIDENCE'],
    ['progression.recalculated', 'StudentProfile', 'BATCH'],
  ];

  for (const [action, entityType, entityId] of cases) {
    const entry = await recordAuditLog({ actor, action, entityType, entityId, metadata: { note: 'x' } });
    assert.ok(entry, `${action} must produce an entry`);

    const stored = await AuditLog.findById(entry._id).lean();
    assert.equal(stored.action, action);
    assert.equal(stored.entityRef, entityId, 'the identity is preserved verbatim');
    assert.equal(stored.actorName, 'Test Admin', 'and so is who did it');
  }
});

test('an ObjectId identity still lands in entityId', async () => {
  const id = '0123456789abcdef01234567';
  const entry = await recordAuditLog({ actor, action: 'coupon.campaign.created', entityType: 'CouponCampaign', entityId: id });

  const stored = await AuditLog.findById(entry._id).lean();
  assert.equal(String(stored.entityId), id, 'still a real reference, not downgraded to a string');
  assert.equal(stored.entityRef, undefined, 'and not duplicated into the text field');
});

test('a failed audit write never fails the action it describes', async () => {
  // The swallow is deliberate; what was wrong was how much it was swallowing.
  const entry = await recordAuditLog({ actor, action: 'x'.repeat(5000), entityType: null, entityId: null });
  assert.equal(entry, null, 'reports failure by returning null rather than throwing');
});
