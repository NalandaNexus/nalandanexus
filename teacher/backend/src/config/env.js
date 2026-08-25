import dotenv from 'dotenv';

dotenv.config();

function required(name, fallback = undefined) {
  const value = process.env[name] ?? fallback;
  return value;
}

// A trailing slash here (easy to introduce when pasting a URL straight from
// a browser address bar into Render's dashboard) breaks CORS outright: the
// `cors` package echoes this string back verbatim as Access-Control-Allow-Origin,
// and browsers require that header to match the request's Origin byte-for-byte
// (which never has a trailing slash) - so every cross-origin request, including
// the login preflight, gets silently rejected by the browser. Stripped here so
// deploy-time URL formatting can't take down auth.
function stripTrailingSlash(url) {
  return url.replace(/\/+$/, '');
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5002,
  clientUrl: stripTrailingSlash(process.env.CLIENT_URL || 'http://localhost:5174'),
  // This backend's own publicly-reachable base URL, used only to build
  // absolute /uploads/... links when bridging a resource/attachment to the
  // student portal (a different origin, so a relative path wouldn't resolve).
  publicUrl: process.env.PUBLIC_URL || `http://localhost:${parseInt(process.env.PORT, 10) || 5002}`,

  mongodbUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/nalanda_teacher'),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  jwtRememberExpiresIn: process.env.JWT_REMEMBER_EXPIRES_IN || '30d',
  cookieName: process.env.COOKIE_NAME || 'nalanda_teacher_token',

  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 300,
  authRateLimitMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 20,

  maxUploadMb: parseInt(process.env.MAX_UPLOAD_MB, 10) || 10,

  seedTeacherEmail: process.env.SEED_TEACHER_EMAIL || 'rajesh@nalanda.edu',
  seedTeacherPassword: process.env.SEED_TEACHER_PASSWORD || 'Faculty@Nalanda2026!',

  // Service-to-service bridge to the (separate service, separate database)
  // student backend, so a published announcement can actually reach
  // students in real time — see services/studentBridge.service.js. A
  // teacher has no login/session in the student backend's database, so this
  // is authenticated with a shared secret rather than a user JWT. Left
  // unconfigured, the bridge is a documented no-op (see that file) rather
  // than a hard failure — announcements still work entirely within the
  // teacher portal either way.
  studentBridge: {
    url: process.env.STUDENT_BACKEND_URL || '',
    serviceKey: process.env.STUDENT_BACKEND_SERVICE_KEY || '',
  },

  // Outbound: lets live assignment/quiz/attendance activity reach admin's
  // monitoring dashboard (a separate service/database) - see
  // services/adminBridge.service.js. Reuses the same shared secret as the
  // student bridge (every internal caller in this system shares one).
  adminBridge: {
    url: process.env.ADMIN_BACKEND_URL || '',
    serviceKey: process.env.STUDENT_BACKEND_SERVICE_KEY || '',
  },
};

export function assertEnv() {
  const missing = [];
  if (!env.jwtSecret || env.jwtSecret === 'replace_with_a_long_random_secret') {
    if (env.nodeEnv === 'production') missing.push('JWT_SECRET');
    else {
      // eslint-disable-next-line no-console
      console.warn('[env] JWT_SECRET is missing/default — using an insecure fallback for local development only.');
      env.jwtSecret = env.jwtSecret || 'dev-only-insecure-secret-change-me';
    }
  }
  if (!env.mongodbUri) missing.push('MONGODB_URI');

  if (missing.length) {
    throw new Error(`[env] Missing required environment variables: ${missing.join(', ')}`);
  }
}

export default env;
