/**
 * Safely parse a stored array value.
 *
 * Both variants try JSON.parse first (new format), then comma-split (old format).
 * The real fix is on the WRITE side: onboarding now stores ICPs as JSON arrays,
 * so future data won't have the comma-ambiguity problem.
 */

/**
 * Parse an ICP field stored in the DB.
 *
 * - If the value is already an array, return it.
 * - If it's a JSON-encoded array string, parse it.
 * - Otherwise comma-split (legacy format). Some old ICPs with internal commas
 *   may fragment, but re-saving the profile will store them as JSON.
 */
export function safeParseICPArray(value: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Not JSON — fall through to comma split (legacy data)
    }
    return value.split(',').map(s => s.trim()).filter(Boolean);
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
