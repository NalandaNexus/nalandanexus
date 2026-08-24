import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Append-only trail of sensitive/important teacher actions (assignment
 * created/deleted, marks changed, attendance changed, profile changed,
 * class modified, ...). Never stores passwords/tokens/secrets — see
 * services/audit.service.js for the write helper and the explicit list of
 * actions it is called from.
 */
const auditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
    action: { type: String, required: true, trim: true },
    targetType: { type: String, default: null },
    targetId: { type: Schema.Types.ObjectId, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: null },
  },
  { timestamps: true }
);

auditLogSchema.index({ actor: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
