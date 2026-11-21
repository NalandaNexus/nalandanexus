import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const { Schema } = mongoose;

/**
 * Base authentication identity for this service.
 *
 * NOTE on scope: Nalanda Nexus is split into three independent portals
 * (student / teacher / admin), each with its own frontend + backend
 * (see workspace README). This backend only ever authenticates `teacher`
 * (and, for future use, `admin`) accounts — students are managed here as
 * roster/analytics records (see models/Student.js) owned by a teacher, not
 * as logins, because student authentication lives in the separate
 * `student/backend` service. The `role` enum still includes `student` so
 * the RBAC middleware and schema are ready if these services are ever
 * consolidated, but no student-role User is ever created by this codebase.
 */
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },
    phone: { type: String, trim: true, default: null, maxlength: 20 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['teacher', 'admin', 'student'], default: 'teacher', required: true },
    avatarUrl: { type: String, default: null },
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
    lastLoginAt: { type: Date, default: null },
    // Bumped on logout-all / password change to invalidate previously
    // issued JWTs without needing a server-side session store.
    tokenVersion: { type: Number, default: 0, select: false },
    // Set true only when an admin-provisioned temp password is issued (see
    // services/auth.service.js#createTeacherAccount and
    // routes/internal.routes.js POST /teachers). While true, middleware/auth.js
    // blocks every route outside /api/teacher/auth/* so the temp password
    // can only ever be used to change itself, never to access the portal.
    mustChangePassword: { type: Boolean, default: false },

    // A single-use, time-limited link to choose a password: the self-service
    // "Forgot password" email (services/auth.service.js#requestPasswordReset),
    // or an older Admin's setup-link onboarding. Only the SHA-256 of the link's
    // token is stored, so a database read cannot be turned into a working link.
    // Cleared the moment it is used (completePasswordSetup).
    setupTokenHash: { type: String, select: false, default: undefined },
    setupTokenExpiresAt: { type: Date, select: false, default: undefined },
    // When the person last chose their own password through a link.
    passwordSetAt: { type: Date, default: null },
    // When a reset link was last emailed, so repeated requests cannot flood the inbox.
    passwordResetRequestedAt: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

userSchema.index({ setupTokenHash: 1 }, { sparse: true });

userSchema.index({ role: 1, status: 1 });

userSchema.methods.comparePassword = function comparePassword(plainText) {
  return bcrypt.compare(plainText, this.passwordHash);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    avatarUrl: this.avatarUrl,
    status: this.status,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
  };
};

userSchema.statics.hashPassword = function hashPassword(plainText) {
  return bcrypt.hash(plainText, 12);
};

export const User = mongoose.model('User', userSchema);
export default User;
