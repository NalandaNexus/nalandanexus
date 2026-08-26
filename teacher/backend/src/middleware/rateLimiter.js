import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { buildRateLimitStore, warnIfRateLimitsAreLocal } from './rateLimitStore.js';

function rateLimitedJson(req, res) {
  res.status(429).json({
    success: false,
    message: 'Too many requests. Please slow down and try again shortly.',
    error: { code: 'RATE_LIMITED' },
  });
}

warnIfRateLimitsAreLocal();

/** General ceiling applied to the whole API to blunt abusive traffic. */
export const generalLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  // Shared across instances when REDIS_URL is set; falls back to
  // express-rate-limit's per-process default otherwise. See rateLimitStore.js.
  store: buildRateLimitStore('general'),
  handler: rateLimitedJson,
});

/**
 * Tighter limiter for the login route specifically, to slow down
 * brute-force password guessing without punishing normal API usage.
 */
export const authLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  store: buildRateLimitStore('auth'),
  handler: rateLimitedJson,
});

export default generalLimiter;
