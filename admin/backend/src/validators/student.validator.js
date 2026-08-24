import { z } from 'zod';
import { paginationQuery } from './common.js';

export const listStudentsQuery = {
  query: paginationQuery.extend({
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
    department: z.string().trim().max(100).optional(),
    courseId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    batch: z.string().trim().max(50).optional(),
  }),
};

export const createStudentSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email(),
    phone: z.string().trim().max(20).optional(),
    rollNo: z.string().trim().min(2).max(40),
    batch: z.string().trim().max(50).optional(),
    semester: z.coerce.number().int().min(1).max(12).optional(),
    department: z.string().trim().max(100).optional(),
  }),
};

export const updateStudentSchema = {
  body: z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      phone: z.string().trim().max(20).optional(),
      batch: z.string().trim().max(50).optional(),
      semester: z.coerce.number().int().min(1).max(12).optional(),
      department: z.string().trim().max(100).optional(),
      status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
      attendancePercent: z.coerce.number().min(0).max(100).optional(),
      gpa: z.coerce.number().min(0).max(10).optional(),
    })
    .strict(),
};

export default { listStudentsQuery, createStudentSchema, updateStudentSchema };
