import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { evaluateCoupon, claimCoupon, releaseCoupon, attachEnrollmentToClaim } from '../services/coupon.service.js';
import { createEnrollment } from '../services/enrollment.service.js';
import { summarizeProfileCompletion } from '../services/studentProfile.service.js';

/**
 * Coupon redemption, alongside the Razorpay flow rather than inside it.
 *
 * payment.controller.js is untouched: a paying student takes exactly the path
 * they took before. A coupon that reduces the price to zero never reaches
 * Razorpay at all - creating a ₹0 order would be both rejected by the gateway
 * and meaningless - so redemption enrols directly through the same
 * createEnrollment the existing free-course branch already uses. One enrollment
 * path, two ways of arriving at it.
 */

/**
 * POST /api/coupons/validate
 *
 * Preview only. Writes nothing and claims nothing, so a student can try a code,
 * see the price, and change their mind. The figures returned are for display;
 * redemption recomputes all of them rather than trusting anything sent back.
 */
export const validateCoupon = asyncHandler(async (req, res) => {
  const { code, courseSlug } = req.body;
  const { coupon, originalAmountInPaise, discountAmountInPaise, finalAmountInPaise } = await evaluateCoupon({
    code,
    courseSlug,
    userId: req.user._id,
  });

  return sendSuccess(res, {
    message: 'Coupon applied.',
    data: {
      valid: true,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      originalAmountInPaise,
      discountAmountInPaise,
      finalAmountInPaise,
      // Lets the UI decide which button to show without doing arithmetic of its
      // own; the backend still refuses anything that contradicts this.
      isFree: finalAmountInPaise === 0,
    },
  });
});

/**
 * POST /api/coupons/redeem
 *
 * Re-validates from scratch, claims one use atomically, then enrols. The
 * preceding /validate call is treated as though it never happened - it proves
 * nothing about the moment of redemption, and a coupon can be exhausted by
 * somebody else in between.
 *
 * Only a coupon that brings the price to exactly zero enrols here. A partial
 * discount has a real amount left to pay and belongs in the Razorpay flow;
 * quietly enrolling such a student free would be a pricing hole, so it is
 * refused rather than approximated.
 */
export const redeemCoupon = asyncHandler(async (req, res) => {
  const { code, courseSlug } = req.body;
  const userId = req.user._id;

  const { coupon, course, originalAmountInPaise, discountAmountInPaise, finalAmountInPaise } = await evaluateCoupon({
    code,
    courseSlug,
    userId,
  });

  if (finalAmountInPaise > 0) {
    throw AppError.badRequest(
      'This coupon reduces the price but does not cover it in full. Please complete the payment to enroll.',
      'COUPON_NOT_FULL_DISCOUNT'
    );
  }

  const claimed = await claimCoupon({ couponId: coupon._id, userId, amountDiscountedInPaise: discountAmountInPaise });

  let enrollment;
  try {
    enrollment = await createEnrollment({ userId, courseId: course._id, course });
  } catch (err) {
    // The seat was taken but the enrollment did not happen. Give it back, or a
    // finite giveaway silently loses a place to a transient failure.
    await releaseCoupon({ couponId: claimed._id, userId });
    throw err;
  }

  await attachEnrollmentToClaim({ couponId: claimed._id, userId, enrollmentId: enrollment.enrollmentId });

  return sendSuccess(res, {
    status: 201,
    message: 'Enrolled successfully with your coupon.',
    data: {
      free: true,
      paymentMethod: 'COUPON',
      couponCode: claimed.code,
      originalAmountInPaise,
      discountAmountInPaise,
      amountPaidInPaise: 0,
      // A free course is still a course: the profile form comes first if it is owed.
      studentProfile: await summarizeProfileCompletion(req.user),
      enrollment: {
        enrollmentId: enrollment.enrollmentId,
        courseId: String(course._id),
        slug: course.slug,
        title: course.title,
        batchCode: enrollment.batchCode || null,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
      },
    },
  });
});

export default { validateCoupon, redeemCoupon };
