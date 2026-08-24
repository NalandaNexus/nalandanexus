import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { avatarPublicUrl } from '../middleware/upload.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { Enrollment } from '../models/Enrollment.js';
import { Course } from '../models/Course.js';
import { Task } from '../models/Task.js';
import { TaskSubmission } from '../models/TaskSubmission.js';
import { Notification } from '../models/Notification.js';
import { getLeaderboard } from '../services/leaderboard.service.js';
import { getWeeklyPerformanceTrend } from '../services/performance.service.js';

export const getProfile = asyncHandler(async (req, res) => {
  const profile = await StudentProfile.findOne({ userId: req.user._id });
  if (!profile) throw AppError.notFound('Student profile not found', 'PROFILE_NOT_FOUND');
  return sendSuccess(res, { data: { user: req.user.toJSON(), profile } });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const profile = await StudentProfile.findOne({ userId: req.user._id });
  if (!profile) throw AppError.notFound('Student profile not found', 'PROFILE_NOT_FOUND');

  const { name, avatar, ...profileFields } = req.body;

  if (name) {
    req.user.name = name;
    await req.user.save();
  }
  if (avatar !== undefined) {
    req.user.avatar = avatar;
    await req.user.save();
  }

  Object.assign(profile, profileFields);
  await profile.save();

  return sendSuccess(res, { message: 'Profile updated.', data: { user: req.user.toJSON(), profile } });
});

/** POST /api/student/profile/avatar (multipart) — file type/size validated by middleware/upload.js before this ever runs. */
export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw AppError.badRequest('An image file is required.', 'FILE_REQUIRED');
  req.user.avatar = avatarPublicUrl(req.file.filename);
  await req.user.save();
  return sendSuccess(res, { message: 'Profile photo updated.', data: { user: req.user.toJSON() } });
});

export const completeOnboarding = asyncHandler(async (req, res) => {
  const profile = await StudentProfile.findOneAndUpdate(
    { userId: req.user._id },
    { hasCompletedOnboarding: true },
    { new: true }
  );
  return sendSuccess(res, { message: 'Onboarding complete.', data: { profile } });
});

/**
 * Consolidated dashboard endpoint (master doc section 18). Every value
 * shown on the dashboard is sourced from the database here - nothing is
 * hardcoded.
 */
export const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [profile, enrollments, notifications] = await Promise.all([
    StudentProfile.findOne({ userId }),
    Enrollment.find({ userId, status: 'active' }).populate('courseId'),
    Notification.find({ userId }).sort({ createdAt: -1 }).limit(10),
  ]);

  if (!profile) throw AppError.notFound('Student profile not found', 'PROFILE_NOT_FOUND');

  const primaryEnrollment = enrollments[0] || null;
  const primaryCourse = primaryEnrollment?.courseId || null;

  let dueTasks = [];
  if (primaryCourse) {
    const [tasks, submissions] = await Promise.all([
      Task.find({ courseId: primaryCourse._id, isPublished: true }).sort({ order: 1 }),
      TaskSubmission.find({ userId }),
    ]);
    const submittedTaskIds = new Set(submissions.filter((s) => s.isCompleted).map((s) => String(s.taskId)));
    dueTasks = tasks
      .filter((t) => !submittedTaskIds.has(String(t._id)))
      .slice(0, 6)
      .map((t) => ({
        id: t.taskId,
        title: t.title,
        type: t.type,
        urgency: t.urgency,
        iconName: t.iconName,
        pointsReward: t.pointsReward,
        moduleTitle: t.moduleTitle,
        targetUrl: t.type === 'Quiz' ? `/student/parambh/quizzes/${t.taskId}` : `/student/parambh/tasks/${t.taskId}`,
      }));
  }

  const { entries: leaderboardTop } = await getLeaderboard({
    courseId: primaryCourse?._id || null,
    period: 'thisWeek',
    limit: 7,
    requestingUserId: userId,
  });

  const performanceTrend = await getWeeklyPerformanceTrend(userId);

  let currentLessonTitle = null;
  let currentModuleTitle = null;
  let totalLessonsInCourse = 0;
  if (primaryCourse) {
    totalLessonsInCourse = primaryCourse.totalLessons;
    for (const m of primaryCourse.modules) {
      const lesson = m.lessons.find((l) => l.lessonId === primaryEnrollment.currentLessonId);
      if (lesson) {
        currentLessonTitle = lesson.title;
        currentModuleTitle = m.title;
        break;
      }
    }
  }

  return sendSuccess(res, {
    data: {
      profile,
      course: primaryCourse
        ? {
            id: primaryCourse.slug,
            name: primaryCourse.title,
            subtitle: primaryCourse.subtitle,
            pillar: primaryCourse.pillar,
            progress: primaryEnrollment.progressPercent,
            currentModuleId: primaryEnrollment.currentModuleId,
            currentModuleTitle,
            currentLessonId: primaryEnrollment.currentLessonId,
            currentLessonTitle,
            totalLessons: totalLessonsInCourse,
          }
        : null,
      isEnrolledInAnyCourse: enrollments.length > 0,
      dueTasks,
      notifications,
      unreadNotificationsCount: notifications.filter((n) => !n.isRead).length,
      leaderboard: leaderboardTop,
      performanceTrend,
    },
  });
});
