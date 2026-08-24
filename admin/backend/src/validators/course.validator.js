import { z } from 'zod';
import { paginationQuery } from './common.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);

export const listCoursesQuery = {
  query: paginationQuery.extend({
    status: z.enum(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED']).optional(),
    department: z.string().trim().max(100).optional(),
    instructor: objectId.optional(),
  }),
};

export const createCourseSchema = {
  body: z.object({
    code: z.string().trim().min(2).max(20),
    title: z.string().trim().min(2).max(200),
    category: z.string().trim().max(100).optional(),
    instructor: objectId.optional(),
    department: z.string().trim().max(100).optional(),
    credits: z.coerce.number().min(0).max(20).optional(),
    modulesCount: z.coerce.number().int().min(0).optional(),
    description: z.string().trim().max(4000).optional(),
    // Multipart fields arrive as a single string, not a JSON array — one
    // feature per line, split server-side (see services/course.service.js).
    features: z.string().trim().max(4000).optional(),
    priceInPaise: z.coerce.number().int().min(0).max(100000000).optional(),
  }),
};

export const updateCourseSchema = {
  body: z
    .object({
      title: z.string().trim().min(2).max(200).optional(),
      category: z.string().trim().max(100).optional(),
      instructor: objectId.nullable().optional(),
      department: z.string().trim().max(100).optional(),
      credits: z.coerce.number().min(0).max(20).optional(),
      modulesCount: z.coerce.number().int().min(0).optional(),
      description: z.string().trim().max(4000).optional(),
      features: z.string().trim().max(4000).optional(),
      priceInPaise: z.coerce.number().int().min(0).max(100000000).optional(),
    })
    .strict(),
};

export const statusSchema = {
  body: z.object({
    status: z.enum(['APPROVED', 'REJECTED', 'ARCHIVED', 'DRAFT', 'PENDING_REVIEW']),
    notes: z.string().trim().max(1000).optional(),
  }),
};

export default { listCoursesQuery, createCourseSchema, updateCourseSchema, statusSchema };
