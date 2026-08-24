import mongoose from 'mongoose';

const { Schema } = mongoose;

export const ROLES = ['student', 'teacher', 'admin', 'super_admin'];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, trim: true, default: null },
    // Optional: null for accounts created via Google Sign-In that never set a password.
    passwordHash: { type: String, default: null, select: false },
    // Optional: set only for accounts created/linked via Google Sign-In. No
    // `default` here deliberately - a sparse unique index only excludes
    // documents where the field is entirely absent, not ones set to `null`,
    // so giving this a `default: null` would make every password-only user
    // collide on the same indexed null value.
    googleId: { type: String, unique: true, sparse: true, index: true },
    role: { type: String, enum: ROLES, default: 'student', index: true },
    avatar: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Never leak the hash even if a query forgets to exclude it.
userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
