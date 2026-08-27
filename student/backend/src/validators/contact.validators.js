import { z } from 'zod';
import { stripHtml } from '../utils/sanitize.js';

// Strips markup BEFORE the length checks run, so a payload like
// "<script></script>" cannot satisfy a min-length rule by being long before
// sanitisation and empty after it.
const cleanText = (max, min = 0, msg) => {
  const base = z.string().trim().max(max).transform(stripHtml);
  return min > 0 ? base.pipe(z.string().min(min, msg)) : base;
};

export const contactSchema = z.object({
  body: z.object({
    name: cleanText(120, 2),
    email: z.string().trim().email(),
    phone: z.string().trim().max(20).optional(),
    subject: cleanText(200).optional(),
    message: cleanText(4000, 10, 'Message must be at least 10 characters'),
  }),
});
