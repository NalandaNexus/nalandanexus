import { z } from 'zod';

export const objectIdParam = (name = 'id') =>
  z.object({ [name]: z.string().regex(/^[0-9a-fA-F]{24}$/, `Invalid ${name}`) });

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  search: z.string().trim().max(200).optional(),
});

export default { objectIdParam, paginationQuery };
