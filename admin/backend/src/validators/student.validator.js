import { z } from 'zod';
import { paginationQuery } from './common.js';

export const listStudentsQuery = {
  query: paginationQuery.extend({
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
    department: z.string().trim().max(100).optional(),
    courseId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    batch: z.string().trim().max(50).optional(),
    source: z.enum(['manual', 'student-portal']).optional(),
  }),
};

export const createStudentSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email(),
    phone: z.string().trim().max(20).optional(),
    rollNo: z.string().trim().min(2).max(40),
    batch: z.string().trim().max(50).optional(),
    semester: z.coerce.number().int().min(1).max(12).optional(),
    department: z.string().trim().max(100).optional(),
  }),
};

export const updateStudentSchema = {
  body: z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      phone: z.string().trim().max(20).optional(),
      batch: z.string().trim().max(50).optional(),
      semester: z.coerce.number().int().min(1).max(12).optional(),
      department: z.string().trim().max(100).optional(),
      status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
      attendancePercent: z.coerce.number().min(0).max(100).optional(),
      gpa: z.coerce.number().min(0).max(10).optional(),
    })
    .strict(),
};

/** The canonical form of an enrollment number however it was typed, or null when it is not one. */
export function normalizeEnrollmentNumber(raw) {
  const compact = String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const match = /^NN(\d{2})(\d{6,9})$/.exec(compact);
  return match ? `NN${match[1]}-${match[2]}` : null;
}

/** Only the canonical form ever reaches the student service; anything else is refused here. */
export const enrollmentNumberParams = {
  params: z.object({
    enrollmentNumber: z
      .string()
      .max(40)
      .transform((value, ctx) => {
        const normalized = normalizeEnrollmentNumber(value);
        if (!normalized) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid enrollment number, for example NN26-000124.' });
          return z.NEVER;
        }
        return normalized;
      }),
  }),
};

/**
 * Resending portal students' records. `mode` picks whose: one student by
 * enrollment number, everyone whose last delivery failed, or every enrolled
 * student a page at a time. Nothing is sent unless `apply` is true.
 */
export const portalSyncSchema = {
  body: z
    .object({
      mode: z.enum(['one', 'pending', 'all']).optional().default('pending'),
      enrollmentNumber: z
        .string()
        .max(40)
        .optional()
        .transform((value, ctx) => {
          if (value === undefined) return undefined;
          const normalized = normalizeEnrollmentNumber(value);
          if (!normalized) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid enrollment number, for example NN26-000124.' });
            return z.NEVER;
          }
          return normalized;
        }),
      cursor: z.string().regex(/^[0-9a-fA-F]{24}$/).nullable().optional(),
      limit: z.coerce.number().int().min(1).max(100).optional().default(10),
      apply: z.boolean().optional().default(false),
    })
    .strict()
    .refine((b) => b.mode !== 'one' || Boolean(b.enrollmentNumber), {
      message: 'An enrollment number is required to resend one student.',
      path: ['enrollmentNumber'],
    }),
};

export default { listStudentsQuery, createStudentSchema, updateStudentSchema, enrollmentNumberParams, portalSyncSchema };
