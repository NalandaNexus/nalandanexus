import jwt from 'jsonwebtoken';
import { Admin } from '../models/Admin.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { recordAuditLog } from './auditLog.service.js';

function issueToken(admin) {
  return jwt.sign(
    {
      id: admin._id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      tokenVersion: admin.tokenVersion,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

export async function login({ email, password }, req) {
  const admin = await Admin.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash +tokenVersion');

  if (!admin) {
    await recordAuditLog({ action: 'admin.login.failed', entityType: 'Admin', metadata: { email, reason: 'not_found' }, result: 'FAILURE', req });
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const passwordMatches = await admin.comparePassword(password);
  if (!passwordMatches) {
    await recordAuditLog({ actor: admin, action: 'admin.login.failed', entityType: 'Admin', entityId: admin._id, result: 'FAILURE', req });
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (admin.status !== 'ACTIVE' || !admin.isActive) {
    throw ApiError.forbidden('This account has been suspended', 'ACCOUNT_SUSPENDED');
  }

  admin.lastLogin = new Date();
  await admin.save();

  const token = issueToken(admin);
  await recordAuditLog({ actor: admin, action: 'admin.login', entityType: 'Admin', entityId: admin._id, req });

  return { token, admin: admin.toSafeJSON() };
}

export async function logout(admin, req) {
  // Bumping tokenVersion invalidates every previously-issued token for this
  // account immediately (checked on every request in middleware/auth.js),
  // which is the real invalidation mechanism for a stateless JWT.
  await Admin.updateOne({ _id: admin._id }, { $inc: { tokenVersion: 1 } });
  await recordAuditLog({ actor: admin, action: 'admin.logout', entityType: 'Admin', entityId: admin._id, req });
}

export async function changePassword(admin, { currentPassword, newPassword }, req) {
  const full = await Admin.findById(admin._id).select('+passwordHash +tokenVersion');
  const matches = await full.comparePassword(currentPassword);
  if (!matches) throw ApiError.badRequest('Current password is incorrect', 'INVALID_CURRENT_PASSWORD');

  full.passwordHash = await Admin.hashPassword(newPassword);
  full.tokenVersion += 1;
  await full.save();

  await recordAuditLog({ actor: admin, action: 'admin.password.changed', entityType: 'Admin', entityId: admin._id, req });

  return { token: issueToken(full) };
}

export async function getSelf(admin) {
  return admin.toSafeJSON();
}

export default { login, logout, changePassword, getSelf };
