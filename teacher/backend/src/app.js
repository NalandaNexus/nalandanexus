import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';

import { env } from './config/env.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { UPLOADS_ROOT } from './middleware/upload.js';
import { isDatabaseConnected } from './config/db.js';
import apiRoutes from './routes/index.js';
import internalRoutes from './routes/internal.routes.js';

export function createApp() {
  const app = express();

  // Render correct client IPs behind a proxy/load balancer (needed for rate limiting to key on real IPs).
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.clientUrl,
      credentials: true,
    })
  );
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());
  // Strips any keys starting with '$' or containing '.' from req.body/query/params — blocks Mongo operator injection.
  app.use(mongoSanitize());

  if (env.nodeEnv !== 'test') {
    app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
  }

  app.use(generalLimiter);

  // Static file serving for local-disk uploads (avatars/resources/assignments) — see middleware/upload.js.
  app.use('/uploads', express.static(UPLOADS_ROOT));

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'Nalanda Faculty & Teacher Backend',
      database: isDatabaseConnected() ? 'connected' : 'disconnected',
      // Which build is answering. Without it, confirming a deploy meant
      // comparing frontend bundle hashes and authenticating, because every
      // guarded route answers 401 before routing and so cannot be probed.
      // Render sets RENDER_GIT_COMMIT; 'unknown' where it is not set.
      commit: (process.env.RENDER_GIT_COMMIT || 'unknown').slice(0, 7),
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/teacher', apiRoutes);
  app.use('/api/internal', internalRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
