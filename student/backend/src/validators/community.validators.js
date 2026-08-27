import { z } from 'zod';
import { stripHtml } from '../utils/sanitize.js';

// Strips markup BEFORE the length checks run, so a payload like
// "<script></script>" cannot satisfy a min-length rule by being long before
// sanitisation and empty after it.
const cleanText = (max, min = 0, msg) => {
  const base = z.string().trim().max(max).transform(stripHtml);
  return min > 0 ? base.pipe(z.string().min(min, msg)) : base;
};

export const createPostSchema = z.object({
  body: z.object({
    body: cleanText(2000, 1, 'Post cannot be empty'),
  }),
});

export const listPostsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  }),
});
