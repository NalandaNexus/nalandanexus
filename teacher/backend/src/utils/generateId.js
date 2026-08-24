/**
 * Generates a human-friendly sequential-looking ID, e.g. TCH-0001.
 * `count` should be the current collection count (or any monotonically
 * increasing seed) — callers retry on unique-index collisions since this
 * is a convenience label, not a concurrency-safe sequence generator.
 */
export function formatSequentialId(prefix, count) {
  return `${prefix}-${String(count).padStart(4, '0')}`;
}

/**
 * Normalizes a display name / concept name into a URL & key-safe slug.
 * 'Wave Optics' -> 'wave-optics'
 */
export function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

export default { formatSequentialId, slugify };
