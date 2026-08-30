import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * The shared rate-limit store.
 *
 * express-rate-limit's default store lives in one process's memory, so a
 * multi-instance deployment counts each instance separately and the real limit
 * becomes the configured one times the instance count. Confirmed live against
 * the deployed teacher API: eight rapid failed logins returned
 * ratelimit-remaining of 19, 19, 18, 17, 18, 17, 16, 15 — climbing back up,
 * which only happens with separate counters.
 *
 * The decisive test here is `two store instances share one counter`: two
 * separately-constructed stores stand in for two Render instances, and a
 * per-process store passes every other test in this file while failing that one.
 */

let mongod;
let MongoRateLimitStore;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  ({ MongoRateLimitStore } = await import('../src/middleware/mongoRateLimitStore.js'));
});

after(async () => {
  await mongoose.connection.close();
  await mongod.stop();
});

beforeEach(async () => {
  await mongoose.connection.collection('ratelimits').deleteMany({});
});

function makeStore(windowMs = 60_000, prefix = 'test') {
  const store = new MongoRateLimitStore({ prefix });
  store.init({ windowMs });
  return store;
}

test('counting starts at one and rises', async () => {
  const store = makeStore();
  assert.equal((await store.increment('ip-a')).totalHits, 1);
  assert.equal((await store.increment('ip-a')).totalHits, 2);
  assert.equal((await store.increment('ip-a')).totalHits, 3);
});

test('different keys are counted separately', async () => {
  const store = makeStore();
  await store.increment('ip-a');
  await store.increment('ip-a');
  assert.equal((await store.increment('ip-b')).totalHits, 1, 'one caller must not spend another caller budget');
});

test('different prefixes never share a counter', async () => {
  const general = makeStore(60_000, 'general');
  const auth = makeStore(60_000, 'auth');

  await general.increment('same-ip');
  await general.increment('same-ip');
  const authHits = await auth.increment('same-ip');

  assert.equal(authHits.totalHits, 1, 'the login limiter must not inherit general API traffic');
});

/**
 * The one that matters. Two independently-constructed stores stand in for two
 * instances behind a load balancer; a per-process store gives each its own
 * count and this assertion fails.
 */
test('two store instances share one counter', async () => {
  const instanceA = makeStore();
  const instanceB = makeStore();

  await instanceA.increment('shared-ip');
  await instanceA.increment('shared-ip');
  const onB = await instanceB.increment('shared-ip');

  assert.equal(onB.totalHits, 3, 'a second instance must continue the count, not restart it');

  const backOnA = await instanceA.increment('shared-ip');
  assert.equal(backOnA.totalHits, 4, 'and the count must never go backwards');
});

test('the count only ever rises within a window', async () => {
  const a = makeStore();
  const b = makeStore();
  const seen = [];
  // Alternating instances is what produced the live 19,19,18,17,18 trace.
  for (let i = 0; i < 8; i += 1) {
    const store = i % 2 === 0 ? a : b;
    seen.push((await store.increment('alternating-ip')).totalHits);
  }
  assert.deepEqual(seen, [1, 2, 3, 4, 5, 6, 7, 8], `expected a monotonic count, saw ${seen.join(',')}`);
});

test('concurrent hits are all counted', async () => {
  const store = makeStore();
  const results = await Promise.all(Array.from({ length: 20 }, () => store.increment('burst-ip')));
  const totals = results.map((r) => r.totalHits).sort((x, y) => x - y);

  assert.equal(new Set(totals).size, 20, 'no two concurrent requests may be handed the same count');
  assert.equal(totals[19], 20, 'and none may be lost');
});

test('a lapsed window starts fresh rather than carrying old hits forward', async () => {
  const store = makeStore(150);
  await store.increment('expiring-ip');
  await store.increment('expiring-ip');

  await new Promise((r) => setTimeout(r, 250));

  const after = await store.increment('expiring-ip');
  assert.equal(after.totalHits, 1, 'the window reset must not depend on the TTL monitor having run');
});

test('a successful request can give its slot back', async () => {
  const store = makeStore();
  await store.increment('decrement-ip');
  await store.increment('decrement-ip');
  await store.decrement('decrement-ip');

  assert.equal((await store.increment('decrement-ip')).totalHits, 2, 'skipSuccessfulRequests depends on this');
});

test('a reset clears the caller entirely', async () => {
  const store = makeStore();
  await store.increment('reset-ip');
  await store.increment('reset-ip');
  await store.resetKey('reset-ip');

  assert.equal((await store.increment('reset-ip')).totalHits, 1);
});

test('resetTime is reported so Retry-After stays accurate', async () => {
  const store = makeStore(60_000);
  const first = await store.increment('retry-ip');
  const second = await store.increment('retry-ip');

  assert.ok(first.resetTime instanceof Date);
  assert.equal(
    second.resetTime.getTime(),
    first.resetTime.getTime(),
    'the window end must not slide forward on every hit, or the limit never arrives'
  );
});
