import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A batch of coupons minted together for one course.
 *
 * The campaign is what an operator actually thinks in: "the 25 free seats we
 * gave away at launch". Coupons carry its _id, so the codes stay anonymous
 * single-use tokens while the reporting question - how many of that giveaway
 * are left - has somewhere to live.
 *
 * It also gives generation an idempotency key. Re-running the seed command, or
 * double-clicking Generate, must not quietly mint a second set of 25 free
 * courses; the unique index on (courseId, name) is what makes that impossible
 * rather than merely unlikely.
 */
const couponCampaignSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },

    // The terms every coupon in the campaign was minted with. Recorded here
    // rather than only on the coupons so the campaign still describes itself
    // after its coupons are spent, and so a later batch cannot silently differ.
    discountType: { type: String, enum: ['FULL', 'PERCENT', 'FIXED'], default: 'FULL', required: true },
    discountValue: { type: Number, default: 100, min: 0 },
    maxUsesPerCoupon: { type: Number, default: 1, min: 1 },
    couponCount: { type: Number, required: true, min: 1 },
    expiresAt: { type: Date, default: null },

    // Who authorised the giveaway. Free seats in a paid course are worth real
    // money, so this is answerable later.
    createdByEmail: { type: String, default: null, trim: true, lowercase: true },
    createdByName: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

// The idempotency guard: one campaign of a given name per course.
couponCampaignSchema.index({ courseId: 1, name: 1 }, { unique: true });

export const CouponCampaign =
  mongoose.models.CouponCampaign || mongoose.model('CouponCampaign', couponCampaignSchema);

export default CouponCampaign;
