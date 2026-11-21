import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { parseCookie } from 'cookie';
import { env } from '../config/env.js';
import { Admin } from '../models/Admin.js';

let io = null;

/**
 * Initializes Socket.IO on the shared HTTP server. Admin clients authenticate
 * with the same JWT the REST API uses (httpOnly cookie first, then the
 * `auth.token` handshake field), then join a role-scoped room so events can
 * be broadcast to "every connected admin" or to their own private channel.
 * Mirrors the auth pattern already used by teacher/backend's sockets/index.js.
 */
export function initSockets(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.clientUrl, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token;
      if (!token && socket.handshake.headers.cookie) {
        const parsed = parseCookie(socket.handshake.headers.cookie);
        token = parsed[env.cookieName];
      }
      if (!token) return next(new Error('Unauthorized'));

      const payload = jwt.verify(token, env.jwtSecret);
      const admin = await Admin.findById(payload.id).select('+tokenVersion');
      if (!admin || admin.status !== 'ACTIVE' || admin.tokenVersion !== payload.tokenVersion) {
        return next(new Error('Unauthorized'));
      }
      socket.adminId = String(admin._id);
      socket.adminRole = admin.role;
      return next();
    } catch (err) {
      console.error('[socket] auth failed:', err.message);
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id} (admin ${socket.adminId})`);
    socket.join('admins');
    socket.join(`admin:${socket.adminId}`);

    socket.on('disconnect', (reason) => {
      console.log(`[socket] disconnected: ${socket.id} (${reason})`);
    });
  });

  io.engine.on('connection_error', (err) => {
    console.error('[socket] engine connection_error:', err.message, err.code, err.context);
  });

  return io;
}

export function getIO() {
  return io;
}

function safeEmit(event, payload) {
  if (!io) return;
  io.to('admins').emit(event, payload);
}

export function emitToAdmin(adminId, event, payload) {
  if (!io) return;
  io.to(`admin:${adminId}`).emit(event, payload);
}

// One emit helper per documented real-time event (§35/§10 of the spec).
// Every one of these is called from a service AFTER the write is confirmed
// by MongoDB — never before, and never optimistically.
export const emitEvent = {
  studentCreated: (student) => safeEmit('student.created', student),
  studentUpdated: (student) => safeEmit('student.updated', student),
  studentDeleted: (id) => safeEmit('student.deleted', { id }),

  teacherCreated: (teacher) => safeEmit('teacher.created', teacher),
  teacherUpdated: (teacher) => safeEmit('teacher.updated', teacher),
  teacherStatusChanged: (teacher) => safeEmit('teacher.statusChanged', teacher),
  teacherDeleted: (id) => safeEmit('teacher.deleted', { id }),

  courseCreated: (course) => safeEmit('course.created', course),
  courseUpdated: (course) => safeEmit('course.updated', course),
  coursePublished: (course) => safeEmit('course.published', course),
  courseDeleted: (id) => safeEmit('course.deleted', { id }),

  resourceCreated: (resource) => safeEmit('resource.created', resource),
  resourceUpdated: (resource) => safeEmit('resource.updated', resource),
  resourceDeleted: (id) => safeEmit('resource.deleted', { id }),

  enrollmentCreated: (enrollment) => safeEmit('enrollment.created', enrollment),
  enrollmentUpdated: (enrollment) => safeEmit('enrollment.updated', enrollment),

  announcementCreated: (announcement) => safeEmit('announcement.created', announcement),

  paymentCreated: (payment) => safeEmit('payment.created', payment),
  paymentUpdated: (payment) => safeEmit('payment.updated', payment),

  assignmentActivityUpdated: (row) => safeEmit('assignment.activity.updated', row),
  quizActivityUpdated: (row) => safeEmit('quiz.activity.updated', row),
  attendanceSummaryUpdated: (row) => safeEmit('attendance.summary.updated', row),

  notificationCreated: (adminId, notification) => emitToAdmin(adminId, 'notification.created', notification),

  leaderboardUpdated: (leaderboard) => safeEmit('leaderboard.updated', leaderboard),
  analyticsUpdated: (snapshot) => safeEmit('analytics.updated', snapshot),
  auditLogCreated: (entry) => safeEmit('audit.created', entry),

  // A module/lesson video changed in the student service (by a teacher or an
  // administrator). Names what changed, carries no URL; the Module Videos page
  // re-reads through its own authorised API.
  courseVideoChanged: (notice) => safeEmit('course_video.changed', notice),
};

export default { initSockets, getIO, emitEvent, emitToAdmin };
