import { Announcement } from '../models/Announcement.js';
import { TeacherAnnouncement } from '../models/TeacherAnnouncement.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';
import { withIds } from '../utils/serialize.js';
import { recordAuditLog } from './auditLog.service.js';
import { notifyAllAdmins } from './notification.service.js';
import { emitEvent } from '../sockets/index.js';
import { pushAnnouncementToStudents } from './studentBridge.service.js';
import { pushAnnouncementToTeachers } from './teacherBridge.service.js';

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

export default { listAnnouncements, createAnnouncement, ingestTeacherAnnouncement, listTeacherAnnouncements, retractTeacherAnnouncement };
