import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

function rateLimitedJson(req, res) {
  res.status(429).json({
    success: false,
    message: 'Too many requests. Please slow down and try again shortly.',
    error: { code: 'RATE_LIMITED' },
  });
}

/** General ceiling applied to the whole API to blunt abusive traffic. */
export const generalLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
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
  handler: rateLimitedJson,
});

export default generalLimiter;
