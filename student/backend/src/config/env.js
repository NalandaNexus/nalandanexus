import dotenv from 'dotenv';

// A test run never reads this machine's .env. Tests configure what they use
// themselves, and a developer's .env names real databases, deployed services
// and service keys - loaded underneath a test, it would quietly point whatever
// the test does not override at production.
if (process.env.NODE_ENV !== 'test') dotenv.config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  return value;
}

// A trailing slash here (easy to introduce when pasting a URL straight from
// a browser address bar into Render's dashboard) breaks CORS outright: the
// browser's real Origin header never has a trailing slash, but the exact-match
// check below (env.clientUrls.includes(origin)) would then never match, so
// every cross-origin request - including the login preflight - gets silently
// rejected by the browser. Confirmed as the actual root cause of the same bug
// on admin/backend and teacher/backend; stripped here too so deploy-time URL
// formatting can't take down auth.
function stripTrailingSlash(url) {
  return url.replace(/\/+$/, '');
}

// Parsed once: CLIENT_URL is a comma-separated list of allowed browser
// origins. Trailing slashes are stripped because a real Origin header never
// carries one, so "https://x.com/" would match nothing.
const CLIENT_URLS = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((u) => stripTrailingSlash(u.trim()))
  .filter(Boolean);

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: Number(process.env.PORT) || 5001,
  // Every allowed browser origin (the CORS allow-list). Comma-separated, so
  // one backend can serve www + the apex + a staging frontend. In dev this
  // defaults to port 3000, which is what frontend/vite.config.js pins - not
  // Vite's own default of 5173.
  clientUrls: CLIENT_URLS,
  // The canonical one, used to build links in outgoing email.
  //
  // This used to be the raw CLIENT_URL string, which was fine while that held
  // a single URL - but the moment it becomes a comma-separated allow-list
  // (which it must, once the site is served from both www and the apex), the
  // whole string ended up inside every verification and password-reset link:
  //   https://a.com,https://b.com/verify-email?token=...
  // i.e. a dead link in every email the platform sends. Take the first entry.
  clientUrl: CLIENT_URLS[0],

  mongoUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/nalanda_nexus'),

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev_access_secret_change_me'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev_refresh_secret_change_me'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // Cookie SameSite policy for the auth cookies. This deployment serves the
  // frontend and backend from DIFFERENT registrable domains
  // (nalandanexus.vercel.app vs nalandanexus.onrender.com), which makes every
  // frontend->backend call cross-site. Under SameSite=Strict (the previous
  // production value) the browser never attaches the refresh cookie to those
  // calls at all, so POST /api/auth/refresh always failed with
  // NO_REFRESH_TOKEN - confirmed live - silently logging students out when
  // the 15-minute access token expired and on every tab close. 'none'
  // (which requires Secure, already set in production) is the only value
  // that works for a split-domain deployment. Override with COOKIE_SAMESITE
  // if you later move both halves under one registrable domain, where
  // 'lax'/'strict' would be preferable.
  cookieSameSite: (process.env.COOKIE_SAMESITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax')).toLowerCase(),

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

  // Sent via SendGrid's HTTPS API (not SMTP) - Render blocks outbound SMTP
  // ports (25/465/587) on free-tier web services, so raw SMTP can never work
  // there regardless of credentials; HTTPS (443) is never blocked.
  email: {
    sendgridApiKey: process.env.SENDGRID_API_KEY || '',
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
// The mirror of the guard below, and the more dangerous direction of the two.
// Mock mode makes a signature built from the hard-coded 'mock_secret' verify,
// so leaving the flag on in production would let anyone forge a successful
// payment and enrol in a paid course for nothing. Nothing legitimately needs
// mock payments in production, so this refuses to start rather than trusting
// that the flag was set deliberately.
if (env.isProd && env.razorpay.mockMode) {
  throw new Error(
    'PAYMENTS_MOCK_MODE is "true" while NODE_ENV is "production". Mock mode accepts forged ' +
      'payment signatures, so a real course could be enrolled in without paying. Refusing to start. ' +
      'Unset PAYMENTS_MOCK_MODE in the production environment.'
  );
}

if (!env.isProd && env.razorpay.keyId.startsWith('rzp_live_') && !env.razorpay.mockMode) {
  throw new Error(
    'RAZORPAY_KEY_ID is a live production key but NODE_ENV is not "production" and ' +
      'PAYMENTS_MOCK_MODE is not "true". Refusing to start to avoid processing real charges ' +
      'from a non-production environment. Use rzp_test_ keys for local development, or set ' +
      'PAYMENTS_MOCK_MODE=true.'
  );
}
