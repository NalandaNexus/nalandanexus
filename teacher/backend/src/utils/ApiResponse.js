/**
 * Sends a consistent success envelope for every 2xx response in the API.
 * Shape: { success: true, message, data, meta? }
 */
export function sendSuccess(res, { statusCode = 200, data = null, message = 'Success', meta = undefined } = {}) {
  const payload = { success: true, message, data };
  if (meta !== undefined) payload.meta = meta;
  return res.status(statusCode).json(payload);
}

export default sendSuccess;
