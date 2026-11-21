import { User } from '../models/User.js';
import { Teacher } from '../models/Teacher.js';
import { ApiError } from '../utils/ApiError.js';
import { formatSequentialId } from '../utils/generateId.js';
import { portalUrl } from '../utils/portalUrl.js';
import { logAudit } from './audit.service.js';
import { sendTeacherPasswordResetEmail } from './adminBridge.service.js';
import {
  TEACHER_ID_PATTERN,
  normalizeEmail,
  findUserByEmail,
  findTeacherUserByEmail,
  hashPassword,
  verifyPassword,
  validateUserRole,
  generateAuthToken,
  generateLinkToken,
  sha256,
} from './credentials.service.js';

export { TEACHER_ID_PATTERN };

/** How long a self-service reset link works, and how often one may be emailed to the same account. */
const RESET_LINK_TTL_MS = 60 * 60 * 1000;
const RESET_REQUEST_COOLDOWN_MS = 60 * 1000;

const invalidCredentials = () => ApiError.unauthorized('Invalid email or password.', 'INVALID_CREDENTIALS');

// A bcrypt hash of nothing anyone knows, checked when there is no account, so an
// unknown address takes as long to refuse as a wrong password does.
let dummyHashPromise;
const dummyHash = () => (dummyHashPromise ||= hashPassword(generateLinkToken()));

/**
 * Verifies a teacher's credentials and issues a session token.
 *
 * Every failure that could reveal whether an address is registered (unknown
 * email or Teacher ID, wrong password, a login that is not a teacher's) returns
 * the same "invalid email or password", so the form cannot be used to find out
 * who works here. Only someone who has proved the password learns that the
 * account is deactivated.
 */
export async function authenticateTeacher({ email, password, rememberMe, ip }) {
  // The login box says "Faculty Email / Educator ID" and the credentials email
  // gives both, so both must work. An ID resolves to the same account an email would.
  const identifier = String(email || '').trim();
  let user;
  if (TEACHER_ID_PATTERN.test(identifier)) {
    const byId = await Teacher.findOne({ teacherId: identifier.toUpperCase() }).select('user').lean();
    user = byId ? await User.findById(byId.user).select('+passwordHash +tokenVersion') : null;
  } else {
    ({ user } = await findUserByEmail(identifier, { select: '+passwordHash +tokenVersion' }));
  }

  if (!validateUserRole(user, 'teacher')) {
    await verifyPassword({ passwordHash: await dummyHash(), comparePassword: User.prototype.comparePassword }, String(password || ' '));
    throw invalidCredentials();
  }

  let passwordOk = await verifyPassword(user, password);
  // A temporary password is copied out of an email, and mail clients and phones
  // routinely carry a space or line break along with it. Temporary passwords
  // never contain whitespace, so while the account is still on one (and only
  // then) the copied value is also tried without it. A password the teacher
  // chose is always compared exactly as typed.
  if (!passwordOk && user.mustChangePassword && typeof password === 'string' && password.trim() !== password) {
    passwordOk = await verifyPassword(user, password.trim());
  }
  if (!passwordOk) throw invalidCredentials();

  // A temp password still authenticates normally - middleware/auth.js is what
  // blocks the rest of the portal until it is changed - so a forced-change
  // teacher gets a real session that can only reach /api/teacher/auth/*.
  if (user.status !== 'active') {
    throw ApiError.forbidden('This account has been deactivated. Contact your administrator.', 'ACCOUNT_INACTIVE');
  }

  const teacher = await Teacher.findOne({ user: user._id });
  if (!teacher) throw ApiError.forbidden('No teacher profile is associated with this account.', 'TEACHER_PROFILE_MISSING');
  if (teacher.accountStatus !== 'active') {
    throw ApiError.forbidden('This account has been deactivated. Contact your administrator.', 'ACCOUNT_INACTIVE');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = generateAuthToken({ user, teacher, rememberMe });
  await logAudit({ actorId: teacher._id, action: 'auth.login', targetType: 'Teacher', targetId: teacher._id, ip });

  return { token, user, teacher };
}

/** Kept under its old name for existing callers. */
export const loginTeacher = authenticateTeacher;

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
  // tokenVersion is `select: false` too; without it `+= 1` below is NaN.
  const user = await User.findById(userId).select('+passwordHash +tokenVersion');
  if (!user) throw ApiError.notFound('Account not found.', 'ACCOUNT_NOT_FOUND');

  let ok = await verifyPassword(user, currentPassword);
  // Same allowance as at login: the temporary password was pasted from an email.
  if (!ok && user.mustChangePassword && typeof currentPassword === 'string' && currentPassword.trim() !== currentPassword) {
    ok = await verifyPassword(user, currentPassword.trim());
  }
  if (!ok) throw ApiError.badRequest('Current password is incorrect.', 'INVALID_CURRENT_PASSWORD');
  if (await verifyPassword(user, newPassword)) {
    throw ApiError.badRequest('Choose a new password that is different from the current one.', 'PASSWORD_UNCHANGED');
  }

  user.passwordHash = await hashPassword(newPassword);
  user.tokenVersion += 1; // invalidate every other active session
  user.mustChangePassword = false; // the temp password, if any, is now permanently unusable
  await user.save();

  await logAudit({ actorId: teacherId, action: 'auth.password_changed', targetType: 'User', targetId: user._id, ip });

  const teacher = { _id: teacherId };
  return generateAuthToken({ user, teacher, rememberMe: false });
}

/**
 * The first free Teacher ID, preferring `requested`.
 *
 * Counting documents and adding one is not enough: a deleted teacher or a
 * hand-numbered one leaves the count behind the highest ID in use, and the next
 * creation would collide on a unique index and fail.
 */
async function allocateTeacherId(requested) {
  if (requested && TEACHER_ID_PATTERN.test(requested)) {
    const wanted = requested.toUpperCase();
    if (!(await Teacher.exists({ teacherId: wanted }))) return wanted;
  }
  let next = (await Teacher.countDocuments()) + 1;
  // eslint-disable-next-line no-await-in-loop
  while (await Teacher.exists({ teacherId: formatSequentialId('TCH', next) })) next += 1;
  return formatSequentialId('TCH', next);
}

/** Creates a teacher profile for a login, retrying if two creations pick the same free Teacher ID at once. */
async function createProfile(user, { requestedTeacherId, title, department, subject, tier = 'free' }) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const teacherId = await allocateTeacherId(attempt === 0 ? requestedTeacherId : null);
    try {
      return await Teacher.create({
        user: user._id,
        teacherId,
        title: title || 'Faculty',
        department: department || null,
        subject: subject || null,
        tier,
      });
    } catch (err) {
      // The unique index decides between two simultaneous creations; the loser takes the next ID.
      if (err?.code !== 11000 || attempt === 2) throw err;
    }
  }
  return null;
}

/**
 * Creates a brand-new teacher User + Teacher profile pair. Used by the seed
 * script and by provisionTeacherAccount for an email that has no login yet.
 */
export async function createTeacherAccount({
  name,
  email,
  password,
  phone = null,
  title,
  department,
  subject,
  tier = 'free',
  mustChangePassword = false,
  // The Teacher ID the Admin portal already showed its administrator. Honoured
  // when free; otherwise the next free one is issued and returned.
  requestedTeacherId = null,
  avatarUrl = null,
  // An older Admin's onboarding: the SHA-256 of a setup link's token and its
  // expiry. The account is then given a random password nobody knows.
  setup = null,
}) {
  const canonical = normalizeEmail(email);
  const { user: existing } = await findUserByEmail(canonical);
  if (existing) throw ApiError.conflict('An account with this email already exists.', 'EMAIL_TAKEN');

  if (!password && !setup) throw ApiError.badRequest('Either a password or a setup link is required.', 'CREDENTIAL_REQUIRED');

  const passwordHash = await hashPassword(password || generateLinkToken());
  const user = await User.create({
    name,
    email: canonical,
    phone,
    avatarUrl,
    passwordHash,
    role: 'teacher',
    mustChangePassword,
    ...(setup ? { setupTokenHash: setup.tokenHash, setupTokenExpiresAt: setup.expiresAt } : {}),
  });

  try {
    const teacher = await createProfile(user, { requestedTeacherId, title, department, subject, tier });
    return { user, teacher };
  } catch (err) {
    await User.deleteOne({ _id: user._id });
    throw err;
  }
}

/**
 * Reads back what provisioning just saved and confirms it is a login the
 * Teacher Portal will accept with exactly the password Admin is about to email:
 * an active teacher with an active profile whose stored hash matches. Admin
 * sends the credentials email only after this has passed, so an email can never
 * again carry a password the login does not have.
 */
async function verifyProvisionedLogin(userId, password) {
  const stored = await User.findById(userId).select('+passwordHash');
  const profile = stored ? await Teacher.findOne({ user: stored._id }).select('accountStatus teacherId') : null;
  const ok =
    validateUserRole(stored, 'teacher') &&
    stored.status === 'active' &&
    profile?.accountStatus === 'active' &&
    (password ? await verifyPassword(stored, password) : true);
  if (!ok) {
    throw new ApiError(500, 'The teacher login was saved but could not be verified, so no credentials should be sent.', 'PROVISION_NOT_VERIFIED');
  }
  return profile;
}

/**
 * Admin's "this person teaches here, and this is their temporary password" -
 * the single, idempotent way a teacher login is issued, used both when Admin
 * creates a teacher and when it resends their credentials.
 *
 * Admin is the authority on who is a teacher; this service owns the login. So
 * an email that already has a teacher login here is not a conflict, it is the
 * same person: their login is re-linked rather than refused. That is the case
 * that used to break - a teacher deleted in Admin keeps a deactivated login
 * here, and when Admin created them again this answered 409 EMAIL_TAKEN, Admin
 * emailed a password anyway, and the login kept its old password (and stayed
 * deactivated), so the emailed one was rejected as "invalid email or password".
 *
 * Re-linking keeps the same login and Teacher ID - and with them the teacher's
 * classes, grades and history - reactivates it, replaces the password with the
 * new temporary one (forcing a change at first sign-in), and ends every session
 * the account had. A login that belongs to anything other than a teacher is
 * never taken over.
 *
 * Returns only after verifyProvisionedLogin has read the saved login back.
 */
export async function provisionTeacherAccount({
  name,
  email,
  password,
  phone,
  title,
  department,
  subject,
  requestedTeacherId = null,
  avatarUrl,
  setup = null,
}) {
  if (!password && !setup) throw ApiError.badRequest('Either a password or a setup link is required.', 'CREDENTIAL_REQUIRED');
  const canonical = normalizeEmail(email);

  const { user: existing, legacy } = await findUserByEmail(canonical, { select: '+passwordHash +tokenVersion +setupTokenHash +setupTokenExpiresAt' });

  if (!existing) {
    try {
      const { user, teacher } = await createTeacherAccount({
        name,
        email: canonical,
        password,
        phone: phone || null,
        title,
        department,
        subject,
        requestedTeacherId,
        avatarUrl: avatarUrl || null,
        setup,
        mustChangePassword: !setup,
      });
      await verifyProvisionedLogin(user._id, password);
      return { user, teacher, relinked: false };
    } catch (err) {
      // Two provisioning calls for the same new address raced; the other one won.
      // Take the re-link path against the login it created.
      if (err?.code === 11000 && /email/.test(String(err.message))) {
        return provisionTeacherAccount({ name, email, password, phone, title, department, subject, requestedTeacherId, avatarUrl, setup });
      }
      throw err;
    }
  }

  if (!validateUserRole(existing, 'teacher')) {
    throw ApiError.conflict('This email already belongs to an account that is not a teacher login.', 'EMAIL_TAKEN');
  }

  const previousStatus = existing.status;
  // An account found under its legacy form is moved to the canonical one, so it
  // is found directly from now on and matches what Admin holds.
  if (legacy) existing.email = canonical;
  if (name) existing.name = name;
  if (phone !== undefined) existing.phone = phone || null;
  if (avatarUrl) existing.avatarUrl = avatarUrl;
  existing.status = 'active';
  if (password) {
    existing.passwordHash = await hashPassword(password);
    existing.mustChangePassword = true;
    // Any outstanding reset link would otherwise still work alongside the new password.
    existing.setupTokenHash = undefined;
    existing.setupTokenExpiresAt = undefined;
  } else {
    existing.setupTokenHash = setup.tokenHash;
    existing.setupTokenExpiresAt = setup.expiresAt;
  }
  existing.tokenVersion = (existing.tokenVersion || 0) + 1;
  await existing.save();

  let teacher = await Teacher.findOne({ user: existing._id });
  if (!teacher) {
    teacher = await createProfile(existing, { requestedTeacherId, title, department, subject });
  } else {
    teacher.accountStatus = 'active';
    if (title) teacher.title = title;
    if (department !== undefined) teacher.department = department || null;
    if (subject !== undefined) teacher.subject = subject || null;
    await teacher.save();
  }

  await logAudit({
    actorId: teacher._id,
    action: 'auth.account_relinked',
    targetType: 'User',
    targetId: existing._id,
    ip: null,
    metadata: { previousStatus, legacyEmail: legacy },
  });

  await verifyProvisionedLogin(existing._id, password);
  return { user: existing, teacher, relinked: true };
}

/**
 * Replaces the pending password-setup link of an EXISTING teacher (an older
 * Admin's "resend setup email"). Only the new token's hash is stored, so the
 * previous link stops working; the password and sessions are left alone until
 * the link is actually used (completePasswordSetup).
 */
export async function issuePasswordSetupLink({ email, tokenHash, expiresAt }) {
  const { user } = await findTeacherUserByEmail(email, { select: '+setupTokenHash +setupTokenExpiresAt' });
  if (!user) throw ApiError.notFound('No teacher account exists for this email.', 'ACCOUNT_NOT_FOUND');

  const teacher = await Teacher.findOne({ user: user._id });
  if (!teacher) throw ApiError.forbidden('No teacher profile is associated with this account.', 'TEACHER_PROFILE_MISSING');

  user.setupTokenHash = tokenHash;
  user.setupTokenExpiresAt = expiresAt;
  await user.save();

  await logAudit({ actorId: teacher._id, action: 'auth.setup_link_issued', targetType: 'User', targetId: user._id, ip: null });
  return { user, teacher };
}

/**
 * "Forgot password", from the teacher themself.
 *
 * Emails a single-use link, valid for an hour, to the address on the login -
 * never to whatever was typed - through Admin, the service that sends mail.
 * The caller always gets the same answer whether or not an account exists, and
 * the email is sent after the answer, so neither the reply nor its timing tells
 * anyone which addresses are registered. A deactivated account gets nothing.
 * One email per account per minute, however often the form is submitted.
 *
 * Requesting a link changes nothing else: the current password keeps working
 * until the link is used, which is when it is replaced and every session ends.
 */
export async function requestPasswordReset({ email, ip }) {
  const { user } = await findTeacherUserByEmail(email);
  if (!user || user.status !== 'active') return { queued: false, reason: 'NO_ACTIVE_ACCOUNT' };
  const teacher = await Teacher.findOne({ user: user._id }).select('_id teacherId accountStatus');
  if (!teacher || teacher.accountStatus !== 'active') return { queued: false, reason: 'NO_ACTIVE_ACCOUNT' };

  const base = portalUrl();
  if (!base) return { queued: false, reason: 'PORTAL_URL_UNKNOWN' };

  // Claimed atomically, so a burst of submissions sends one email, not many.
  const now = new Date();
  const claimed = await User.findOneAndUpdate(
    {
      _id: user._id,
      $or: [{ passwordResetRequestedAt: null }, { passwordResetRequestedAt: { $lte: new Date(now.getTime() - RESET_REQUEST_COOLDOWN_MS) } }],
    },
    { $set: { passwordResetRequestedAt: now } }
  );
  if (!claimed) return { queued: false, reason: 'TOO_SOON' };

  const token = generateLinkToken();
  const expiresAt = new Date(now.getTime() + RESET_LINK_TTL_MS);
  await User.updateOne({ _id: user._id }, { $set: { setupTokenHash: sha256(token), setupTokenExpiresAt: expiresAt } });
  await logAudit({ actorId: teacher._id, action: 'auth.password_reset_requested', targetType: 'User', targetId: user._id, ip });

  const delivery = sendTeacherPasswordResetEmail({
    email: user.email,
    name: user.name,
    teacherId: teacher.teacherId,
    resetUrl: `${base}/setup-password?token=${token}&purpose=reset`,
    expiresAt: expiresAt.toISOString(),
  }).then(async (result) => {
    await logAudit({
      actorId: teacher._id,
      action: result.delivered ? 'auth.password_reset_emailed' : 'auth.password_reset_email_failed',
      targetType: 'User',
      targetId: user._id,
      ip: null,
      metadata: { reason: result.reason || null },
    }).catch(() => {});
    return result;
  });

  return { queued: true, delivery };
}

const INVALID_SETUP_LINK = () =>
  ApiError.badRequest('This link is invalid, has already been used, or has expired. Request a new one from the sign-in page.', 'SETUP_LINK_INVALID');

async function findBySetupToken(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(token)) return null;
  const user = await User.findOne({
    setupTokenHash: sha256(token),
    setupTokenExpiresAt: { $gt: new Date() },
    role: 'teacher',
  }).select('+setupTokenHash +setupTokenExpiresAt');
  return user;
}

/** What the password page may show before a password is chosen. Reveals nothing for a bad link. */
export async function inspectPasswordSetup(token) {
  const user = await findBySetupToken(token);
  if (!user) throw INVALID_SETUP_LINK();
  if (user.status !== 'active') throw ApiError.forbidden('This account has been deactivated. Contact your administrator.', 'ACCOUNT_INACTIVE');
  const teacher = await Teacher.findOne({ user: user._id }).select('teacherId').lean();
  return {
    name: user.name,
    email: user.email,
    teacherId: teacher?.teacherId || null,
    expiresAt: user.setupTokenExpiresAt,
  };
}

/**
 * Lets the holder of a valid link choose their password.
 *
 * Single use, enforced by the database: the match on the token and its expiry
 * and the clearing of both are one update, so two requests presenting the same
 * link cannot both succeed. Setting it replaces the old password, revokes every
 * session the account had (tokenVersion) and clears any forced-change flag.
 */
export async function completePasswordSetup({ token, password, ip }) {
  const user = await findBySetupToken(token);
  if (!user) throw INVALID_SETUP_LINK();
  if (user.status !== 'active') throw ApiError.forbidden('This account has been deactivated. Contact your administrator.', 'ACCOUNT_INACTIVE');

  const passwordHash = await hashPassword(password);
  const updated = await User.findOneAndUpdate(
    { _id: user._id, setupTokenHash: sha256(token), setupTokenExpiresAt: { $gt: new Date() } },
    {
      $set: { passwordHash, passwordSetAt: new Date(), mustChangePassword: false },
      $unset: { setupTokenHash: '', setupTokenExpiresAt: '' },
      $inc: { tokenVersion: 1 },
    },
    { new: true }
  );
  // Lost the race: another request used the same link between the check and here.
  if (!updated) throw INVALID_SETUP_LINK();

  const teacher = await Teacher.findOne({ user: user._id }).select('_id teacherId');
  if (teacher) await logAudit({ actorId: teacher._id, action: 'auth.password_set_via_link', targetType: 'User', targetId: user._id, ip });
  return { email: user.email, teacherId: teacher?.teacherId || null };
}

/**
 * Resets an EXISTING teacher's password to an admin-issued temporary one (an
 * older Admin's "Resend Credentials"). Bumps tokenVersion and forces a change at
 * first sign-in, exactly like a new account. Current Admin uses
 * provisionTeacherAccount for this, which also re-creates a missing login.
 */
export async function resetCredentials({ email, newPassword }) {
  const { user } = await findTeacherUserByEmail(email, { select: '+passwordHash +tokenVersion' });
  if (!user) throw ApiError.notFound('No teacher account exists for this email.', 'ACCOUNT_NOT_FOUND');

  const teacher = await Teacher.findOne({ user: user._id });
  if (!teacher) throw ApiError.forbidden('No teacher profile is associated with this account.', 'TEACHER_PROFILE_MISSING');

  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = true;
  user.tokenVersion += 1;
  await user.save();

  await logAudit({ actorId: teacher._id, action: 'auth.credentials_reset', targetType: 'User', targetId: user._id, ip: null });

  return { user, teacher };
}

/**
 * Deactivates (or reactivates) the real Teacher Portal login when Admin
 * deletes, suspends or restores the teacher on its own side. Bumping
 * tokenVersion ends any session already issued, not just future logins.
 */
export async function setAccountStatus({ email, status }) {
  const { user } = await findTeacherUserByEmail(email, { select: '+tokenVersion' });
  if (!user) return { found: false };

  user.status = status;
  user.tokenVersion += 1;
  await user.save();

  await logAudit({ actorId: user._id, action: `auth.account_${status}`, targetType: 'User', targetId: user._id, ip: null });
  return { found: true, userId: user._id };
}

export default {
  authenticateTeacher,
  loginTeacher,
  logoutTeacher,
  invalidateAllSessions,
  changePassword,
  createTeacherAccount,
  provisionTeacherAccount,
  issuePasswordSetupLink,
  requestPasswordReset,
  inspectPasswordSetup,
  completePasswordSetup,
  resetCredentials,
  setAccountStatus,
};
