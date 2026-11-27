import { Router } from 'express';
import * as internalController from '../controllers/internal.controller.js';
import * as eligibilityController from '../controllers/eligibilityAdmin.controller.js';
import * as lessonVideoController from '../controllers/lessonVideo.controller.js';
import * as courseStructureController from '../controllers/courseStructure.controller.js';
import {
  videoCatalogSchema,
  courseVideosSchema,
  videoEventsSchema,
  inspectVideoSchema,
  upsertLessonVideoSchema,
  updateLessonVideoSchema,
  removeLessonVideoSchema,
  upsertModuleVideoSchema,
  updateModuleVideoSchema,
  removeModuleVideoSchema,
  startLessonUploadSchema,
  startModuleUploadSchema,
  uploadPartUrlsSchema,
  resumeUploadSchema,
  completeUploadSchema,
  abortUploadSchema,
} from '../validators/lessonVideo.validators.js';
import {
  courseStructureParamsSchema,
  updateCourseSettingsSchema,
  addModuleSchema,
  updateModuleSchema,
  reorderModulesSchema,
  addLessonSchema,
  updateLessonSchema,
  reorderLessonsSchema,
  removeModuleSchema,
  removeLessonSchema,
} from '../validators/courseStructure.validators.js';
import { requireInternalServiceKey } from '../middleware/internalService.js';
import { validate } from '../middleware/validate.js';
import {
  createBridgedAnnouncementSchema,
  updateBridgedAnnouncementSchema,
  createBridgedMaterialSchema,
  upsertBridgedTaskSchema,
  createBridgedLiveClassSchema,
  updateBridgedLiveClassSchema,
  enrolledStudentsQuerySchema,
  upsertBridgedQuizSchema,
  deliverTeacherMessageSchema,
  upsertBridgedCourseSchema,
  unpublishBridgedCourseSchema,
  upsertBridgedResourceSchema,
  retractBridgedResourceSchema,
  upsertBridgedFacultySchema,
  retractBridgedFacultySchema,
  gradeBridgedTaskSubmissionSchema,
  adminListCouponsSchema,
  adminCreateCampaignSchema,
  adminProgressionRulesSchema,
  adminStageUpdateSchema,
  adminAchievementUpdateSchema,
  adminRecalculateSchema,
  adminStudentProgressSchema,
  adminStudentActivitySchema,
  adminRecordAttendanceSchema,
  adminCourseSlugSchema,
  adminSetSubjectsSchema,
  adminModuleGatingDryRunSchema,
  adminListCampaignsSchema,
  adminCampaignIdSchema,
  adminUpdateCouponSchema,
  adminCouponIdSchema,
  lookupStudentSchema,
  resyncPortalStudentsSchema,
} from '../validators/internal.validators.js';

// Service-to-service only - authenticated by a shared secret
// (requireInternalServiceKey), never a user JWT. Not reachable by any
// student/teacher/admin session, by design.
const router = Router();
router.use(requireInternalServiceKey);

// Module and lesson videos (YouTube, Google Drive, uploaded files). Modules
// and lessons live only here, so the Admin and Teacher portals manage their
// videos through these rather than holding a copy. Upload routes name the
// course too, so the teacher portal's per-course assignment check covers them.
const lessonPath = '/lesson-videos/courses/:slug/lessons/:lessonId';
const modulePath = '/lesson-videos/courses/:slug/modules/:moduleId';
const uploadPath = '/lesson-videos/courses/:slug/uploads/:uploadId';
router.get('/lesson-videos/courses', validate(videoCatalogSchema), lessonVideoController.listVideoCatalog);
router.get('/lesson-videos/events', validate(videoEventsSchema), lessonVideoController.listVideoEvents);
router.get('/lesson-videos/courses/:slug', validate(courseVideosSchema), lessonVideoController.getCourseVideos);
router.post('/lesson-videos/inspect', validate(inspectVideoSchema), lessonVideoController.inspectVideo);
router.put(lessonPath, validate(upsertLessonVideoSchema), lessonVideoController.upsertVideo);
router.patch(lessonPath, validate(updateLessonVideoSchema), lessonVideoController.updateVideo);
router.delete(lessonPath, validate(removeLessonVideoSchema), lessonVideoController.removeVideo);
router.put(modulePath, validate(upsertModuleVideoSchema), lessonVideoController.upsertVideo);
router.patch(modulePath, validate(updateModuleVideoSchema), lessonVideoController.updateVideo);
router.delete(modulePath, validate(removeModuleVideoSchema), lessonVideoController.removeVideo);
router.post(`${lessonPath}/uploads`, validate(startLessonUploadSchema), lessonVideoController.startUpload);
router.post(`${modulePath}/uploads`, validate(startModuleUploadSchema), lessonVideoController.startUpload);
router.post(`${uploadPath}/parts`, validate(uploadPartUrlsSchema), lessonVideoController.uploadPartUrls);
router.post(`${uploadPath}/resume`, validate(resumeUploadSchema), lessonVideoController.resumeUpload);
router.post(`${uploadPath}/complete`, validate(completeUploadSchema), lessonVideoController.completeUpload);
router.delete(uploadPath, validate(abortUploadSchema), lessonVideoController.abortUpload);

// Module/lesson structure: rename, reorder, add, edit, remove. Modules and
// lessons live only here, same arrangement as lesson videos just above - the
// Admin and Teacher portals edit structure through these rather than holding
// a copy. PUT .../order routes are distinct from the PATCH .../:id routes by
// HTTP method, not by path shape, so "order" is never mistaken for an id.
router.get('/course-structure/courses/:slug', validate(courseStructureParamsSchema), courseStructureController.getCourseStructure);
router.patch('/course-structure/courses/:slug', validate(updateCourseSettingsSchema), courseStructureController.updateCourseSettings);
router.post('/course-structure/courses/:slug/modules', validate(addModuleSchema), courseStructureController.addModule);
router.put('/course-structure/courses/:slug/modules/order', validate(reorderModulesSchema), courseStructureController.reorderModules);
router.patch('/course-structure/courses/:slug/modules/:moduleId', validate(updateModuleSchema), courseStructureController.updateModule);
router.post('/course-structure/courses/:slug/modules/:moduleId/lessons', validate(addLessonSchema), courseStructureController.addLesson);
router.put(
  '/course-structure/courses/:slug/modules/:moduleId/lessons/order',
  validate(reorderLessonsSchema),
  courseStructureController.reorderLessons
);
router.patch(
  '/course-structure/courses/:slug/modules/:moduleId/lessons/:lessonId',
  validate(updateLessonSchema),
  courseStructureController.updateLesson
);
router.delete('/course-structure/courses/:slug/modules/:moduleId', validate(removeModuleSchema), courseStructureController.removeModule);
router.delete(
  '/course-structure/courses/:slug/modules/:moduleId/lessons/:lessonId',
  validate(removeLessonSchema),
  courseStructureController.removeLesson
);

router.post('/announcements', validate(createBridgedAnnouncementSchema), internalController.createBridgedAnnouncement);
router.patch('/announcements/:sourceId', validate(updateBridgedAnnouncementSchema), internalController.updateBridgedAnnouncement);
router.delete('/announcements/:sourceId', internalController.deleteBridgedAnnouncement);

router.post('/materials', validate(createBridgedMaterialSchema), internalController.createBridgedMaterial);
router.delete('/materials/:sourceId', internalController.deleteBridgedMaterial);

router.post('/tasks', validate(upsertBridgedTaskSchema), internalController.upsertBridgedTask);
router.patch('/tasks', validate(upsertBridgedTaskSchema), internalController.upsertBridgedTask);
router.delete('/tasks/:sourceId', internalController.retractBridgedTask);

router.post('/live-classes', validate(createBridgedLiveClassSchema), internalController.createBridgedLiveClass);
router.patch('/live-classes/:sourceId', validate(updateBridgedLiveClassSchema), internalController.updateBridgedLiveClass);
router.delete('/live-classes/:sourceId', internalController.retractBridgedLiveClass);

router.get('/courses/:slug/enrolled-students', validate(enrolledStudentsQuerySchema), internalController.listEnrolledStudents);

router.post('/quizzes', validate(upsertBridgedQuizSchema), internalController.upsertBridgedQuiz);
router.patch('/quizzes', validate(upsertBridgedQuizSchema), internalController.upsertBridgedQuiz);
router.delete('/quizzes/:sourceId', internalController.retractBridgedQuiz);

router.post('/messages', validate(deliverTeacherMessageSchema), internalController.deliverTeacherMessage);

router.post('/courses', validate(upsertBridgedCourseSchema), internalController.upsertBridgedCourse);
router.patch('/courses/:sourceId/unpublish', validate(unpublishBridgedCourseSchema), internalController.unpublishBridgedCourse);

router.post('/resources', validate(upsertBridgedResourceSchema), internalController.upsertBridgedResource);
router.patch('/resources', validate(upsertBridgedResourceSchema), internalController.upsertBridgedResource);
router.delete('/resources/:sourceId', validate(retractBridgedResourceSchema), internalController.retractBridgedResource);

// The teaching faculty the About page introduces. The admin portal owns teacher
// identity; this is where it publishes the part the public may see.
router.post('/faculty', validate(upsertBridgedFacultySchema), internalController.upsertBridgedFaculty);
router.delete('/faculty/:sourceId', validate(retractBridgedFacultySchema), internalController.retractBridgedFaculty);

router.patch(
  '/task-submissions/:sourceId/grade',
  validate(gradeBridgedTaskSubmissionSchema),
  internalController.gradeBridgedTaskSubmission
);

// Coupon administration for the Admin portal. Coupons live in this database
// beside Course and Enrollment, so Admin reaches them here rather than keeping a
// second copy - the same arrangement batches use.
// Subject tagging: what an activity teaches, which is what the progression
// engine credits. Guarded by the same service key as the rest of this router.
// Attendance is recorded in the teacher service and scored here, so it crosses
// as events rather than being duplicated as a second source of truth.
// Progression, read-only, for the teacher and admin portals. Neither can write
// a score through here - seeing progression and authoring it are different
// permissions, and only one of them exists.
// Progression configuration. Every number the engine consults is editable
// here and nowhere else, which is what keeps a disputed score answerable by
// reading one document.
router.get('/progression/rules', internalController.adminGetProgressionRules);
router.put('/progression/rules', validate(adminProgressionRulesSchema), internalController.adminUpdateProgressionRules);
router.patch('/progression/stages/:code', validate(adminStageUpdateSchema), internalController.adminUpdateStage);
router.patch('/progression/achievements/:code', validate(adminAchievementUpdateSchema), internalController.adminUpdateAchievement);
router.post('/progression/recalculate', validate(adminRecalculateSchema), internalController.adminRecalculateProgression);
router.get('/progression/analytics', internalController.adminProgressionAnalytics);

// Stage eligibility: the criteria an administrator publishes for each
// transition. A draft affects nobody; only a published rule decides anything.
router.get('/progression/eligibility', eligibilityController.listEligibility);
router.get('/progression/eligibility/:stage', eligibilityController.getEligibility);
router.put('/progression/eligibility/:stage/draft', eligibilityController.saveDraft);
router.post('/progression/eligibility/:stage/validate', eligibilityController.validateDraft);
router.post('/progression/eligibility/:stage/publish', eligibilityController.publishRule);
router.post('/progression/eligibility/:stage/disable', eligibilityController.disableRule);
router.post('/progression/eligibility/preview', eligibilityController.previewEligibility);
router.get('/progression/student-eligibility', eligibilityController.studentEligibilityOverview);
// Brings GARUD and YODDHA into existence. Dry run unless { apply: true }.
router.post('/progression/journey/setup', internalController.adminSetupJourney);
// Curriculum content. Dry unless the body says apply, and it never writes
// student data - creating content is not the same as granting access to it.
router.post('/progression/curriculum/seed', internalController.adminSeedCurriculum);
// Task submissions for a set of students, so a teacher can find the course
// assignments they are entitled to grade. Grading itself already exists at
// /task-submissions/:sourceId/grade and works on any submission by id.
router.post('/task-submissions/for-students', internalController.adminListTaskSubmissions);
router.get('/progression/curriculum/audit', internalController.adminAuditCurriculum);

router.post('/progression/students', validate(adminStudentProgressSchema), internalController.adminGetStudentProgress);
router.get('/progression/students/:userId/activity', validate(adminStudentActivitySchema), internalController.adminGetStudentActivity);

router.post('/attendance', validate(adminRecordAttendanceSchema), internalController.adminRecordAttendance);

router.get('/subjects', internalController.adminListSubjects);
router.get('/courses/:slug/content', validate(adminCourseSlugSchema), internalController.adminGetCourseContent);
router.patch('/courses/:slug/subjects', validate(adminSetSubjectsSchema), internalController.adminSetContentSubjects);
// Preview-before-flip for the mandatory-progression gate - see
// courseGating.service.js#dryRunImpact. Never writes anything.
router.post(
  '/progression/module-gating/dry-run',
  validate(adminModuleGatingDryRunSchema),
  internalController.adminModuleGatingDryRun
);

router.get('/coupon-campaigns', validate(adminListCampaignsSchema), internalController.adminListCampaigns);
router.post('/coupon-campaigns', validate(adminCreateCampaignSchema), internalController.adminCreateCampaign);
router.get('/coupon-campaigns/:id/export', validate(adminCampaignIdSchema), internalController.adminExportCampaign);
router.get('/coupons', validate(adminListCouponsSchema), internalController.adminListCoupons);
router.patch('/coupons/:id', validate(adminUpdateCouponSchema), internalController.adminUpdateCoupon);
router.delete('/coupons/:id', validate(adminCouponIdSchema), internalController.adminDeleteCoupon);

// Student lookup by enrollment number. The teacher portal always sends its
// teacher's roster as the scope; the admin portal sends none. A POST because the
// scope can be long, not because anything is written.
router.post('/students/lookup', validate(lookupStudentSchema), internalController.lookupStudentByEnrollmentNumber);

// Resends student records to the admin and teacher portals. Dry unless
// { apply: true }, like the other administrative runs on this router.
router.post('/portal-students/resync', validate(resyncPortalStudentsSchema), internalController.resyncPortalStudents);

export default router;
