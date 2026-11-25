import { catchAsync } from '../utils/catchAsync.js';
import { generateReportAndLog } from '../services/report.service.js';
import { assertCourseAccessForClass } from '../services/courseAccess.service.js';

export const exportReport = catchAsync(async (req, res) => {
  const type = req.query.type || 'students';
  const { classId, from, to } = req.query;
  // Course-access-widened, matching the rest of the monitoring surface
  // (dashboard/students/analytics): a report scoped to one class only needs
  // standing to see THAT class, own or shared.
  if (classId) await assertCourseAccessForClass(req.teacher._id, classId);

  const csv = await generateReportAndLog(req.teacher._id, type, { classId, from, to }, req.ip);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="nalanda-${type}-report.csv"`);
  return res.status(200).send(csv);
});

export default { exportReport };
