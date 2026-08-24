import { z } from 'zod';

export const createBridgedAnnouncementSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1).max(4000),
    type: z.enum(['general', 'course', 'urgent']).optional().default('general'),
    publishAt: z.coerce.date().optional(),
    expiresAt: z.coerce.date().optional().nullable(),
    sourceId: z.string().trim().min(1),
    authorName: z.string().trim().max(160).optional().nullable(),
    // Resolved server-side to real courseIds - empty/omitted = institution-wide broadcast.
    courseSlugs: z.array(z.string().trim().min(1)).optional().default([]),
    source: z.enum(['teacher-portal', 'admin-portal']).optional().default('teacher-portal'),
  }),
});

export const updateBridgedAnnouncementSchema = z.object({
  params: z.object({
    sourceId: z.string().trim().min(1),
  }),
  body: z.object({
    title: z.string().trim().min(1).max(200).optional(),
    content: z.string().trim().min(1).max(4000).optional(),
    type: z.enum(['general', 'course', 'urgent']).optional(),
    isPublished: z.boolean().optional(),
    publishAt: z.coerce.date().optional(),
    expiresAt: z.coerce.date().optional().nullable(),
  }),
});

export const createBridgedMaterialSchema = z.object({
  body: z.object({
    studentCourseSlug: z.string().trim().min(1),
    title: z.string().trim().min(1).max(200),
    moduleTitle: z.string().trim().max(200).optional().default(''),
    uploadedByName: z.string().trim().max(160).optional().default(''),
    fileUrl: z.string().trim().url(),
    fileName: z.string().trim().max(300).optional().nullable(),
    fileType: z.string().trim().max(30).optional().default('other'),
    fileSizeBytes: z.number().int().min(0).optional().default(0),
    sourceId: z.string().trim().min(1),
  }),
});

export const upsertBridgedTaskSchema = z.object({
  body: z.object({
    studentCourseSlug: z.string().trim().min(1),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(4000).optional().default(''),
    moduleTitle: z.string().trim().max(200).optional().default(''),
    dueDate: z.coerce.date(),
    pointsReward: z.number().int().min(0).max(1000).optional().default(30),
    sourceId: z.string().trim().min(1),
  }),
});

export const createBridgedLiveClassSchema = z.object({
  body: z.object({
    studentCourseSlug: z.string().trim().min(1),
    title: z.string().trim().min(1).max(200),
    instructor: z.string().trim().min(1).max(160),
    scheduledAt: z.coerce.date(),
    durationMinutes: z.number().int().min(5).max(600).optional().default(60),
    joinUrl: z.string().trim().url(),
    sourceId: z.string().trim().min(1),
  }),
});

export const updateBridgedLiveClassSchema = z.object({
  params: z.object({
    sourceId: z.string().trim().min(1),
  }),
  body: z.object({
    title: z.string().trim().min(1).max(200).optional(),
    scheduledAt: z.coerce.date().optional(),
    durationMinutes: z.number().int().min(5).max(600).optional(),
    joinUrl: z.string().trim().url().optional(),
    // A reschedule explicitly un-cancels/un-completes a session back to
    // 'upcoming' by default (see controller) - only pass this to instead
    // mark it 'live'/'completed' from the teacher-portal side.
    status: z.enum(['upcoming', 'live', 'completed', 'cancelled']).optional(),
  }),
});

export const enrolledStudentsQuerySchema = z.object({
  params: z.object({
    slug: z.string().trim().min(1),
  }),
});

export const upsertBridgedQuizSchema = z.object({
  body: z.object({
    studentCourseSlug: z.string().trim().min(1),
    title: z.string().trim().min(1).max(200),
    moduleTitle: z.string().trim().max(200).optional().default(''),
    timeLimitMins: z.number().int().min(1).max(600).optional().default(30),
    questions: z
      .array(
        z.object({
          questionId: z.string().trim().min(1),
          question: z.string().trim().min(1).max(2000),
          options: z.array(z.string().trim().min(1).max(300)).min(2).max(6),
          correctIndex: z.number().int().min(0),
          explanation: z.string().trim().max(2000).optional().default(''),
        })
      )
      .min(1),
    sourceId: z.string().trim().min(1),
  }),
});

export const deliverTeacherMessageSchema = z.object({
  body: z.object({
    studentUserId: z.string().trim().min(1),
    text: z.string().trim().min(1).max(4000),
    teacherName: z.string().trim().max(160).optional().nullable(),
  }),
});

export const upsertBridgedCourseSchema = z.object({
  body: z.object({
    sourceId: z.string().trim().min(1),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^[a-z0-9-]+$/i, 'Invalid slug'),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(4000).optional().default(''),
    features: z.array(z.string().trim().max(200)).optional().default([]),
    priceInPaise: z.number().int().min(0).max(100000000).optional().default(0),
    image: z.string().trim().url().optional().nullable(),
  }),
});

export const unpublishBridgedCourseSchema = z.object({
  params: z.object({
    sourceId: z.string().trim().min(1),
  }),
});

export const upsertBridgedResourceSchema = z.object({
  body: z.object({
    sourceId: z.string().trim().min(1),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional().default(''),
    type: z.enum(['magazine', 'event', 'program']),
    fileUrl: z.string().trim().url(),
    fileName: z.string().trim().max(300).optional().nullable(),
    fileType: z.string().trim().max(30).optional().default('other'),
    fileSizeBytes: z.number().int().min(0).optional().default(0),
    uploadedByName: z.string().trim().max(160).optional().default(''),
    isPublished: z.boolean().optional().default(true),
  }),
});

export const retractBridgedResourceSchema = z.object({
  params: z.object({
    sourceId: z.string().trim().min(1),
  }),
});

export const gradeBridgedTaskSubmissionSchema = z.object({
  params: z.object({
    sourceId: z.string().trim().min(1),
  }),
  body: z.object({
    score: z.number().min(0),
    maxScore: z.number().min(1),
    feedback: z.string().trim().max(2000).optional().nullable(),
  }),
});

export default {
  createBridgedAnnouncementSchema,
  updateBridgedAnnouncementSchema,
  createBridgedMaterialSchema,
  upsertBridgedTaskSchema,
  createBridgedLiveClassSchema,
  updateBridgedLiveClassSchema,
  enrolledStudentsQuerySchema,
  upsertBridgedQuizSchema,
  deliverTeacherMessageSchema,
  upsertBridgedCourseSchema,
  unpublishBridgedCourseSchema,
  upsertBridgedResourceSchema,
  retractBridgedResourceSchema,
  gradeBridgedTaskSubmissionSchema,
};
