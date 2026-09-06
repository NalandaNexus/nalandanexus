import crypto from 'node:crypto';
import { Coupon } from '../models/Coupon.js';
import { Course } from '../models/Course.js';
import { AppError } from '../utils/AppError.js';
import { getActiveEnrollment } from './enrollment.service.js';

/**
 * Everything a coupon is worth, and the only place it is decided.
 *
 * The client sends a code and a course. It never sends a price, and no price it
 * sends would be read: the amount always comes from the Course document here,
 * exactly as the existing Razorpay order flow does it. `validate` and `redeem`
 * both go through the same evaluation, so a preview cannot disagree with what is
 * actually charged.
 */

/**
 * Codes people read aloud and type from a screenshot.
 *
 * Alphabet excludes O/0 and I/1/L, which are the characters that generate
 * support tickets. Drawn from crypto.randomInt rather than Math.random - these
 * are bearer tokens for a free course, and a predictable sequence would let
 * someone who has one guess the rest.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_PREFIX = 'NN';
const CODE_BODY_LENGTH = 8;

export function generateCouponCode() {
  let body = '';
  for (let i = 0; i < CODE_BODY_LENGTH; i += 1) {
    body += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return `${CODE_PREFIX}${body}`;
}

/** Trim and uppercase before any lookup, so casing and stray spaces never decide the answer. */
export function normalizeCode(code) {
  return String(code ?? '').trim().toUpperCase();
}

/**
 * What a coupon is worth against a course price, in paise.
 *
 * Integer arithmetic throughout - a percentage of a price in paise must never
 * produce a fraction of a paisa, and the discount can never exceed the price
 * (which would otherwise imply paying the customer).
 */
export function computeDiscount(coupon, priceInPaise) {
  if (coupon.discountType === 'FULL') return priceInPaise;
  if (coupon.discountType === 'PERCENT') {
    const pct = Math.min(Math.max(coupon.discountValue, 0), 100);
    return Math.min(priceInPaise, Math.floor((priceInPaise * pct) / 100));
  }
  return Math.min(priceInPaise, Math.max(0, Math.floor(coupon.discountValue)));
}

/**
 * Reasons a coupon is refused.
 *
 * Deliberately the same message whether a code does not exist, is inactive, or
 * belongs to another course's giveaway: a distinct "this code exists but is not
 * for this course" reply turns the endpoint into an oracle for enumerating valid
 * codes. Reasons a legitimate holder needs in order to act - already used,
 * expired, already enrolled - are told plainly, because those are about THEIR
 * coupon, which they already hold.
 */
const UNKNOWN = () => AppError.badRequest('Invalid coupon code.', 'COUPON_INVALID');

/**
 * Reads a coupon and works out what it does for this student on this course.
 *
 * Pure read - it claims nothing. Both the preview endpoint and the redemption
 * endpoint call it, and redemption then re-checks every one of these conditions
 * inside its atomic claim, so a coupon that lapses between the two is still
 * caught.
 */
export async function evaluateCoupon({ code, courseSlug, userId }) {
  const normalized = normalizeCode(code);
  if (!normalized) throw UNKNOWN();

  const course = await Course.findOne({ slug: courseSlug, isPublished: true });
  if (!course) throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');
  if (!course.isPurchasable) {
    throw AppError.badRequest('This course is not yet open for enrollment.', 'COURSE_NOT_PURCHASABLE');
  }

  // Checked before the coupon is even looked at: spending a single-use code on a
  // course the student already owns would burn it for nothing.
  const existing = await getActiveEnrollment(userId, course._id);
  if (existing) throw AppError.conflict('You are already enrolled in this course.', 'ALREADY_ENROLLED');

  const coupon = await Coupon.findOne({ code: normalized });

  // Unknown, inactive, and wrong-course all answer identically - see UNKNOWN.
  if (!coupon || !coupon.isActive || String(coupon.courseId) !== String(course._id)) throw UNKNOWN();

  if (coupon.expiresAt && coupon.expiresAt.getTime() <= Date.now()) {
    throw AppError.badRequest('This coupon has expired.', 'COUPON_EXPIRED');
  }
  if (coupon.usedCount >= coupon.maxUses) {
    throw AppError.badRequest('This coupon has already been used.', 'COUPON_EXHAUSTED');
  }
  if (coupon.usedBy.some((u) => String(u.userId) === String(userId))) {
    throw AppError.badRequest('You have already used this coupon.', 'COUPON_ALREADY_USED_BY_YOU');
  }

  const originalAmountInPaise = course.priceInPaise;
  const discountAmountInPaise = computeDiscount(coupon, originalAmountInPaise);
  const finalAmountInPaise = Math.max(0, originalAmountInPaise - discountAmountInPaise);

  return { coupon, course, originalAmountInPaise, discountAmountInPaise, finalAmountInPaise };
}

/**
 * Takes one use of the coupon, or fails.
 *
 * ONE conditional update. Every rule that decides eligibility is in the filter,
 * so the check and the increment cannot be separated by another request: Mongo
 * matches and updates a single document atomically, and a loser matches nothing
 * and gets null back. A read-then-write version of this - however carefully
 * ordered - lets two simultaneous redemptions both see usedCount 0 and both
 * proceed, which for a single-use code means two free enrollments.
 *
 * `usedBy.userId: { $ne: userId }` is in the filter too, so the same student
 * racing themselves (a double-click, a retried request) also takes one seat.
 */
export async function claimCoupon({ couponId, userId, amountDiscountedInPaise }) {
  const now = new Date();
  const claimed = await Coupon.findOneAndUpdate(
    {
      _id: couponId,
      isActive: true,
      $expr: { $lt: ['$usedCount', '$maxUses'] },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      'usedBy.userId': { $ne: userId },
    },
    {
      $inc: { usedCount: 1 },
      $push: { usedBy: { userId, usedAt: now, amountDiscountedInPaise, enrollmentId: null } },
    },
    { new: true }
  );

  if (!claimed) throw AppError.badRequest('This coupon has already been used.', 'COUPON_EXHAUSTED');
  return claimed;
}

/**
 * Gives a claimed use back.
 *
 * Only for the narrow window where the claim succeeded but creating the
 * enrollment did not. Without it a crashed request would silently consume one of
 * a finite number of free places and nobody would ever get it.
 */
export async function releaseCoupon({ couponId, userId }) {
  await Coupon.updateOne(
    { _id: couponId, usedCount: { $gt: 0 } },
    { $inc: { usedCount: -1 }, $pull: { usedBy: { userId } } }
  );
}

/** Records the enrollment the claim produced, so an admin can trace a code to a real place. */
export async function attachEnrollmentToClaim({ couponId, userId, enrollmentId }) {
  if (!enrollmentId) return;
  await Coupon.updateOne(
    { _id: couponId, 'usedBy.userId': userId },
    { $set: { 'usedBy.$.enrollmentId': enrollmentId } }
  );
}

/**
 * Creates a batch of coupons for one course.
 *
 * Generation retries on collision rather than trusting randomness: the unique
 * index is the real guarantee, and a duplicate must cost one retry rather than
 * failing the whole batch. Returns the codes so the caller can hand them out -
 * this is the only moment they are assembled in one place.
 */
export async function generateCoupons({ courseId, count, discountType = 'FULL', discountValue = 100, maxUses = 1, expiresAt = null, batchLabel = null }) {
  const course = await Course.findById(courseId);
  if (!course) throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');

  const created = [];
  for (let i = 0; i < count; i += 1) {
    let inserted = null;
    for (let attempt = 0; attempt < 5 && !inserted; attempt += 1) {
      try {
        inserted = await Coupon.create({
          code: generateCouponCode(),
          courseId: course._id,
          discountType,
          discountValue,
          maxUses,
          expiresAt,
          batchLabel,
        });
      } catch (err) {
        if (err?.code !== 11000) throw err;
        // Collided with an existing code; draw another.
      }
    }
    // Five collisions on a 31^8 space is not chance - let the central error
    // handler turn it into a 500 rather than inventing a partial batch.
    if (!inserted) throw new Error('Could not generate a unique coupon code after 5 attempts.');
    created.push(inserted);
  }
  return created;
}

/** Admin-facing shape. `usedBy` carries real student identities, so it is only ever sent to an authenticated admin. */
export function shapeCouponForAdmin(coupon, { courseTitle = null } = {}) {
  const expired = Boolean(coupon.expiresAt && coupon.expiresAt.getTime() <= Date.now());
  const exhausted = coupon.usedCount >= coupon.maxUses;
  return {
    id: String(coupon._id),
    code: coupon.code,
    courseId: String(coupon.courseId?._id || coupon.courseId),
    courseTitle: courseTitle || coupon.courseId?.title || null,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    maxUses: coupon.maxUses,
    usedCount: coupon.usedCount,
    isActive: coupon.isActive,
    expiresAt: coupon.expiresAt,
    batchLabel: coupon.batchLabel,
    // A single word for the table, derived here so every surface agrees.
    status: !coupon.isActive ? 'INACTIVE' : expired ? 'EXPIRED' : exhausted ? 'USED' : 'AVAILABLE',
    usedBy: (coupon.usedBy || []).map((u) => ({
      userId: String(u.userId?._id || u.userId),
      name: u.userId?.name || null,
      email: u.userId?.email || null,
      enrollmentId: u.enrollmentId || null,
      usedAt: u.usedAt,
      amountDiscountedInPaise: u.amountDiscountedInPaise,
    })),
    createdAt: coupon.createdAt,
  };
}

export default {
  generateCouponCode,
  normalizeCode,
  computeDiscount,
  evaluateCoupon,
  claimCoupon,
  releaseCoupon,
  attachEnrollmentToClaim,
  generateCoupons,
  shapeCouponForAdmin,
};
