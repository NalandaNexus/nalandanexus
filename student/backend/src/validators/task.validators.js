import { z } from 'zod';

export const submitTaskSchema = z.object({
  body: z.object({
    submissionText: z.string().trim().max(5000).optional().default(''),
  }),
});
