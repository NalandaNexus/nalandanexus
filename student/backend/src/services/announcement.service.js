import { Announcement } from '../models/Announcement.js';
import { Notification } from '../models/Notification.js';
import { Enrollment } from '../models/Enrollment.js';
import { User } from '../models/User.js';

/**
 * Real, persisted Notifications for every eligible student — the live
 * socket emit in createAnnouncement() only reaches a student connected at
 * the exact publish instant; anyone who logs in later would otherwise
 * never see it in their notification bell. Course-scoped announcements
 * notify only enrolled students; institution-wide ones (empty courseIds)
 * notify every active student account.
 */
async function notifyStudentsOfAnnouncement(announcement) {
  const authorLabel = announcement.createdBy ? null : announcement.externalAuthorName;
  const title = authorLabel ? `${authorLabel}: ${announcement.title}` : announcement.title;
  const description = announcement.content.length > 140 ? `${announcement.content.slice(0, 140)}…` : announcement.content;

  let userIds;
  if (announcement.courseIds?.length) {
    userIds = await Enrollment.find({ courseId: { $in: announcement.courseIds }, status: 'active' }).distinct('userId');
  } else {
    userIds = await User.find({ role: 'student', isActive: true }).distinct('_id');
  }
  if (!userIds.length) return;

  const docs = userIds.map((userId) => ({
    userId,
    title,
    description,
    type: announcement.courseIds?.length ? 'course' : 'system',
    link: '/student/announcements',
  }));
  const created = await Notification.insertMany(docs);

  try {
    const { emitNotificationCreated } = await import('../sockets/index.js');
    created.forEach((n) => emitNotificationCreated(n.userId, n));
  } catch {
    // socket layer optional
  }
}

/**
 * Creates an announcement and pushes it to eligible students in real time -
 * every connected student when `courseIds` is empty (institution-wide),
 * or only students enrolled in one of `courseIds` otherwise (master doc
 * section 42: "never broadcast every notification to every student").
 */
export async function createAnnouncement(fields) {
  let announcement = await Announcement.create(fields);
  announcement = await announcement.populate('createdBy', 'name role');

  try {
    const { emitAnnouncementCreated, emitToCourse, emitToPublic } = await import('../sockets/index.js');
    const payload = {
      id: announcement._id,
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      publishAt: announcement.publishAt,
      expiresAt: announcement.expiresAt,
      isRead: false,
      author: announcement.createdBy
        ? { name: announcement.createdBy.name, role: announcement.createdBy.role }
        : announcement.externalAuthorName
          ? { name: announcement.externalAuthorName, role: 'teacher' }
          : null,
    };

    if (announcement.courseIds?.length) {
      for (const courseId of announcement.courseIds) {
        emitToCourse(courseId, 'announcement.created', payload);
      }
    } else {
      emitAnnouncementCreated(payload);
      // Institution-wide announcements are exactly what GET
      // /api/public/announcements exposes to anonymous visitors - push the
      // same event to the public namespace so the Landing Page's
      // AnnouncementsSection can refetch live instead of only on mount.
      if (announcement.isPublished) emitToPublic('announcement.created', { id: String(announcement._id) });
    }
  } catch {
    // socket layer not initialized (e.g. in seed script run standalone / tests) - ignore
  }

  await notifyStudentsOfAnnouncement(announcement);

  return announcement;
}
