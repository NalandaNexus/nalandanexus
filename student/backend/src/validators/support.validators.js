import { z } from 'zod';

export const createTicketSchema = z.object({
  body: z.object({
    subject: z.string().trim().min(3, 'Subject is required').max(200),
    message: z.string().trim().min(10, 'Please provide more detail (min 10 characters)').max(4000),
  }),
});
