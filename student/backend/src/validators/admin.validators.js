import { z } from 'zod';

export const createAnnouncementSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1).max(4000),
    type: z.enum(['general', 'course', 'urgent']).optional().default('general'),
    publishAt: z.coerce.date().optional(),
    expiresAt: z.coerce.date().optional().nullable(),
  }),
});

export const updateAnnouncementSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(200).optional(),
    content: z.string().trim().min(1).max(4000).optional(),
    type: z.enum(['general', 'course', 'urgent']).optional(),
    isPublished: z.boolean().optional(),
    publishAt: z.coerce.date().optional(),
    expiresAt: z.coerce.date().optional().nullable(),
  }),
});

export const createLiveClassSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(200),
    instructor: z.string().trim().min(1).max(200),
    scheduledAt: z.coerce.date(),
    durationMinutes: z.number().int().min(1).max(600).optional().default(60),
    joinUrl: z.string().trim().url().optional().nullable(),
    recordingUrl: z.string().trim().optional().nullable(),
    status: z.enum(['upcoming', 'completed', 'cancelled']).optional().default('upcoming'),
    courseId: z.string().trim().optional().nullable(),
  }),
});

export const updateLiveClassSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(200).optional(),
    instructor: z.string().trim().min(1).max(200).optional(),
    scheduledAt: z.coerce.date().optional(),
    durationMinutes: z.number().int().min(1).max(600).optional(),
    joinUrl: z.string().trim().url().optional().nullable(),
    recordingUrl: z.string().trim().optional().nullable(),
    status: z.enum(['upcoming', 'completed', 'cancelled']).optional(),
    isPublished: z.boolean().optional(),
  }),
});
