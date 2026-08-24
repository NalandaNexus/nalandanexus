import { User } from '../models/User.js';
import { Teacher } from '../models/Teacher.js';
import { ApiError } from '../utils/ApiError.js';
import { signAuthToken } from '../utils/tokens.js';
import { formatSequentialId } from '../utils/generateId.js';
import { logAudit } from './audit.service.js';

/**
 * Verifies teacher credentials and issues a session token.
 * Deliberately returns a generic "invalid email or password" message on
 * every failure branch (unknown email, wrong password, wrong role) so the
 * response can't be used to enumerate valid faculty email addresses.
 */
export async function loginTeacher({ email, password, rememberMe, ip }) {
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash +tokenVersion');
  const genericError = () => ApiError.unauthorized('Invalid email or password.', 'INVALID_CREDENTIALS');

  if (!user || user.role !== 'teacher') throw genericError();

  const passwordOk = await user.comparePassword(password);
  if (!passwordOk) throw genericError();

  // A temp password still authenticates normally - middleware/auth.js is
  // what actually blocks portal access until it's changed, not this check -
  // so a forced-reset teacher still gets a real session here, just one that
  // can only reach /api/teacher/auth/*.
  if (user.status !== 'active') {
    throw ApiError.forbidden('This account has been deactivated. Contact your administrator.', 'ACCOUNT_INACTIVE');
  }

  const teacher = await Teacher.findOne({ user: user._id });
  if (!teacher) throw ApiError.forbidden('No teacher profile is associated with this account.', 'TEACHER_PROFILE_MISSING');

  user.lastLoginAt = new Date();
  await user.save();

  const token = signAuthToken(
    { userId: user._id, teacherId: teacher._id, role: user.role, tokenVersion: user.tokenVersion },
    Boolean(rememberMe)
  );

  await logAudit({ actorId: teacher._id, action: 'auth.login', targetType: 'Teacher', targetId: teacher._id, ip });

  return { token, user, teacher };
}

export async function logoutTeacher({ teacherId, ip }) {
  if (teacherId) {
    await logAudit({ actorId: teacherId, action: 'auth.logout', targetType: 'Teacher', targetId: teacherId, ip });
  }
}

/** Bumps tokenVersion, which immediately invalidates every previously issued JWT for this user. */
export async function invalidateAllSessions(userId) {
  await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
}

export async function changePassword({ userId, currentPassword, newPassword, ip, teacherId }) {
  // Must also select tokenVersion (also `select: false` on the schema) -
  // omitting it left `user.tokenVersion` undefined below, so `+= 1` produced
  // NaN and the save failed a Mongoose Number cast on every call (a
  // pre-existing bug this path had never actually been exercised by, found
  // live while testing the new forced-reset flow).
  const user = await User.findById(userId).select('+passwordHash +tokenVersion');
  if (!user) throw ApiError.notFound('Account not found.', 'ACCOUNT_NOT_FOUND');

  const ok = await user.comparePassword(currentPassword);
  if (!ok) throw ApiError.badRequest('Current password is incorrect.', 'INVALID_CURRENT_PASSWORD');

  user.passwordHash = await User.hashPassword(newPassword);
  user.tokenVersion += 1; // invalidate every other active session
  user.mustChangePassword = false; // the temp password, if any, is now permanently unusable
  await user.save();

  await logAudit({ actorId: teacherId, action: 'auth.password_changed', targetType: 'User', targetId: user._id, ip });

  return signAuthToken({ userId: user._id, teacherId, role: user.role, tokenVersion: user.tokenVersion }, false);
}

/**
 * Creates a brand-new teacher User + Teacher profile pair. Not exposed via
 * a public self-serve registration route (faculty onboarding is expected to
 * be an administrative action) — used by the seed script today, and left
 * here so an admin-invite flow can call it directly later without
 * duplicating the account-creation logic.
 */
export async function createTeacherAccount({ name, email, password, phone = null, title, department, subject, tier = 'free', mustChangePassword = false }) {
  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) throw ApiError.conflict('An account with this email already exists.', 'EMAIL_TAKEN');

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({ name, email, phone, passwordHash, role: 'teacher', mustChangePassword });

  const count = await Teacher.countDocuments();
  const teacherId = formatSequentialId('TCH', count + 1);

  const teacher = await Teacher.create({
    user: user._id,
    teacherId,
    title: title || 'Faculty',
    department: department || null,
    subject: subject || null,
    tier,
  });

  return { user, teacher };
}

/**
 * Resets an EXISTING teacher's password to a new admin-issued temporary
 * one (the "Resend Credentials" flow) — unlike createTeacherAccount, this
 * expects the account to already exist and updates it in place rather than
 * conflicting on EMAIL_TAKEN. Mirrors changePassword's security posture:
 * bumps tokenVersion (any session authenticated with the old password is
 * immediately revoked, not just the password itself) and forces
 * mustChangePassword back to true so the new temp password only ever
 * grants the same restricted first-login state as a brand-new account.
 */
export async function resetCredentials({ email, newPassword }) {
  const user = await User.findOne({ email: email.toLowerCase().trim(), role: 'teacher' }).select('+passwordHash +tokenVersion');
  if (!user) throw ApiError.notFound('No teacher account exists for this email.', 'ACCOUNT_NOT_FOUND');

  const teacher = await Teacher.findOne({ user: user._id });
  if (!teacher) throw ApiError.forbidden('No teacher profile is associated with this account.', 'TEACHER_PROFILE_MISSING');

  user.passwordHash = await User.hashPassword(newPassword);
  user.mustChangePassword = true;
  user.tokenVersion += 1;
  await user.save();

  await logAudit({ actorId: teacher._id, action: 'auth.credentials_reset', targetType: 'User', targetId: user._id, ip: null });

  return { user, teacher };
}

/**
 * Deactivates (or reactivates) the real Teacher Portal login when admin
 * deletes/restores the teacher on its own side - the gap this closes: admin
 * deleting a teacher previously only soft-deleted its own governance
 * record, leaving the real portal account fully able to log in and use the
 * app indefinitely (confirmed live via a QA pass). Bumping tokenVersion
 * invalidates any already-issued session immediately, not just future
 * logins - mirrors resetCredentials' logout-everywhere behavior.
 */
export async function setAccountStatus({ email, status }) {
  const user = await User.findOne({ email: email.toLowerCase().trim(), role: 'teacher' }).select('+tokenVersion');
  if (!user) return { found: false };

  user.status = status;
  user.tokenVersion += 1;
  await user.save();

  await logAudit({ actorId: user._id, action: `auth.account_${status}`, targetType: 'User', targetId: user._id, ip: null });
  return { found: true, userId: user._id };
}

export default { loginTeacher, logoutTeacher, invalidateAllSessions, changePassword, createTeacherAccount, resetCredentials, setAccountStatus };
