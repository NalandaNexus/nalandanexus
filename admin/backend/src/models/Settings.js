import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Deliberately a singleton document (fixed _id) rather than a full
 * collection — the Admin Settings page edits one shared platform config.
 */
const settingsSchema = new Schema(
  {
    _id: { type: String, default: 'platform_settings' },
    platformName: { type: String, default: 'Nalanda Nexus' },
    supportEmail: { type: String, default: 'support@nalanda.edu' },
    security: {
      strictAdminProvisioning: { type: Boolean, default: true },
      tokenHashEnforcement: { type: Boolean, default: true },
      bcryptWorkFactor: { type: Number, default: 12 },
      invitationExpiryHours: { type: Number, default: 24 },
    },
    notifications: {
      emailEnabled: { type: Boolean, default: true },
      teacherApprovalAlerts: { type: Boolean, default: true },
      paymentAlerts: { type: Boolean, default: true },
    },
    academic: {
      currentAcademicSession: { type: String, default: '2026-27' },
      attendanceThresholdPercent: { type: Number, default: 75 },
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true, _id: false }
);

export const Settings = mongoose.model('Settings', settingsSchema);
export default Settings;
