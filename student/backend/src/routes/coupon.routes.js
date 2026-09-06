import { Router } from 'express';
import * as couponController from '../controllers/coupon.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiters.js';
import { validateCouponSchema, redeemCouponSchema } from '../validators/coupon.validators.js';

/**
 * Coupon endpoints, mounted beside payments rather than inside them - the
 * Razorpay routes are deliberately left exactly as they were.
 *
 * Both routes are authenticated and student-scoped: a coupon is worth a course,
 * so it is only ever evaluated against a known person, and an anonymous caller
 * could otherwise sit and guess codes.
 *
 * `authLimiter` rather than the general one because guessing a code IS a
 * credential-guessing attack. It is the tighter of the two limiters the project
 * already has, it counts failures and forgives successes
 * (skipSuccessfulRequests), and it shares its counter across instances - so a
 * would-be guesser gets one small allowance, not one per container.
 */
const router = Router();

router.post(
  '/validate',
  authLimiter,
  authenticate,
  requireRole('student'),
  validate(validateCouponSchema),
  couponController.validateCoupon
);

router.post(
  '/redeem',
  authLimiter,
  authenticate,
  requireRole('student'),
  validate(redeemCouponSchema),
  couponController.redeemCoupon
);

export default router;
