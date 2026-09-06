import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as studentBridge from '../services/studentCourseBridge.service.js';
import { recordAuditLog } from '../services/auditLog.service.js';

/**
 * Coupon administration.
 *
 * Coupons live in the student service's database, beside the Course they
 * discount and the Enrollment they produce, so these routes proxy to it rather
 * than keeping a second copy here - the same arrangement batch management uses.
 * A local mirror would mean two answers to "has this code been used", and that
 * question has to have exactly one.
 *
 * Every action is audit-logged with the acting admin, because a coupon is worth
 * a paid course and "who created these 25 free places" is a question somebody
 * will eventually ask.
 */

export const list = catchAsync(async (req, res) => {
  const { coupons, summary } = await studentBridge.listCoupons(req.query);
  sendSuccess(res, { data: coupons, meta: { summary } });
});

export const create = catchAsync(async (req, res) => {
  const created = await studentBridge.createCoupons(req.body);
  await recordAuditLog({
    actor: req.admin,
    action: 'coupon.generated',
    entityType: 'Coupon',
    metadata: {
      count: created.length,
      courseSlug: req.body.courseSlug,
      discountType: req.body.discountType || 'FULL',
      batchLabel: req.body.batchLabel || null,
      // The codes themselves are deliberately NOT logged - the audit trail is
      // read by more people than should be able to redeem a free course.
    },
    req,
  });
  sendSuccess(res, { statusCode: 201, message: `${created.length} coupon(s) generated`, data: created });
});

export const update = catchAsync(async (req, res) => {
  const coupon = await studentBridge.updateCoupon(req.params.id, req.body);
  await recordAuditLog({
    actor: req.admin,
    action: req.body.isActive === false ? 'coupon.deactivated' : 'coupon.updated',
    entityType: 'Coupon',
    entityId: req.params.id,
    metadata: { fields: Object.keys(req.body) },
    req,
  });
  sendSuccess(res, { message: 'Coupon updated successfully', data: coupon });
});

export const remove = catchAsync(async (req, res) => {
  await studentBridge.deleteCoupon(req.params.id);
  await recordAuditLog({
    actor: req.admin,
    action: 'coupon.deleted',
    entityType: 'Coupon',
    entityId: req.params.id,
    req,
  });
  sendSuccess(res, { message: 'Coupon removed successfully' });
});

export default { list, create, update, remove };
