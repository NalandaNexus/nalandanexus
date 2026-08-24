import { z } from 'zod';

export const submitQuizSchema = z.object({
  body: z.object({
    // { [questionId]: selectedOptionIndex }
    answers: z.record(z.string(), z.number().int().min(0)),
  }),
});
