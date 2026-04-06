/**
 * Shared URL normalizer for consistent URL matching across services.
 *
 * Used by issue hash generation and issue reconciliation to ensure
 * the same page URL always produces the same canonical form.
 */

/**
 * Normalize a URL for consistent matching:
 * - lowercase
 * - trim whitespace
 * - strip #fragment
 * - strip trailing slash (unless it's just "/")
 */
export function normalizeUrl(url: string): string {
  let u = url.toLowerCase().trim()
  // Strip fragment
  const hashIdx = u.indexOf('#')
  if (hashIdx !== -1) u = u.slice(0, hashIdx)
  // Normalize www. so https://www.x.com and https://x.com are the same
  u = u.replace(/^(https?:\/\/)www\./i, '$1')
  // Strip trailing slash (but keep root "/")
  if (u.length > 1 && u.endsWith('/')) u = u.slice(0, -1)
  return u
}
