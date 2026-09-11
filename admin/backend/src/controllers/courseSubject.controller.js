import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as studentBridge from '../services/studentCourseBridge.service.js';
import { recordAuditLog } from '../services/auditLog.service.js';

/**
 * Classifying what each piece of a course actually teaches.
 *
 * The subject decides which of a student's three skill scores an activity feeds,
 * so this is progression configuration wearing content-editor clothes. It is
 * guarded by `courses.manage` for that reason: whoever can price a course can
 * say what it teaches, and nobody below that can.
 *
 * The content itself lives in the student service, which is the only place a
 * native course exists - hence the proxy rather than a local edit.
 */

export const getContent = catchAsync(async (req, res) => {
  const content = await studentBridge.getCourseContent(req.params.slug);
  sendSuccess(res, { data: content });
});

export const getSubjects = catchAsync(async (req, res) => {
  const subjects = await studentBridge.listSubjects();
  sendSuccess(res, { data: subjects });
});

export const setSubjects = catchAsync(async (req, res) => {
  const result = await studentBridge.setContentSubjects(req.params.slug, req.body);

  await recordAuditLog({
    actor: req.admin,
    action: 'course.subjects.updated',
    entityType: 'Course',
    entityId: req.params.slug,
    metadata: {
      slug: req.params.slug,
      // What was retagged, so a later "why did this student's Computer score
      // change" has an answer that predates the change.
      modules: (req.body.modules || []).map((m) => `${m.moduleId}=${m.subject ?? 'inherit'}`),
      lessons: (req.body.lessons || []).map((l) => `${l.lessonId}=${l.subject ?? 'inherit'}`),
      quizzes: (req.body.quizzes || []).map((q) => `${q.quizId}=${q.subject ?? 'inherit'}`),
      tasks: (req.body.tasks || []).map((t) => `${t.taskId}=${t.subject ?? 'inherit'}`),
    },
    req,
  });

  sendSuccess(res, { message: 'Subjects updated', data: result });
});

export default { getContent, getSubjects, setSubjects };
