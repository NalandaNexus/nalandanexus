import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { sendError } from '../utils/ApiResponse.js';
import { buildRateLimitStore, warnIfRateLimitsAreLocal } from './rateLimitStore.js';

const handler = (req, res) =>
  sendError(res, { statusCode: 429, code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' });

warnIfRateLimitsAreLocal();

export const apiLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  // Shared across instances when REDIS_URL is set; falls back to
  // express-rate-limit's per-process default otherwise. See rateLimitStore.js.
  store: buildRateLimitStore('general'),
  handler,
});

export const authLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildRateLimitStore('auth'),
  handler,
  skipSuccessfulRequests: true,
});

export default { apiLimiter, authLimiter };
