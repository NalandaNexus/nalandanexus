import { AuditLog } from '../models/AuditLog.js';
import { withIds } from '../utils/serialize.js';
import { emitEvent } from '../sockets/index.js';

/**
 * Fire-and-forget audit trail writer. Never throws into the caller's
 * request/response flow — a logging failure must not fail the underlying
 * admin action. Never pass passwords/tokens/secrets in `metadata`.
 */
export async function recordAuditLog({ actor, action, entityType, entityId, metadata, result = 'SUCCESS', req }) {
  try {
    const entry = await AuditLog.create({
      actor: actor?._id || actor?.id,
      actorName: actor?.name,
      actorRole: actor?.role,
      action,
      entityType,
      entityId,
      metadata,
      result,
      ip: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    });
    emitEvent.auditLogCreated(entry);
    return entry;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[audit] failed to record audit log:', err.message);
    return null;
  }
}

export async function listAuditLogs({ page, limit, skip, filter, sort }) {
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items: withIds(items), total };
}

export default { recordAuditLog, listAuditLogs };
