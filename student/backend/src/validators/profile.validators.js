import { z } from 'zod';
import { stripHtml } from '../utils/sanitize.js';

// Strips markup BEFORE the length checks run, so a payload like
// "<script></script>" cannot satisfy a min-length rule by being long before
// sanitisation and empty after it.
const cleanText = (max, min = 0, msg) => {
  const base = z.string().trim().max(max).transform(stripHtml);
  return min > 0 ? base.pipe(z.string().min(min, msg)) : base;
};

// Explicit allow-list. role / xp / level / rank / badges / isVerified / isActive
// are intentionally excluded - those are backend-controlled fields (see
// master architecture doc section 19: "Do not allow the frontend to modify...").
export const updateProfileSchema = z.object({
  body: z
    .object({
      name: cleanText(120, 2).optional(),
      grade: cleanText(40).optional(),
      board: cleanText(60).optional(),
      school: cleanText(160).optional(),
      bio: cleanText(500).optional(),
      avatar: z.string().trim().max(2000).optional(),
    })
    .strict(),
});

/**
 * The profile a course requires: these four fields and nothing else.
 *
 * `.strict()` is the point. An enrollment number, email, user id or Google id
 * sent with the form is refused outright rather than quietly dropped, so a
 * client that tries to set one is told it cannot. Whether each value is
 * acceptable is decided in studentProfile.service.js#profileFieldErrors, which
 * is also what the service enforces, so the two cannot drift apart.
 */
export const completeProfileSchema = z.object({
  body: z
    .object({
      fullName: z.string().max(200).optional(),
      guardianName: z.string().max(200).optional(),
      grade: z.string().max(40).optional(),
      phone: z.string().max(40).optional(),
    })
    .strict(),
});
