import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
    email: z.string().trim().email('Please enter a valid email address').toLowerCase(),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    grade: z.string().trim().max(40).optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email('Please enter a valid email address').toLowerCase(),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().trim().email('Please enter a valid email address').toLowerCase(),
  }),
});

export const googleAuthSchema = z.object({
  body: z.object({
    idToken: z.string().min(20, 'A valid Google credential is required'),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(10, 'Invalid or missing reset token'),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(10, 'Invalid or missing verification token'),
  }),
});

export const resendVerificationSchema = z.object({
  body: z.object({
    email: z.string().trim().email('Please enter a valid email address').toLowerCase(),
  }),
});
