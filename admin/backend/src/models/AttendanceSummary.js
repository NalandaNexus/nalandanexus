import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * One row per (class, date) - a daily tally, not a per-student record.
 * Admin only needs aggregate monitoring here; the real per-session
 * Attendance collection stays entirely owned by teacher/backend.
 * `sourceId` is a composite `${classId}_${date}` key teacher/backend
 * builds, giving idempotent upsert-per-day semantics.
 */
const attendanceSummarySchema = new Schema(
  {
    className: { type: String, default: '' },
    teacherName: { type: String, default: '' },
    date: { type: String, required: true }, // YYYY-MM-DD
    presentCount: { type: Number, default: 0 },
    absentCount: { type: Number, default: 0 },
    lateCount: { type: Number, default: 0 },
    totalCount: { type: Number, default: 0 },
    sourceId: { type: String },
  },
  { timestamps: true }
);

attendanceSummarySchema.index({ sourceId: 1 }, { unique: true, sparse: true });
attendanceSummarySchema.index({ date: -1 });

export const AttendanceSummary = mongoose.model('AttendanceSummary', attendanceSummarySchema);
export default AttendanceSummary;
