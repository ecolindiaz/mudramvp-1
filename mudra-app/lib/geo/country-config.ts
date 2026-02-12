/**
 * Country & Language Configuration Module
 * Single source of truth for all geo-localization config.
 *
 * Imported by backend services, API routes, and frontend components.
 */

// ---------------------------------------------------------------------------
// Allowed countries
// ---------------------------------------------------------------------------

export const ALLOWED_COUNTRIES = ['US', 'GB', 'ES', 'MX', 'CO', 'AR', 'PE'] as const;
export type CountryCode = (typeof ALLOWED_COUNTRIES)[number];

// ---------------------------------------------------------------------------
// Country → Language mapping
// ---------------------------------------------------------------------------

export const COUNTRY_LANGUAGE_MAP: Record<CountryCode, 'en' | 'es'> = {
  US: 'en',
  GB: 'en',
  ES: 'es',
  MX: 'es',
  CO: 'es',
  AR: 'es',
  PE: 'es',
};

// ---------------------------------------------------------------------------
// Country metadata (for UI rendering and API calls)
// ---------------------------------------------------------------------------

export const COUNTRY_META: Record<
  CountryCode,
  {
    name: string;
    flag: string;
    flagCode: string;
    capital: string;
    timezone: string;
    region: string;
  }
> = {
  US: {
    name: 'United States',
    flag: '\u{1F1FA}\u{1F1F8}',
    flagCode: 'US',
    capital: 'New York',
    timezone: 'America/New_York',
    region: 'New York',
  },
  GB: {
    name: 'United Kingdom',
    flag: '\u{1F1EC}\u{1F1E7}',
    flagCode: 'GB',
    capital: 'London',
    timezone: 'Europe/London',
    region: 'England',
  },
  ES: {
    name: 'Spain',
    flag: '\u{1F1EA}\u{1F1F8}',
    flagCode: 'ES',
    capital: 'Madrid',
    timezone: 'Europe/Madrid',
    region: 'Madrid',
  },
  MX: {
    name: 'Mexico',
    flag: '\u{1F1F2}\u{1F1FD}',
    flagCode: 'MX',
    capital: 'Mexico City',
    timezone: 'America/Mexico_City',
    region: 'CDMX',
  },
  CO: {
    name: 'Colombia',
    flag: '\u{1F1E8}\u{1F1F4}',
    flagCode: 'CO',
    capital: 'Bogota',
    timezone: 'America/Bogota',
    region: 'Bogota',
  },
  AR: {
    name: 'Argentina',
    flag: '\u{1F1E6}\u{1F1F7}',
    flagCode: 'AR',
    capital: 'Buenos Aires',
    timezone: 'America/Argentina/Buenos_Aires',
    region: 'Buenos Aires',
  },
  PE: {
    name: 'Peru',
    flag: '\u{1F1F5}\u{1F1EA}',
    flagCode: 'PE',
    capital: 'Lima',
    timezone: 'America/Lima',
    region: 'Lima',
  },
};

// ---------------------------------------------------------------------------
// Provider geo-config builders
// ---------------------------------------------------------------------------

/**
 * Build OpenAI `user_location` for the Responses API `web_search` tool.
 * Returns undefined for US (no geo filter needed — current default behaviour).
 */
export function buildOpenAIGeoConfig(country: CountryCode) {
  if (country === 'US') return undefined;
  const meta = COUNTRY_META[country];
  return {
    type: 'approximate' as const,
    country,
    city: meta.capital,
    region: meta.region,
    timezone: meta.timezone,
  };
}

/**
 * Build Perplexity geo config.
 * Returns undefined for US.
 */
export function buildPerplexityGeoConfig(country: CountryCode) {
  if (country === 'US') return undefined;
  const meta = COUNTRY_META[country];
  const lang = COUNTRY_LANGUAGE_MAP[country];
  return {
    user_location: {
      country,
      region: meta.region,
      city: meta.capital,
    },
    search_language_filter: [lang],
  };
}

/**
 * Build Claude/Anthropic `user_location` for the web_search tool.
 * Returns undefined for US.
 */
export function buildClaudeGeoConfig(country: CountryCode) {
  if (country === 'US') return undefined;
  const meta = COUNTRY_META[country];
  return {
    type: 'approximate' as const,
    country,
    city: meta.capital,
    region: meta.region,
    timezone: meta.timezone,
  };
}

/**
 * Gemini has NO native geo parameter — needs BrightData residential proxy.
 */
export function isGeminiProxyNeeded(country: CountryCode): boolean {
  return country !== 'US';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getLanguageForCountry(country: CountryCode): 'en' | 'es' {
  return COUNTRY_LANGUAGE_MAP[country];
}

export function getUniqueLanguages(countries: CountryCode[]): Array<'en' | 'es'> {
  return [...new Set(countries.map((c) => COUNTRY_LANGUAGE_MAP[c]))];
}

export function isAllowedCountry(code: string): code is CountryCode {
  return (ALLOWED_COUNTRIES as readonly string[]).includes(code);
}

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export const MAX_MONITORS = 3;
export const MAX_COUNTRIES_PER_MONITOR = 5;
