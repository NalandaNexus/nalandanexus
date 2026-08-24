const MAX_LIMIT = 100;

/**
 * Parses page/limit query params into safe integers and a Mongo skip value.
 * Never trusts client-supplied numbers blindly — clamps to sane bounds so a
 * client can't request an unbounded page size and force a full collection scan.
 */
export function parsePagination(query = {}) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = 20;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function buildPaginationMeta({ page, limit, total }) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return { page, limit, total, totalPages };
}

/**
 * Whitelist-based sort parser. Never forwards a raw client string straight
 * into a Mongo sort object — only fields present in `allowedFields` are honored.
 */
export function parseSort(sortParam, allowedFields, fallback = { createdAt: -1 }) {
  if (!sortParam || typeof sortParam !== 'string') return fallback;
  const direction = sortParam.startsWith('-') ? -1 : 1;
  const field = sortParam.replace(/^-/, '');
  if (!allowedFields.includes(field)) return fallback;
  return { [field]: direction };
}

export default { parsePagination, buildPaginationMeta, parseSort };
