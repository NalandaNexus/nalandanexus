import { validationResult } from 'express-validator';
import { ApiError } from '../utils/ApiError.js';
import { stripHtml } from '../utils/sanitize.js';

/**
 * Fields whose value must reach the handler byte-for-byte.
 *
 * A password may legitimately contain angle brackets, and stripping markup out
 * of one would silently change the credential - the user would set a password
 * they could never type again. Same reasoning for opaque tokens and URLs.
 */
const NEVER_SANITISE = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  // The temporary password Admin is about to email: stored any differently from
  // what the email says, and the teacher is told their password is invalid.
  'tempPassword',
  'token',
  'refreshToken',
  'accessToken',
  'signature',
  'url',
  'fileUrl',
  'videoUrl',
  'avatarUrl',
  'meetingUrl',
  'link',
]);

/**
 * Recursively strips markup from user-authored strings in the request body.
 *
 * Applied centrally rather than field-by-field across ~150 validator rules,
 * because the failure mode of missing one is silent: the value is stored raw
 * and only becomes a problem in whichever consumer renders it as HTML. Teacher
 * content is bridged into the Student portal, so it outlives this app's own
 * rendering guarantees.
 */
function sanitiseInPlace(value, key) {
  if (typeof value === 'string') {
    return NEVER_SANITISE.has(key) ? value : stripHtml(value);
  }
  if (Array.isArray(value)) {
    return value.map((v) => sanitiseInPlace(v, key));
  }
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) {
      value[k] = sanitiseInPlace(value[k], k);
    }
  }
  return value;
}

/**
 * Runs after a chain of express-validator checks and turns any failures
 * into a single, consistently-shaped 422 ApiError instead of letting each
 * route hand-roll its own validation response.
 *
 * Sanitisation runs only once validation has PASSED, so a rule such as
 * notEmpty() still sees the value the client actually sent - a body of
 * "<script></script>" fails its own length rule rather than being quietly
 * accepted and stored as an empty string.
 */
export function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) {
    if (req.body && typeof req.body === 'object') sanitiseInPlace(req.body);
    return next();
  }

  const details = result.array({ onlyFirstError: true }).map((e) => ({
    field: e.path,
    message: e.msg,
  }));

  next(ApiError.unprocessable('One or more fields are invalid.', 'VALIDATION_ERROR', details));
}

export default validate;
