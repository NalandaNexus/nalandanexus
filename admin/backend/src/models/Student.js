import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const { Schema } = mongoose;

const studentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, select: false },
    rollNo: { type: String, required: true, unique: true, trim: true },
    batch: { type: String, trim: true },
    semester: { type: Number, min: 1, max: 12 },
    department: { type: String, trim: true, index: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'], default: 'ACTIVE', index: true },
    attendancePercent: { type: Number, default: 0, min: 0, max: 100 },
    gpa: { type: Number, default: 0, min: 0, max: 10 },
    enrolledCourses: [{ type: Schema.Types.ObjectId, ref: 'Course' }],
    completedTasks: { type: Number, default: 0 },
    lastActive: { type: Date },
    avatar: { type: String },

    // --- students who enrolled through the student portal ----------------------
    //
    // Written only by services/portalStudent.service.js, from the record the
    // student portal sends whenever a student enrols or changes their profile.
    // `source` tells the two kinds of record apart: 'manual' was entered by an
    // admin here, 'student-portal' was created by that sync.
    source: { type: String, enum: ['manual', 'student-portal'], default: 'manual', index: true },
    // The student portal's user id: the identity a sync is keyed on, never the
    // name. No default - the unique index below is sparse, and a sparse index only
    // skips a document whose field is genuinely absent.
    portalUserId: { type: String },
    enrollmentNumber: { type: String, trim: true, uppercase: true },
    guardianName: { type: String, trim: true, default: null },
    grade: { type: String, trim: true, default: null }, // the student's class, e.g. "Class 9"
    profileComplete: { type: Boolean, default: false },
    profileCompletedAt: { type: Date, default: null },
    portalEnrollments: {
      type: [
        new Schema(
          {
            enrollmentId: { type: String, default: null },
            courseSlug: { type: String, default: null },
            courseTitle: { type: String, default: null },
            status: { type: String, enum: ['active', 'revoked'], required: true },
            enrolledAt: { type: Date, default: null },
            endsAt: { type: Date, default: null },
            batchCode: { type: String, default: null },
          },
          { _id: false }
        ),
      ],
      default: undefined,
    },
    // When the record last applied here was read on the student portal, so an
    // older one delivered late cannot overwrite it.
    portalSyncedAt: { type: Date, default: null },

    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

studentSchema.index({ name: 'text', email: 'text', rollNo: 'text', department: 'text' });
// One record per portal student, however many times their record is delivered.
studentSchema.index({ portalUserId: 1 }, { unique: true, sparse: true });
studentSchema.index({ enrollmentNumber: 1 }, { sparse: true });

studentSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.passwordHash);
};

studentSchema.statics.hashPassword = function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
};

export const Student = mongoose.model('Student', studentSchema);
export default Student;
