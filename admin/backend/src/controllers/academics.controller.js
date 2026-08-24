import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as academicsService from '../services/academics.service.js';

export const overview = catchAsync(async (req, res) => {
  const [attendance, content, assignmentActivity, quizActivity] = await Promise.all([
    academicsService.getAttendanceOverview(),
    academicsService.getContentRepositoryStats(),
    academicsService.listAssignmentActivity(),
    academicsService.listQuizActivity(),
  ]);

  return sendSuccess(res, {
    data: {
      attendance,
      content,
      assignments: { available: true, items: assignmentActivity },
      exams: { available: true, items: quizActivity },
    },
  });
});

export const attendanceSummaries = catchAsync(async (req, res) => {
  const items = await academicsService.listAttendanceSummaries();
  return sendSuccess(res, { data: items });
});

export default { overview, attendanceSummaries };
