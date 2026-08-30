import { z } from 'zod';

/**
 * Batch administration input.
 *
 * The teacher service validates all of this again against its own data — the
 * course must exist in the live catalogue, the teacher must have a real account.
 * These schemas reject what is malformed before a cross-service call is made,
 * and keep unexpected keys out of the proxied body; they are not the only line
 * of defence, and are not treated as one.
 */

const courseSlug = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9-]+$/i, 'Invalid course reference');

const teacherEmail = z.string().trim().min(1).max(160).email('A valid teacher email is required');

// A batch of a coaching course seats roughly 50-60. The bounds are wide enough
// for a one-to-one or a large cohort while still refusing zero and absurd values.
const capacity = z.coerce.number().int().min(1, 'Capacity must be at least 1').max(500, 'Capacity cannot exceed 500');

export const listBatchesQuery = {
  query: z.object({
    courseSlug: courseSlug.optional(),
    teacherEmail: teacherEmail.optional(),
    status: z.enum(['all', 'active', 'archived']).optional(),
    search: z.string().trim().max(120).optional(),
  }),
};

export const createBatchSchema = {
  body: z.object({
    courseSlug,
    name: z.string().trim().min(1, 'A batch name is required').max(120),
    teacherEmail,
    capacity: capacity.optional(),
    room: z.string().trim().max(60).nullish(),
    schedule: z.string().trim().max(200).nullish(),
  }),
};

export const updateBatchSchema = {
  body: z.object({
    name: z.string().trim().min(1).max(120).optional(),
    capacity: capacity.optional(),
    // FULL is derived from enrolledCount vs capacity, never stored — a stored
    // flag drifts the moment a seat is released.
    status: z.enum(['active', 'archived']).optional(),
    room: z.string().trim().max(60).nullish(),
    schedule: z.string().trim().max(200).nullish(),
    studentCourseSlug: courseSlug.optional(),
  }),
};

export const reassignTeacherSchema = {
  body: z.object({
    teacherEmail,
  }),
};

export default { listBatchesQuery, createBatchSchema, updateBatchSchema, reassignTeacherSchema };
