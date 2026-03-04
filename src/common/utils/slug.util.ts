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
