/**
 * BrightData Residential Proxy Utility
 *
 * Used ONLY for Gemini/Google API calls where geo-targeting is needed.
 * Gemini has no native geo parameter — the only way to geo-localize its
 * search grounding is to route the request through a country-specific
 * residential IP via BrightData.
 *
 * All other providers (OpenAI, Perplexity, Claude) use native API-level
 * geo parameters and do NOT need a proxy.
 */

import type { CountryCode } from './country-config';

// ---------------------------------------------------------------------------
// Proxy URL builder
// ---------------------------------------------------------------------------

/**
 * Construct the BrightData proxy URL for a given country.
 *
 * Env vars required:
 *   BRIGHTDATA_HOST     – e.g. brd.superproxy.io
 *   BRIGHTDATA_PORT     – e.g. 22225
 *   BRIGHTDATA_USERNAME – zone username (e.g. brd-customer-xxx-zone-residential)
 *   BRIGHTDATA_PASSWORD – zone password
 *
 * The country targeting parameter is appended to the username:
 *   brd-customer-xxx-zone-residential-country-es
 */
export function buildGeminiProxyUrl(country: CountryCode): string | undefined {
  const host = process.env.BRIGHTDATA_HOST;
  const port = process.env.BRIGHTDATA_PORT;
  const username = process.env.BRIGHTDATA_USERNAME;
  const password = process.env.BRIGHTDATA_PASSWORD;

  if (!host || !port || !username || !password) {
    console.warn(
      '[BrightData] Missing env vars (BRIGHTDATA_HOST, BRIGHTDATA_PORT, BRIGHTDATA_USERNAME, BRIGHTDATA_PASSWORD). Gemini geo-targeting disabled.',
    );
    return undefined;
  }

  // Append country targeting to the username
  const countryLower = country.toLowerCase();
  const targetedUsername = `${username}-country-${countryLower}`;

  return `http://${targetedUsername}:${password}@${host}:${port}`;
}

/**
 * Build the Gemini REST API endpoint URL for a proxied request.
 * When we can't use the SDK (proxy routing), we call the REST API directly.
 */
export function buildGeminiRestEndpoint(model: string): string {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key not configured (GEMINI_API_KEY)');
  }
  // Preview models require v1beta; stable GA models use v1
  const apiVersion = model.includes('preview') ? 'v1beta' : 'v1';
  return `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;
}
