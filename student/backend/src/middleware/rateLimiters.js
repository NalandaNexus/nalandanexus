import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { sendError } from '../utils/apiResponse.js';

function handler(res) {
  return sendError(res, { status: 429, code: 'RATE_LIMITED', message: 'Too many requests. Please slow down and try again shortly.' });
}

export const generalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMin * 60 * 1000,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => handler(res),
});

// Tighter limiter for auth endpoints (login/register/forgot-password) to
// blunt credential stuffing / enumeration / brute force attempts.
export const authLimiter = rateLimit({
  windowMs: env.rateLimit.windowMin * 60 * 1000,
  max: env.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => handler(res),
});
