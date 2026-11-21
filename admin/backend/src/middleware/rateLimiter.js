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

/*
 * Module-video limits, counted per signed-in administrator (these routes run
 * after authentication). Generous for real work - a 20 GB file needs about 40
 * part-URL requests - and tight enough that a stolen session cannot hammer
 * the student service or the storage provider.
 */
const perAdmin = (req) => `admin:${String(req.admin?._id || req.ip)}`;
const videoLimiter = (prefix, windowMs, max) =>
  rateLimit({ store: new MongoRateLimitStore({ prefix }), windowMs, max, keyGenerator: perAdmin, standardHeaders: true, legacyHeaders: false, handler });

/** Link checks reach YouTube/Google from the student service. */
export const videoInspectLimiter = videoLimiter('video-inspect', 60 * 1000, 60);
/** Opening upload sessions. */
export const videoUploadStartLimiter = videoLimiter('video-upload-start', 60 * 60 * 1000, 30);
/** Part URLs, resume and complete calls while uploading. */
export const videoUploadActivityLimiter = videoLimiter('video-upload-activity', 15 * 60 * 1000, 900);

export default { apiLimiter, authLimiter, videoInspectLimiter, videoUploadStartLimiter, videoUploadActivityLimiter };
