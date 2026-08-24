import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { listAuditLogs } from '../services/auditLog.service.js';
import { parsePagination, buildPaginationMeta, parseSort } from '../utils/pagination.js';

export const list = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query.sort, ['createdAt', 'action', 'entityType'], { createdAt: -1 });
  const filter = {};
  if (req.query.entityType) filter.entityType = req.query.entityType;
  if (req.query.action) filter.action = new RegExp(req.query.action, 'i');

  const { items, total } = await listAuditLogs({ page, limit, skip, filter, sort });
  return sendSuccess(res, { data: items, meta: buildPaginationMeta({ page, limit, total }) });
});

export default { list };
