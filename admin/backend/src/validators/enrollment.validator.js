import { z } from 'zod';
import { paginationQuery } from './common.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);

export const listEnrollmentsQuery = {
  query: paginationQuery.extend({
    student: objectId.optional(),
    course: objectId.optional(),
    status: z.enum(['ACTIVE', 'COMPLETED', 'DROPPED']).optional(),
  }),
};

export const createEnrollmentSchema = {
  body: z.object({
    student: objectId,
    course: objectId,
  }),
};

export const updateEnrollmentSchema = {
  body: z
    .object({
      status: z.enum(['ACTIVE', 'COMPLETED', 'DROPPED']).optional(),
      progressPercent: z.coerce.number().min(0).max(100).optional(),
    })
    .strict(),
};

export default { listEnrollmentsQuery, createEnrollmentSchema, updateEnrollmentSchema };
