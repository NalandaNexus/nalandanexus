import mongoose from 'mongoose';
import dns from 'node:dns';
import { env } from './env.js';

// Windows dev-machine workaround: Node's bundled DNS resolver sometimes
// falls back to a dead 127.0.0.1 loopback instead of the network adapter's
// real DNS server, even though the OS's own resolver works fine - this
// makes mongodb+srv:// SRV lookups fail with ECONNREFUSED while `nslookup`
// succeeds from the same machine. Only kicks in when that exact broken
// state is detected, so it's a no-op anywhere DNS is already configured
// correctly (e.g. production).
if (dns.getServers().length === 1 && dns.getServers()[0] === '127.0.0.1') {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

mongoose.set('strictQuery', true);

let hasConnectedOnce = false;

/**
 * Connects to MongoDB with a small retry loop so a slow-starting local
 * `mongod` (or a transient Atlas hiccup) doesn't crash the whole process on
 * boot. Logs connection state transitions so issues are easy to diagnose.
 */
export async function connectDatabase({ retries = 5, retryDelayMs = 3000 } = {}) {
  mongoose.connection.on('connected', () => {
    hasConnectedOnce = true;
    console.log(`[db] Mongoose connected -> ${maskUri(env.mongodbUri)}`);
  });
  mongoose.connection.on('error', (err) => {
    console.error('[db] Mongoose connection error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[db] Mongoose disconnected.');
  });
  mongoose.connection.on('reconnected', () => {
    console.log('[db] Mongoose reconnected.');
  });

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await mongoose.connect(env.mongodbUri, {
        serverSelectionTimeoutMS: 8000,
        autoIndex: env.nodeEnv !== 'production',
      });
      return mongoose.connection;
    } catch (err) {
      console.error(`[db] Connection attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt === retries) {
        throw new Error(
          `[db] Could not connect to MongoDB after ${retries} attempts. ` +
            `Check MONGODB_URI in your .env (currently pointing at ${maskUri(env.mongodbUri)}). ` +
            `Original error: ${err.message}`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  return undefined;
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    console.log('[db] Mongoose connection closed gracefully.');
  }
}

export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1 && hasConnectedOnce;
}

function maskUri(uri) {
  try {
    const u = new URL(uri);
    if (u.password) u.password = '****';
    return u.toString();
  } catch {
    return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
  }
}

export default connectDatabase;
