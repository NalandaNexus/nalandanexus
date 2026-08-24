/**
 * Minimal structured logger.
 * Never log secrets: passwords, tokens, JWT/Razorpay secrets, DB URIs with credentials.
 */
const REDACT_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'secret',
  'jwt',
  'razorpaySignature',
  'key_secret',
]);

function redact(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (REDACT_KEYS.has(key)) {
      out[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      out[key] = redact(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function timestamp() {
  return new Date().toISOString();
}

export const logger = {
  info(...args) {
    console.log(`[INFO] ${timestamp()}`, ...args.map(safe));
  },
  warn(...args) {
    console.warn(`[WARN] ${timestamp()}`, ...args.map(safe));
  },
  error(...args) {
    console.error(`[ERROR] ${timestamp()}`, ...args.map(safe));
  },
  debug(...args) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] ${timestamp()}`, ...args.map(safe));
    }
  },
};

function safe(arg) {
  if (typeof arg === 'object' && arg !== null) {
    return redact(arg);
  }
  return arg;
}
