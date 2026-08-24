import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Teacher profile — the professional/pedagogical data that sits alongside
 * (but is kept separate from) the auth-only User document. Referenced by
 * almost every other collection as the ownership/authorization anchor.
 */
const teacherSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    teacherId: { type: String, required: true, unique: true, trim: true, uppercase: true }, // e.g. TCH-0001

    title: { type: String, default: 'Faculty', trim: true, maxlength: 160 }, // designation shown in header greeting
    department: { type: String, default: null, trim: true, maxlength: 120 },
    subject: { type: String, default: null, trim: true, maxlength: 120 }, // primary teaching subject
    qualification: { type: String, default: null, trim: true, maxlength: 200 },
    experienceYears: { type: Number, default: 0, min: 0, max: 60 },
    bio: { type: String, default: null, maxlength: 1000 },

    tier: { type: String, enum: ['free', 'pro'], default: 'free' },
    proExpiresAt: { type: Date, default: null },

    accountStatus: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },

    preferences: {
      emailNotifications: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: true },
      theme: { type: String, enum: ['dark', 'light'], default: 'dark' },
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

teacherSchema.virtual('isPro').get(function isProVirtual() {
  return this.tier === 'pro' && (!this.proExpiresAt || this.proExpiresAt > new Date());
});

teacherSchema.methods.toSafeJSON = function toSafeJSON(user) {
  return {
    id: this._id,
    teacherId: this.teacherId,
    name: user?.name,
    email: user?.email,
    phone: user?.phone,
    avatarUrl: user?.avatarUrl,
    mustChangePassword: Boolean(user?.mustChangePassword),
    title: this.title,
    department: this.department,
    subject: this.subject,
    qualification: this.qualification,
    experienceYears: this.experienceYears,
    bio: this.bio,
    tier: this.tier,
    isPro: this.isPro,
    accountStatus: this.accountStatus,
    preferences: this.preferences,
    createdAt: this.createdAt,
  };
};

export const Teacher = mongoose.model('Teacher', teacherSchema);
export default Teacher;
