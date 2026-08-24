import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * One record per (student, class, date). The unique compound index below
 * is what prevents duplicate attendance for the same student/class/day;
 * "corrections" are supported by updating the existing document (see
 * services/attendance.service.js#markAttendance, which upserts) rather than
 * inserting a second row.
 */
const attendanceSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    class: { type: Schema.Types.ObjectId, ref: 'SchoolClass', required: true, index: true },
    teacher: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
    date: { type: Date, required: true }, // normalized to UTC midnight
    status: { type: String, enum: ['present', 'absent', 'late'], required: true },
    markedBy: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true },
    remarks: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: true }
);

attendanceSchema.index({ student: 1, class: 1, date: 1 }, { unique: true });
attendanceSchema.index({ class: 1, date: -1 });
attendanceSchema.index({ teacher: 1, date: -1 });

/** Normalizes any Date/string to UTC midnight so same-day marks collide correctly. */
attendanceSchema.statics.normalizeDate = function normalizeDate(input) {
  const d = input ? new Date(input) : new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

export const Attendance = mongoose.model('Attendance', attendanceSchema);
export default Attendance;
