import mongoose from 'mongoose';

/**
 * A rate-limit store that every instance shares, backed by the MongoDB this
 * service is already connected to.
 *
 * express-rate-limit defaults to an in-memory store, which is per-process. On a
 * platform that runs more than one instance behind a load balancer that means
 * each instance counts separately, so the effective limit is the configured one
 * multiplied by however many instances happen to be running. Confirmed live
 * against the deployed teacher API: eight rapid failed logins returned
 * ratelimit-remaining of 19, 19, 18, 17, 18, 17, 16, 15 - the counter climbing
 * back UP, which is only possible with separate counters. Brute-force
 * protection was diluted accordingly.
 *
 * Mongo rather than Redis deliberately: Atlas is already a hard dependency of
 * every one of these services, so this needs no new infrastructure, no new
 * credentials and no new failure mode. `$inc` inside findOneAndUpdate is a
 * single atomic document update, which is exactly the guarantee a shared
 * counter needs.
 *
 * Expiry is handled two ways on purpose. A TTL index eventually removes old
 * documents, but Mongo's TTL monitor only runs about once a minute, so a
 * document can outlive its window; every read therefore also compares
 * `expiresAt` and starts a fresh window when the stored one has passed. The
 * index is for cleanup, not for correctness.
 */

const COLLECTION = 'ratelimits';

// Identifies this process, so a health probe can reveal how many containers are
// actually serving traffic - a question the platform does not otherwise answer.
const INSTANCE_ID = `${process.pid.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

let indexReady = null;

function collection() {
  const conn = mongoose.connection;
  if (!conn || conn.readyState !== 1) return null;
  return conn.collection(COLLECTION);
}

/** Created once, lazily — the store is constructed before the connection is up. */
async function ensureIndex(col) {
  if (!indexReady) {
    indexReady = col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch((err) => {
      // A failed index build must not take the API down; the expiresAt check
      // below still enforces the window correctly, documents just linger.
      console.error('[rateLimit] Could not create TTL index:', err.message);
      indexReady = null;
    });
  }
  return indexReady;
}

export class MongoRateLimitStore {
  constructor({ prefix = 'rl' } = {}) {
    this.prefix = prefix;
    this.windowMs = 60_000;
  }

  /** express-rate-limit hands the store its window at startup. */
  init(options) {
    this.windowMs = options.windowMs;
  }

  key(key) {
    return `${this.prefix}:${key}`;
  }

  async increment(key) {
    const col = collection();
    // No database means no counter. Refusing the request here would take the
    // whole API down over a dependency that is already required for anything
    // useful to happen, so the request proceeds and the failure is loud in the
    // logs rather than silent.
    if (!col) {
      console.error('[rateLimit] Database unavailable — request not counted.');
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
    }
    await ensureIndex(col);

    const _id = this.key(key);

    // Three atomic steps, retried, because opening a window is itself a race.
    //
    // An earlier version fell back to an upsert that SET hits to 1 whenever no
    // live window matched. Under a burst at window start every concurrent
    // request took that branch and overwrote the others, so twenty simultaneous
    // attempts recorded about three - reopening the very brute-force hole this
    // store exists to close. Caught by the concurrency test, not by reasoning.
    //
    // Each step below either wins outright or loses cleanly to another racer
    // and re-reads, so no path ever writes a count it did not derive.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const now = new Date();

      // 1. A live window exists: just add to it.
      const bumped = await col.findOneAndUpdate(
        { _id, expiresAt: { $gt: now } },
        { $inc: { hits: 1 } },
        { returnDocument: 'after' }
      );
      const doc = bumped?.value ?? bumped;
      if (doc?.expiresAt) return { totalHits: doc.hits, resetTime: doc.expiresAt };

      const expiresAt = new Date(now.getTime() + this.windowMs);

      // 2. A lapsed window exists: exactly one racer can match `$lte: now`,
      //    because the winner pushes expiresAt into the future. Everyone else
      //    falls through and increments on the next pass.
      const revived = await col.findOneAndUpdate(
        { _id, expiresAt: { $lte: now } },
        { $set: { hits: 1, expiresAt } },
        { returnDocument: 'after' }
      );
      if ((revived?.value ?? revived)?.expiresAt) return { totalHits: 1, resetTime: expiresAt };

      // 3. No document at all. insertOne is atomic on _id, so exactly one racer
      //    creates it and the rest get a duplicate-key error and loop back to
      //    step 1 - where the document now exists and they increment it.
      try {
        await col.insertOne({ _id, hits: 1, expiresAt });
        return { totalHits: 1, resetTime: expiresAt };
      } catch (err) {
        if (err?.code !== 11000) throw err;
      }
    }

    // Losing five consecutive races is not realistic; counting the request is
    // the safe direction if it somehow happens.
    console.error('[rateLimit] Could not settle a counter for', _id);
    return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
  }

  async decrement(key) {
    const col = collection();
    if (!col) return;
    // Used by skipSuccessfulRequests: a successful login gives its slot back.
    await col.updateOne({ _id: this.key(key), hits: { $gt: 0 } }, { $inc: { hits: -1 } });
  }

  async resetKey(key) {
    const col = collection();
    if (!col) return;
    await col.deleteOne({ _id: this.key(key) });
  }
}

/**
 * Reports whether the shared counter is actually reachable from THIS instance,
 * and which instance answered.
 *
 * The store degrades quietly by design - if the database is unreachable it lets
 * the request through rather than taking the API down over rate limiting. That
 * is the right trade, but it makes a broken store indistinguishable from a
 * working one from outside, which is exactly the position this deployment ended
 * up in: counters demonstrably not shared, with no way to tell whether the store
 * was failing or whether several containers were serving.
 *
 * `instanceId` is per-process, so repeated calls that return different ids prove
 * how many containers are live - the other half of the same question.
 */
export async function probeStore() {
  const col = collection();
  if (!col) return { reachable: false, reason: 'DATABASE_NOT_CONNECTED', instanceId: INSTANCE_ID };
  try {
    const key = `probe:${INSTANCE_ID}`;
    const expiresAt = new Date(Date.now() + 60_000);
    await col.updateOne({ _id: key }, { $set: { hits: 1, expiresAt } }, { upsert: true });
    const found = await col.findOne({ _id: key });
    await col.deleteOne({ _id: key });
    return { reachable: Boolean(found), instanceId: INSTANCE_ID, collection: COLLECTION };
  } catch (err) {
    return { reachable: false, reason: err.message, instanceId: INSTANCE_ID };
  }
}

export default MongoRateLimitStore;
