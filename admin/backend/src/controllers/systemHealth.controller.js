import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { getSystemHealth } from '../services/systemHealth.service.js';

export const get = catchAsync(async (req, res) => {
  const data = await getSystemHealth();
  return sendSuccess(res, { data });
});

export default { get };
