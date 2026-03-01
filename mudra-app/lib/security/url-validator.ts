/**
 * SSRF-safe URL validator.
 *
 * Rejects private/reserved IPs, loopback, link-local, cloud metadata
 * endpoints and non-HTTP(S) schemes *before* handing URLs to external
 * services like Firecrawl.
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',          // GCP metadata
  'metadata.internal',                 // GCP alternate
  'kubernetes.default.svc',            // K8s service
]);

/** Patterns that should never appear in hostnames we scrape. */
const BLOCKED_HOSTNAME_PATTERNS = [
  /\.internal$/i,                       // *.internal (GCP, etc.)
  /\.local$/i,                          // mDNS / Bonjour
  /\.svc\.cluster\.local$/i,            // K8s in-cluster
];

/**
 * Returns true when the IPv4 address falls in a reserved/private range.
 * Covers RFC 1918, loopback, link-local, broadcast, and CGNAT.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  const octets = parts.map(Number);
  if (octets.some(o => Number.isNaN(o) || o < 0 || o > 255)) return false;

  const [a, b] = octets;
  if (a === 0) return true;                                 // 0.0.0.0/8
  if (a === 10) return true;                                // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true;        // 100.64.0.0/10  CGNAT
  if (a === 127) return true;                               // 127.0.0.0/8    loopback
  if (a === 169 && b === 254) return true;                  // 169.254.0.0/16 link-local / metadata
  if (a === 172 && b >= 16 && b <= 31) return true;         // 172.16.0.0/12
  if (a === 192 && b === 0 && octets[2] === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 168) return true;                  // 192.168.0.0/16
  if (a >= 224) return true;                                // 224+  multicast & reserved
  return false;
}

/**
 * Returns true when the IPv6 address is loopback, link-local, or
 * unique-local (private).
 */
function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1') return true;                         // loopback
  if (lower.startsWith('fe80:')) return true;               // link-local
  if (lower.startsWith('fc00:') || lower.startsWith('fd00:')) return true; // ULA
  if (lower === '::') return true;                          // unspecified
  // IPv4-mapped IPv6  e.g. ::ffff:127.0.0.1
  const v4Mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped && isPrivateIPv4(v4Mapped[1])) return true;
  return false;
}

function looksLikeIPv4(h: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(h);
}

function looksLikeIPv6(h: string): boolean {
  return h.includes(':');
}

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates that a user-supplied URL is safe to request externally.
 *
 * Checks:
 *  1. Syntactically valid URL
 *  2. HTTP or HTTPS only
 *  3. Not a private/reserved IP (v4 + v6)
 *  4. Not a blocked hostname (localhost, cloud metadata, etc.)
 *  5. No credentials embedded in the URL
 */
export function validateExternalUrl(urlString: string): UrlValidationResult {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // --- protocol ---
  if (!['http:', 'https:'].includes(url.protocol)) {
    return { valid: false, error: 'Only HTTP and HTTPS protocols are allowed' };
  }

  // --- embedded credentials ---
  if (url.username || url.password) {
    return { valid: false, error: 'URLs with embedded credentials are not allowed' };
  }

  const hostname = url.hostname.toLowerCase();

  // --- blocked hostnames ---
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { valid: false, error: 'Access to internal hosts is not allowed' };
  }
  if (BLOCKED_HOSTNAME_PATTERNS.some(p => p.test(hostname))) {
    return { valid: false, error: 'Access to internal hosts is not allowed' };
  }

  // --- IPv4 private ---
  if (looksLikeIPv4(hostname) && isPrivateIPv4(hostname)) {
    return { valid: false, error: 'Access to private IP ranges is not allowed' };
  }

  // --- IPv6 private (brackets stripped by URL parser) ---
  if (looksLikeIPv6(hostname) && isPrivateIPv6(hostname)) {
    return { valid: false, error: 'Access to private IP ranges is not allowed' };
  }

  return { valid: true };
}
