import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/courseSubject.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

/**
 * Subject tagging for course content.
 *
 * Guarded by `courses.manage` - the subject an activity carries decides which
 * skill score it feeds, so this is progression configuration, not cosmetic
 * metadata, and it belongs behind the same permission as pricing a course.
 */
const router = Router();

router.use(authenticate);

const slugParam = { params: z.object({ slug: z.string().trim().min(1).max(120) }) };

const assignment = z.object({ subject: z.string().trim().max(32).nullish() });
const setSchema = {
  ...slugParam,
  body: z.object({
    modules: z.array(assignment.extend({ moduleId: z.string().trim().min(1) })).max(200).optional(),
    lessons: z.array(assignment.extend({ lessonId: z.string().trim().min(1) })).max(500).optional(),
    quizzes: z.array(assignment.extend({ quizId: z.string().trim().min(1) })).max(500).optional(),
    tasks: z.array(assignment.extend({ taskId: z.string().trim().min(1) })).max(500).optional(),
  }),
};

router.get('/subjects', requirePermission('courses.manage'), controller.getSubjects);
router.get('/:slug/content', requirePermission('courses.manage'), validate(slugParam), controller.getContent);
router.patch('/:slug/subjects', requirePermission('courses.manage'), validate(setSchema), controller.setSubjects);

export default router;
