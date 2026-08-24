import fs from 'node:fs/promises';
import path from 'node:path';
import { Announcement } from '../models/Announcement.js';
import { SchoolClass } from '../models/SchoolClass.js';
import { Teacher } from '../models/Teacher.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';
import { logAudit } from './audit.service.js';
import { notifyTeacher } from './notification.service.js';
import { emitToTeacher, emitToClass } from '../sockets/index.js';
import { UPLOADS_ROOT } from '../middleware/upload.js';
import { pushAnnouncementToStudents, retractAnnouncementFromStudents } from './studentBridge.service.js';
import { pushAnnouncementActivity, retractAnnouncementActivity } from './adminBridge.service.js';
import { AdminAnnouncement } from '../models/AdminAnnouncement.js';

const WRITABLE_FIELDS = [
  'title',
  'description',
  'type',
  'priority',
  'audience',
  'classes',
  'eventDate',
  'startTime',
  'endTime',
  'venue',
  'registrationLink',
  'publishAt',
  'expiresAt',
];

function shape(a) {
  return {
    id: a._id,
    title: a.title,
    description: a.description,
    type: a.type,
    priority: a.priority,
    audience: a.audience,
    classIds: (a.classes || []).map((c) => (c._id ? String(c._id) : String(c))),
    classes: (a.classes || []).some((c) => c && c.name)
      ? a.classes.map((c) => ({ id: c._id, name: c.name, code: c.code }))
      : undefined,
    eventDate: a.eventDate,
    startTime: a.startTime,
    endTime: a.endTime,
    venue: a.venue,
    registrationLink: a.registrationLink,
    attachmentUrl: a.attachmentUrl,
    attachmentName: a.attachmentName,
    bannerUrl: a.bannerUrl,
    publishAt: a.publishAt,
    expiresAt: a.expiresAt,
    status: a.status,
    publishedAt: a.publishedAt,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

/** Every audience choice must resolve to classes this teacher actually owns — never trust posted IDs. */
async function resolveAndValidateAudience(teacherId, { audience, classes }) {
  if (audience === 'all_my_classes') {
    const owned = await SchoolClass.find({ teacher: teacherId, status: 'active' }).select('_id').lean();
    return owned.map((c) => c._id);
  }

  if (audience === 'classes') {
    const ids = Array.isArray(classes) ? [...new Set(classes)] : [];
    if (ids.length === 0) {
      throw ApiError.badRequest('Select at least one class to target.', 'AUDIENCE_REQUIRED');
    }
    const owned = await SchoolClass.find({ _id: { $in: ids }, teacher: teacherId }).select('_id').lean();
    if (owned.length !== ids.length) {
      throw ApiError.forbidden('You can only target classes you teach.', 'CLASS_NOT_OWNED');
    }
    return owned.map((c) => c._id);
  }

  throw ApiError.badRequest('Invalid audience.', 'INVALID_AUDIENCE');
}

function deriveInitialStatus({ status, publishAt }) {
  if (status === 'draft') return 'draft';
  const at = publishAt ? new Date(publishAt) : new Date();
  return at.getTime() > Date.now() ? 'scheduled' : 'published';
}

async function deliver(announcement) {
  const payload = shape(announcement);
  emitToTeacher(announcement.teacher, 'announcement:published', payload);
  for (const classId of announcement.classes) {
    emitToClass(classId, 'announcement:published', payload);
  }
  // Self-notification so the teacher's bell/badge reflects it even if no
  // client is connected at the moment it goes live (e.g. a scheduled
  // publish that fires while the teacher is offline).
  await notifyTeacher(announcement.teacher, {
    type: 'announcement',
    title: `${labelForType(announcement.type)} published`,
    message: announcement.title,
    relatedEntityType: 'Announcement',
    relatedEntityId: announcement._id,
  });

  // Cross-portal delivery: push to the (separate) student backend so this
  // actually reaches students, not just this teacher's own connected
  // devices/class rooms in this database. Best-effort — see
  // studentBridge.service.js for why this never throws.
  const teacher = await Teacher.findById(announcement.teacher).populate('user', 'name').lean();
  await pushAnnouncementToStudents(announcement, teacher?.user?.name);

  // Symmetric delivery to admin/backend's own monitoring dashboard — a
  // real Notification for every admin, not just a passive log entry. Never
  // existed before this pass; see adminBridge.service.js#pushAnnouncementActivity.
  await pushAnnouncementActivity(
    {
      ...payload,
      className: announcement.audience === 'all_my_classes' ? 'All my classes' : `${announcement.classes.length} class(es)`,
    },
    teacher?.user?.name
  );
}

function labelForType(type) {
  return { ANNOUNCEMENT: 'Announcement', CLASS_UPDATE: 'Class update', EVENT: 'Event', CONVOCATION: 'Convocation update', ACADEMIC: 'Academic notice', URGENT: 'Urgent notice' }[type] || 'Announcement';
}

export async function createAnnouncement(teacherId, body, file, ip) {
  const status = body.status === 'draft' ? 'draft' : undefined; // explicit draft request only; anything else is computed
  const classIds = await resolveAndValidateAudience(teacherId, body);

  const doc = {
    teacher: teacherId,
    title: body.title,
    description: body.description,
    type: body.type,
    priority: body.priority || 'normal',
    audience: body.audience,
    classes: classIds,
    eventDate: body.eventDate || null,
    startTime: body.startTime || null,
    endTime: body.endTime || null,
    venue: body.venue || null,
    registrationLink: body.registrationLink || null,
    publishAt: body.publishAt || Date.now(),
    expiresAt: body.expiresAt || null,
  };
  doc.status = deriveInitialStatus({ status, publishAt: doc.publishAt });
  if (doc.status === 'published') doc.publishedAt = new Date();

  if (file) {
    doc.attachmentUrl = `/uploads/announcements/${file.filename}`;
    doc.attachmentName = file.originalname;
  }

  const announcement = await Announcement.create(doc);
  await logAudit({ actorId: teacherId, action: 'announcement.created', targetType: 'Announcement', targetId: announcement._id, metadata: { type: doc.type, status: doc.status }, ip });

  if (announcement.status === 'published') {
    await deliver(announcement);
  }

  return shape(announcement);
}

export async function listAnnouncements(teacherId, query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const filter = { teacher: teacherId };

  if (query.type) filter.type = query.type;
  if (query.status) filter.status = query.status;
  if (query.classId) filter.classes = query.classId;
  if (query.search) filter.$text = { $search: query.search };
  if (query.from || query.to) {
    filter.publishAt = {};
    if (query.from) filter.publishAt.$gte = new Date(query.from);
    if (query.to) filter.publishAt.$lte = new Date(query.to);
  }

  const [rows, total] = await Promise.all([
    Announcement.find(filter).populate('classes', 'name code').sort({ publishAt: -1 }).skip(skip).limit(limit).lean(),
    Announcement.countDocuments(filter),
  ]);

  return { announcements: rows.map(shape), meta: buildPaginationMeta({ page, limit, total }) };
}

export async function getAnnouncement(teacherId, id) {
  const a = await Announcement.findOne({ _id: id, teacher: teacherId }).populate('classes', 'name code');
  if (!a) throw ApiError.notFound('Announcement not found.', 'ANNOUNCEMENT_NOT_FOUND');
  return shape(a);
}

async function loadOwned(teacherId, id) {
  const a = await Announcement.findOne({ _id: id, teacher: teacherId });
  if (!a) throw ApiError.notFound('Announcement not found.', 'ANNOUNCEMENT_NOT_FOUND');
  return a;
}

export async function updateAnnouncement(teacherId, id, body, file, ip) {
  const announcement = await loadOwned(teacherId, id);
  if (['published', 'expired', 'archived'].includes(announcement.status) && !['archived'].includes(body.status)) {
    throw ApiError.badRequest('Only draft or scheduled announcements can be edited.', 'ANNOUNCEMENT_NOT_EDITABLE');
  }

  for (const field of WRITABLE_FIELDS) {
    if (body[field] === undefined) continue;
    if (field === 'audience' || field === 'classes') continue; // handled together below
    announcement[field] = body[field];
  }

  if (body.audience !== undefined) {
    announcement.classes = await resolveAndValidateAudience(teacherId, {
      audience: body.audience,
      classes: body.classes ?? announcement.classes,
    });
    announcement.audience = body.audience;
  }

  if (file) {
    if (announcement.attachmentUrl) await removeUploadedFile(announcement.attachmentUrl);
    announcement.attachmentUrl = `/uploads/announcements/${file.filename}`;
    announcement.attachmentName = file.originalname;
  }

  if (body.status === 'draft') {
    announcement.status = 'draft';
  } else if (body.publishAt !== undefined && announcement.status !== 'draft') {
    announcement.status = deriveInitialStatus({ publishAt: announcement.publishAt });
  }

  await announcement.save();
  await logAudit({ actorId: teacherId, action: 'announcement.updated', targetType: 'Announcement', targetId: id, ip });

  if (announcement.status === 'published' && !announcement.publishedAt) {
    announcement.publishedAt = new Date();
    await announcement.save();
    await deliver(announcement);
  }

  return shape(announcement);
}

/** Immediate manual publish of a draft or scheduled announcement. */
export async function publishAnnouncement(teacherId, id, ip) {
  const announcement = await loadOwned(teacherId, id);
  if (announcement.status === 'published') return shape(announcement);
  if (!['draft', 'scheduled'].includes(announcement.status)) {
    throw ApiError.badRequest('Only a draft or scheduled announcement can be published.', 'INVALID_STATUS_TRANSITION');
  }

  announcement.status = 'published';
  announcement.publishAt = new Date();
  announcement.publishedAt = new Date();
  await announcement.save();
  await logAudit({ actorId: teacherId, action: 'announcement.published', targetType: 'Announcement', targetId: id, ip });
  await deliver(announcement);
  return shape(announcement);
}

export async function archiveAnnouncement(teacherId, id, ip) {
  const announcement = await loadOwned(teacherId, id);
  const wasPublished = announcement.status === 'published';
  announcement.status = 'archived';
  await announcement.save();
  await logAudit({ actorId: teacherId, action: 'announcement.archived', targetType: 'Announcement', targetId: id, ip });
  emitToTeacher(teacherId, 'announcement:updated', shape(announcement));
  if (wasPublished) {
    await retractAnnouncementFromStudents(String(announcement._id));
    await retractAnnouncementActivity(String(announcement._id));
  }
  return shape(announcement);
}

/** Cancels a not-yet-published (draft/scheduled) announcement outright. */
export async function deleteAnnouncement(teacherId, id, ip) {
  const announcement = await Announcement.findOneAndDelete({ _id: id, teacher: teacherId });
  if (!announcement) throw ApiError.notFound('Announcement not found.', 'ANNOUNCEMENT_NOT_FOUND');

  if (announcement.attachmentUrl) await removeUploadedFile(announcement.attachmentUrl);

  await logAudit({ actorId: teacherId, action: 'announcement.deleted', targetType: 'Announcement', targetId: id, ip });
  emitToTeacher(teacherId, 'announcement:deleted', { id });
  for (const classId of announcement.classes) {
    emitToClass(classId, 'announcement:deleted', { id: String(id) });
  }
  if (announcement.status === 'published') {
    await retractAnnouncementFromStudents(String(announcement._id));
    await retractAnnouncementActivity(String(announcement._id));
  }
  return { id };
}

async function removeUploadedFile(fileUrl) {
  const filePath = path.join(UPLOADS_ROOT, fileUrl.replace(/^\/uploads\//, ''));
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('[announcement] Failed to remove file from disk:', filePath, err.message);
  }
}

/**
 * Server-side scheduling sweep — called on an interval by
 * jobs/announcementScheduler.job.js. Does not depend on any browser tab
 * staying open: a scheduled announcement publishes (and an expired one
 * expires) purely from a due timestamp being reached, checked here.
 */
export async function runScheduledSweep() {
  const now = new Date();

  const due = await Announcement.find({ status: 'scheduled', publishAt: { $lte: now } });
  for (const announcement of due) {
    announcement.status = 'published';
    announcement.publishedAt = now;
    await announcement.save();
    await deliver(announcement);
  }

  const expiring = await Announcement.find({ status: 'published', expiresAt: { $ne: null, $lte: now } });
  for (const announcement of expiring) {
    announcement.status = 'expired';
    await announcement.save();
    emitToTeacher(announcement.teacher, 'announcement:expired', shape(announcement));
    for (const classId of announcement.classes) {
      emitToClass(classId, 'announcement:expired', shape(announcement));
    }
  }

  return { published: due.length, expired: expiring.length };
}

/** Real Admin broadcasts a teacher can only ever read — see models/AdminAnnouncement.js. */
export async function listAdminAnnouncements({ page, limit } = {}) {
  const { page: p, limit: l, skip } = parsePagination({ page, limit });
  const [items, total] = await Promise.all([
    AdminAnnouncement.find({}).sort({ publishedAt: -1 }).skip(skip).limit(l).lean(),
    AdminAnnouncement.countDocuments({}),
  ]);
  return { announcements: items, meta: buildPaginationMeta({ page: p, limit: l, total }) };
}

export default {
  createAnnouncement,
  listAnnouncements,
  listAdminAnnouncements,
  getAnnouncement,
  updateAnnouncement,
  publishAnnouncement,
  archiveAnnouncement,
  deleteAnnouncement,
  runScheduledSweep,
};
