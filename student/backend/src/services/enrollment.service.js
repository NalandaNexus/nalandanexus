import { Enrollment } from '../models/Enrollment.js';
import { Notification } from '../models/Notification.js';

export async function getActiveEnrollment(userId, courseId) {
  return Enrollment.findOne({ userId, courseId, status: 'active' });
}

export async function createEnrollment({ userId, courseId, orderId = null, course }) {
  const existing = await Enrollment.findOne({ userId, courseId });
  if (existing) {
    if (existing.status !== 'active') {
      existing.status = 'active';
      existing.orderId = orderId || existing.orderId;
      await existing.save();
    }
    return existing;
  }

  const firstModule = course?.modules?.[0];
  const firstLesson = firstModule?.lessons?.[0];

  const enrollment = await Enrollment.create({
    userId,
    courseId,
    orderId,
    currentModuleId: firstModule?.moduleId || null,
    currentLessonId: firstLesson?.lessonId || null,
  });

  await Notification.create({
    userId,
    title: `Welcome to ${course?.title || 'your course'}!`,
    description: 'Your enrollment is active. Start your first lesson now.',
    type: 'course',
    link: '/student/dashboard',
  });

  return enrollment;
}
