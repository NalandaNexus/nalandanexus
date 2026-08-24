import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as paymentService from '../services/payment.service.js';

export const list = catchAsync(async (req, res) => {
  const { items, meta, summary } = await paymentService.listPayments(req.query);
  return sendSuccess(res, { data: items, meta: { ...meta, summary } });
});

export const create = catchAsync(async (req, res) => {
  const payment = await paymentService.createPayment(req.body, req.admin, req);
  return sendSuccess(res, { statusCode: 201, data: payment, message: 'Payment record created' });
});

export const updateStatus = catchAsync(async (req, res) => {
  const payment = await paymentService.updatePaymentStatus(req.params.id, req.body.status, req.admin, req);
  return sendSuccess(res, { data: payment, message: 'Payment status updated' });
});

export default { list, create, updateStatus };
