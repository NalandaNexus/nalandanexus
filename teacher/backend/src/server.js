import http from 'node:http';
import { env, assertEnv } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { createApp } from './app.js';
import { initSockets } from './sockets/index.js';
import { startAnnouncementScheduler } from './jobs/announcementScheduler.job.js';

assertEnv();

const app = createApp();
const httpServer = http.createServer(app);
initSockets(httpServer);

let isShuttingDown = false;
let schedulerTimer = null;

async function start() {
  await connectDatabase();

  httpServer.listen(env.port, () => {
    console.log(`Nalanda Teacher Backend running on http://localhost:${env.port} [${env.nodeEnv}]`);
    console.log(`CORS origin: ${env.clientUrl}`);
  });

  schedulerTimer = startAnnouncementScheduler();
}

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[server] Received ${signal}, shutting down gracefully...`);

  const forceExitTimer = setTimeout(() => {
    console.error('[server] Graceful shutdown timed out, forcing exit.');
    process.exit(1);
  }, 10000);

  httpServer.close(async () => {
    try {
      if (schedulerTimer) clearInterval(schedulerTimer);
      await disconnectDatabase();
      clearTimeout(forceExitTimer);
      console.log('[server] Shutdown complete.');
      process.exit(0);
    } catch (err) {
      console.error('[server] Error during shutdown:', err);
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception:', err);
  shutdown('uncaughtException');
});

start().catch((err) => {
  console.error('[server] Fatal startup error:', err.message);
  process.exit(1);
});

export default httpServer;
