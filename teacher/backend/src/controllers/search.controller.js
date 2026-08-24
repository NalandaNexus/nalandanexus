import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { globalSearch } from '../services/search.service.js';

export const search = catchAsync(async (req, res) => {
  const results = await globalSearch(req.teacher._id, req.query.q);
  sendSuccess(res, { data: results });
});

export default { search };
