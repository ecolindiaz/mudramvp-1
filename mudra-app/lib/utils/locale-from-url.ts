/**
 * Locale extraction utilities for URL-based language filtering.
 *
 * Used to tag SitemapPages with their detected locale and to filter
 * pages/issues by the user's selected country/region.
 */

import { isAllowedCountry, getLanguageForCountry } from '@/lib/geo/country-config'

const LOCALE_PATH_RE = /^\/([a-z]{2})(?:-[a-z]{2})?(?:\/|$)/i

/**
 * ISO 639-1 language codes commonly used as URL locale prefixes.
 * Without this allowlist, 2-letter product slugs like /qr or /us
 * would be falsely detected as locales.
 */
const KNOWN_WEB_LOCALES = new Set([
  'en', 'es', 'fr', 'de', 'pt', 'it', 'nl', 'ja', 'ko', 'zh',
  'ru', 'ar', 'hi', 'pl', 'sv', 'da', 'no', 'fi', 'cs', 'tr',
  'th', 'vi', 'id', 'ms', 'he', 'uk', 'ro', 'hu', 'el', 'bg',
  'hr', 'sk', 'sl', 'lt', 'lv', 'et', 'ca', 'eu', 'gl', 'sr',
])

/**
 * Extract the 2-letter language code from a URL's locale path prefix.
 * Returns null if no locale prefix is present or if the code is not
 * a recognized ISO 639-1 language code.
 *
 * Examples:
 *   /en/card       → "en"
 *   /es-mx/pricing → "es"
 *   /en            → "en"
 *   /enterprise    → null  (3+ letters, not a locale)
 *   /qr            → null  (2 letters but not a language code)
 *   /pricing       → null
 */
export function extractLocaleFromUrl(url: string): string | null {
  try {
    const pathname = url.startsWith('http') ? new URL(url).pathname : url
    const match = pathname.match(LOCALE_PATH_RE)
    if (!match) return null
    const code = match[1].toLowerCase()
    return KNOWN_WEB_LOCALES.has(code) ? code : null
  } catch {
    return null
  }
}

/**
 * Check if a page's locale matches the expected language.
 * Pages with locale=null (no prefix) always match — this is the
 * monolingual zero-change guarantee.
 */
export function languageMatchesLocale(language: 'en' | 'es', locale: string | null): boolean {
  if (locale === null) return true
  return locale === language
}

/**
 * Build a Prisma WHERE fragment to filter SitemapPages by locale
 * based on the selected country code.
 * Returns undefined if no valid country is provided (show all).
 */
export function buildLocaleWhereClause(country: string): { OR: Array<{ locale: string | null }> } | undefined {
  if (!isAllowedCountry(country)) return undefined
  const language = getLanguageForCountry(country)
  return { OR: [{ locale: null }, { locale: language }] }
}
