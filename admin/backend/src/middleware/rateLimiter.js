import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { sendError } from '../utils/ApiResponse.js';

import { MongoRateLimitStore } from './mongoRateLimitStore.js';

/**
 * Counters are shared across instances (see mongoRateLimitStore.js). The
 * library's default store is per-process, so on a multi-instance deployment the
 * real limit was the configured one multiplied by the instance count. Each
 * limiter gets its own prefix so they never share a counter.
 */

const handler = (req, res) =>
  sendError(res, { statusCode: 429, code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' });

export const apiLimiter = rateLimit({
  store: new MongoRateLimitStore({ prefix: 'general' }),
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

export const authLimiter = rateLimit({
  store: new MongoRateLimitStore({ prefix: 'auth' }),
  windowMs: env.rateLimitWindowMs,
  max: env.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  skipSuccessfulRequests: true,
});

export default { apiLimiter, authLimiter };
