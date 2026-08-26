import { env } from '../config/env.js';

/**
 * Session cookie plumbing for the admin portal.
 *
 * The JWT used to be handed to the browser and kept in localStorage, where
 * any script on the page could read it - the weakest token storage of the
 * three portals, guarding the highest-privilege one. It now travels in an
 * httpOnly cookie instead, matching teacher/backend. middleware/auth.js has
 * always accepted this cookie, so the Bearer path stays available for
 * non-browser clients and nothing server-side had to change to read it.
 */

/**
 * True when the browser considers the request cross-site - the admin
 * frontend and this API are deployed as separate services on unrelated
 * domains, and a SameSite=Strict/Lax cookie is simply never attached to a
 * cross-site request. Compared by hostname rather than registrable domain
 * deliberately: erring toward "cross-site" still works (SameSite=None is
 * always sent, and credentialed CORS is already pinned to one exact
 * origin), while erring the other way breaks login outright.
 */
function isCrossSiteRequest(req) {
  const origin = req?.headers?.origin;
  if (!origin) return false;
  try {
    return new URL(origin).hostname !== req.hostname;
  } catch {
    return false;
  }
}

function baseOptions(req) {
  const crossSite = isCrossSiteRequest(req);
  return {
    httpOnly: true,
    // SameSite=None is only honoured on a Secure cookie.
    secure: env.nodeEnv === 'production' || crossSite,
    sameSite: crossSite ? 'none' : env.nodeEnv === 'production' ? 'strict' : 'lax',
    path: '/',
  };
}

/** Milliseconds for a "8h"/"30d"-style expiry string; falls back to 8 hours. */
function parseExpiryMs(expr) {
  const match = /^(\d+)([smhd])$/.exec(String(expr || ''));
  if (!match) return 8 * 60 * 60 * 1000;
  const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return Number(match[1]) * multipliers[match[2]];
}

export function setSessionCookie(req, res, token, { remember = false } = {}) {
  res.cookie(env.cookieName, token, {
    ...baseOptions(req),
    maxAge: parseExpiryMs(remember ? env.jwtRememberExpiresIn : env.jwtExpiresIn),
  });
}

export function clearSessionCookie(req, res) {
  // A clear only takes effect when its attributes match the cookie that was
  // set - dropping sameSite/secure would leave a cross-site session alive.
  res.clearCookie(env.cookieName, baseOptions(req));
}

export default { setSessionCookie, clearSessionCookie };
