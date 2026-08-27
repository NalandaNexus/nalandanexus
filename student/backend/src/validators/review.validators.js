import { z } from 'zod';
import { stripHtml } from '../utils/sanitize.js';

// Whole stars, 1-5. Rejects 0, 6, 4.5, "5", null and NaN alike - the star
// value is the one field the average is computed from, so anything the schema
// lets through would silently distort every course's rating.
const ratingField = z
  .number({ invalid_type_error: 'Rating must be a number between 1 and 5.' })
  .int('Rating must be a whole number of stars.')
  .min(1, 'Rating must be at least 1 star.')
  .max(5, 'Rating cannot be more than 5 stars.');

const commentField = z.string().trim().max(2000).transform(stripHtml);

export const createReviewSchema = z.object({
  body: z
    .object({
      rating: ratingField,
      comment: commentField.optional().default(''),
    })
    .strict(),
});

export const updateReviewSchema = z.object({
  body: z
    .object({
      rating: ratingField.optional(),
      comment: commentField.optional(),
    })
    .strict()
    .refine((b) => b.rating !== undefined || b.comment !== undefined, {
      message: 'Provide a rating or a comment to update.',
    }),
});
