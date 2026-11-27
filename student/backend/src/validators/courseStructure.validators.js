import { z } from 'zod';

/**
 * Course-structure bridge requests. Shape only - titles/descriptions are
 * re-sanitized inside courseStructure.service.js regardless of what passes
 * here, so there is one rule for what a title is allowed to contain, not a
 * regex here that could disagree with it.
 */

const slug = z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/i, 'Invalid course');
const moduleId = z.string().trim().min(1).max(120);
const lessonId = z.string().trim().min(1).max(120);

// The version of the module/lesson/course the editor loaded: an ISO
// timestamp, or null for "no prior edit exists yet". Omitted = don't check
// (older callers / internal scripts).
const expectedUpdatedAt = z.union([z.string().datetime({ offset: true }), z.null()]).optional();

const actor = z
  .object({
    portal: z.enum(['admin', 'teacher']),
    userId: z.string().trim().max(64).nullish(),
    name: z.string().trim().max(120).nullish(),
  })
  .optional();

export const courseStructureParamsSchema = z.object({ params: z.object({ slug }) });

export const updateCourseSettingsSchema = z.object({
  params: z.object({ slug }),
  body: z.object({ progressionGatingEnabled: z.boolean(), expectedUpdatedAt, actor }),
});

export const addModuleSchema = z.object({
  params: z.object({ slug }),
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional().default(''),
    order: z.number().int().positive().optional(),
    gatingEnabled: z.boolean().nullable().optional(),
    actor,
  }),
});

export const updateModuleSchema = z.object({
  params: z.object({ slug, moduleId }),
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    gatingEnabled: z.boolean().nullable().optional(),
    expectedUpdatedAt,
    actor,
  }),
});

export const reorderModulesSchema = z.object({
  params: z.object({ slug }),
  body: z.object({ orderedModuleIds: z.array(moduleId).min(1), actor }),
});

export const addLessonSchema = z.object({
  params: z.object({ slug, moduleId }),
  body: z.object({
    title: z.string().min(1).max(200),
    duration: z.string().max(40).optional().default(''),
    summary: z.string().max(500).optional().default(''),
    content: z.string().max(20000).optional().default(''),
    order: z.number().int().positive().optional(),
    isPublished: z.boolean().optional().default(true),
    actor,
  }),
});

export const updateLessonSchema = z.object({
  params: z.object({ slug, moduleId, lessonId }),
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    duration: z.string().max(40).optional(),
    summary: z.string().max(500).optional(),
    content: z.string().max(20000).optional(),
    isPublished: z.boolean().optional(),
    expectedUpdatedAt,
    actor,
  }),
});

export const reorderLessonsSchema = z.object({
  params: z.object({ slug, moduleId }),
  body: z.object({ orderedLessonIds: z.array(lessonId).min(1), actor }),
});

export const removeModuleSchema = z.object({
  params: z.object({ slug, moduleId }),
  body: z.object({ actor }).optional().default({}),
});

export const removeLessonSchema = z.object({
  params: z.object({ slug, moduleId, lessonId }),
  body: z.object({ actor }).optional().default({}),
});
