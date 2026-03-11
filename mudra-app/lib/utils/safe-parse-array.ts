/**
 * Safely parse a stored array value.
 *
 * Two variants exist because ICP descriptions legitimately contain commas
 * (e.g. "Developers who need APIs for OCR, scraping, search") whereas
 * competitors / services never do.
 */

/**
 * Parse an ICP field stored in the DB.
 *
 * - If the value is already an array, return it.
 * - If it's a JSON-encoded array string, parse it.
 * - Otherwise treat the entire string as a **single** ICP
 *   (never comma-split, because ICP descriptions contain commas).
 */
export function safeParseICPArray(value: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Not JSON — treat whole string as one ICP entry
    }
    return [value];
  }
  return fallback;
}

/**
 * Parse a generic array field (competitors, services) stored in the DB.
 *
 * - If the value is already an array, return it.
 * - If it's a JSON-encoded array string, parse it.
 * - Otherwise comma-split (safe for fields whose items never contain commas).
 */
export function safeParseArray(value: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Not JSON — fall through to comma split
    }
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
  return fallback;
}
