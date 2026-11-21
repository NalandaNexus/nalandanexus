import crypto from 'crypto';

/**
 * Generates the temporary password emailed to a new teacher.
 *
 * 14 characters drawn with crypto.randomInt from an alphabet that leaves out
 * every character a person can misread or mistype when copying from an email:
 * 0/O/o, 1/l/I/i, 5/S, 2/Z, quotes, spaces, and anything an HTML mail client or
 * a URL might mangle (& < > " '). Always at least one upper-case letter, one
 * lower-case letter, one digit and one symbol, so it satisfies every password
 * rule the Teacher Portal enforces. Roughly 80 bits of entropy.
 *
 * The plaintext lives only long enough to be hashed by the Teacher service and
 * written into one email; it is never stored, logged, or returned by an API.
 */
const UPPER = 'ABCDEFGHJKLMNPQRTUVWXY';
const LOWER = 'abcdefghjkmnpqrstuvwxyz';
const DIGITS = '346789';
const SYMBOLS = '@#$%*+=?';
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;
const LENGTH = 14;

const pick = (set) => set[crypto.randomInt(set.length)];

export function generateTempPassword() {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < LENGTH) chars.push(pick(ALL));
  // Fisher-Yates with a CSPRNG, so the guaranteed classes are not always in front.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export default generateTempPassword;
