/**
 * Normalize a display name into a URL-safe slug.
 * - Lowercase
 * - Trim
 * - Replace spaces and consecutive non-alphanumeric chars with single hyphen
 * - Collapse multiple hyphens
 * - Trim leading/trailing hyphens
 */
export function slugify(name: string): string {
  if (!name || typeof name !== 'string') return '';
  let s = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || '';
}

/**
 * Normalize a location name for consistent storage and matching.
 * - Trim whitespace
 * - Collapse internal spaces
 * - Title-case (first letter of each word uppercase, rest lowercase)
 * Use when creating/updating location entities and when matching so that
 * "Kangundo", "kangundo", "KANGUNDO" all match the same record.
 */
export function normalizeLocationName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  return trimmed
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
