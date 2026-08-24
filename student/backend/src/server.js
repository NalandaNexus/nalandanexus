import http from 'node:http';
import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { initSocket } from './sockets/index.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { startQuizExpirySweep } from './jobs/quizExpirySweep.job.js';
import { startLiveClassStatusSweep } from './jobs/liveClassStatusSweep.job.js';

async function main() {
  try {
    await connectDB();
  } catch (err) {
    logger.error('[Startup] Failed to connect to MongoDB. The server will not start against a broken DB state.', err.message);
    process.exit(1);
  }

  const app = createApp();
  const httpServer = http.createServer(app);
  initSocket(httpServer);
  startQuizExpirySweep();
  startLiveClassStatusSweep();

  httpServer.listen(env.port, () => {
    logger.info(`Nalanda Student Backend running on http://localhost:${env.port} (${env.nodeEnv})`);
  });

  const shutdown = async (signal) => {
    logger.info(`[Shutdown] Received ${signal}, closing gracefully...`);
    httpServer.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    // Force-exit if graceful shutdown hangs.
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error('[UnhandledRejection]', reason);
  });
}

main();
