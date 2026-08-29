/**
 * Sanitisation helpers for teacher-authored free text.
 *
 * React escapes text children, so stored markup was never executable in this
 * portal's own UI. The risk is every OTHER consumer: a batch name, class
 * description or announcement written here is bridged into the Student portal
 * (services/studentBridge.service.js), and anything bridged out is no longer
 * protected by this app's rendering choices. Strip markup on the way in rather
 * than trusting every downstream reader to escape it.
 *
 * Mirrors student/backend/src/utils/sanitize.js so both portals treat
 * user-authored text identically.
 */

/**
 * Removes HTML/XML tags and comments, leaving ordinary prose (including bare
 * comparison operators) intact.
 *
 * Only sequences that actually look like markup are removed - `<` followed by
 * a letter or `/`, through the matching `>`. "Grade 9 < Grade 10" is
 * untouched, while "<script>" and "<img src=x onerror=1>" are not. Repeats
 * until stable so nested leftovers like "<<b>b>" cannot reconstruct a tag.
 */
export function stripHtml(value) {
  if (typeof value !== 'string') return value;

  let out = value;
  let previous;
  do {
    previous = out;
    out = out
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<\/?[a-zA-Z][^>]*>/g, '');
  } while (out !== previous);

  return out.trim();
}

/**
 * Escapes the five XML-significant characters. Use wherever a value is
 * interpolated into an HTML document we generate ourselves (e.g. an email
 * body), independently of whether it was stripped on write.
 */
export function escapeHtml(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
