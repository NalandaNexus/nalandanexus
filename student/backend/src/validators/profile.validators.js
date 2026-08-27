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
