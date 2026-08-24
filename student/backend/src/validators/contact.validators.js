import { z } from 'zod';

export const contactSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email(),
    phone: z.string().trim().max(20).optional(),
    subject: z.string().trim().max(200).optional(),
    message: z.string().trim().min(10, 'Message must be at least 10 characters').max(4000),
  }),
});
