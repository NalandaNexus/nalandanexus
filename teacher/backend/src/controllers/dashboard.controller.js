import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { getDashboardOverview } from '../services/dashboard.service.js';

export const getOverview = catchAsync(async (req, res) => {
  const overview = await getDashboardOverview(req.teacher._id);
  sendSuccess(res, { data: overview });
});

export default { getOverview };
