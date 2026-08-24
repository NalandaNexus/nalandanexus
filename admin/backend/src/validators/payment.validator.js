import { z } from 'zod';
import { paginationQuery } from './common.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);

export const listPaymentsQuery = {
  query: paginationQuery.extend({
    status: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']).optional(),
    student: objectId.optional(),
  }),
};

export const createPaymentSchema = {
  body: z.object({
    student: objectId,
    amount: z.coerce.number().positive(),
    currency: z.string().trim().length(3).optional(),
    method: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'UPI', 'OTHER']).optional(),
    reference: z.string().trim().max(120).optional(),
    description: z.string().trim().max(300).optional(),
    dueDate: z.coerce.date().optional(),
  }),
};

export const updatePaymentStatusSchema = {
  body: z.object({ status: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']) }),
};

export default { listPaymentsQuery, createPaymentSchema, updatePaymentStatusSchema };
