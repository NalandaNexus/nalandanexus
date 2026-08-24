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
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

studentSchema.index({ name: 'text', email: 'text', rollNo: 'text', department: 'text' });

studentSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.passwordHash);
};

studentSchema.statics.hashPassword = function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
};

export const Student = mongoose.model('Student', studentSchema);
export default Student;
