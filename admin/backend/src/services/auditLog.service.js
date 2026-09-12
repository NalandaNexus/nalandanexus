import { AuditLog } from '../models/AuditLog.js';
import { withIds } from '../utils/serialize.js';
import { emitEvent } from '../sockets/index.js';

/**
 * Fire-and-forget audit trail writer. Never throws into the caller's
 * request/response flow — a logging failure must not fail the underlying
 * admin action. Never pass passwords/tokens/secrets in `metadata`.
 */
/** True for the 24-hex form Mongoose can cast; false for a slug or a code. */
function isObjectId(value) {
  return typeof value === 'string' ? /^[0-9a-fA-F]{24}$/.test(value) : Boolean(value?._bsontype || value?.toHexString);
}

export async function recordAuditLog({ actor, action, entityType, entityId, entityRef, metadata, result = 'SUCCESS', req }) {
  try {
    // Callers pass whatever identifies the thing they changed. Routing a
    // non-ObjectId to entityRef means a slug or a stage code is recorded rather
    // than failing the cast and being swallowed by the catch below.
    const id = isObjectId(entityId) ? entityId : undefined;
    const ref = entityRef || (id ? undefined : entityId != null ? String(entityId) : undefined);

    const entry = await AuditLog.create({
      actor: actor?._id || actor?.id,
      actorName: actor?.name,
      actorRole: actor?.role,
      action,
      entityType,
      entityId: id,
      entityRef: ref,
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
