import { z } from 'zod';

/**
 * Coupon input.
 *
 * Note what is absent: any amount, price or discount. The client names a code
 * and a course and nothing else - every figure is computed server-side from the
 * Course document (see services/coupon.service.js). A schema that accepted an
 * `amount` would be the first step toward trusting one.
 *
 * The code pattern is deliberately broader than the generator's own alphabet, so
 * a hand-typed lowercase code or one from an older batch still reaches
 * normalisation rather than being rejected on shape.
 */
const couponCode = z
  .string()
  .trim()
  .min(4, 'Enter your coupon code')
  .max(32)
  .regex(/^[A-Za-z0-9-]+$/, 'Invalid coupon code.');

const courseSlug = z.string().trim().min(1, 'courseSlug is required').max(200);

export const validateCouponSchema = z.object({
  body: z.object({ code: couponCode, courseSlug }),
});

export const redeemCouponSchema = z.object({
  body: z.object({ code: couponCode, courseSlug }),
});

export default { validateCouponSchema, redeemCouponSchema };
