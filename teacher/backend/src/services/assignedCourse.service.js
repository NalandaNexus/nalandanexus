import { AssignedCourse } from '../models/AssignedCourse.js';
import { User } from '../models/User.js';
import { Teacher } from '../models/Teacher.js';
import { emitToTeacher } from '../sockets/index.js';
import { notifyTeacher } from './notification.service.js';

function shape(doc) {
  return {
    id: doc._id,
    sourceId: doc.sourceId,
    title: doc.title,
    courseCode: doc.courseCode,
    description: doc.description,
    image: doc.image,
    priceInPaise: doc.priceInPaise,
    status: doc.status,
    assignedAt: doc.assignedAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Upserts an admin-pushed course assignment by `sourceId` (admin's Course
 * _id) — a single call handles create, field updates, AND reassignment to
 * a different teacher, since changing the `teacher` field on the same row
 * is all reassignment requires (the old teacher's list query simply no
 * longer matches it). Resolves the teacher by email because admin/backend
 * and this service have no shared ObjectId space for the same human.
 * Never throws — a missing/unmatched teacher is a legitimate outcome the
 * caller (admin's course.service.js) surfaces as a warning, not a crash.
 */
export async function assignCourse({ teacherEmail, sourceId, title, courseCode, description, image, priceInPaise, status }) {
  const user = await User.findOne({ email: teacherEmail.toLowerCase().trim(), role: 'teacher' });
  if (!user) return { assigned: false, reason: 'TEACHER_NOT_FOUND' };

  const teacher = await Teacher.findOne({ user: user._id });
  if (!teacher) return { assigned: false, reason: 'TEACHER_PROFILE_MISSING' };

  const isNew = !(await AssignedCourse.exists({ sourceId }));
  const wasReassigned = !isNew && (await AssignedCourse.exists({ sourceId, teacher: { $ne: teacher._id } }));

  const doc = await AssignedCourse.findOneAndUpdate(
    { sourceId },
    {
      teacher: teacher._id,
      title,
      courseCode: courseCode || null,
      description: description || '',
      image: image || null,
      priceInPaise: priceInPaise || 0,
      status: status || 'PENDING_REVIEW',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  emitToTeacher(teacher._id, 'course.assigned', shape(doc));

  // A teacher not connected at the exact moment admin assigns/reassigns a
  // course to them would otherwise never learn about it - the same
  // notification-persistence gap already fixed on every other bridge
  // ingest path in this project.
  if (isNew || wasReassigned) {
    await notifyTeacher(teacher._id, {
      type: 'system',
      title: 'New course assigned to you',
      message: `"${doc.title}"${doc.courseCode ? ` (${doc.courseCode})` : ''} has been assigned to you.`,
      relatedEntityType: 'AssignedCourse',
      relatedEntityId: doc._id,
    });
  }

  return { assigned: true, teacherId: String(teacher._id) };
}

export async function unassignCourse(sourceId) {
  const doc = await AssignedCourse.findOneAndDelete({ sourceId });
  if (doc) emitToTeacher(doc.teacher, 'course.unassigned', { sourceId });
  return { removed: Boolean(doc) };
}

export async function listAssignedCourses(teacherId) {
  const docs = await AssignedCourse.find({ teacher: teacherId }).sort({ createdAt: -1 }).lean();
  return docs.map(shape);
}

export default { assignCourse, unassignCourse, listAssignedCourses };
