import dotenv from 'dotenv';

dotenv.config();

function required(name, fallback = undefined) {
  return process.env[name] ?? fallback;
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
  port: parseInt(process.env.PORT, 10) || 5003,
  clientUrl: stripTrailingSlash(process.env.CLIENT_URL || 'http://localhost:5175'),
  serverUrl: process.env.SERVER_URL || 'http://localhost:5003',

  mongodbUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/nalanda_admin'),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  jwtRememberExpiresIn: process.env.JWT_REMEMBER_EXPIRES_IN || '30d',
  cookieName: process.env.COOKIE_NAME || 'nalanda_admin_token',

  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 300,
  authRateLimitMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 20,

  seedSuperAdminName: process.env.SEED_SUPER_ADMIN_NAME || 'Adarsh Admin',
  seedSuperAdminEmail: process.env.SEED_SUPER_ADMIN_EMAIL || 'admin@nalanda.edu',
  seedSuperAdminPassword: process.env.SEED_SUPER_ADMIN_PASSWORD || 'Admin@Nalanda2026!',

  // Service-to-service bridge to the (separate service, separate database)
  // student backend, so a system-wide/student-audience announcement
  // actually reaches students — mirrors teacher/backend's identical bridge.
  // Left unconfigured, the bridge is a documented no-op rather than a hard
  // failure — announcements still work entirely within the admin portal.
  studentBridge: {
    url: process.env.STUDENT_BACKEND_URL || '',
    serviceKey: process.env.STUDENT_BACKEND_SERVICE_KEY || '',
  },

  // Service-to-service bridge to teacher/backend (a separate service,
  // separate database), used to provision a REAL Teacher Portal login when
  // Admin creates a teacher — see services/teacherBridge.service.js. Must
  // match teacher/backend's STUDENT_BACKEND_SERVICE_KEY (that middleware
  // checks one shared secret regardless of which portal is calling it).
  teacherBridge: {
    url: process.env.TEACHER_BACKEND_URL || '',
    serviceKey: process.env.TEACHER_BACKEND_SERVICE_KEY || '',
  },

  // Email (optional - if unset, emails are logged to console instead of
  // sent). Same convention as student/backend's identical config.
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'Nalanda Nexus <nalandanexus@gmail.com>',
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
