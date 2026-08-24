import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as attendanceService from '../services/attendance.service.js';

export const markAttendance = catchAsync(async (req, res) => {
  const records = await attendanceService.markAttendance(req.teacher._id, req.body, req.ip);
  sendSuccess(res, { message: 'Attendance saved successfully.', data: records });
});

export const listAttendance = catchAsync(async (req, res) => {
  const records = await attendanceService.listAttendance(req.teacher._id, req.query);
  sendSuccess(res, { data: records });
});

export const getAttendanceAnalytics = catchAsync(async (req, res) => {
  const analytics = await attendanceService.getAttendanceAnalytics(req.teacher._id, req.params.classId, req.query);
  sendSuccess(res, { data: analytics });
});

export default { markAttendance, listAttendance, getAttendanceAnalytics };
