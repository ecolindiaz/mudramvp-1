/**
 * Shared domain blocklist for URLs that can't be reliably scraped
 * (JS-heavy, auth-gated, rate-limited sites).
 */

const UNSCRAPPABLE_DOMAINS = new Set([
  'reddit.com',
  'old.reddit.com',
  'np.reddit.com',
  'linkedin.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'tiktok.com',
]);

/** Strip leading `www.` from a hostname */
function stripWww(hostname: string): string {
  return hostname.replace(/^www\./, '');
}

/** Extract and normalize the domain from a full URL */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return stripWww(parsed.hostname);
  } catch {
    return url;
  }
}

/**
 * Returns true if `url` belongs to the brand's domain (including subdomains).
 * Safe no-op when `brandWebsite` is null/undefined.
 */
export function isBrandDomain(url: string, brandWebsite: string | undefined | null): boolean {
  if (!brandWebsite) return false;
  const urlDomain = extractDomain(url);
  const brandDomain = extractDomain(brandWebsite);
  if (urlDomain === brandDomain) return true;
  if (urlDomain.endsWith(`.${brandDomain}`)) return true;
  return false;
}

/**
 * Returns true if the domain (already stripped of `www.`) is blocked.
 * Handles exact matches and subdomain matches (e.g. `m.facebook.com`).
 */
export function isDomainBlocked(domain: string): boolean {
  const normalized = stripWww(domain);

  if (UNSCRAPPABLE_DOMAINS.has(normalized)) return true;

  // Check if it's a subdomain of a blocked domain (e.g. m.facebook.com)
  for (const blocked of UNSCRAPPABLE_DOMAINS) {
    if (normalized.endsWith(`.${blocked}`)) return true;
  }

  return false;
}
