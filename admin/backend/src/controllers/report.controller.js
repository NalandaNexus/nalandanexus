import { catchAsync } from '../utils/catchAsync.js';
import { generateReport } from '../services/report.service.js';
import { recordAuditLog } from '../services/auditLog.service.js';

export const exportReport = catchAsync(async (req, res) => {
  const type = req.query.type || 'teachers';
  const { from, to, status } = req.query;
  const csv = await generateReport(type, { from, to, status });
  await recordAuditLog({ actor: req.admin, action: 'report.exported', entityType: 'Report', metadata: { type, from, to, status }, req });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="nalanda-${type}-report.csv"`);
  return res.status(200).send(csv);
});

export default { exportReport };
