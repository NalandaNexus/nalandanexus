import { Enrollment } from '../models/Enrollment.js';
import { Course } from '../models/Course.js';
import { fetchTeacherForCourse } from './teacherBridge.service.js';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Resolves "who does this student message" — the real teacher/backend
 * Teacher assigned to the student's primary (first) active enrollment's
 * course, via its linked `studentCourseSlug`. Cached on the Enrollment
 * document (see Enrollment.assignedTeacher) and refreshed lazily when
 * stale/missing, so a slow/unreachable teacher backend never blocks
 * reading or sending a message - it just means a stale or null name until
 * the next successful resolution.
 */
export async function resolveAssignedTeacher(userId) {
  const enrollment = await Enrollment.findOne({ userId, status: 'active' }).sort({ enrolledAt: 1 }).populate('courseId', 'slug');
  if (!enrollment) return null;

  const slug = enrollment.courseId?.slug || null;
  const isFresh = enrollment.assignedTeacher?.resolvedAt && Date.now() - new Date(enrollment.assignedTeacher.resolvedAt).getTime() < CACHE_TTL_MS;
  if (isFresh) {
    return { ...(enrollment.assignedTeacher.toObject?.() || enrollment.assignedTeacher), courseSlug: slug };
  }

  const resolved = slug ? await fetchTeacherForCourse(slug, { batchId: enrollment.batchId }) : null;

  enrollment.assignedTeacher = {
    teacherId: resolved?.teacherId || enrollment.assignedTeacher?.teacherId || null,
    name: resolved?.name || enrollment.assignedTeacher?.name || null,
    avatarUrl: resolved?.avatarUrl || enrollment.assignedTeacher?.avatarUrl || null,
    resolvedAt: new Date(),
  };
  await enrollment.save();

  return { ...enrollment.assignedTeacher.toObject(), courseSlug: slug };
}

export default { resolveAssignedTeacher };
