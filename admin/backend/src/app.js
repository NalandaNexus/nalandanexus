import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import morgan from 'morgan';
import { env } from './config/env.js';
import { isDatabaseConnected } from './config/db.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { UPLOADS_ROOT } from './middleware/upload.js';
import adminRoutes from './routes/index.js';
import internalRoutes from './routes/internal.routes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  // crossOriginResourcePolicy defaults to 'same-origin', which would block
  // a browser (not curl/server-to-server calls, which ignore it) from
  // loading /uploads/courses/* images embedded on a different origin
  // (admin frontend :5175, student frontend/Landing Page) - these files are
  // intentionally public course catalog assets, so this is loosened
  // specifically for that, not a blanket "disable helmet" choice.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  // Never `cors({ origin: '*' })` for an authenticated app — restricted to
  // the one known admin frontend origin, with credentials for the cookie
  // fallback auth path.
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  // Skip gzip for the SSE telemetry stream — compression buffers chunks
  // waiting for a full block before flushing, which stalls res.write()
  // event delivery indefinitely on a long-lived text/event-stream response.
  app.use(compression({ filter: (req, res) => !req.path.includes('live-telemetry') && compression.filter(req, res) }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(mongoSanitize());
  if (env.nodeEnv !== 'test') app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
  app.use(apiLimiter);

  // Static file serving for local-disk course cover images — see middleware/upload.js.
  app.use('/uploads', express.static(UPLOADS_ROOT));

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'nalanda-admin-backend',
      database: isDatabaseConnected() ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/admin', adminRoutes);
  app.use('/api/internal', internalRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
