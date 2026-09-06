import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A redeemable discount on ONE course.
 *
 * Built for the launch giveaway - 25 single-use codes granting 100% off - but
 * deliberately not hard-wired to that: the course is a reference, the discount is
 * a type and a value, and the usage cap is a number. Nothing here knows about
 * "25" or about any particular course.
 *
 * The redemption rules live in services/coupon.service.js rather than in this
 * schema, because they have to be applied as ONE atomic database operation. A
 * coupon that is checked and then claimed in two steps can be claimed twice by
 * two simultaneous requests, which for a single-use code is the whole ballgame.
 */
const usedBySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    enrollmentId: { type: String, default: null }, // the business ENR-… identifier
    usedAt: { type: Date, default: Date.now },
    amountDiscountedInPaise: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const couponSchema = new Schema(
  {
    // Stored already normalised (trimmed, uppercased) so a lookup never has to
    // guess at casing, and so the unique index actually means what it says -
    // "nnx7k4p9" and "NNX7K4P9" must not be two different coupons.
    code: { type: String, required: true, unique: true, trim: true, uppercase: true, minlength: 4, maxlength: 32 },

    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },

    // FULL is the only type the launch needs. PERCENT and FIXED are here because
    // the alternative is a boolean that has to be widened later, and widening a
    // boolean in a payments path is worse than an enum that starts with one
    // meaningful value. Pricing for each lives in one place (coupon.service.js).
    discountType: { type: String, enum: ['FULL', 'PERCENT', 'FIXED'], default: 'FULL', required: true },
    // Percent for PERCENT, paise for FIXED, ignored for FULL.
    discountValue: { type: Number, default: 100, min: 0 },

    maxUses: { type: Number, default: 1, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    usedBy: { type: [usedBySchema], default: [] },

    isActive: { type: Boolean, default: true, index: true },
    // Null means "never expires", which is a real choice rather than a missing
    // value - the launch codes have no deadline.
    expiresAt: { type: Date, default: null },

    // Free-text label so an admin can tell one generated batch from another.
    batchLabel: { type: String, default: null, trim: true, maxlength: 120 },
  },
  { timestamps: true }
);

// Serves the redemption query, which always filters on all three together.
couponSchema.index({ courseId: 1, isActive: 1, usedCount: 1 });
// Serves the admin "which coupons has this student used" lookup.
couponSchema.index({ 'usedBy.userId': 1 });

/** True when every seat on this coupon is spoken for. Derived, never stored - a stored flag drifts. */
couponSchema.virtual('isExhausted').get(function isExhausted() {
  return this.usedCount >= this.maxUses;
});

export const Coupon = mongoose.model('Coupon', couponSchema);
export default Coupon;
