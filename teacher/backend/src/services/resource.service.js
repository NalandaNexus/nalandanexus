import fs from 'node:fs/promises';
import path from 'node:path';
import { Resource } from '../models/Resource.js';
import { Teacher } from '../models/Teacher.js';
import { ApiError } from '../utils/ApiError.js';
import { assertClassOwnership } from './class.service.js';
import { logAudit } from './audit.service.js';
import { UPLOADS_ROOT } from '../middleware/upload.js';
import { pushResourceToStudents, retractResourceFromStudents } from './studentBridge.service.js';
import { publicUrlFor } from '../middleware/upload.js';
import { destroyCloudinaryAsset } from '../middleware/cloudinaryStorage.js';

function shape(r) {
  return {
    id: r._id,
    title: r.title,
    type: r.type,
    fileUrl: r.fileUrl,
    fileSize: r.fileSize,
    sizeLabel: formatBytes(r.fileSize),
    classId: r.class,
    subject: r.subject,
    downloads: r.downloadsCount,
    createdAt: r.createdAt,
  };
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function inferType(mimetype) {
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype.includes('presentation')) return 'slide';
  if (mimetype.includes('word')) return 'doc';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('image/')) return 'image';
  return 'other';
}

export async function listResources(teacherId) {
  const rows = await Resource.find({ teacher: teacherId }).sort({ createdAt: -1 }).lean();
  return rows.map(shape);
}

export async function createResource(teacherId, { title, subject, classId }, file, ip) {
  if (!file) throw ApiError.badRequest('A file is required.', 'FILE_REQUIRED');
  const classDoc = classId ? await assertClassOwnership(teacherId, classId) : null;

  const resource = await Resource.create({
    title,
    type: inferType(file.mimetype),
    fileUrl: publicUrlFor('resources', file.filename),
    fileName: file.originalname,
    fileSize: file.size,
    subject: subject || null,
    class: classId || null,
    teacher: teacherId,
  });

  await logAudit({ actorId: teacherId, action: 'resource.uploaded', targetType: 'Resource', targetId: resource._id, metadata: { title }, ip });

  // Cross-portal delivery: push to the student backend if this resource's
  // class is linked to a purchasable course. Best-effort - see
  // studentBridge.service.js.
  if (classDoc?.studentCourseSlug) {
    const teacher = await Teacher.findById(teacherId).populate('user', 'name').lean();
    await pushResourceToStudents(resource, classDoc, teacher?.user?.name);
  }

  return shape(resource);
}

export async function registerDownload(teacherId, resourceId) {
  const resource = await Resource.findOneAndUpdate(
    { _id: resourceId, teacher: teacherId },
    { $inc: { downloadsCount: 1 } },
    { new: true }
  );
  if (!resource) throw ApiError.notFound('Resource not found.', 'RESOURCE_NOT_FOUND');
  return shape(resource);
}

export async function deleteResource(teacherId, resourceId, ip) {
  const resource = await Resource.findOneAndDelete({ _id: resourceId, teacher: teacherId });
  if (!resource) throw ApiError.notFound('Resource not found.', 'RESOURCE_NOT_FOUND');

  // Without this, the file stays on disk and permanently reachable at its
  // static /uploads/... URL even after the record — and the UI's "delete" —
  // says it's gone. Best-effort: a missing file (already cleaned up, moved,
  // etc.) must not turn a successful delete into a 500.
  if (resource.fileUrl && /^https?:\/\//i.test(resource.fileUrl)) {
    // Stored in Cloudinary rather than on this disk - deleting the local
    // path would silently no-op and orphan the remote asset forever.
    await destroyCloudinaryAsset(resource.fileUrl);
  } else if (resource.fileUrl) {
    const filePath = path.join(UPLOADS_ROOT, resource.fileUrl.replace(/^\/uploads\//, ''));
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('[resource] Failed to remove file from disk:', filePath, err.message);
      }
    }
  }

  await logAudit({ actorId: teacherId, action: 'resource.deleted', targetType: 'Resource', targetId: resourceId, ip });
  await retractResourceFromStudents(resourceId);
  return { id: resourceId };
}

export default { listResources, createResource, registerDownload, deleteResource };
