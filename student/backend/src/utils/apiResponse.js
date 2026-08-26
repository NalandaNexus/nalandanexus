/**
 * Consistent API response envelope used across every endpoint.
 */
export function sendSuccess(res, { data = null, message = 'Operation successful', status = 200, meta } = {}) {
  const payload = { success: true, data, message };
  if (meta) payload.meta = meta;
  return res.status(status).json(payload);
}

// Error codes whose `details` are safe — and necessary — to return in
// production. A validation failure's details are the field names and
// messages the user needs in order to fix their own input; withholding them
// leaves the frontend showing a bare "Invalid request data" for a rule it
// may not enforce client-side, with nothing to point at. Everything else
// (stack traces, driver messages) stays development-only, which is what the
// blanket suppression here was actually protecting against.
const CODES_WITH_PUBLIC_DETAILS = new Set(['VALIDATION_ERROR']);

export function sendError(res, { status = 500, code = 'INTERNAL_ERROR', message = 'Something went wrong', details } = {}) {
  const payload = { success: false, error: { code, message } };
  if (details && (CODES_WITH_PUBLIC_DETAILS.has(code) || process.env.NODE_ENV !== 'production')) {
    payload.error.details = details;
  }
  return res.status(status).json(payload);
}
