import { ClassSession } from '../models/ClassSession.js';
import { SchoolClass } from '../models/SchoolClass.js';
import { Student } from '../models/Student.js';
import { Attendance } from '../models/Attendance.js';
import { Teacher } from '../models/Teacher.js';
import { ApiError } from '../utils/ApiError.js';
import { assertClassOwnership } from './class.service.js';
import { logAudit } from './audit.service.js';
import { canonicalizeYoutubeUrl } from '../utils/youtube.js';
import { pushLiveClassToStudents, updateLiveClassToStudents, retractLiveClassFromStudents } from './studentBridge.service.js';
import { emitToClass, emitToTeacher } from '../sockets/index.js';

/**
 * Computes the *display* status of a session from real wall-clock time
 * instead of trusting a stored value, so "LIVE NOW" never lingers after a
 * period has actually ended and "upcoming" flips to live automatically.
 */
export function withComputedStatus(session) {
  if (session.status === 'cancelled') return { ...session, computedStatus: 'cancelled' };
  const start = new Date(session.startAt).getTime();
  const end = start + session.durationMinutes * 60000;
  const now = Date.now();
  let computedStatus = 'upcoming';
  if (session.status === 'completed' || now >= end) computedStatus = 'completed';
  else if (now >= start && now < end) computedStatus = 'live_now';
  return { ...session, computedStatus };
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/**
 * Builds an attendance-risk warning string for a session's class from real
 * attendance history, e.g. "2 students with 3+ recent absences" — computed
 * on read rather than stored as static copy.
 */
async function computeAttendanceWarning(classId, teacherId) {
  const students = await Student.find({ class: classId, teacher: teacherId, status: 'active', linkedUserId: { $ne: null } }).select('_id').lean();
  if (!students.length) return null;

  const studentIds = students.map((s) => s._id);
  const recent = await Attendance.find({ student: { $in: studentIds }, class: classId })
    .sort({ date: -1 })
    .limit(students.length * 5)
    .lean();

  const absenceStreak = new Map();
  for (const rec of recent) {
    if (rec.status === 'absent') {
      absenceStreak.set(String(rec.student), (absenceStreak.get(String(rec.student)) || 0) + 1);
    }
  }
  const atRiskCount = [...absenceStreak.values()].filter((n) => n >= 3).length;
  if (atRiskCount > 0) return `${atRiskCount} student${atRiskCount > 1 ? 's' : ''} with 3+ recent absences`;

  const lowAttendance = await Student.countDocuments({
    class: classId,
    teacher: teacherId,
    status: 'active',
    linkedUserId: { $ne: null },
    'metrics.attendanceRate': { $lt: 75 },
  });
  if (lowAttendance > 0) return `${lowAttendance} student${lowAttendance > 1 ? 's' : ''} below 75% attendance`;

  return null;
}

/**
 * A teacher's sessions for a single calendar day, shaped to match
 * TodaysSchedule/CalendarPage's expected fields. `dateStr` defaults to today
 * (used by the dashboard overview); CalendarPage passes an explicit date to
 * navigate to other days.
 */
export async function getScheduleForDate(teacherId, dateStr) {
  const day = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(day.getTime())) throw ApiError.badRequest('Invalid date.', 'INVALID_DATE');

  const startOfDay = new Date(day);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(day);
  endOfDay.setHours(23, 59, 59, 999);

  const sessions = await ClassSession.find({
    teacher: teacherId,
    startAt: { $gte: startOfDay, $lte: endOfDay },
    status: { $ne: 'cancelled' },
  })
    .populate('class', 'name subject room')
    .sort({ startAt: 1 })
    .lean();

  const out = [];
  for (const session of sessions) {
    const { computedStatus } = withComputedStatus(session);
    const attendanceWarning = await computeAttendanceWarning(session.class?._id, teacherId);
    out.push({
      id: session._id,
      time: formatTime(session.startAt),
      startAt: session.startAt,
      duration: `${session.durationMinutes} min`,
      durationMinutes: session.durationMinutes,
      subject: session.subject || session.class?.subject || 'Class Session',
      className: session.class?.name || 'Unknown Class',
      classId: session.class?._id,
      topic: session.topic,
      status: computedStatus,
      attendanceWarning,
      expectedStudents: await Student.countDocuments({ class: session.class?._id, status: 'active', linkedUserId: { $ne: null } }),
      room: session.room || session.class?.room || null,
    });
  }
  return out;
}

/** Back-compat alias — dashboard.service.js's overview always wants today's sessions. */
export async function getTodaysSchedule(teacherId) {
  return getScheduleForDate(teacherId);
}

/**
 * The Timetable — deliberately NOT a separate model/source of truth (see
 * models/ClassSession.js's own doc-comment on why a fake, disconnected
 * timetable would be worse than none). Every timetable entry IS a real
 * ClassSession; this is a date-range read over the same collection
 * `getScheduleForDate` already queries for a single day, shaped the same
 * way so both surfaces stay trivially consistent with each other.
 */
export async function getTimetable(teacherId, { from, to, classId } = {}) {
  const rangeStart = from ? new Date(from) : new Date();
  if (!from) rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = to ? new Date(to) : new Date(rangeStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
    throw ApiError.badRequest('Invalid date range.', 'INVALID_DATE_RANGE');
  }

  const filter = { teacher: teacherId, startAt: { $gte: rangeStart, $lte: rangeEnd }, status: { $ne: 'cancelled' } };
  if (classId) filter.class = classId;

  const sessions = await ClassSession.find(filter)
    .populate('class', 'name subject room studentCourseSlug')
    .sort({ startAt: 1 })
    .lean();

  return sessions.map((session) => {
    const { computedStatus } = withComputedStatus(session);
    const start = new Date(session.startAt);
    return {
      id: session._id,
      day: start.toLocaleDateString('en-US', { weekday: 'long' }),
      date: start.toISOString().slice(0, 10),
      startAt: session.startAt,
      time: formatTime(session.startAt),
      durationMinutes: session.durationMinutes,
      endTime: formatTime(new Date(start.getTime() + session.durationMinutes * 60000)),
      classId: session.class?._id,
      className: session.class?.name || 'Unknown Class',
      subject: session.subject || session.class?.subject || null,
      topic: session.topic,
      room: session.room || session.class?.room || null,
      youtubeUrl: session.youtubeUrl,
      status: computedStatus,
      wasRescheduled: (session.rescheduleHistory?.length || 0) > 0,
      linkedToStudentCourse: Boolean(session.class?.studentCourseSlug),
    };
  });
}

/** Creates a new ClassSession (a Calendar/Live-Schedule "timetable slot"). */
export async function createSession(teacherId, payload, ip) {
  const classDoc = await assertClassOwnership(teacherId, payload.classId);

  let youtubeUrl = null;
  if (payload.youtubeUrl) {
    youtubeUrl = canonicalizeYoutubeUrl(payload.youtubeUrl);
    if (!youtubeUrl) throw ApiError.badRequest('That does not look like a valid YouTube URL.', 'INVALID_YOUTUBE_URL');
  }

  const session = await ClassSession.create({
    class: payload.classId,
    teacher: teacherId,
    startAt: payload.startAt,
    durationMinutes: payload.durationMinutes || 45,
    subject: payload.subject || null,
    topic: payload.topic || '',
    room: payload.room || null,
    youtubeUrl,
  });

  await logAudit({ actorId: teacherId, action: 'session.created', targetType: 'ClassSession', targetId: session._id, metadata: { startAt: session.startAt }, ip });

  if (youtubeUrl) {
    const teacher = await Teacher.findById(teacherId).populate('user', 'name').lean();
    await pushLiveClassToStudents(session, classDoc, teacher?.user?.name);
  }

  const [shaped] = await getScheduleForDate(teacherId, session.startAt.toISOString());
  return shaped || {
    id: session._id,
    time: formatTime(session.startAt),
    startAt: session.startAt,
    duration: `${session.durationMinutes} min`,
    durationMinutes: session.durationMinutes,
    subject: session.subject || 'Class Session',
    classId: session.class,
    topic: session.topic,
    status: 'upcoming',
    room: session.room,
  };
}

/**
 * Reschedules and/or transitions a session's status — the update endpoint
 * the schedule route previously lacked entirely (only create + cancel
 * existed). A real time/duration change is recorded as a `rescheduleHistory`
 * entry on the SAME document (never delete+recreate), pushed to the
 * already-bridged student-portal LiveClass in place, and broadcast live to
 * both the class room (students watching that class) and the teacher's own
 * room (so the Classes/Calendar/Dashboard pages update without a refresh).
 * `status` here only ever moves to 'live' or 'completed' — 'cancelled' has
 * its own dedicated endpoint (cancelSession) and 'scheduled' is the
 * implicit state a reschedule returns to.
 */
export async function updateSession(teacherId, sessionId, payload, ip) {
  const session = await ClassSession.findOne({ _id: sessionId, teacher: teacherId });
  if (!session) throw ApiError.notFound('Session not found.', 'SESSION_NOT_FOUND');
  if (session.status === 'cancelled') throw ApiError.badRequest('A cancelled session cannot be modified.', 'SESSION_CANCELLED');

  const { startAt, durationMinutes, topic, room, youtubeUrl, status, reason } = payload;

  const startChanged = startAt !== undefined && new Date(startAt).getTime() !== session.startAt.getTime();
  const durationChanged = durationMinutes !== undefined && durationMinutes !== session.durationMinutes;
  const isReschedule = startChanged || durationChanged;

  if (isReschedule) {
    session.rescheduleHistory.push({
      previousStartAt: session.startAt,
      previousDurationMinutes: session.durationMinutes,
      reason: reason || null,
      rescheduledBy: teacherId,
    });
  }

  if (startAt !== undefined) session.startAt = startAt;
  if (durationMinutes !== undefined) session.durationMinutes = durationMinutes;
  if (topic !== undefined) session.topic = topic;
  if (room !== undefined) session.room = room;

  const hadYoutubeUrl = Boolean(session.youtubeUrl);
  if (youtubeUrl !== undefined) {
    if (youtubeUrl) {
      const canonical = canonicalizeYoutubeUrl(youtubeUrl);
      if (!canonical) throw ApiError.badRequest('That does not look like a valid YouTube URL.', 'INVALID_YOUTUBE_URL');
      session.youtubeUrl = canonical;
    } else {
      session.youtubeUrl = null;
    }
  }

  // A reschedule implicitly un-cancels/un-completes back to 'scheduled'
  // unless the caller explicitly asks for 'live'/'completed' in the same call.
  if (status) session.status = status;
  else if (isReschedule) session.status = 'scheduled';

  await session.save();
  await logAudit({
    actorId: teacherId,
    action: isReschedule ? 'session.rescheduled' : 'session.updated',
    targetType: 'ClassSession',
    targetId: session._id,
    metadata: { startAt: session.startAt, status: session.status, reason: reason || null },
    ip,
  });

  const classDoc = await SchoolClass.findById(session.class).lean();

  if (session.youtubeUrl && classDoc?.studentCourseSlug) {
    if (!hadYoutubeUrl) {
      const teacher = await Teacher.findById(teacherId).populate('user', 'name').lean();
      await pushLiveClassToStudents(session, classDoc, teacher?.user?.name);
    } else {
      await updateLiveClassToStudents(session);
    }
  } else if (!session.youtubeUrl && hadYoutubeUrl) {
    await retractLiveClassFromStudents(String(session._id), 'rescheduled');
  }

  const [shaped] = await getScheduleForDate(teacherId, session.startAt.toISOString());
  const payload_ = shaped || { id: session._id, startAt: session.startAt, status: session.status };

  const eventName = isReschedule ? 'class.rescheduled' : status === 'live' ? 'class.started' : status === 'completed' ? 'class.completed' : 'class.updated';
  emitToClass(String(session.class), eventName, payload_);
  emitToTeacher(String(teacherId), eventName, payload_);

  return payload_;
}

/** Cancels (soft-deletes) a session rather than hard-deleting, preserving history. */
export async function cancelSession(teacherId, sessionId, ip) {
  const session = await ClassSession.findOne({ _id: sessionId, teacher: teacherId });
  if (!session) throw ApiError.notFound('Session not found.', 'SESSION_NOT_FOUND');
  session.status = 'cancelled';
  await session.save();
  await logAudit({ actorId: teacherId, action: 'session.cancelled', targetType: 'ClassSession', targetId: session._id, ip });
  if (session.youtubeUrl) {
    await retractLiveClassFromStudents(String(session._id), 'cancelled');
  }
  const result = { id: session._id, status: session.status };
  emitToClass(String(session.class), 'class.cancelled', result);
  emitToTeacher(String(teacherId), 'class.cancelled', result);
  return result;
}

/**
 * Returns the currently-live session (if any) with the fields LiveClassPanel
 * needs. Only fields genuinely derivable from real records (roster size,
 * today's attendance) are populated; the in-class live-polling metrics
 * (per-question response rate, early finishers) have no data source in the
 * current product — there is no live-quiz/response-capture feature anywhere
 * in the given frontend or backend — so they are returned as empty/null
 * rather than fabricated. See API_DOCUMENTATION.md for this documented gap.
 */
export async function getActiveLiveSession(teacherId) {
  const now = new Date();
  const session = await ClassSession.findOne({
    teacher: teacherId,
    status: { $in: ['live', 'scheduled'] },
    startAt: { $lte: now },
  })
    .populate('class', 'name subject room')
    .sort({ startAt: -1 })
    .lean();

  if (!session) return { isActive: false };
  const { computedStatus } = withComputedStatus(session);
  if (computedStatus !== 'live_now') return { isActive: false };

  const classId = session.class?._id;
  const totalStudents = await Student.countDocuments({ class: classId, status: 'active', linkedUserId: { $ne: null } });
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const activeStudents = await Attendance.countDocuments({
    class: classId,
    date: { $gte: todayStart },
    status: { $in: ['present', 'late'] },
  });

  return {
    isActive: true,
    sessionId: session._id,
    classId,
    className: session.class?.name,
    subject: session.subject || session.class?.subject,
    topic: session.topic,
    activeStudents,
    totalStudents,
    // No live-polling data source exists yet (see doc-comment above).
    responseRate: null,
    correctRate: null,
    wrongRate: null,
    questions: [],
    earlyFinishers: [],
  };
}

export default {
  withComputedStatus,
  getScheduleForDate,
  getTodaysSchedule,
  getTimetable,
  createSession,
  updateSession,
  cancelSession,
  getActiveLiveSession,
};
