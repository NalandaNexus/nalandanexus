import { Exam } from '../models/Exam.js';
import { ExamResult } from '../models/ExamResult.js';
import { SchoolClass } from '../models/SchoolClass.js';
import { Teacher } from '../models/Teacher.js';
import { Student } from '../models/Student.js';
import { ApiError } from '../utils/ApiError.js';
import { assertClassOwnership } from './class.service.js';
import { logAudit } from './audit.service.js';
import { notifyTeacher } from './notification.service.js';
import { emitToTeacher } from '../sockets/index.js';
import { pushQuizToStudents, retractQuizFromStudents } from './studentBridge.service.js';
import { pushQuizActivity } from './adminBridge.service.js';

/** Best-effort admin monitoring push — metadata/counts only, never question content. */
async function notifyAdminOfExam(shaped, teacherId) {
  const teacher = await Teacher.findById(teacherId).populate('user', 'name').lean();
  await pushQuizActivity({ ...shaped, teacherName: teacher?.user?.name || '' });
}

async function assertExamOwnership(teacherId, examId) {
  const exam = await Exam.findOne({ _id: examId, teacher: teacherId });
  if (!exam) throw ApiError.notFound('Exam not found.', 'EXAM_NOT_FOUND');
  return exam;
}

function shape(exam) {
  return {
    id: exam._id,
    title: exam.title,
    classId: exam.class?._id || exam.class,
    className: exam.class?.name,
    type: exam.type,
    totalQuestions: exam.totalQuestions,
    durationMinutes: exam.durationMinutes,
    scheduledAt: exam.scheduledAt,
    status: exam.status,
    questions: exam.questions,
    createdAt: exam.createdAt,
  };
}

/** Delivers/updates the quiz on the student portal once it's active and has real questions. Best-effort - see studentBridge.service.js. */
async function syncToStudents(exam) {
  if (exam.status !== 'active' || !exam.questions?.length) return;
  const classDoc = await SchoolClass.findById(exam.class);
  if (classDoc?.studentCourseSlug) {
    await pushQuizToStudents(exam, classDoc);
  }
}

export async function listExams(teacherId) {
  const rows = await Exam.find({ teacher: teacherId }).populate('class', 'name').sort({ scheduledAt: 1, createdAt: -1 }).lean();
  return rows.map(shape);
}

export async function createExam(teacherId, payload, ip) {
  await assertClassOwnership(teacherId, payload.classId);
  const exam = await Exam.create({
    title: payload.title,
    class: payload.classId,
    teacher: teacherId,
    type: payload.type || 'quiz',
    totalQuestions: payload.totalQuestions || 0,
    durationMinutes: payload.durationMinutes || 30,
    scheduledAt: payload.scheduledAt || null,
    status: payload.scheduledAt ? 'scheduled' : 'draft',
  });
  await logAudit({ actorId: teacherId, action: 'exam.created', targetType: 'Exam', targetId: exam._id, metadata: { title: exam.title }, ip });
  await exam.populate('class', 'name');
  const shaped = shape(exam);
  await notifyAdminOfExam(shaped, teacherId);
  return shaped;
}

export async function updateExam(teacherId, examId, updates, ip) {
  const exam = await assertExamOwnership(teacherId, examId);
  // Explicit whitelist matching updateExamValidator's declared fields — see
  // the analogous fix (and its rationale) in course.service.js#updateCourse.
  const patchable = ['title', 'type', 'totalQuestions', 'durationMinutes', 'scheduledAt', 'status', 'questions'];
  for (const key of patchable) {
    if (updates[key] !== undefined) exam[key] = updates[key];
  }
  if (updates.questions !== undefined) exam.totalQuestions = updates.questions.length;
  await exam.save();
  await logAudit({ actorId: teacherId, action: 'exam.updated', targetType: 'Exam', targetId: exam._id, metadata: { updates: { ...updates, questions: updates.questions ? `${updates.questions.length} questions` : undefined } }, ip });
  await exam.populate('class', 'name');
  await syncToStudents(exam);
  const shaped = shape(exam);
  await notifyAdminOfExam(shaped, teacherId);
  return shaped;
}

export async function deleteExam(teacherId, examId, ip) {
  const exam = await assertExamOwnership(teacherId, examId);
  await exam.deleteOne();
  await logAudit({ actorId: teacherId, action: 'exam.deleted', targetType: 'Exam', targetId: examId, ip });
  await retractQuizFromStudents(String(examId));
  await notifyAdminOfExam({ id: examId, title: exam.title, status: 'archived', questions: [] }, teacherId);
  return { id: examId };
}

/**
 * Receives a real, server-graded quiz result bridged in from student/backend
 * (the gap this closes: a bridged Exam's quiz results never previously
 * reached teacher/backend at all — a teacher could publish a quiz to real
 * students but never learn any student's score). Resolves the exam by
 * `sourceId` (this backend's own Exam._id) and the student the same way
 * receiveBridgedSubmission does — by `linkedUserId` first, falling back to
 * email, creating the roster row on the fly if genuinely new.
 */
export async function receiveBridgedQuizResult({ examSourceId, studentUserId, studentName, studentEmail, scorePercentage, correctCount, totalCount }) {
  const exam = await Exam.findById(examSourceId);
  if (!exam) return { recorded: false, reason: 'EXAM_NOT_FOUND' };

  let student = await Student.findOne({ class: exam.class, linkedUserId: studentUserId });
  if (!student && studentEmail) {
    student = await Student.findOne({ class: exam.class, email: studentEmail.toLowerCase() });
    if (student && !student.linkedUserId) {
      student.linkedUserId = studentUserId;
      await student.save();
    }
  }
  if (!student) {
    student = await Student.create({
      name: studentName || studentEmail || 'Student',
      email: (studentEmail || `${studentUserId}@unknown.student`).toLowerCase(),
      class: exam.class,
      teacher: exam.teacher,
      linkedUserId: studentUserId,
    });
  }

  const result = await ExamResult.findOneAndUpdate(
    { exam: exam._id, student: student._id },
    {
      exam: exam._id,
      student: student._id,
      class: exam.class,
      teacher: exam.teacher,
      scorePercentage,
      correctCount,
      totalCount,
      submittedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  emitToTeacher(exam.teacher, 'quiz.result_received', {
    resultId: result._id,
    examId: exam._id,
    studentId: student._id,
    scorePercentage,
  });
  await notifyTeacher(exam.teacher, {
    type: 'submission',
    title: `Quiz result: ${exam.title}`,
    message: `${student.name} scored ${scorePercentage}% (${correctCount}/${totalCount}) on "${exam.title}".`,
    relatedEntityType: 'Exam',
    relatedEntityId: exam._id,
  });

  return { recorded: true, resultId: result._id };
}

export default { listExams, createExam, updateExam, deleteExam, receiveBridgedQuizResult };
