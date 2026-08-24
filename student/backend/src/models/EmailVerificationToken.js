import mongoose from 'mongoose';

const { Schema } = mongoose;

/** Mirrors PasswordResetToken.js exactly - same one-time-token pattern, applied to email verification instead of password reset. */
const emailVerificationTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

emailVerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailVerificationToken = mongoose.model('EmailVerificationToken', emailVerificationTokenSchema);
