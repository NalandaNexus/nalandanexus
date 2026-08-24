import { z } from 'zod';

export const createOrderSchema = z.object({
  body: z.object({
    courseSlug: z.string().trim().min(1, 'courseSlug is required'),
  }),
});

export const verifyPaymentSchema = z.object({
  body: z.object({
    razorpay_order_id: z.string().min(1),
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
  }),
});
