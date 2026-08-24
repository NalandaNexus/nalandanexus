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

export default { listAnnouncementsQuery, createAnnouncementSchema };
