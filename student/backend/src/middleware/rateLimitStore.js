import { createClient } from 'redis';
import { RedisStore } from 'rate-limit-redis';
import { logger } from '../utils/logger.js';

/**
 * Shared rate-limit store.
 *
 * express-rate-limit's default store lives in the process's own memory. That
 * is fine for one instance and useless for several: this service runs more
 * than one on Render, each keeps a separate counter, and the effective limit
 * becomes (configured limit x instance count). Measured on production before
 * this existed: 26 consecutive failed logins produced zero 429s, and the
 * `ratelimit-reset` header cycled through three independent countdowns -
 * three separate stores answering in turn. Brute-force protection was
 * essentially decorative.
 *
 * Pointing REDIS_URL at any shared Redis fixes it, because every instance
 * then increments the same counter.
 *
 * Deliberately degrades rather than refusing to boot when REDIS_URL is
 * unset: rate limiting is a safeguard, not a dependency, and taking the
 * whole API down because a cache is missing would be the worse failure. The
 * warning below is loud so the degraded state can't pass unnoticed. The
 * client is also configured to keep retrying rather than throwing, so a
 * Redis blip degrades throughput instead of failing requests.
 */

let client = null;
let connectPromise = null;

function getClient() {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  if (!client) {
    client = createClient({
      url,
      socket: {
        connectTimeout: 5000,
        // Cap the backoff so a long outage doesn't stretch to minutes
        // between attempts; returning a number (never an Error) keeps
        // node-redis retrying instead of giving up permanently.
        reconnectStrategy: (retries) => Math.min(retries * 200, 3000),
      },
    });

    // node-redis emits 'error' on every failed reconnect. Without a listener
    // that becomes an unhandled 'error' event, which takes the process down -
    // exactly the outage this module is supposed to avoid.
    client.on('error', (err) => {
      logger.error('[RateLimit] Redis connection error', err.message);
    });
    client.on('ready', () => {
      logger.info('[RateLimit] Redis connected - rate limits are now shared across instances.');
    });

    connectPromise = client.connect().catch((err) => {
      logger.error('[RateLimit] Redis initial connect failed; limits stay per-instance.', err.message);
    });
  }

  return client;
}

/**
 * Returns a store for express-rate-limit, or undefined to let it use its own
 * in-memory default. Each limiter needs its own prefix so the general and
 * auth limiters don't share a counter.
 */
export function buildRateLimitStore(prefix) {
  const redisClient = getClient();
  if (!redisClient) return undefined;

  return new RedisStore({
    prefix: `rl:${prefix}:`,
    // rate-limit-redis drives the client through this one call.
    sendCommand: async (...args) => {
      await connectPromise;
      return redisClient.sendCommand(args);
    },
  });
}

/** Logged once at boot so a degraded deployment is visible in the logs. */
export function warnIfRateLimitsAreLocal() {
  if (!process.env.REDIS_URL) {
    logger.warn(
      '[RateLimit] REDIS_URL is not set - rate limits are per-process. If this service runs ' +
        'more than one instance, the effective limit is multiplied by the instance count and ' +
        'brute-force protection is weaker than configured.'
    );
  }
}

export default { buildRateLimitStore, warnIfRateLimitsAreLocal };
