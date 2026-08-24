import { Settings } from '../models/Settings.js';
import { recordAuditLog } from './auditLog.service.js';

export async function getSettings() {
  let settings = await Settings.findById('platform_settings');
  if (!settings) settings = await Settings.create({ _id: 'platform_settings' });
  return settings;
}

export async function updateSettings(data, actor, req) {
  const settings = await getSettings();

  if (data.security) Object.assign(settings.security, data.security);
  if (data.notifications) Object.assign(settings.notifications, data.notifications);
  if (data.academic) Object.assign(settings.academic, data.academic);
  if (data.platformName) settings.platformName = data.platformName;
  if (data.supportEmail) settings.supportEmail = data.supportEmail;
  settings.updatedBy = actor._id;

  await settings.save();
  await recordAuditLog({ actor, action: 'settings.updated', entityType: 'Settings', entityId: settings._id, metadata: { fields: Object.keys(data) }, req });
  return settings;
}

export default { getSettings, updateSettings };
