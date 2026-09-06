import { Router } from 'express';
import * as couponController from '../controllers/coupon.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdParam } from '../validators/common.js';
import {
  listCouponsQuery,
  listCampaignsQuery,
  createCampaignSchema,
  updateCouponSchema,
} from '../validators/coupon.validator.js';

/**
 * Coupon administration.
 *
 * Guarded by `courses.manage`, the same permission that governs the courses
 * these coupons discount - anyone trusted to price a course is the same person
 * trusted to give it away. A separate permission would leave every existing
 * admin locked out of the page on day one.
 *
 * There is deliberately no unauthenticated route here: the list response carries
 * live coupon codes and the names of the students who redeemed them.
 */
const router = Router();

router.use(authenticate);

router.get('/campaigns', requirePermission('courses.manage'), validate(listCampaignsQuery), couponController.listCampaigns);
router.post('/campaigns', requirePermission('courses.manage'), validate(createCampaignSchema), couponController.createCampaign);
// The one route that hands over the whole list of live codes as a file.
router.get('/campaigns/:id/export', requirePermission('courses.manage'), validate({ params: objectIdParam() }), couponController.exportCampaign);
router.get('/', requirePermission('courses.manage'), validate(listCouponsQuery), couponController.list);
router.patch('/:id', requirePermission('courses.manage'), validate({ params: objectIdParam(), ...updateCouponSchema }), couponController.update);
router.delete('/:id', requirePermission('courses.manage'), validate({ params: objectIdParam() }), couponController.remove);

export default router;
