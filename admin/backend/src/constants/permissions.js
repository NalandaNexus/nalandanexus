export const ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  STAFF: 'STAFF',
});

export const PERMISSIONS = Object.freeze([
  'users.read', 'users.create', 'users.update', 'users.delete',
  'teachers.read', 'teachers.create', 'teachers.update', 'teachers.delete',
  'students.read', 'students.create', 'students.update', 'students.delete',
  'courses.manage', 'resources.manage',
  'analytics.view', 'payments.view', 'payments.manage',
  'settings.manage', 'audit.view', 'announcements.manage', 'notifications.manage',
]);

// SUPER_ADMIN always gets every permission regardless of what's stored on the
// document (enforced in the Admin model's hasPermission method), so it isn't
// listed explicitly here.
export const DEFAULT_ROLE_PERMISSIONS = Object.freeze({
  ADMIN: [
    'users.read', 'teachers.read', 'teachers.create', 'teachers.update',
    'students.read', 'students.create', 'students.update',
    'courses.manage', 'resources.manage',
    'analytics.view', 'payments.view', 'audit.view',
    'announcements.manage', 'notifications.manage',
  ],
  STAFF: [
    'teachers.read', 'students.read', 'students.create', 'students.update',
    'analytics.view', 'announcements.manage', 'resources.manage',
  ],
});

export default { ROLES, PERMISSIONS, DEFAULT_ROLE_PERMISSIONS };
