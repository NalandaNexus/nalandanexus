import crypto from 'node:crypto';
import { Coupon } from '../models/Coupon.js';
import { CouponCampaign } from '../models/CouponCampaign.js';
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
// Grouped as NNxx-xxxx-xx. Chunking is the whole reason people can read a code
// back over a phone without losing their place; the groups carry no meaning and
// are not part of what is matched.
const CODE_GROUPS = [2, 4, 2];

/** `NNX7-K4P9-X2` - eight random characters from a 31-symbol alphabet, drawn one at a time. */
export function generateCouponCode() {
  let body = '';
  for (let i = 0; i < CODE_BODY_LENGTH; i += 1) {
    body += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return formatCode(`${CODE_PREFIX}${body}`);
}

/** Inserts the display grouping into a bare `NN…` code. */
export function formatCode(bare) {
  const chars = String(bare).slice(CODE_PREFIX.length);
  const groups = [];
  let at = 0;
  for (const size of CODE_GROUPS) {
    groups.push(chars.slice(at, at + size));
    at += size;
  }
  return `${CODE_PREFIX}${groups[0]}-${groups.slice(1).join('-')}`;
}

/**
 * Reduces whatever the student typed to the one form a lookup can use.
 *
 * People retype these from a screenshot or a WhatsApp message, so the dashes
 * arrive missing, doubled, or as spaces or en-dashes depending on the keyboard.
 * Every separator is dropped and the grouping re-applied, which means the code
 * matches whether it was pasted as `NNX7-K4P9-X2`, `nnx7k4p9x2` or
 * `NNX7 K4P9 X2` - none of which should be the difference between a free course
 * and "Invalid coupon code."
 */
export function normalizeCode(code) {
  const stripped = String(code ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (!stripped.startsWith(CODE_PREFIX)) return stripped;
  if (stripped.length !== CODE_PREFIX.length + CODE_BODY_LENGTH) return stripped;
  return formatCode(stripped);
}

/**
 * Both shapes a stored code could take.
 *
 * Codes are stored grouped, but matching on the bare form too costs one index
 * entry in an $in and means a code minted before the grouping existed still
 * works for the person holding it.
 */
export function codeLookupForms(code) {
  const normalized = normalizeCode(code);
  const bare = normalized.replace(/-/g, '');
  return normalized === bare ? [bare] : [normalized, bare];
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

  const coupon = await Coupon.findOne({ code: { $in: codeLookupForms(normalized) } });

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
/**
 * Mints a campaign and its coupons.
 *
 * Uniqueness is delegated to the unique index on `code`, not to a "does this
 * exist?" read beforehand. A read cannot promise anything: two generators can
 * both find a code free and both write it. The index is the only thing that
 * actually decides, so a duplicate key is treated as an ordinary event - draw
 * again - rather than an error.
 *
 * The whole batch is all-or-nothing. A campaign that says 25 but holds 19
 * because generation gave up partway is worse than no campaign: the operator
 * hands out 25 codes from a list that never had them. On failure the campaign
 * and everything minted under it are removed, which also leaves the name free
 * for an immediate retry.
 */
export async function createCampaign({
  courseId,
  name,
  count,
  discountType = 'FULL',
  discountValue = 100,
  maxUses = 1,
  expiresAt = null,
  createdByEmail = null,
  createdByName = null,
}) {
  const course = await Course.findById(courseId);
  if (!course) throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');

  const trimmedName = String(name ?? '').trim();
  if (!trimmedName) throw AppError.badRequest('Give the campaign a name.', 'CAMPAIGN_NAME_REQUIRED');

  // Checked before minting for a clear message, and enforced by the unique index
  // below for correctness - two operators clicking Generate at the same moment
  // both pass this read, and only one survives the write.
  const clash = await CouponCampaign.findOne({ courseId: course._id, name: trimmedName }).lean();
  if (clash) {
    throw AppError.conflict(
      `A campaign named "${trimmedName}" already exists for this course. Use a different name, or open the existing campaign.`,
      'CAMPAIGN_EXISTS'
    );
  }

  let campaign;
  try {
    campaign = await CouponCampaign.create({
      name: trimmedName,
      courseId: course._id,
      discountType,
      discountValue,
      maxUsesPerCoupon: maxUses,
      couponCount: count,
      expiresAt,
      createdByEmail,
      createdByName,
    });
  } catch (err) {
    if (err?.code === 11000) {
      throw AppError.conflict(
        `A campaign named "${trimmedName}" already exists for this course.`,
        'CAMPAIGN_EXISTS'
      );
    }
    throw err;
  }

  const created = [];
  try {
    for (let i = 0; i < count; i += 1) {
      let inserted = null;
      for (let attempt = 0; attempt < 5 && !inserted; attempt += 1) {
        try {
          inserted = await Coupon.create({
            code: generateCouponCode(),
            courseId: course._id,
            campaignId: campaign._id,
            discountType,
            discountValue,
            maxUses,
            expiresAt,
          });
        } catch (err) {
          if (err?.code !== 11000) throw err;
          // Collided with an existing code; draw another.
        }
      }
      // Five collisions on a 31^8 space is not chance - something is wrong with
      // the generator, and a partial batch must not be passed off as a full one.
      if (!inserted) throw new Error('Could not generate a unique coupon code after 5 attempts.');
      created.push(inserted);
    }
  } catch (err) {
    await Coupon.deleteMany({ campaignId: campaign._id });
    await CouponCampaign.deleteOne({ _id: campaign._id });
    throw err;
  }

  return { campaign, coupons: created };
}

/**
 * Per-campaign counts, computed from the coupons themselves.
 *
 * Never stored on the campaign: a cached "used" total drifts the moment a
 * redemption, a release or a deactivation touches a coupon without going through
 * whatever would have updated it.
 */
export async function summarizeCampaigns(match = {}) {
  const now = new Date();
  return Coupon.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          campaignId: '$campaignId',
          // Mirrors shapeCouponForAdmin's precedence exactly.
          status: {
            $switch: {
              branches: [
                { case: { $eq: ['$isActive', false] }, then: 'INACTIVE' },
                { case: { $and: [{ $ne: ['$expiresAt', null] }, { $lte: ['$expiresAt', now] }] }, then: 'EXPIRED' },
                { case: { $gte: ['$usedCount', '$maxUses'] }, then: 'USED' },
              ],
              default: 'AVAILABLE',
            },
          },
        },
        count: { $sum: 1 },
      },
    },
  ]);
}

/** Campaign shape for the admin table, with its live statistics attached. */
export function shapeCampaignForAdmin(campaign, stats = {}) {
  const counts = { AVAILABLE: 0, USED: 0, EXPIRED: 0, INACTIVE: 0, ...stats };
  return {
    id: String(campaign._id),
    name: campaign.name,
    courseId: String(campaign.courseId?._id || campaign.courseId),
    courseTitle: campaign.courseId?.title || null,
    courseSlug: campaign.courseId?.slug || null,
    discountType: campaign.discountType,
    discountValue: campaign.discountValue,
    maxUsesPerCoupon: campaign.maxUsesPerCoupon,
    // What was asked for, beside what is actually there - they differ if coupons
    // were deleted afterwards, and hiding that would make the table lie.
    requestedCount: campaign.couponCount,
    total: counts.AVAILABLE + counts.USED + counts.EXPIRED + counts.INACTIVE,
    available: counts.AVAILABLE,
    used: counts.USED,
    expired: counts.EXPIRED,
    inactive: counts.INACTIVE,
    expiresAt: campaign.expiresAt,
    createdByEmail: campaign.createdByEmail,
    createdByName: campaign.createdByName,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  };
}

/** Admin-facing shape. `usedBy` carries real student identities, so it is only ever sent to an authenticated admin. */
export function shapeCouponForAdmin(coupon, { courseTitle = null } = {}) {
  const expired = Boolean(coupon.expiresAt && coupon.expiresAt.getTime() <= Date.now());
  const exhausted = coupon.usedCount >= coupon.maxUses;
  return {
    id: String(coupon._id),
    code: coupon.code,
    campaignId: String(coupon.campaignId?._id || coupon.campaignId || ''),
    campaignName: coupon.campaignId?.name || null,
    courseId: String(coupon.courseId?._id || coupon.courseId),
    courseTitle: courseTitle || coupon.courseId?.title || null,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    maxUses: coupon.maxUses,
    usedCount: coupon.usedCount,
    isActive: coupon.isActive,
    expiresAt: coupon.expiresAt,
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
  createCampaign,
  summarizeCampaigns,
  shapeCampaignForAdmin,
  shapeCouponForAdmin,
};
