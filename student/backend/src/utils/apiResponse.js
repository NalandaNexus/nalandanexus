/**
 * Consistent API response envelope used across every endpoint.
 */
export function sendSuccess(res, { data = null, message = 'Operation successful', status = 200, meta } = {}) {
  const payload = { success: true, data, message };
  if (meta) payload.meta = meta;
  return res.status(status).json(payload);
}

export function sendError(res, { status = 500, code = 'INTERNAL_ERROR', message = 'Something went wrong', details, exposeDetails = false } = {}) {
  const payload = { success: false, error: { code, message } };
  // Details are hidden in production unless the error was built to carry
  // public data a client acts on (e.g. a 409's current version).
  if (details && (exposeDetails || process.env.NODE_ENV !== 'production')) {
    payload.error.details = details;
  }
  return res.status(status).json(payload);
}
