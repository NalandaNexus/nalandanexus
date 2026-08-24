import dotenv from 'dotenv';

dotenv.config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: Number(process.env.PORT) || 5001,
  // Matches frontend/vite.config.js's configured dev server port (3000),
  // not Vite's own default of 5173 - this project pins a custom port.
  // Accepts a comma-separated list (e.g. "https://app.example.com,https://staging.example.com")
  // so a staging + production frontend can share one backend deployment.
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:3000')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean),

  mongoUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/nalanda_nexus'),

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev_access_secret_change_me'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev_refresh_secret_change_me'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  passwordReset: {
    expiresMinutes: Number(process.env.PASSWORD_RESET_TOKEN_EXPIRES_MIN) || 30,
  },

  emailVerification: {
    expiresMinutes: Number(process.env.EMAIL_VERIFICATION_TOKEN_EXPIRES_MIN) || 24 * 60,
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
    mockMode: process.env.PAYMENTS_MOCK_MODE === 'true' || process.env.NODE_ENV === 'test',
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'Nalanda Nexus <no-reply@nalandanexus.edu>',
  },

  support: {
    // Where a submitted Help & Support ticket is emailed - kept in an env
    // var rather than hardcoded so it can be changed without a code
    // deploy, and never exposed to the frontend (this backend sends the
    // email itself; the browser never sees this address or any SMTP
    // credential).
    notifyEmail: process.env.SUPPORT_NOTIFICATION_EMAIL || '',
  },

  rateLimit: {
    windowMin: Number(process.env.RATE_LIMIT_WINDOW_MIN) || 15,
    max: Number(process.env.RATE_LIMIT_MAX) || 300,
    authMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  },

  // Service-to-service bridge: lets the (separate) teacher backend deliver
  // a published announcement here without a student-portal user session.
  // See middleware/internalService.js and routes/internal.routes.js. Empty
  // by default, which makes every /api/internal/* route respond
  // INTERNAL_NOT_CONFIGURED rather than silently accepting unauthenticated
  // writes.
  internal: {
    serviceKey: process.env.INTERNAL_SERVICE_KEY || '',
  },

  // Outbound half of the bidirectional messaging bridge: lets a student's
  // message reach the (separate) teacher backend's own real-time inbox
  // rather than only living in this database. Reuses the same shared
  // secret as the inbound side (INTERNAL_SERVICE_KEY) since teacher/backend's
  // requireInternalServiceKey doesn't distinguish callers either. Empty
  // TEACHER_BACKEND_URL disables the bridge (message still saves locally).
  teacherBridge: {
    url: process.env.TEACHER_BACKEND_URL || '',
    serviceKey: process.env.INTERNAL_SERVICE_KEY || '',
  },

  // Outbound: lets a real, signature-verified Razorpay payment reach
  // admin/backend's payment ledger (a separate service/database) instead of
  // only living here. Reuses the same shared secret as every other
  // internal bridge in this system. Empty ADMIN_BACKEND_URL disables the
  // bridge (the payment still saves/verifies locally either way).
  adminBridge: {
    url: process.env.ADMIN_BACKEND_URL || '',
    serviceKey: process.env.INTERNAL_SERVICE_KEY || '',
  },
};

// Fail fast in production if secrets were left at insecure defaults.
if (env.isProd) {
  const insecureDefaults = ['dev_access_secret_change_me', 'dev_refresh_secret_change_me'];
  if (insecureDefaults.includes(env.jwt.accessSecret) || insecureDefaults.includes(env.jwt.refreshSecret)) {
    throw new Error('JWT secrets must be set via environment variables in production.');
  }
}

// A specific MongoDB Atlas credential was accidentally committed to
// .env.example during development and is treated as permanently
// compromised. Refuse to boot with it in production so a forgotten rotation
// can never silently ship - if you see this error, rotate the database
// password in Atlas and update MONGODB_URI.
const KNOWN_LEAKED_MONGO_PASSWORD_FRAGMENT = 'DOWsQxVl28LF0PPO';
if (env.isProd && env.mongoUri.includes(KNOWN_LEAKED_MONGO_PASSWORD_FRAGMENT)) {
  throw new Error(
    'MONGODB_URI still uses a database password that was previously exposed in .env.example. ' +
      'Rotate the password in MongoDB Atlas and update MONGODB_URI before starting in production.'
  );
}

// Live Razorpay keys should never be exercised from a non-production
// environment - refuse to boot rather than risk a developer accidentally
// processing a real charge against a local/staging run. Set
// PAYMENTS_MOCK_MODE=true or use rzp_test_ keys for local development.
if (!env.isProd && env.razorpay.keyId.startsWith('rzp_live_') && !env.razorpay.mockMode) {
  throw new Error(
    'RAZORPAY_KEY_ID is a live production key but NODE_ENV is not "production" and ' +
      'PAYMENTS_MOCK_MODE is not "true". Refusing to start to avoid processing real charges ' +
      'from a non-production environment. Use rzp_test_ keys for local development, or set ' +
      'PAYMENTS_MOCK_MODE=true.'
  );
}
