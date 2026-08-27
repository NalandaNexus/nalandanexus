import { z } from 'zod';
import { stripHtml } from '../utils/sanitize.js';

// Strips markup BEFORE the length checks run, so a payload like
// "<script></script>" cannot satisfy a min-length rule by being long before
// sanitisation and empty after it.
const cleanText = (max, min = 0, msg) => {
  const base = z.string().trim().max(max).transform(stripHtml);
  return min > 0 ? base.pipe(z.string().min(min, msg)) : base;
};

export const upsertNoteSchema = z.object({
  body: z.object({
    title: cleanText(200, 1, 'Title is required'),
    category: cleanText(60).optional().default('General'),
    content: cleanText(20000).optional().default(''),
  }),
});
