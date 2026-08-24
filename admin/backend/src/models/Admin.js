import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { ROLES, DEFAULT_ROLE_PERMISSIONS } from '../constants/permissions.js';

const { Schema } = mongoose;

/**
 * Login-capable account for the Admin portal (SUPER_ADMIN / ADMIN / STAFF).
 * Deliberately its own collection, not a shared `User` collection with
 * teacher/backend or student/backend — those two backends already live on
 * separate MongoDB deployments with their own User schemas, so there is no
 * existing shared identity store to attach to. See PHASE audit notes.
 */
const adminSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.STAFF, index: true },
    permissions: { type: [String], default: undefined },
    avatar: { type: String },
    badge: { type: String, default: 'Administrator' },
    status: { type: String, enum: ['ACTIVE', 'SUSPENDED'], default: 'ACTIVE', index: true },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    tokenVersion: { type: Number, default: 0, select: false },
  },
  { timestamps: true }
);

adminSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

adminSchema.methods.hasPermission = function hasPermission(permission) {
  if (this.role === ROLES.SUPER_ADMIN) return true;
  const effective = this.permissions && this.permissions.length ? this.permissions : DEFAULT_ROLE_PERMISSIONS[this.role] || [];
  return effective.includes(permission);
};

adminSchema.methods.toSafeJSON = function toSafeJSON() {
  const obj = this.toObject({ virtuals: false });
  delete obj.passwordHash;
  delete obj.tokenVersion;
  delete obj.__v;
  return obj;
};

adminSchema.statics.hashPassword = function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
};

export const Admin = mongoose.model('Admin', adminSchema);
export default Admin;
