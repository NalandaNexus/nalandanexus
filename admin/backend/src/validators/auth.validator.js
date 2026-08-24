import { z } from 'zod';

export const loginSchema = {
  body: z.object({
    email: z.string().trim().email('A valid email is required'),
    password: z.string().min(1, 'Password is required'),
  }),
};

export const changePasswordSchema = {
  body: z
    .object({
      currentPassword: z.string().min(1),
      newPassword: z
        .string()
        .min(8, 'New password must be at least 8 characters')
        .regex(/[A-Z]/, 'New password must contain an uppercase letter')
        .regex(/[0-9]/, 'New password must contain a number'),
    })
    .strict(),
};

export default { loginSchema, changePasswordSchema };
