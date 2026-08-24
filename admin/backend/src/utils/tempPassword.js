import crypto from 'crypto';

/**
 * Generates a secure, non-predictable one-time password for an
 * admin-provisioned account (teacher or student) — never a fixed/guessable
 * string like "Nalanda123". Always hash the result before storing it; the
 * plaintext exists only long enough to email it and, if email fails, to
 * show it once to the admin as a fallback (see teacher.service.js#createTeacher).
 */
export function generateTempPassword() {
  return crypto.randomBytes(9).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 12) + 'A1!';
}

export default generateTempPassword;
