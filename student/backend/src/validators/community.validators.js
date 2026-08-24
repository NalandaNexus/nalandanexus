import { z } from 'zod';

export const createPostSchema = z.object({
  body: z.object({
    body: z.string().trim().min(1, 'Post cannot be empty').max(2000),
  }),
});

export const listPostsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  }),
});
