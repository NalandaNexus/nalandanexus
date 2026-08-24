import { Router } from 'express';
import authRoutes from './auth.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import teacherRoutes from './teacher.routes.js';
import studentRoutes from './student.routes.js';
import courseRoutes from './course.routes.js';
import resourceRoutes from './resource.routes.js';
import enrollmentRoutes from './enrollment.routes.js';
import announcementRoutes from './announcement.routes.js';
import auditLogRoutes from './auditLog.routes.js';
import notificationRoutes from './notification.routes.js';
import paymentRoutes from './payment.routes.js';
import settingsRoutes from './settings.routes.js';
import reportRoutes from './report.routes.js';
import systemHealthRoutes from './systemHealth.routes.js';
import academicsRoutes from './academics.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/', dashboardRoutes); // /overview, /leaderboard, /live-telemetry (kept flat for frontend compatibility)
router.use('/teachers', teacherRoutes);
router.use('/students', studentRoutes);
router.use('/courses', courseRoutes);
router.use('/resources', resourceRoutes);
router.use('/enrollments', enrollmentRoutes);
router.use('/announcements', announcementRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/notifications', notificationRoutes);
router.use('/payments', paymentRoutes);
router.use('/settings', settingsRoutes);
router.use('/reports', reportRoutes);
router.use('/system-health', systemHealthRoutes);
router.use('/academics', academicsRoutes);

export default router;
