import { Server } from 'socket.io';
import { parseCookie } from 'cookie';
import { env } from '../config/env.js';
import { verifyAuthToken } from '../utils/tokens.js';
import { User } from '../models/User.js';
import { Teacher } from '../models/Teacher.js';
import { getAccessibleCourseSlugs, canActOnClass } from '../services/courseAccess.service.js';

let ioInstance = null;

function teacherRoom(teacherId) {
  return `teacher:${String(teacherId)}`;
}
function classRoom(classId) {
  return `class:${String(classId)}`;
}
function courseRoom(slug) {
  return `course:${String(slug)}`;
}
// Single-tenant app (one institution) - every authenticated teacher socket
// auto-joins this fixed room, giving admin-broadcast announcements a real,
// bounded room to target instead of an unauthenticated `io.emit()` to
// every open socket regardless of identity.
const INSTITUTION_ROOM = 'institution:nalanda';

/**
 * Initializes Socket.IO on the shared HTTP server. Authentication reads the
 * SAME httpOnly cookie the REST API uses (parsed straight from the
 * handshake headers) so the frontend's `socketService.connect()` — which
 * already calls `io(SOCKET_URL, { ...credentials-bearing options })` with
 * no manual token — works unmodified.
 */
export function initSockets(httpServer) {
  ioInstance = new Server(httpServer, {
    cors: { origin: env.clientUrl, credentials: true },
  });

  ioInstance.use(async (socket, next) => {
    try {
      const rawCookie = socket.handshake.headers.cookie;
      const token = rawCookie ? parseCookie(rawCookie)[env.cookieName] : socket.handshake.auth?.token;
      if (!token || token === 'nalanda_teacher_session') {
        // No session yet (e.g. app loaded before login) — allow the socket
        // to connect so it can be authenticated later, but keep it out of
        // any teacher/class rooms until it identifies itself.
        return next();
      }

      const payload = verifyAuthToken(token);
      const user = await User.findById(payload.sub).select('+tokenVersion');
      if (!user || user.status !== 'active' || (payload.tokenVersion ?? 0) !== user.tokenVersion) return next();

      const teacher = await Teacher.findOne({ user: user._id });
      if (teacher) {
        socket.data.teacherId = String(teacher._id);
        socket.data.isPro = teacher.isPro;
      }
      next();
    } catch {
      // Invalid/expired token: connect anonymously rather than rejecting
      // the handshake outright, matching socketService's "keep retrying"
      // reconnection UX instead of hard-failing the websocket.
      next();
    }
  });

  ioInstance.on('connection', async (socket) => {
    if (socket.data.teacherId) {
      socket.join(teacherRoom(socket.data.teacherId));
      socket.join(INSTITUTION_ROOM);

      // Auto-joins every course this teacher currently holds CourseAccess
      // for, mirroring the institution-room auto-join above, so a
      // grade/attendance update emitted to the whole course (see
      // emitToCourse) reaches every teacher watching it live, not just the
      // one who made it.
      try {
        const slugs = await getAccessibleCourseSlugs(socket.data.teacherId);
        for (const slug of slugs) socket.join(courseRoom(slug));
      } catch {
        // Best-effort: a teacher who misses the initial auto-join can still
        // reach course-room updates after their next reconnect.
      }
    }

    socket.on('subscribe:class', async ({ classId } = {}) => {
      // Previously joined any classId an authenticated OR EVEN ANONYMOUS
      // socket asked for, with no check at all - any client could read
      // another teacher's live class-room events just by guessing an id.
      // Now mirrors the REST API's own authorization: only a teacher who
      // may act on this class (owns it, or holds course-access to its
      // course) is let into its room.
      if (!classId || !socket.data.teacherId) return;
      try {
        if (await canActOnClass(socket.data.teacherId, classId)) socket.join(classRoom(classId));
      } catch {
        // Lookup failure: do not grant the room.
      }
    });

    socket.on('unsubscribe:class', ({ classId } = {}) => {
      if (classId) socket.leave(classRoom(classId));
    });
  });

  return ioInstance;
}

export function getIO() {
  return ioInstance;
}

export function emitToTeacher(teacherId, event, payload) {
  ioInstance?.to(teacherRoom(teacherId)).emit(event, payload);
}

export function emitToClass(classId, event, payload) {
  ioInstance?.to(classRoom(classId)).emit(event, payload);
}

/** Reaches every teacher sharing a course (see the connection handler's auto-join above) - not just the one who made the change, so course-wide grading/attendance updates are seen live by every teacher watching it. */
export function emitToCourse(studentCourseSlug, event, payload) {
  if (!studentCourseSlug) return;
  ioInstance?.to(courseRoom(studentCourseSlug)).emit(event, payload);
}

/** Broadcasts to every authenticated teacher socket — used for institution-wide admin announcements. */
export function emitToAllTeachers(event, payload) {
  ioInstance?.to(INSTITUTION_ROOM).emit(event, payload);
}

export default { initSockets, getIO, emitToTeacher, emitToClass, emitToCourse, emitToAllTeachers };
