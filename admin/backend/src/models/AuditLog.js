import mongoose from 'mongoose';

const { Schema } = mongoose;

const auditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'Admin', index: true },
    actorName: { type: String },
    actorRole: { type: String },
    action: { type: String, required: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: Schema.Types.ObjectId },
    /**
     * The identity of things that are not addressed by ObjectId.
     *
     * Course slugs, stage codes, achievement codes and the GLOBAL rules
     * singleton all identify real entities that have no ObjectId in THIS
     * database. Writing them into entityId failed the cast, and recordAuditLog
     * catches its own errors - so those entries were dropped in silence, which
     * is the worst possible failure mode for an audit trail.
     */
    entityRef: { type: String, index: true },
    metadata: { type: Schema.Types.Mixed },
    result: { type: String, enum: ['SUCCESS', 'FAILURE'], default: 'SUCCESS' },
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
