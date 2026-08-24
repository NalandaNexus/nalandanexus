import { z } from 'zod';
import { paginationQuery } from './common.js';

export const listResourcesQuery = {
  query: paginationQuery.extend({
    type: z.enum(['magazine', 'event', 'program']).optional(),
  }),
};

export const createResourceSchema = {
  body: z.object({
    title: z.string().trim().min(2).max(200),
    type: z.enum(['magazine', 'event', 'program']),
    description: z.string().trim().max(2000).optional(),
    // Multipart checkbox fields arrive as the string "true"/"false".
    isPublished: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .optional()
      .transform((v) => (v === undefined ? true : v === true || v === 'true')),
  }),
};

export const updateResourceSchema = {
  body: z
    .object({
      title: z.string().trim().min(2).max(200).optional(),
      type: z.enum(['magazine', 'event', 'program']).optional(),
      description: z.string().trim().max(2000).optional(),
      isPublished: z
        .union([z.boolean(), z.enum(['true', 'false'])])
        .optional()
        .transform((v) => (v === undefined ? undefined : v === true || v === 'true')),
    })
    .strict(),
};

export default { listResourcesQuery, createResourceSchema, updateResourceSchema };
