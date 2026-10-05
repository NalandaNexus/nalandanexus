import { z } from 'zod';
import { paginationQuery } from './common.js';

export const listTeachersQuery = {
  query: paginationQuery.extend({
    status: z.enum(['INVITED', 'ACTIVE', 'SUSPENDED', 'INACTIVE']).optional(),
    department: z.string().trim().max(100).optional(),
    subject: z.string().trim().max(100).optional(),
  }),
};

// The public profile an admin may set on a teacher, shown on the student site's
// About page. Shared by create and update so the two cannot drift apart.
const publicProfileFields = {
  showOnWebsite: z.boolean().optional(),
  websiteRole: z.string().trim().max(160).optional().nullable(),
  websiteCategory: z.string().trim().max(80).optional().nullable(),
  expertise: z.array(z.string().trim().min(1).max(160)).max(12).optional(),
  experienceNote: z.string().trim().max(240).optional().nullable(),
  websiteOrder: z.coerce.number().int().min(0).max(9999).optional(),
};

export const createTeacherSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email(),
    phone: z.string().trim().max(20).optional(),
    department: z.string().trim().max(100).optional(),
    subject: z.string().trim().max(100).optional(),
    qualification: z.string().trim().max(200).optional(),
    ...publicProfileFields,
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
      ...publicProfileFields,
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
