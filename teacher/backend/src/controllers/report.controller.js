import { catchAsync } from '../utils/catchAsync.js';
import { generateReportAndLog } from '../services/report.service.js';
import { assertClassOwnership } from '../services/class.service.js';

export const exportReport = catchAsync(async (req, res) => {
  const type = req.query.type || 'students';
  const { classId, from, to } = req.query;
  if (classId) await assertClassOwnership(req.teacher._id, classId);

  const csv = await generateReportAndLog(req.teacher._id, type, { classId, from, to }, req.ip);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="nalanda-${type}-report.csv"`);
  return res.status(200).send(csv);
});

export default { exportReport };
