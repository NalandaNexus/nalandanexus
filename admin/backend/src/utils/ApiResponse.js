export function sendSuccess(res, { statusCode = 200, data = null, message = 'Success', meta } = {}) {
  const body = { success: true, message, data };
  if (meta !== undefined) body.meta = meta;
  return res.status(statusCode).json(body);
}

export function sendError(res, { statusCode = 500, code = 'INTERNAL_ERROR', message = 'Something went wrong', details } = {}) {
  const body = { success: false, message, code };
  if (details !== undefined) body.errors = details;
  return res.status(statusCode).json(body);
}

export default { sendSuccess, sendError };
