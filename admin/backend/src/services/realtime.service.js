import { Student } from '../models/Student.js';
import { Teacher } from '../models/Teacher.js';
import { Course } from '../models/Course.js';
import { isDatabaseConnected } from '../config/db.js';
import { getIO } from '../sockets/index.js';

/**
 * Replaces the previous SSE implementation's setInterval(Math.random())
 * jitter with real, DB-derived counts and real Socket.IO connection state.
 * There is genuinely no student-session-tracking system owned by
 * admin/backend (that would live in student/backend), so field names here
 * are chosen to be honest about what they represent — account counts and
 * real connection/queue state, not fabricated "online right now" figures.
 */
export async function getLiveSnapshot() {
  const io = getIO();
  const connectedAdmins = io ? io.sockets.sockets.size : 0;

  const [activeStudents, activeTeachers, pendingCourseReviews, suspendedTeachers] = await Promise.all([
    Student.countDocuments({ deletedAt: null, status: 'ACTIVE' }),
    Teacher.countDocuments({ deletedAt: null, status: 'ACTIVE' }),
    Course.countDocuments({ deletedAt: null, status: 'PENDING_REVIEW' }),
    Teacher.countDocuments({ deletedAt: null, status: 'SUSPENDED' }),
  ]);

  return {
    activeStudentAccounts: activeStudents,
    activeTeacherAccounts: activeTeachers,
    connectedAdmins,
    pendingCourseReviews,
    suspendedTeachers,
    databaseStatus: isDatabaseConnected() ? 'CONNECTED' : 'DISCONNECTED',
    serverTime: new Date().toISOString(),
  };
}

export default { getLiveSnapshot };
