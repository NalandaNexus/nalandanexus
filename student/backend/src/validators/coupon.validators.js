import { z } from 'zod';
import { normalizeCode } from '../services/coupon.service.js';

/**
 * Coupon input.
 *
 * Note what is absent: any amount, price or discount. The client names a code
 * and a course and nothing else - every figure is computed server-side from the
 * Course document (see services/coupon.service.js). A schema that accepted an
 * `amount` would be the first step toward trusting one.
 *
 * The shape is checked on the NORMALISED code rather than on the raw string,
 * because guessing at separators is a losing game: codes are printed grouped
 * (NNQU-AKCA-FR), and they come back pasted with spaces from a wrapped message,
 * with an en dash from a phone keyboard, or with nothing at all. An earlier
 * pattern here allowed only `[A-Za-z0-9-]`, which rejected "NNQU AKCA FR" with a
 * validation error before normalisation ever saw it - the tolerance existed but
 * was unreachable.
 *
 * Stripping first and validating after means every separator is handled by one
 * rule, and what the rest of the code receives is already the canonical form.
 */
const couponCode = z
  .string()
  .max(64, 'Invalid coupon code.')
  .transform((raw) => normalizeCode(raw))
  .refine((code) => code.length >= 4, { message: 'Enter your coupon code' })
  // After normalisation only the alphabet and the grouping hyphens remain;
  // anything else means the input was never a code.
  .refine((code) => /^[A-Z0-9-]+$/.test(code), { message: 'Invalid coupon code.' })
  .refine((code) => code.replace(/-/g, '').length <= 32, { message: 'Invalid coupon code.' });

const courseSlug = z.string().trim().min(1, 'courseSlug is required').max(200);

export const validateCouponSchema = z.object({
  body: z.object({ code: couponCode, courseSlug }),
});

export const redeemCouponSchema = z.object({
  body: z.object({ code: couponCode, courseSlug }),
});

export default { validateCouponSchema, redeemCouponSchema };
