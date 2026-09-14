import { Router } from 'express';
import * as internalController from '../controllers/internal.controller.js';
import * as eligibilityController from '../controllers/eligibilityAdmin.controller.js';
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
  adminListCampaignsSchema,
  adminCampaignIdSchema,
  adminUpdateCouponSchema,
  adminCouponIdSchema,
} from '../validators/internal.validators.js';

// Service-to-service only - authenticated by a shared secret
// (requireInternalServiceKey), never a user JWT. Not reachable by any
// student/teacher/admin session, by design.
const router = Router();
router.use(requireInternalServiceKey);

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

router.get('/coupon-campaigns', validate(adminListCampaignsSchema), internalController.adminListCampaigns);
router.post('/coupon-campaigns', validate(adminCreateCampaignSchema), internalController.adminCreateCampaign);
router.get('/coupon-campaigns/:id/export', validate(adminCampaignIdSchema), internalController.adminExportCampaign);
router.get('/coupons', validate(adminListCouponsSchema), internalController.adminListCoupons);
router.patch('/coupons/:id', validate(adminUpdateCouponSchema), internalController.adminUpdateCoupon);
router.delete('/coupons/:id', validate(adminCouponIdSchema), internalController.adminDeleteCoupon);

export default router;
