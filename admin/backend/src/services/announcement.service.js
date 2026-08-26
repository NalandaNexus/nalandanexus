import { Announcement } from '../models/Announcement.js';
import { TeacherAnnouncement } from '../models/TeacherAnnouncement.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';
import { withIds } from '../utils/serialize.js';
import { recordAuditLog } from './auditLog.service.js';
import { notifyAllAdmins } from './notification.service.js';
import { emitEvent } from '../sockets/index.js';
import {
  pushAnnouncementToStudents,
  updateAnnouncementForStudents,
  removeAnnouncementFromStudents,
} from './studentBridge.service.js';
import { pushAnnouncementToTeachers, removeAnnouncementFromTeachers } from './teacherBridge.service.js';
import { ApiError } from '../utils/ApiError.js';

export async function listAnnouncements(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = { deletedAt: null };
  if (query.audience) filter.audience = { $in: [query.audience, 'ALL'] };

  const [items, total] = await Promise.all([
    Announcement.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(limit).populate('author', 'name').lean(),
    Announcement.countDocuments(filter),
  ]);
  return { items: withIds(items), meta: buildPaginationMeta({ page, limit, total }) };
}

export async function createAnnouncement(data, actor, req) {
  const announcement = await Announcement.create({ ...data, author: actor._id });
  await recordAuditLog({ actor, action: 'announcement.created', entityType: 'Announcement', entityId: announcement._id, req });
  await notifyAllAdmins({
    excludeAdminId: actor._id,
    type: 'ANNOUNCEMENT',
    title: `New ${data.priority === 'HIGH' ? 'high-priority ' : ''}announcement: ${announcement.title}`,
    message: announcement.content.length > 140 ? `${announcement.content.slice(0, 140)}…` : announcement.content,
    relatedEntityType: 'Announcement',
    relatedEntityId: announcement._id,
  });
  emitEvent.announcementCreated(announcement);

  // Cross-portal delivery: push STUDENTS/ALL-audience announcements to the
  // (separate) student backend so they actually reach students, not just
  // connected admin sessions. Best-effort — see studentBridge.service.js.
  if (announcement.audience !== 'TEACHERS') {
    await pushAnnouncementToStudents(announcement, actor?.name);
  }
  // Symmetric delivery to teacher/backend for TEACHERS/ALL-audience
  // announcements — this direction genuinely never existed before (see
  // teacherBridge.service.js#pushAnnouncementToTeachers). Best-effort.
  if (announcement.audience !== 'STUDENTS') {
    await pushAnnouncementToTeachers({
      sourceId: String(announcement._id),
      title: announcement.title,
      content: announcement.content,
      priority: announcement.priority,
      authorName: actor?.name,
      publishedAt: announcement.publishedAt,
    });
  }

  return announcement;
}

/**
 * Edits an existing announcement and mirrors the change to wherever it was
 * already delivered. Without this, an announcement was write-once: a typo,
 * a wrong link or a test post published to the public student landing page
 * could never be corrected or taken down through the product.
 */
export async function updateAnnouncement(id, data, actor, req) {
  const announcement = await Announcement.findOne({ _id: id, deletedAt: null });
  if (!announcement) throw ApiError.notFound('Announcement not found', 'ANNOUNCEMENT_NOT_FOUND');

  const previousAudience = announcement.audience;
  Object.assign(announcement, data);
  await announcement.save();

  await recordAuditLog({ actor, action: 'announcement.updated', entityType: 'Announcement', entityId: announcement._id, req });
  emitEvent.announcementCreated(announcement);

  // Student side: an edit that keeps students in the audience is an update;
  // one that removes them is effectively a retraction over there.
  if (announcement.audience !== 'TEACHERS') {
    await updateAnnouncementForStudents(announcement);
  } else if (previousAudience !== 'TEACHERS') {
    await removeAnnouncementFromStudents(String(announcement._id));
  }

  // Teacher side upserts on sourceId, so re-pushing is the update path.
  if (announcement.audience !== 'STUDENTS') {
    await pushAnnouncementToTeachers({
      sourceId: String(announcement._id),
      title: announcement.title,
      content: announcement.content,
      priority: announcement.priority,
      authorName: actor?.name,
      publishedAt: announcement.publishedAt,
    });
  } else if (previousAudience !== 'STUDENTS') {
    await removeAnnouncementFromTeachers(String(announcement._id));
  }

  return announcement;
}

/**
 * Soft-deletes an announcement and retracts it from both portals. Soft
 * rather than hard so the audit trail still resolves the entity it refers
 * to; listAnnouncements already filters on deletedAt.
 */
export async function deleteAnnouncement(id, actor, req) {
  const announcement = await Announcement.findOne({ _id: id, deletedAt: null });
  if (!announcement) throw ApiError.notFound('Announcement not found', 'ANNOUNCEMENT_NOT_FOUND');

  announcement.deletedAt = new Date();
  await announcement.save();

  await recordAuditLog({ actor, action: 'announcement.deleted', entityType: 'Announcement', entityId: announcement._id, req });

  // Retract everywhere it was delivered, regardless of current audience -
  // the audience may have changed since it was first published.
  await removeAnnouncementFromStudents(String(announcement._id));
  await removeAnnouncementFromTeachers(String(announcement._id));

  return announcement;
}

/**
 * Receives a real, published announcement from teacher/backend (see
 * teacher/backend/src/services/adminBridge.service.js#pushAnnouncementActivity).
 * Idempotent on sourceId. Fans a real Notification out to every active
 * admin — the same helper admin's own announcement.created path already
 * uses — so a teacher's broadcast shows up in the bell, not just a list.
 */
export async function ingestTeacherAnnouncement(data) {
  const existing = await TeacherAnnouncement.findOne({ sourceId: data.sourceId });
  if (existing) return existing;

  const announcement = await TeacherAnnouncement.create(data);

  await notifyAllAdmins({
    type: 'ANNOUNCEMENT',
    title: `New announcement from ${data.teacherName || 'a teacher'}: ${announcement.title}`,
    message: announcement.content.length > 140 ? `${announcement.content.slice(0, 140)}…` : announcement.content,
    relatedEntityType: 'TeacherAnnouncement',
    relatedEntityId: announcement._id,
  });

  return announcement;
}

export async function listTeacherAnnouncements(query) {
  const { page, limit, skip } = parsePagination(query);
  const [items, total] = await Promise.all([
    TeacherAnnouncement.find({}).sort({ publishedAt: -1 }).skip(skip).limit(limit).lean(),
    TeacherAnnouncement.countDocuments({}),
  ]);
  return { items: withIds(items), meta: buildPaginationMeta({ page, limit, total }) };
}

export async function retractTeacherAnnouncement(sourceId) {
  const removed = await TeacherAnnouncement.findOneAndDelete({ sourceId });
  return removed;
}

export default {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  ingestTeacherAnnouncement,
  listTeacherAnnouncements,
  retractTeacherAnnouncement,
};
