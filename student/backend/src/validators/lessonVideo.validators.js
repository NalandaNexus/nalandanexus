import { z } from 'zod';

/**
 * Lesson video bridge requests. Shape only - whether the URL is a real YouTube
 * link is decided by utils/youtube.js inside the service, so there is one rule
 * and one set of error codes, not a regex here that could disagree with it.
 */

const slug = z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/i, 'Invalid course');
const lessonId = z.string().trim().min(1).max(120);
const moduleId = z.string().trim().min(1).max(120);
const uploadId = z.string().trim().regex(/^[a-f\d]{24}$/i, 'Invalid upload session.');

// The version of the video the editor loaded: an ISO timestamp, or null for
// "there was no video". Omitted means "do not check" (older callers).
const expectedUpdatedAt = z.union([z.string().datetime({ offset: true }), z.null()]).optional();

const actor = z
  .object({
    portal: z.enum(['admin', 'teacher']),
    userId: z.string().trim().max(64).nullish(),
    name: z.string().trim().max(120).nullish(),
  })
  .optional();

export const videoCatalogSchema = z.object({
  query: z.object({ slugs: z.string().trim().max(2000).optional() }),
});

export const courseVideosSchema = z.object({
  params: z.object({ slug }),
});

export const inspectVideoSchema = z.object({
  body: z.object({ url: z.string().max(2048), provider: z.enum(['youtube', 'google_drive']).optional() }),
});

export const videoEventsSchema = z.object({
  query: z.object({
    slug: slug.optional(),
    slugs: z.string().trim().max(2000).optional(),
    level: z.enum(['info', 'warn', 'error', 'problems']).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    before: z.string().datetime({ offset: true }).optional(),
  }),
});

const upsertBody = z.object({
  provider: z.enum(['youtube', 'google_drive']).optional().default('youtube'),
  url: z.string().max(2048),
  title: z.string().max(200).optional().default(''),
  description: z.string().max(2000).optional().default(''),
  playbackMode: z.enum(['embed', 'external']).optional().default('embed'),
  isPublished: z.boolean().optional().default(false),
  expectedUpdatedAt,
  actor,
});
const detailsBody = z
  .object({
    title: z.string().max(200).optional(),
    description: z.string().max(2000).optional(),
    playbackMode: z.enum(['embed', 'external']).optional(),
    isPublished: z.boolean().optional(),
    expectedUpdatedAt,
    actor,
  })
  .strict();
const removeBody = z.object({ actor, expectedUpdatedAt }).optional().default({});

const lessonParams = z.object({ slug, lessonId });
const moduleParams = z.object({ slug, moduleId });
export const upsertLessonVideoSchema = z.object({ params: lessonParams, body: upsertBody });
export const updateLessonVideoSchema = z.object({ params: lessonParams, body: detailsBody });
export const removeLessonVideoSchema = z.object({ params: lessonParams, body: removeBody });
export const upsertModuleVideoSchema = z.object({ params: moduleParams, body: upsertBody });
export const updateModuleVideoSchema = z.object({ params: moduleParams, body: detailsBody });
export const removeModuleVideoSchema = z.object({ params: moduleParams, body: removeBody });

// Uploads. Size and type are judged again by the service (utils/videoFile.js);
// these only bound the shapes.
const uploadStartBody = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  mimeType: z.string().max(120).optional().default(''),
  title: z.string().max(200).optional().default(''),
  description: z.string().max(2000).optional().default(''),
  isPublished: z.boolean().optional().default(true),
  expectedUpdatedAt,
  actor,
});
const uploadParams = z.object({ slug, uploadId });
export const startLessonUploadSchema = z.object({ params: lessonParams, body: uploadStartBody });
export const startModuleUploadSchema = z.object({ params: moduleParams, body: uploadStartBody });
export const uploadPartUrlsSchema = z.object({
  params: uploadParams,
  body: z.object({ actor, partNumbers: z.array(z.number().int().positive()).min(1).max(50) }),
});
export const resumeUploadSchema = z.object({ params: uploadParams, body: z.object({ actor }) });
export const completeUploadSchema = z.object({
  params: uploadParams,
  body: z.object({
    actor,
    duration: z.number().finite().min(0).max(24 * 60 * 60).optional(),
    // Set only when the uploader chose to replace a video someone else changed meanwhile.
    expectedUpdatedAt,
  }),
});
export const abortUploadSchema = z.object({ params: uploadParams, body: z.object({ actor }).optional().default({}) });
