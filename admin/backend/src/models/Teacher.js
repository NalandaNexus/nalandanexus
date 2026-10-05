import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const { Schema } = mongoose;

const invitationSchema = new Schema(
  {
    tokenHash: { type: String },
    createdAt: { type: Date },
    expiresAt: { type: Date },
    isUsed: { type: Boolean, default: false },
    usedAt: { type: Date },
  },
  { _id: false }
);

const teacherSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, select: false },
    teacherId: { type: String, required: true, unique: true },
    department: { type: String, trim: true },
    subject: { type: String, trim: true },
    qualification: { type: String, trim: true },
    status: { type: String, enum: ['INVITED', 'ACTIVE', 'SUSPENDED', 'INACTIVE'], default: 'INVITED', index: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    studentsCount: { type: Number, default: 0 },
    coursesCount: { type: Number, default: 0 },
    lastActive: { type: Date },
    avatar: { type: String },

    // --- public profile, shown on the student site's About page -------------
    //
    // Published to the student portal by services/studentFacultyBridge.service.js
    // while `showOnWebsite` is on and the teacher is active, and withdrawn as
    // soon as it is off or they are suspended or deleted. Only these fields ever
    // leave this database: email, phone, credentials and governance state do not
    // belong on a public page.
    showOnWebsite: { type: Boolean, default: false, index: true },
    websiteRole: { type: String, trim: true, maxlength: 160, default: null },
    websiteCategory: { type: String, trim: true, maxlength: 80, default: null },
    expertise: { type: [String], default: [] },
    experienceNote: { type: String, trim: true, maxlength: 240, default: null },
    websiteOrder: { type: Number, default: 0 },
    facultySyncedAt: { type: Date, default: null },
    facultySyncStatus: { type: String, enum: ['synced', 'failed', null], default: null },

    invitation: { type: invitationSchema, default: undefined },
    suspensionReason: { type: String },
    resetTokenHash: { type: String, select: false },
    resetTokenExpiresAt: { type: Date, select: false },
    // Set on creation: whether the real Teacher Portal login (a separate
    // service/database - see services/teacherBridge.service.js) was
    // successfully provisioned, and whether the credentials email actually
    // went out. Never silently claim success on either — see spec item 41.
    portalProvisioned: { type: Boolean, default: false },
    credentialEmailSent: { type: Boolean, default: false },
    credentialEmailSentAt: { type: Date, default: null },
    emailDeliveryStatus: { type: String, enum: ['sent', 'failed', 'stubbed', null], default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

teacherSchema.index({ name: 'text', email: 'text', department: 'text', subject: 'text' });

teacherSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.passwordHash);
};

teacherSchema.statics.hashPassword = function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
};

// Soft-delete aware query helpers — default reads exclude soft-deleted records
// unless a caller explicitly opts in via `.where('deletedAt').ne(undefined)`.
teacherSchema.query.notDeleted = function notDeleted() {
  return this.where({ deletedAt: null });
};

export const Teacher = mongoose.model('Teacher', teacherSchema);
export default Teacher;
