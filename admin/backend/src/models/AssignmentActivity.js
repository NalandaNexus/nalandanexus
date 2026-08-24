import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Lightweight read-model of a teacher/backend Assignment, bridged in for
 * admin monitoring only (see routes/internal.routes.js) — never the
 * source of truth (that's teacher/backend's own Assignment+Submission
 * collections, a separate service/database). Admin never writes to this;
 * it only mirrors live counts pushed by teacher/backend's own
 * services/adminBridge.service.js.
 */
const assignmentActivitySchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    className: { type: String, default: '' },
    teacherName: { type: String, default: '' },
    dueDate: { type: Date },
    total: { type: Number, default: 0 },
    submitted: { type: Number, default: 0 },
    toGrade: { type: Number, default: 0 },
    avgScore: { type: Number, default: null },
    status: { type: String, default: 'published' },
    // No default deliberately - see the identical, already-fixed sparse-index bug elsewhere in this system.
    sourceId: { type: String },
  },
  { timestamps: true }
);

assignmentActivitySchema.index({ sourceId: 1 }, { unique: true, sparse: true });
assignmentActivitySchema.index({ dueDate: -1 });

export const AssignmentActivity = mongoose.model('AssignmentActivity', assignmentActivitySchema);
export default AssignmentActivity;
