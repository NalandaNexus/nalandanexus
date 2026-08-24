import mongoose from 'mongoose';
import dns from 'node:dns';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

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

let isConnected = false;

export async function connectDB(uriOverride) {
  const uri = uriOverride || env.mongoUri;

  mongoose.connection.on('connected', () => {
    isConnected = true;
    logger.info(`[MongoDB] Connected -> ${maskUri(uri)}`);
  });

  mongoose.connection.on('error', (err) => {
    logger.error('[MongoDB] Connection error', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    logger.warn('[MongoDB] Disconnected');
  });

  // Do not let the server run silently against a broken DB.
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000,
  });

  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
  isConnected = false;
}

export function isDbConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

function maskUri(uri) {
  try {
    const url = new URL(uri.replace('mongodb+srv://', 'https://').replace('mongodb://', 'http://'));
    if (url.password) url.password = '****';
    if (url.username) url.username = '****';
    return url.toString();
  } catch {
    return 'mongodb://***';
  }
}
