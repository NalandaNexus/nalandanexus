import { z } from 'zod';
import { paginationQuery } from './common.js';

export const listTeachersQuery = {
  query: paginationQuery.extend({
    status: z.enum(['INVITED', 'ACTIVE', 'SUSPENDED', 'INACTIVE']).optional(),
    department: z.string().trim().max(100).optional(),
    subject: z.string().trim().max(100).optional(),
  }),
};

export const createTeacherSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email(),
    phone: z.string().trim().max(20).optional(),
    department: z.string().trim().max(100).optional(),
    subject: z.string().trim().max(100).optional(),
    qualification: z.string().trim().max(200).optional(),
  }),
};

export const updateTeacherSchema = {
  body: z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      phone: z.string().trim().max(20).optional(),
      department: z.string().trim().max(100).optional(),
      subject: z.string().trim().max(100).optional(),
      qualification: z.string().trim().max(200).optional(),
    })
    .strict(),
};

export const suspendTeacherSchema = {
  body: z.object({ reason: z.string().trim().min(3).max(500) }),
};

export const activateTeacherSchema = {
  body: z.object({
    token: z.string().min(10),
    password: z
      .string()
      .min(8)
      .regex(/[A-Z]/, 'Password must contain an uppercase letter')
      .regex(/[0-9]/, 'Password must contain a number'),
  }),
};

export default {
  listTeachersQuery,
  createTeacherSchema,
  updateTeacherSchema,
  suspendTeacherSchema,
  activateTeacherSchema,
};
