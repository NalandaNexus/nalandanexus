import { z } from 'zod';

export const updateSettingsSchema = {
  body: z
    .object({
      platformName: z.string().trim().min(1).max(120).optional(),
      supportEmail: z.string().trim().email().optional(),
      security: z
        .object({
          strictAdminProvisioning: z.boolean().optional(),
          tokenHashEnforcement: z.boolean().optional(),
          bcryptWorkFactor: z.number().int().min(10).max(14).optional(),
          invitationExpiryHours: z.number().int().min(1).max(168).optional(),
        })
        .partial()
        .optional(),
      notifications: z
        .object({
          emailEnabled: z.boolean().optional(),
          teacherApprovalAlerts: z.boolean().optional(),
          paymentAlerts: z.boolean().optional(),
        })
        .partial()
        .optional(),
      academic: z
        .object({
          currentAcademicSession: z.string().trim().max(20).optional(),
          attendanceThresholdPercent: z.number().min(0).max(100).optional(),
        })
        .partial()
        .optional(),
    })
    .strict(),
};

export default { updateSettingsSchema };
