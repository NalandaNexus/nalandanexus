import { z } from 'zod';

// Explicit allow-list. role / xp / level / rank / badges / isVerified / isActive
// are intentionally excluded - those are backend-controlled fields (see
// master architecture doc section 19: "Do not allow the frontend to modify...").
export const updateProfileSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      grade: z.string().trim().max(40).optional(),
      board: z.string().trim().max(60).optional(),
      school: z.string().trim().max(160).optional(),
      bio: z.string().trim().max(500).optional(),
      avatar: z.string().trim().max(2000).optional(),
    })
    .strict(),
});
