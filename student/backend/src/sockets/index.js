import { Server } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { Enrollment } from '../models/Enrollment.js';

let io = null;
let publicNs = null;

/**
 * Authenticated Socket.IO server for legitimate real-time features:
 *  - leaderboard.updated, course:lecture_*, course:notes_added,
 *    course:quiz_created, course:task_created — all course-scoped, delivered
 *    only to students actually enrolled in that course (see the room-join
 *    below — never a client-requested subscription, always server-decided)
 *  - notification.created, message.created — private, per-user
 *
 * Explicitly NOT implemented: any live per-action student activity stream
 * ("student is watching...", "student clicked...") - that was intentionally
 * scoped out (master doc section 27/52).
 */
export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.clientUrls, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) return next(new Error('Authentication required'));
      const payload = verifyAccessToken(token);
      socket.userId = payload.sub;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    // Each user gets a private room - private events are never broadcast globally.
    socket.join(`user:${socket.userId}`);
    logger.debug(`[Socket] Connected user:${socket.userId}`);

    // Server-decided course room membership - the client never requests a
    // course room directly, so a student can't subscribe to a course they
    // haven't purchased just by asking for its room.
    joinEnrolledCourseRooms(socket).catch((err) => logger.debug(`[Socket] Failed to join course rooms: ${err.message}`));

    socket.on('disconnect', () => {
      logger.debug(`[Socket] Disconnected user:${socket.userId}`);
    });
  });

  // Public, unauthenticated, broadcast-only namespace for the anonymous
  // Landing Page. `io.use(...)` above only guards the DEFAULT namespace - a
  // separate namespace does not inherit it, so this one is reachable
  // without a JWT by design. It only ever pushes data already exposed by
  // GET /api/public/* (resources, announcements) and never registers a
  // handler for any incoming client event, so an anonymous connection here
  // can observe public data sooner but cannot read, write, or trigger
  // anything it couldn't already GET.
  publicNs = io.of('/public');
  publicNs.on('connection', (socket) => {
    logger.debug(`[Socket] Public (anonymous) connection: ${socket.id}`);
  });

  return io;
}

async function joinEnrolledCourseRooms(socket) {
  const enrollments = await Enrollment.find({ userId: socket.userId, status: 'active' }).select('courseId').lean();
  for (const e of enrollments) {
    socket.join(`course:${e.courseId}`);
  }
}

export function getIO() {
  return io;
}

export function emitToUser(userId, event, payload) {
  io?.to(`user:${userId}`).emit(event, payload);
}

/** Course-scoped broadcast — only students actually enrolled in `courseId` are joined to this room (see initSocket). */
export function emitToCourse(courseId, event, payload) {
  io?.to(`course:${courseId}`).emit(event, payload);
}

export function emitLeaderboardUpdated(courseId, period, entries) {
  emitToCourse(courseId, 'leaderboard.updated', { courseId: String(courseId), period, entries });
}

export function emitNotificationCreated(userId, notification) {
  emitToUser(userId, 'notification.created', notification);
}

/** Broadcasts a newly-published announcement to every connected student. */
export function emitAnnouncementCreated(announcement) {
  io?.emit('announcement.created', announcement);
}

/** Broadcasts a new/updated community post to every connected student - the peer feed had no realtime sync at all before this. */
export function emitCommunityPostCreated(post) {
  io?.emit('community.post_created', post);
}
export function emitCommunityPostUpdated(post) {
  io?.emit('community.post_updated', post);
}

/** Broadcasts to the public/anonymous namespace - see initSocket for scope. */
export function emitToPublic(event, payload) {
  publicNs?.emit(event, payload);
}
