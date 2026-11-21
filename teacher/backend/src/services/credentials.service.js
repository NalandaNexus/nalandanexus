import crypto from 'node:crypto';
import validator from 'validator';
import { User } from '../models/User.js';
import { signAuthToken } from '../utils/tokens.js';

/**
 * The one place this service decides what an email address is, how a password
 * is hashed and checked, and who counts as a teacher.
 *
 * Every path that creates, finds or authenticates a teacher login goes through
 * these helpers - provisioning from Admin, the login form, a resend, a password
 * reset, a status change and course assignment - so they cannot drift apart
 * again. They drifted before: accounts were stored under express-validator's
 * normalizeEmail() form (Gmail dots and "+tags" stripped) while Admin keeps the
 * address as typed, so the two services disagreed about who a person was.
 */

/** The Teacher ID shape: TCH-0001. Also what a person may type into the login box in place of an email. */
export const TEACHER_ID_PATTERN = /^TCH-\d{4,}$/i;

/** The canonical form of an email address everywhere in this service: trimmed and lower-cased, nothing else. */
export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * The form older accounts were stored under: express-validator's
 * normalizeEmail(), which also drops dots and "+tags" from Gmail addresses and
 * folds googlemail.com into gmail.com. Only ever used to FIND an account created
 * before the canonical form, never to store a new one.
 */
export function legacyEmailForm(value) {
  const email = normalizeEmail(value);
  if (!email) return null;
  const legacy = validator.normalizeEmail(email);
  return legacy && legacy !== email ? legacy : null;
}

/**
 * Finds the login for an email address: the canonical form first, then the
 * legacy form so an account stored before the canonical form still resolves.
 * Returns the user and whether it was found only through the legacy form.
 */
export async function findUserByEmail(email, { select = '', role } = {}) {
  const canonical = normalizeEmail(email);
  if (!canonical) return { user: null, legacy: false };
  const base = role ? { role } : {};

  const exact = await User.findOne({ ...base, email: canonical }).select(select);
  if (exact) return { user: exact, legacy: false };

  const legacy = legacyEmailForm(canonical);
  if (!legacy) return { user: null, legacy: false };
  const old = await User.findOne({ ...base, email: legacy }).select(select);
  return { user: old, legacy: Boolean(old) };
}

/** As findUserByEmail, restricted to teacher logins. */
export async function findTeacherUserByEmail(email, { select = '' } = {}) {
  return findUserByEmail(email, { select, role: 'teacher' });
}

/** bcrypt, cost 12 - the same hash the login check expects. Hash a plaintext exactly once, never a hash. */
export function hashPassword(plainText) {
  return User.hashPassword(plainText);
}

/** Checks a plaintext against a user's stored hash. The user must have been loaded with +passwordHash. */
export async function verifyPassword(user, plainText) {
  if (!user?.passwordHash || typeof plainText !== 'string' || !plainText) return false;
  return user.comparePassword(plainText);
}

/** Whether a login may use the Teacher Portal at all - a student or admin identity never may. */
export function validateUserRole(user, role = 'teacher') {
  return Boolean(user) && user.role === role;
}

/** The session token for a signed-in teacher: identity, role and the token version that revokes it. */
export function generateAuthToken({ user, teacher, rememberMe = false }) {
  return signAuthToken({ userId: user._id, teacherId: teacher._id, role: user.role, tokenVersion: user.tokenVersion }, Boolean(rememberMe));
}

/** A single-use link token: URL-safe, 256 bits. Only its SHA-256 is ever stored. */
export function generateLinkToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

export default {
  TEACHER_ID_PATTERN,
  normalizeEmail,
  legacyEmailForm,
  findUserByEmail,
  findTeacherUserByEmail,
  hashPassword,
  verifyPassword,
  validateUserRole,
  generateAuthToken,
  generateLinkToken,
  sha256,
};
