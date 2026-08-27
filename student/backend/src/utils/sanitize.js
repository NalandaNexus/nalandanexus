/**
 * Sanitisation helpers for user-authored free text.
 *
 * React escapes text children, so stored markup was never executable in this
 * app's own UI. The risk is every OTHER consumer of the same data: the
 * support-ticket email template interpolates the student's message straight
 * into an HTML body, and a public feed (/api/public/highlights) serves post
 * text to anonymous visitors. Storing markup and hoping every future reader
 * escapes it is the fragile order of operations - strip it on the way in,
 * and escape again at any HTML sink.
 */

/**
 * Removes HTML/XML tags and comments from a string, leaving ordinary prose
 * (including bare comparison operators) intact.
 *
 * Only sequences that actually look like markup are removed - `<` followed by
 * a letter or `/`, through the matching `>`. "5 < 10 and x > y" is untouched,
 * while "<script>", "<img src=x onerror=1>", and "</div>" are not. Repeats
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
 * Escapes the five XML-significant characters. Use at any point where a value
 * is interpolated into an HTML document we generate ourselves (e.g. email
 * bodies), independently of whether it was stripped on write.
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

/**
 * Zod refinement helper: strips tags, then rejects the value if nothing
 * meaningful survived. Prevents "<script></script>" from passing a
 * min-length check by being long before sanitisation and empty after it.
 */
export function sanitizedText(schema) {
  return schema.transform(stripHtml);
}
