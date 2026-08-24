/**
 * Consistent API response envelope used across every endpoint.
 */
export function sendSuccess(res, { data = null, message = 'Operation successful', status = 200, meta } = {}) {
  const payload = { success: true, data, message };
  if (meta) payload.meta = meta;
  return res.status(status).json(payload);
}

export function sendError(res, { status = 500, code = 'INTERNAL_ERROR', message = 'Something went wrong', details } = {}) {
  const payload = { success: false, error: { code, message } };
  if (details && process.env.NODE_ENV !== 'production') {
    payload.error.details = details;
  }
  return res.status(status).json(payload);
}
