import { env } from '../config/env.js';

/**
 * Bridges an admin-uploaded Resource (magazine/event photo/program
 * material) into student/backend's real public Resource collection so it
 * shows on the Landing Page — a separate service/database. Mirrors
 * studentCourseBridge.service.js exactly (shared-secret auth, idempotent on
 * sourceId, best-effort/never-throws).
 */

function isConfigured() {
  return Boolean(env.studentBridge.url && env.studentBridge.serviceKey);
}

async function call(path, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${env.studentBridge.url}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-Internal-Service-Key': env.studentBridge.serviceKey, ...options.headers },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Student backend returned ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/** Publishes (creates or updates) a resource on the Landing Page. Never throws; returns a real status. */
export async function publishResourceToStudents(resource) {
  if (!isConfigured()) return { synced: false, reason: 'NOT_CONFIGURED' };
  try {
    await call('/api/internal/resources', {
      method: 'POST',
      body: JSON.stringify({
        sourceId: String(resource._id),
        title: resource.title,
        description: resource.description || '',
        type: resource.type,
        // Resolved to an absolute URL here (this backend already serves
        // /uploads statically, cross-origin-enabled — see app.js) - student
        // backend just stores whatever it's given, mirroring how the course
        // bridge resolves its own image URL.
        fileUrl: `${env.serverUrl}${resource.file}`,
        fileName: resource.fileName,
        fileType: resource.fileType,
        fileSizeBytes: resource.fileSizeBytes,
        uploadedByName: 'Nalanda Nexus Admin',
        isPublished: resource.isPublished,
      }),
    });
    return { synced: true };
  } catch (err) {
    console.error('[studentResourceBridge] Failed to publish resource to Landing Page:', err.message);
    return { synced: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

/** Retracts a previously-bridged resource (real delete — no student ever "owns" a magazine/event photo the way they own a course). */
export async function retractResourceFromStudents(sourceId) {
  if (!isConfigured()) return { synced: false, reason: 'NOT_CONFIGURED' };
  try {
    await call(`/api/internal/resources/${sourceId}`, { method: 'DELETE' });
    return { synced: true };
  } catch (err) {
    console.error('[studentResourceBridge] Failed to retract resource from Landing Page:', err.message);
    return { synced: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

export default { publishResourceToStudents, retractResourceFromStudents };
