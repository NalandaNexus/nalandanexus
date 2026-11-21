import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { MongoRateLimitStore } from './mongoRateLimitStore.js';

/**
 * Counters are shared across instances (see mongoRateLimitStore.js). The
 * library's default store is per-process, so on a multi-instance deployment the
 * real limit was the configured one times the instance count - confirmed live,
 * with the remaining-count climbing back up between requests.
 *
 * Each limiter gets its own prefix so the general ceiling and the login limiter
 * never share a counter.
 */

function rateLimitedJson(req, res) {
  res.status(429).json({
    success: false,
    message: 'Too many requests. Please slow down and try again shortly.',
    error: { code: 'RATE_LIMITED' },
  });
}

/** General ceiling applied to the whole API to blunt abusive traffic. */
export const generalLimiter = rateLimit({
  store: new MongoRateLimitStore({ prefix: 'general' }),
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
  store: new MongoRateLimitStore({ prefix: 'auth' }),
  windowMs: env.rateLimitWindowMs,
  max: env.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: rateLimitedJson,
});

/**
 * "Forgot password" always answers success (so it cannot reveal who has an
 * account), which means authLimiter - counting only failures - would never stop
 * it. This one counts every request, so the form cannot be used to flood a
 * teacher's inbox or probe addresses at speed. The service also sends at most
 * one email per account per minute on top of this.
 */
export const passwordResetLimiter = rateLimit({
  store: new MongoRateLimitStore({ prefix: 'pwreset' }),
  windowMs: env.rateLimitWindowMs,
  max: env.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitedJson,
});

export default generalLimiter;

/*
 * Module-video limits, counted per signed-in user (these routes always run
 * after authentication), so one teacher's uploads never use up another's.
 * Generous for real work - a 20 GB file needs about 40 part-URL requests -
 * and tight enough that a stolen session cannot hammer the student service
 * or the storage provider.
 */
const perUser = (req) => `user:${String(req.user?._id || req.ip)}`;

/** Link checks reach YouTube/Google from the student service. */
export const videoInspectLimiter = rateLimit({
  store: new MongoRateLimitStore({ prefix: 'video-inspect' }),
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: perUser,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitedJson,
});

/** Opening upload sessions. */
export const videoUploadStartLimiter = rateLimit({
  store: new MongoRateLimitStore({ prefix: 'video-upload-start' }),
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: perUser,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitedJson,
});

/** Part URLs, resume and complete calls while uploading. */
export const videoUploadActivityLimiter = rateLimit({
  store: new MongoRateLimitStore({ prefix: 'video-upload-activity' }),
  windowMs: 15 * 60 * 1000,
  max: 900,
  keyGenerator: perUser,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitedJson,
});
