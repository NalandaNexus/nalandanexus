import { AuditLog } from '../models/AuditLog.js';

/**
 * Fire-and-forget audit trail writer. Never throws — an audit-log failure
 * must not break the user-facing action it's describing, so errors are
 * swallowed after being logged server-side (this is the one deliberate,
 * commented exception to the "never silently swallow errors" rule, and it
 * only ever applies to this best-effort logging path).
 */
export async function logAudit({ actorId, action, targetType = null, targetId = null, metadata = {}, ip = null }) {
  try {
    await AuditLog.create({ actor: actorId, action, targetType, targetId, metadata, ip });
  } catch (err) {
    console.error('[audit] Failed to write audit log entry:', action, err.message);
  }
}

export default logAudit;
