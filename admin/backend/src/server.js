import http from 'http';
import { env, assertEnv } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { createApp } from './app.js';
import { initSockets } from './sockets/index.js';

async function main() {
  assertEnv();
  await connectDatabase();

  const app = createApp();
  const httpServer = http.createServer(app);
  initSockets(httpServer);

  httpServer.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] Nalanda Admin API listening on port ${env.port} (${env.nodeEnv})`);
  });

  const shutdown = async (signal) => {
    // eslint-disable-next-line no-console
    console.log(`[server] Received ${signal}, shutting down gracefully...`);
    httpServer.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});
