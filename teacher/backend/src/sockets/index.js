import { Server } from 'socket.io';
import { parseCookie } from 'cookie';
import { env } from '../config/env.js';
import { verifyAuthToken } from '../utils/tokens.js';
import { User } from '../models/User.js';
import { Teacher } from '../models/Teacher.js';

let ioInstance = null;

function teacherRoom(teacherId) {
  return `teacher:${String(teacherId)}`;
}
function classRoom(classId) {
  return `class:${String(classId)}`;
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

  ioInstance.on('connection', (socket) => {
    if (socket.data.teacherId) {
      socket.join(teacherRoom(socket.data.teacherId));
      socket.join(INSTITUTION_ROOM);
    }

    socket.on('subscribe:class', ({ classId } = {}) => {
      if (classId) socket.join(classRoom(classId));
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

/** Broadcasts to every authenticated teacher socket — used for institution-wide admin announcements. */
export function emitToAllTeachers(event, payload) {
  ioInstance?.to(INSTITUTION_ROOM).emit(event, payload);
}

export default { initSockets, getIO, emitToTeacher, emitToClass, emitToAllTeachers };
