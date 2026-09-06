import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';

import { env } from './config/env.js';
import { generalLimiter } from './middleware/rateLimiters.js';
import { notFoundHandler, globalErrorHandler } from './middleware/errorHandler.js';
import { asyncHandler } from './utils/asyncHandler.js';
import { sendSuccess, sendError } from './utils/apiResponse.js';
import { isDbConnected } from './config/db.js';
import { getStoredFile } from './services/fileStorage.service.js';

import authRoutes from './routes/auth.routes.js';
import publicRoutes from './routes/public.routes.js';
import studentRoutes from './routes/student.routes.js';
import courseRoutes from './routes/courses.routes.js';
import taskRoutes from './routes/task.routes.js';
import quizRoutes from './routes/quiz.routes.js';
import leaderboardRoutes from './routes/leaderboard.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import couponRoutes from './routes/coupon.routes.js';
import adminRoutes from './routes/admin.routes.js';
import internalRoutes from './routes/internal.routes.js';
import { razorpayWebhook } from './controllers/payment.controller.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  // Security headers
  app.use(helmet());

  // CORS - only the configured client origin(s), with credentials for httpOnly cookies.
  // CLIENT_URL may be a comma-separated list (see config/env.js) to support
  // e.g. a staging + production frontend sharing one backend.
  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin/non-browser requests (curl, server-to-server) send no Origin header - allow.
        if (!origin || env.clientUrls.includes(origin)) {
          return callback(null, true);
        }
        // Tagged so the global error handler can answer 403 instead of a
        // misleading 500 - a disallowed origin is a rejected request, not a
        // server fault, and a 500 here also makes real outages harder to spot
        // in logs/monitoring.
        const err = new Error('Not allowed by CORS');
        err.isCorsError = true;
        return callback(err);
      },
      credentials: true,
    })
  );

  // Razorpay webhook needs the RAW body for HMAC signature verification,
  // so it must be registered before express.json() parses the body.
  app.post(
    '/api/payments/webhook',
    express.raw({ type: 'application/json' }),
    (req, res, next) => {
      req.rawBody = req.body?.toString('utf8') || '';
      try {
        req.body = req.rawBody ? JSON.parse(req.rawBody) : {};
      } catch {
        req.body = {};
      }
      next();
    },
    razorpayWebhook
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(mongoSanitize()); // strips $ / . operators from user input (NoSQL injection prevention)

  if (env.nodeEnv !== 'test') {
    app.use(morgan(env.isProd ? 'combined' : 'dev'));
  }

  app.use('/api', generalLimiter);

  // Uploads are served from MongoDB, not the local filesystem - Render's disk
  // is ephemeral and used to lose every avatar on each redeploy. The stored
  // contentType comes from the validated mimetype at upload time, and nosniff
  // stops a browser from re-interpreting the bytes as anything else, so a file
  // whose *content* is HTML still cannot execute.
  app.get(
    '/uploads/avatars/:key',
    asyncHandler(async (req, res) => {
      const file = await getStoredFile(req.params.key);
      if (!file) {
        return sendError(res, { status: 404, code: 'FILE_NOT_FOUND', message: 'File not found.' });
      }
      // setHeader, not res.set: Express's setter appends "; charset=utf-8" to
      // the content type, which is meaningless on binary image data.
      res.setHeader('Content-Type', file.contentType);
      res.setHeader('Content-Length', String(file.data.length));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.end(file.data);
    })
  );

  app.get(
    '/api/health',
    asyncHandler(async (req, res) => {
      return sendSuccess(res, {
        message: 'Nalanda Student Backend is healthy.',
        data: {
          service: 'nalanda-student-backend',
          status: 'healthy',
          database: isDbConnected() ? 'connected' : 'disconnected',
          timestamp: new Date().toISOString(),
        },
      });
    })
  );

  app.use('/api/auth', authRoutes);
  app.use('/api/public', publicRoutes);
  // NOTE: more specific /api/student/* sub-routers are registered before the
  // generic /api/student router so Express matches them first (avoids
  // falling through studentRoutes' own auth middleware for every request).
  app.use('/api/student/courses', courseRoutes);
  app.use('/api/student/tasks', taskRoutes);
  app.use('/api/student/quizzes', quizRoutes);
  app.use('/api/student', studentRoutes);
  app.use('/api/leaderboard', leaderboardRoutes);
  app.use('/api/payments', paymentRoutes);
  // Beside payments, not inside it: the Razorpay routes above are unchanged.
  app.use('/api/coupons', couponRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/internal', internalRoutes);

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}
