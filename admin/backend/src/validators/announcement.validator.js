import { z } from 'zod';
import { paginationQuery } from './common.js';

export const listAnnouncementsQuery = { query: paginationQuery.extend({ audience: z.enum(['ALL', 'TEACHERS', 'STUDENTS']).optional() }) };

export const createAnnouncementSchema = {
  body: z.object({
    title: z.string().trim().min(3).max(200),
    content: z.string().trim().min(3),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    audience: z.enum(['ALL', 'TEACHERS', 'STUDENTS']).optional(),
  }),
};

export const updateAnnouncementSchema = {
  body: z
    .object({
      title: z.string().trim().min(3).max(200).optional(),
      content: z.string().trim().min(3).optional(),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
      audience: z.enum(['ALL', 'TEACHERS', 'STUDENTS']).optional(),
    })
    .strict(),
};

export default { listAnnouncementsQuery, createAnnouncementSchema, updateAnnouncementSchema };
