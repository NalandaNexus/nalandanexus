import { z } from 'zod';

export const ingestPaymentSchema = {
  body: z.object({
    sourceId: z.string().trim().min(1),
    studentName: z.string().trim().max(160).optional().nullable(),
    studentEmail: z.string().trim().max(200).optional().nullable(),
    courseTitle: z.string().trim().max(200).optional().nullable(),
    amountInPaise: z.coerce.number().int().min(0),
    currency: z.string().trim().length(3).optional().default('INR'),
    status: z.enum(['PAID', 'FAILED', 'PENDING', 'REFUNDED']),
    razorpayOrderId: z.string().trim().max(120).optional().nullable(),
    razorpayPaymentId: z.string().trim().max(120).optional().nullable(),
  }),
};

export const ingestAssignmentActivitySchema = {
  body: z.object({
    sourceId: z.string().trim().min(1),
    title: z.string().trim().min(1).max(200),
    className: z.string().trim().max(160).optional().default(''),
    teacherName: z.string().trim().max(160).optional().default(''),
    dueDate: z.coerce.date().optional().nullable(),
    total: z.coerce.number().int().min(0).optional().default(0),
    submitted: z.coerce.number().int().min(0).optional().default(0),
    toGrade: z.coerce.number().int().min(0).optional().default(0),
    avgScore: z.coerce.number().min(0).max(100).optional().nullable(),
    status: z.string().trim().max(30).optional().default('published'),
  }),
};

export const ingestQuizActivitySchema = {
  body: z.object({
    sourceId: z.string().trim().min(1),
    title: z.string().trim().min(1).max(200),
    className: z.string().trim().max(160).optional().default(''),
    teacherName: z.string().trim().max(160).optional().default(''),
    type: z.string().trim().max(30).optional().default('quiz'),
    questionCount: z.coerce.number().int().min(0).optional().default(0),
    durationMinutes: z.coerce.number().int().min(0).optional().default(0),
    scheduledAt: z.coerce.date().optional().nullable(),
    status: z.string().trim().max(30).optional().default('draft'),
  }),
};

export const ingestAttendanceSummarySchema = {
  body: z.object({
    sourceId: z.string().trim().min(1),
    className: z.string().trim().max(160).optional().default(''),
    teacherName: z.string().trim().max(160).optional().default(''),
    date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
    presentCount: z.coerce.number().int().min(0).optional().default(0),
    absentCount: z.coerce.number().int().min(0).optional().default(0),
    lateCount: z.coerce.number().int().min(0).optional().default(0),
    totalCount: z.coerce.number().int().min(0).optional().default(0),
  }),
};

export const ingestTeacherAnnouncementSchema = {
  body: z.object({
    sourceId: z.string().trim().min(1),
    title: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1),
    priority: z.string().trim().max(20).optional().default('MEDIUM'),
    teacherName: z.string().trim().max(160).optional().default(''),
    className: z.string().trim().max(160).optional().default(''),
    publishedAt: z.coerce.date().optional(),
  }),
};

export default {
  ingestPaymentSchema,
  ingestAssignmentActivitySchema,
  ingestQuizActivitySchema,
  ingestAttendanceSummarySchema,
  ingestTeacherAnnouncementSchema,
};
