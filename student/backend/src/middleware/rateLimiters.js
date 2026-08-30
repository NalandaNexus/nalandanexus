import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { sendError } from '../utils/apiResponse.js';

import { MongoRateLimitStore } from './mongoRateLimitStore.js';

/**
 * Counters are shared across instances (see mongoRateLimitStore.js). The
 * library's default store is per-process, so on a multi-instance deployment the
 * real limit was the configured one multiplied by the instance count. Each
 * limiter gets its own prefix so they never share a counter.
 */

function handler(res) {
  return sendError(res, { status: 429, code: 'RATE_LIMITED', message: 'Too many requests. Please slow down and try again shortly.' });
}

export const generalLimiter = rateLimit({
  store: new MongoRateLimitStore({ prefix: 'general' }),
  windowMs: env.rateLimit.windowMin * 60 * 1000,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => handler(res),
});

// Tighter limiter for auth endpoints (login/register/forgot-password) to
// blunt credential stuffing / enumeration / brute force attempts.
export const authLimiter = rateLimit({
  store: new MongoRateLimitStore({ prefix: 'auth' }),
  windowMs: env.rateLimit.windowMin * 60 * 1000,
  max: env.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => handler(res),
});
