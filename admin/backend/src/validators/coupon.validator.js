import { z } from 'zod';

/**
 * Coupon administration input.
 *
 * The student service validates all of this again against its own data - the
 * course must exist, the discount must make sense. These schemas reject what is
 * malformed before a cross-service call is made and keep unexpected keys out of
 * the proxied body; they are not the only line of defence and are not treated as
 * one.
 */

/**
 * Courses cross this boundary by SLUG.
 *
 * This portal's course documents live in this portal's database; their _ids
 * mean nothing to the student backend that actually stores the coupons. Sending
 * one produced an empty table and a COURSE_NOT_FOUND on create, both silent
 * enough to look like "there are no coupons".
 */
export const listCouponsQuery = {
  query: z.object({
    status: z.enum(['ALL', 'AVAILABLE', 'USED', 'EXPIRED', 'INACTIVE']).optional(),
    courseSlug: z.string().trim().max(120).optional(),
    search: z.string().trim().max(64).optional(),
  }),
};

export const createCouponsSchema = {
  body: z.object({
    // Slug, not _id - see the note on listCouponsQuery.
    courseSlug: z.string().trim().min(1).max(120),
    // Capped so a mistyped figure cannot mint thousands of free places in one
    // click - the giveaway this was built for is 25.
    count: z.coerce.number().int().min(1, 'Create at least one coupon').max(500, 'No more than 500 at a time'),
    discountType: z.enum(['FULL', 'PERCENT', 'FIXED']).optional(),
    discountValue: z.coerce.number().min(0).max(100000000).optional(),
    maxUses: z.coerce.number().int().min(1).max(1000).optional(),
    expiresAt: z.coerce.date().nullish(),
    batchLabel: z.string().trim().max(120).nullish(),
  }),
};

export const updateCouponSchema = {
  // Only activation and expiry. A coupon's code, course, discount and recorded
  // usage are history once issued; usedCount in particular is what keeps a
  // single-use code single-use, so it is not editable from anywhere.
  body: z.object({
    isActive: z.boolean().optional(),
    expiresAt: z.coerce.date().nullish(),
  }),
};

export default { listCouponsQuery, createCouponsSchema, updateCouponSchema };
