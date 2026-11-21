import { env } from '../config/env.js';

/**
 * Where this Teacher Portal's web app lives: the first CLIENT_URL origin. Used
 * for every link that is emailed to a teacher, so a link always opens the portal
 * itself rather than this API. Null when it is not configured.
 */
export function portalUrl() {
  return String(env.clientUrl || '').split(',')[0].trim().replace(/\/+$/, '') || null;
}

export default portalUrl;
