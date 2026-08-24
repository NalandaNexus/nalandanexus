import { z } from 'zod';

export const upsertNoteSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    category: z.string().trim().max(60).optional().default('General'),
    content: z.string().trim().max(20000).optional().default(''),
  }),
});
