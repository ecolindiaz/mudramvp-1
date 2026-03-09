import { generateInitialPrompts, profileToBrandInfo } from './prompt-generation.service';
import { validateCompetitors, quickValidateName, type ValidatedCompetitor } from './competitor-validation.service';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { type CountryCode, buildOpenAIGeoConfig, buildPerplexityGeoConfig, buildClaudeGeoConfig, isGeminiProxyNeeded, getLanguageForCountry } from '@/lib/geo/country-config';
import { buildGeminiProxyUrl, buildGeminiRestEndpoint } from '@/lib/geo/brightdata-proxy';

// Utility: Sleep function for retry delays
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Runs async tasks with a concurrency limit using a worker-queue pattern.
 * Preserves result order matching the input order.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const queue = items.map((item, i) => ({ item, index: i }));

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const entry = queue.shift();
      if (!entry) break;
      results[entry.index] = await fn(entry.item, entry.index);
    }
  });

  await Promise.all(workers);
  return results;
}

// Cache for resolved Gemini grounding redirect URLs (in-memory, per-process)
const geminiRedirectCache = new Map<string, { url: string; title: string; resolvedAt: number }>();
// Tracks active redirect resolutions so duplicate URLs don't trigger parallel retries/log spam
const geminiRedirectInFlight = new Map<string, Promise<{ url: string; title: string }>>();
const REDIRECT_CACHE_TTL = 1000 * 60 * 60; // 1 hour cache TTL

// Anthropic throttle removed — relying on retryWithBackoff to handle 429s naturally

// Gemini model configuration: preview primary with stable fallbacks
const GEMINI_PRIMARY_MODEL = 'gemini-3-flash-preview';
const GEMINI_FALLBACK_MODEL = 'gemini-2.5-flash';
const GEMINI_FALLBACK_MODEL_LITE = 'gemini-2.5-flash-lite';

// Model used to extract brand/competitor entities from provider response text.
const COMPETITOR_EXTRACTION_MODEL = 'gpt-5.2';

/**
 * Resolves a Gemini grounding redirect URL to get the actual source URL.
 * Google's grounding API returns URLs like:
 * https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHQl1aug...
 *
 * This function follows the redirect to get the actual destination URL.
 * Returns the original URL if resolution fails to ensure we don't lose data.
 */
async function resolveGeminiGroundingUrl(
  redirectUrl: string,
  originalTitle?: string
): Promise<{ url: string; title: string }> {
  // If not a grounding redirect URL, return as-is
  if (!redirectUrl.includes('vertexaisearch.cloud.google.com/grounding-api-redirect')) {
    return { url: redirectUrl, title: originalTitle || '' };
  }

  // Check cache first
  const cached = geminiRedirectCache.get(redirectUrl);
  if (cached && Date.now() - cached.resolvedAt < REDIRECT_CACHE_TTL) {
    return { url: cached.url, title: cached.title };
  }

  // Reuse an active resolution for the same URL to avoid duplicate retries/logs under concurrency.
  const activeResolution = geminiRedirectInFlight.get(redirectUrl);
  if (activeResolution) {
    const resolved = await activeResolution;
    return { url: resolved.url, title: resolved.title || originalTitle || '' };
  }

  const resolutionPromise = (async (): Promise<{ url: string; title: string }> => {
    // Helper to extract title from resolved URL
    const extractTitle = (resolvedUrl: string): string => {
      let title = originalTitle || '';
      try {
        const urlObj = new URL(resolvedUrl);
        if (!title || title.length < 5) {
          title = urlObj.hostname;
        }
      } catch {
        // Keep original title if URL parsing fails
      }
      return title;
    };

    // Helper to cache and return a resolved URL
    const cacheAndReturn = (resolved: string, method: string): { url: string; title: string } => {
      const title = extractTitle(resolved);
      geminiRedirectCache.set(redirectUrl, {
        url: resolved,
        title,
        resolvedAt: Date.now(),
      });
      console.log(`[Gemini] Resolved redirect (${method}): ${redirectUrl.substring(0, 60)}... → ${resolved.substring(0, 80)}...`);
      return { url: resolved, title };
    };

    // Retry with backoff: 3 attempts with 500ms, 1s, 2s delays
    // This handles transient failures & rate limiting from Google's redirect endpoint
    const MAX_ATTEMPTS = 3;
    const INITIAL_RETRY_DELAY = 500;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        // Stage 1: HEAD request to read Location header (fast path)
        const response = await fetch(redirectUrl, {
          method: 'HEAD',
          redirect: 'manual',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MudraBot/1.0)',
          },
          signal: AbortSignal.timeout(8000), // 8 second timeout
        });

        const location = response.headers.get('location');
        if (location && location !== redirectUrl) {
          return cacheAndReturn(location, 'HEAD');
        }

        // Stage 2: GET with full redirect follow (slower fallback)
        const followResponse = await fetch(redirectUrl, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MudraBot/1.0)',
          },
          signal: AbortSignal.timeout(12000), // 12 second timeout for full follow
        });

        const finalUrl = followResponse.url;
        if (finalUrl && finalUrl !== redirectUrl) {
          return cacheAndReturn(finalUrl, 'GET follow');
        }

        // Both stages returned same URL — not a transient error, no point retrying
        break;
      } catch (error: any) {
        const isLastAttempt = attempt === MAX_ATTEMPTS - 1;
        if (isLastAttempt) {
          console.warn(`[Gemini] Failed to resolve redirect URL after ${MAX_ATTEMPTS} attempts: ${error.message}`);
        } else {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          console.warn(`[Gemini] Redirect resolution attempt ${attempt + 1}/${MAX_ATTEMPTS} failed (${error.message}), retrying in ${delay}ms...`);
          await sleep(delay);
        }
      }
    }

    // Return original URL as fallback - never lose the source
    return { url: redirectUrl, title: originalTitle || '' };
  })();

  geminiRedirectInFlight.set(redirectUrl, resolutionPromise);

  try {
    return await resolutionPromise;
  } finally {
    geminiRedirectInFlight.delete(redirectUrl);
  }
}

/**
 * Resolves multiple Gemini grounding URLs in parallel with concurrency limit.
 * Returns resolved citations maintaining original order and positions.
 */
async function resolveGeminiGroundingUrls(
  citations: Citation[],
  concurrency: number = 3
): Promise<Citation[]> {
  if (citations.length === 0) return [];

  const results: Citation[] = new Array(citations.length);
  const queue = citations.map((c, i) => ({ citation: c, index: i }));

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      const { citation, index } = item;
      const resolved = await resolveGeminiGroundingUrl(citation.url, citation.title);

      results[index] = {
        ...citation,
        url: resolved.url,
        title: resolved.title || citation.title,
      };
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Retry helper with exponential backoff for rate limits and transient errors
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries - 1;
      const isRetryable =
        error.status === 408 || // Request timeout
        error.status === 429 || // Rate limit
        error.status === 500 || // Server error
        error.status === 502 || // Bad gateway
        error.status === 503 || // Service unavailable
        error.status === 504 || // Gateway timeout
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.message?.includes('timeout');

      if (!isRetryable || isLastAttempt) {
        throw error;
      }

      // Respect retry-after header from API (Anthropic SDK attaches headers to error)
      let retryAfterMs = 0;
      const retryAfterHeader = error.headers?.get?.('retry-after') ?? error.headers?.['retry-after'];
      if (retryAfterHeader) {
        const retryAfterSec = parseFloat(retryAfterHeader);
        if (!isNaN(retryAfterSec)) {
          retryAfterMs = retryAfterSec * 1000;
        }
      }

      const exponentialDelay = initialDelay * Math.pow(2, attempt);
      const MAX_WAIT_MS = 120_000; // Cap at 2 minutes
      const delay = Math.min(Math.max(retryAfterMs, exponentialDelay), MAX_WAIT_MS);
      console.warn(`⚠️  Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms (retry-after: ${retryAfterMs}ms, exponential: ${exponentialDelay}ms) due to: ${error.message}`);
      await sleep(delay);
    }
  }

  throw new Error('Max retries exceeded');
}

// Types for direct GEO analysis
export interface Citation {
  title?: string;
  url: string;
  snippet?: string;
  position?: number;
}

export interface DirectGEOConfig {
  brandName: string;
  industry?: string;
  description?: string;
  competitors?: string[];
  targetAudience?: string;
  keyProducts?: string[];
  customPrompts?: Array<string | { text: string; category?: string; language?: string }>; // Support both string[] and objects with categories
  country?: CountryCode;           // Target country for geo-localized analysis
  apiKeys: {
    openai?: string;
    anthropic?: string;
    google?: string;
    perplexity?: string;
  };
}

export interface DirectGEOResult {
  brandName: string;
  overallScore: number;
  analyses: ProviderAnalysis[];
  competitorComparison: CompetitorAnalysis[];
  validatedCompetitors?: ValidatedCompetitor[]; // AI-validated competitors with confidence scores
  recommendations: string[];
  country?: string;     // ISO code of the country this result is for
  language?: string;    // Language used for prompts ("en" | "es")
  timestamp: Date;
}

export interface ProviderAnalysis {
  provider: string;
  promptTests: PromptTest[];
  brandVisibilityScore: number;
  averagePosition: number;
  mentionRate: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface PromptTest {
  prompt: string;
  promptCategory?: string; // Category for intent weighting
  response: string;
  brandMentioned: boolean;
  brandPosition?: number;
  competitors: string[];
  competitorPositions?: Record<string, number>; // Maps competitor name to their position
  competitorSentiments?: Record<string, 'positive' | 'neutral' | 'negative'>; // Maps competitor name to sentiment
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  citations?: Citation[]; // Inline citations referenced in response
  sources?: Citation[]; // All URLs retrieved during web search
  searchQueries?: string[]; // Queries used for grounding (Gemini)
  rawCompetitorsMentioned?: string[]; // Pre-validation competitor mentions (all regex-filtered names)
  rawCompetitorPositions?: Record<string, number>;
  rawCompetitorSentiments?: Record<string, 'positive' | 'neutral' | 'negative'>;
}

export interface CompetitorAnalysis {
  name: string;
  mentionCount: number;
  averagePosition: number;
  shareOfVoice: number;
}

/**
 * Normalize company name for comparison
 * Handles common variations: case, punctuation, common suffixes
 */
function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Strip parenthetical suffixes: "io.net (GPU DePIN)" → "io.net"
    .replace(/\s*\(.*?\)\s*$/, '')
    // Remove common suffixes
    .replace(/\s*(inc\.?|llc\.?|ltd\.?|corp\.?|co\.?|company)$/i, '')
    // Remove punctuation (but keep periods for domains like io.net)
    .replace(/[,!?'"()]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clean parenthetical content from LLM-extracted names in analysis objects.
 * e.g. "Y Combinator (Online/Hybrid)" → "Y Combinator"
 * 
 * Handles collisions (same company with different parentheticals):
 * - For positions: keeps the minimum (best/lowest rank) to preserve best visibility
 * - For sentiments: keeps the first occurrence to maintain consistency
 */
function cleanLLMAnalysisNames(analysis: any): void {
  if (analysis.competitorsMentioned && Array.isArray(analysis.competitorsMentioned)) {
    analysis.competitorsMentioned = analysis.competitorsMentioned.map((name: string) =>
      name.replace(/\s*\(.*$/, '').trim()
    ).filter((name: string) => name.length > 0);
  }
  if (analysis.competitorPositions && typeof analysis.competitorPositions === 'object') {
    const cleaned: Record<string, number> = {};
    for (const [name, pos] of Object.entries(analysis.competitorPositions)) {
      const clean = name.replace(/\s*\(.*$/, '').trim();
      if (clean.length > 0) {
        const numPos = pos as number;
        // On collision (same cleaned name): keep minimum position (best rank, lower is better)
        if (clean in cleaned) {
          cleaned[clean] = Math.min(cleaned[clean], numPos);
        } else {
          cleaned[clean] = numPos;
        }
      }
    }
    analysis.competitorPositions = cleaned;
  }
  if (analysis.competitorSentiments && typeof analysis.competitorSentiments === 'object') {
    const cleaned: Record<string, string> = {};
    for (const [name, sent] of Object.entries(analysis.competitorSentiments)) {
      const clean = name.replace(/\s*\(.*$/, '').trim();
      if (clean.length > 0) {
        // On collision (same cleaned name): keep first occurrence for sentiment
        if (!(clean in cleaned)) {
          cleaned[clean] = sent as string;
        }
      }
    }
    analysis.competitorSentiments = cleaned;
  }
}

/**
 * Check if two company names match (strict matching, not fuzzy substring)
 * Returns true only if names are essentially the same company
 */
function matchCompetitorNames(name1: string, name2: string): boolean {
  const norm1 = normalizeCompanyName(name1);
  const norm2 = normalizeCompanyName(name2);

  // Exact match after normalization
  if (norm1 === norm2) {
    return true;
  }

  // Handle acronyms vs full names (e.g., "YC" vs "Y Combinator")
  // Only match if one is very short (likely acronym) and other starts with those letters
  if (norm1.length <= 3 && norm2.length > 3) {
    const initials = norm2.split(' ').map(w => w[0]).join('');
    if (initials === norm1) return true;
  }
  if (norm2.length <= 3 && norm1.length > 3) {
    const initials = norm1.split(' ').map(w => w[0]).join('');
    if (initials === norm2) return true;
  }

  // Suffix-aware matching: "Akash" matches "Akash Network", "Scale" matches "Scale AI"
  // Constraints: shorter MUST be exactly 1 word, longer MUST be exactly 2 words
  const companySuffixes = new Set([
    'network', 'ai', 'labs', 'protocol', 'cloud', 'tech', 'technologies',
    'digital', 'studio', 'studios', 'global', 'group', 'hq', 'io',
    'platform', 'software', 'computing', 'systems', 'data', 'health',
  ]);
  const words1 = norm1.split(' ');
  const words2 = norm2.split(' ');
  if (words1.length === 1 && words2.length === 2) {
    if (words2[0] === norm1 && companySuffixes.has(words2[1])) return true;
  }
  if (words2.length === 1 && words1.length === 2) {
    if (words1[0] === norm2 && companySuffixes.has(words1[1])) return true;
  }

  // TLD-aware matching: "E2B" matches "E2B.dev", "Fly" matches "Fly.io"
  const tldSuffixes = new Set(['dev', 'io', 'ai', 'com', 'net', 'cloud', 'new', 'app', 'sh']);
  const matchTld = (plain: string, dotted: string) => {
    const parts = dotted.split('.');
    return parts.length === 2 && parts[0] === plain && tldSuffixes.has(parts[1]);
  };
  if (words1.length === 1 && words2.length === 1) {
    if (norm1.includes('.') && !norm2.includes('.') && matchTld(norm2, norm1)) return true;
    if (norm2.includes('.') && !norm1.includes('.') && matchTld(norm1, norm2)) return true;
  }

  return false;
}

/**
 * Validate brand position - must be >= 1 to be a valid ranking
 * Position 0 or negative values indicate the LLM misinterpreted a brand mention
 * (e.g., brand mentioned in prose before a list) as a ranking position.
 * In such cases, we return null to indicate no explicit ranking was found.
 */
const MAX_VALID_POSITION = 20;

function validateBrandPosition(position: number | null | undefined): number | undefined {
  if (position === null || position === undefined) {
    return undefined;
  }
  // Position must be >= 1 and <= MAX_VALID_POSITION to be a valid ranking
  if (position >= 1 && position <= MAX_VALID_POSITION) {
    return position;
  }
  // Position 0, negative, or > 20 = LLM error, treat as no ranking
  console.warn(`[Position Validation] Invalid position ${position} detected, treating as no ranking`);
  return undefined;
}

/**
 * LLM-as-judge: confirm whether a TLD-stripped base word (e.g. "Next" from
 * "Next.js") refers to the brand or is ordinary English in the given text.
 * Uses gpt-4o-mini for speed/cost.  Returns true = brand reference.
 * On any failure, conservatively returns false (skip the ambiguous match).
 */
async function judgeBrandMentionWithLLM(
  text: string,
  brandFull: string,
  brandBase: string,
  openaiKey: string,
): Promise<boolean> {
  try {
    const openai = new OpenAI({ apiKey: openaiKey.trim() });

    // Extract a ~400-char window around the first occurrence for context
    const idx = text.toLowerCase().indexOf(brandBase.toLowerCase());
    const start = Math.max(0, idx - 200);
    const end = Math.min(text.length, idx + brandBase.length + 200);
    const excerpt = text.slice(start, end);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 10,
      messages: [
        {
          role: 'system',
          content:
            'You decide whether a word in a text excerpt refers to the brand/product or is just an ordinary English word. Reply ONLY "YES" (brand reference) or "NO" (ordinary word).',
        },
        {
          role: 'user',
          content: `Brand: "${brandFull}"\nWord to check: "${brandBase}"\n\nExcerpt:\n"""${excerpt}"""\n\nDoes "${brandBase}" refer to the brand "${brandFull}" here?`,
        },
      ],
    });

    const answer = (response.choices?.[0]?.message?.content ?? '').trim().toUpperCase();
    return answer.startsWith('YES');
  } catch (err) {
    console.warn(`[Brand Judge] LLM call failed for "${brandFull}", skipping ambiguous match:`, err);
    return false;
  }
}

/**
 * Validate brand mention using regex with word boundaries.
 * For ambiguous TLD-stripped base names (e.g. "Next" from "Next.js"),
 * uses an LLM judge to confirm the match when an OpenAI key is available.
 */
export async function validateBrandMention(
  text: string,
  brandName: string,
  openaiApiKey?: string,
): Promise<boolean> {
  const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const trimmedBrand = brandName.trim();
  const escapedBrand = escapeRegex(trimmedBrand);
  if (!escapedBrand) return false;

  // Phase 1: Light clean — strip URLs and code, but keep bare domains intact.
  // This lets domain-format brands (Daytona.io, E2B.dev) survive for matching.
  const lightCleaned = text
    .replace(/https?:\/\/[^\s]+/g, ' ')
    .replace(/www\.[^\s]+/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 1a) Exact brand match (handles "Daytona" within "Daytona.io" via word boundaries)
  const exactPattern = new RegExp(`\\b${escapedBrand}\\b`, 'i');
  if (exactPattern.test(lightCleaned)) return true;

  // 1b) If brand has a TLD suffix ("Daytona.io"), also match bare base name ("Daytona")
  //     Uses LLM judge to avoid false positives from common English words
  //     (e.g. "Next.js" → "Next" matching "Next, we will…")
  const brandBase = trimmedBrand.replace(/\.[a-z]{2,}$/i, '');
  if (brandBase.toLowerCase() !== trimmedBrand.toLowerCase() && brandBase.length >= 2) {
    const basePattern = new RegExp(`\\b${escapeRegex(brandBase)}\\b`, 'i');
    if (basePattern.test(lightCleaned)) {
      // Regex found the base word — ask the LLM whether it's actually the brand
      if (openaiApiKey) {
        return judgeBrandMentionWithLLM(text, trimmedBrand, brandBase, openaiApiKey);
      }
      // No API key available — skip ambiguous match (conservative)
      return false;
    }
  }

  // Phase 2: Full clean — also strip bare domains for variant-aware matching.
  // Prevents false positives like "scaleai.ca" matching "Scale AI".
  const fullCleaned = lightCleaned
    .replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (exactPattern.test(fullCleaned)) return true;

  // Variant-aware fallback for merged/split brand forms ("ScaleAI" <-> "Scale AI")
  const brandTokens = brandName
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (brandTokens.length <= 1) return false;

  const flexiblePattern = new RegExp(
    `\\b${brandTokens.map(token => escapeRegex(token)).join('[\\s\\-_]*')}\\b`,
    'i'
  );
  if (flexiblePattern.test(fullCleaned)) return true;

  // Significant prefix match for brands with 3+ tokens
  if (brandTokens.length >= 3) {
    for (let prefixLen = brandTokens.length - 1; prefixLen >= 2; prefixLen--) {
      const prefixTokens = brandTokens.slice(0, prefixLen);
      const prefixPattern = new RegExp(
        `\\b${prefixTokens.map(token => escapeRegex(token)).join('[\\s\\-_]*')}\\b`,
        'i'
      );
      if (prefixPattern.test(fullCleaned)) return true;
    }
  }

  return false;
}

/**
 * Filter competitors to only include valid company names
 */
export function filterValidCompetitors(competitors: string[], brandName: string): string[] {
  if (!competitors || !Array.isArray(competitors)) return [];

  const brandLower = brandName.toLowerCase();

  // Extract first word of brand name for matching brand products
  // e.g., "Vercel" -> matches "Vercel AI", "Vercel SDK", "Vercel Agent"
  const brandFirstWord = brandLower.split(/\s+/)[0];

  return competitors.filter(comp => {
    if (!comp || typeof comp !== 'string') return false;

    const compLower = comp.toLowerCase().trim();

    // Filter empty or whitespace-only strings
    if (!compLower || compLower.length === 0) return false;

    // Filter exact brand match or brand contained in competitor name
    if (compLower === brandLower || compLower.includes(brandLower)) return false;

    // Filter if competitor starts with brand name (catches "Vercel AI", "Vercel SDK", etc.)
    if (compLower.startsWith(brandFirstWord + ' ') || compLower.startsWith(brandFirstWord + "'s")) return false;

    // Filter generic product/feature names that are likely referring to tracked brand's products
    // These are commonly extracted when AI describes a brand's features instead of competitors
    const genericProductNames = [
      // SDK/API related
      'ai sdk', 'ai gateway', 'ai agent', 'ai assistant', 'ai platform', 'ai api',
      'sdk', 'api', 'gateway', 'agent', 'cli', 'dashboard', 'platform',
      // Payment/commerce related generic terms
      'payment gateway', 'payment api', 'payment platform', 'checkout',
      // Generic product features
      'edge functions', 'edge network', 'edge runtime', 'serverless functions',
      'analytics', 'insights', 'observability', 'monitoring',
      'preview deployments', 'preview environments', 'instant rollbacks',
      'automatic scaling', 'auto scaling', 'global cdn',
      // Generic platform features
      'pro plan', 'enterprise plan', 'team plan', 'free tier',
      'managed infrastructure', 'infrastructure as code',
      // Single-word abstract/category terms
      'security', 'performance', 'reliability', 'scalability', 'compliance',
      'governance', 'automation', 'integration', 'deployment', 'infrastructure',
      'engagement', 'methodology', 'philosophy',
    ];
    if (genericProductNames.includes(compLower)) return false;

    // Filter if it's a 2-word combo where second word is a generic tech term
    // e.g., "AI Gateway", "AI SDK" (unless it's clearly a company like "Scale AI")
    const words = compLower.split(/\s+/);
    if (words.length === 2) {
      const genericSecondWords = [
        'sdk', 'api', 'cli', 'gateway', 'agent', 'platform', 'runtime',
        'functions', 'network', 'cdn', 'edge', 'proxy', 'cache',
        'dashboard', 'console', 'portal', 'studio', 'hub', 'center',
      ];
      if (genericSecondWords.includes(words[1])) {
        // Only keep if first word is a known company name (not generic like "AI", "Edge", "Cloud")
        const genericFirstWords = ['ai', 'edge', 'cloud', 'serverless', 'managed', 'global', 'auto', 'instant'];
        if (genericFirstWords.includes(words[0])) return false;
      }

      // Filter comparison category headings / attribute labels
      // e.g., "Core Identity", "Primary Strength", "Build Speed", "Engagement Model"
      const abstractNouns = new Set([
        'identity', 'strength', 'control', 'latency', 'speed', 'cost',
        'generosity', 'pricing', 'tier', 'stage', 'assessment', 'evaluation',
        'compliance', 'governance', 'scalability', 'flexibility', 'compatibility',
        'reliability', 'accuracy', 'performance', 'management', 'deployment',
        'integration', 'verification', 'automation', 'model', 'complexity',
        'maturity', 'readiness', 'coverage', 'efficiency', 'quality',
        'capability', 'capacity', 'overhead', 'footprint', 'posture',
        'focus', 'approach', 'methodology', 'philosophy',
        'security', 'experience', 'infrastructure',
      ]);
      const genericFirstForAbstract = new Set([
        'core', 'primary', 'best', 'free', 'low', 'high', 'setup', 'build',
        'deployment', 'infrastructure', 'security', 'model', 'engagement',
        'data', 'network', 'api', 'cloud', 'cost', 'price', 'code',
        'developer', 'user', 'platform', 'service', 'system', 'overall',
        'total', 'key', 'main', 'top', 'base', 'resource', 'vendor',
      ]);
      // Also check hyphenated first words (e.g., "low-latency" → check "low")
      const firstWordBase = words[0].split('-')[0];
      if (abstractNouns.has(words[1]) && (genericFirstForAbstract.has(words[0]) || genericFirstForAbstract.has(firstWordBase))) return false;
    }

    if (comp.length < 2 || comp.length > 40) return false;

    // CRITICAL: Filter out generic category terms that are NOT company names
    const genericTerms = [
      // Career/Job related generic terms
      'networking', 'internships', 'internships and co', 'career fairs', 'career services',
      'job portals', 'online job portals', 'job boards', 'resume builders',
      'professional certifications', 'coding competitions', 'hackathons',
      'coding competitions and hackathons', 'technical blogs', 'portfolios',
      'technical blogs and portfolios', 'alumni networks', 'mentorship',
      'career advising', 'career coaching', 'mock interviews', 'interview prep',
      'company career pages', 'recruitment agencies', 'virtual career summit',
      // Education related
      'online courses', 'bootcamps', 'workshops', 'webinars', 'tutorials',
      'certification programs', 'degree programs', 'moocs', 'scholarships',
      // Tech generic terms
      'open source', 'software solutions', 'cloud services', 'web development',
      'mobile development', 'data science', 'machine learning', 'ai tools',
      // Generic phrases that look like categories
      'industry events', 'meetups', 'conferences', 'summits', 'forums',
      'communities', 'professional organizations', 'associations', 'groups',
      'platforms', 'resources', 'tools', 'services', 'solutions',
    ];
    if (genericTerms.includes(compLower)) return false;
    
    // Filter out generic terms that start with common category indicators
    const categoryStarts = [
      'online ', 'virtual ', 'professional ', 'technical ', 'coding ',
      'career ', 'job ', 'industry ', 'software ', 'tech ', 'digital ',
      'ai ', 'commercial ', 'decentralized ', 'centralized ', 'distributed ',
    ];
    for (const start of categoryStarts) {
      if (compLower.startsWith(start)) {
        // Check if the rest looks like a generic term
        const rest = compLower.slice(start.length);
        const genericRest = [
          'courses', 'events', 'services', 'platforms', 'resources', 'tools',
          'communities', 'networks', 'groups', 'forums', 'boards', 'fairs',
          'certifications', 'workshops', 'bootcamps', 'programs', 'portals',
          'marketplaces', 'providers', 'solutions', 'systems', 'agencies',
          'organizations', 'ecosystems', 'protocols', 'frameworks', 'offerings',
          'alternatives', 'options',
        ];
        if (genericRest.includes(rest)) return false;
      }
    }

    // Filter names containing '/' — almost never companies
    // Catches: "AI model/data marketplaces", "GPU/CPU compute", "annotation/labeling services"
    if (comp.includes('/')) {
      const slashExceptions = ['fly.io', 'bolt.new', 'ci/cd', 'gitlab ci/cd', 'next.js'];
      if (!slashExceptions.some(ex => compLower.includes(ex))) return false;
    }

    // Filter multi-word phrases ending with plural category nouns
    // Using PLURAL forms only protects company names with singular: "Render Network", "Ocean Protocol"
    const pluralCategoryNouns = [
      'marketplaces', 'networks', 'services', 'providers', 'platforms',
      'solutions', 'tools', 'systems', 'agencies', 'organizations',
      'ecosystems', 'protocols', 'frameworks', 'offerings', 'alternatives', 'options',
    ];
    const lastWord = words[words.length - 1];
    const genericFirstWordsForCategory = [
      'ai', 'cloud', 'data', 'web', 'digital', 'enterprise', 'commercial',
      'decentralized', 'centralized', 'distributed', 'gpu', 'compute',
      'edge', 'serverless', 'managed', 'global', 'auto', 'instant',
      'online', 'virtual', 'professional', 'technical', 'coding',
      'career', 'job', 'industry', 'software', 'tech', 'open',
      'annotation', 'labeling', 'training',
    ];
    if (pluralCategoryNouns.includes(lastWord)) {
      if (words.length >= 2 && genericFirstWordsForCategory.includes(words[0])) return false;
    }

    // Expanded 3+ word generic combo: first word generic AND last word generic tech term → filter
    if (words.length >= 3) {
      const genericFirstSet = [
        'ai', 'edge', 'cloud', 'serverless', 'managed', 'global', 'auto', 'instant',
        'decentralized', 'centralized', 'distributed', 'gpu', 'compute', 'data',
        'web', 'digital', 'enterprise', 'commercial', 'open',
        'free', 'low', 'high', 'fast', 'setup', 'build', 'deploy',
      ];
      const genericLastSet = [
        'sdk', 'gateway', 'service', 'platform', 'runtime', 'functions',
        'network', 'cdn', 'edge', 'proxy', 'cache', 'dashboard', 'console',
        'portal', 'studio', 'hub', 'center', 'marketplace', 'provider',
        'solution', 'tool', 'system', 'framework', 'protocol', 'ecosystem',
        'integration', 'automation', 'verification', 'deployment', 'management',
        'generosity', 'performance', 'latency', 'speed', 'cost', 'pricing',
      ];
      if (genericFirstSet.includes(words[0]) && genericLastSet.includes(lastWord)) return false;
    }
    
    const invalidStarts = [
      'others ', 'other ', 'posts ', 'reach out', 'sign up', 'check out',
      'learn more', 'get started', 'the ', 'a ', 'an ', 'some ', 'many ',
      'leading ', 'top ', 'best ', 'great ', 'amazing ', 'excellent ',
      'consider ', 'explore ', 'visit ', 'contact ', 'try ', 'use ',
      // Sentence starters that indicate this is a phrase, not a company name
      'as ', 'like ', 'such ', 'for ', 'with ', 'and ', 'or ', 'but ',
      'if ', 'when ', 'while ', 'although ', 'because ', 'since ',
      'however ', 'therefore ', 'thus ', 'hence ', 'also ', 'even ',
      'this ', 'that ', 'these ', 'those ', 'it ', 'they ', 'we ', 'you ',
      'i ', 'my ', 'our ', 'your ', 'their ', 'its ', 'his ', 'her ',
    ];
    if (invalidStarts.some(start => compLower.startsWith(start))) return false;

    const actionPatterns = [
      ' share ', ' highlight', ' recommend', ' suggest', ' contact ',
      ' directly', ' their team', ' your ', ' to your ', ' can help',
      ' sign up', ' check out', ' learn more', ' get started',
      ' might ', ' should ', ' could ', ' would ', ' will ',
      // Verb patterns that indicate this is a sentence, not a company name
      ' is ', ' are ', ' was ', ' were ', ' has ', ' have ', ' had ',
      ' does ', ' do ', ' did ', ' can ', ' may ', ' must ',
      ' being ', ' been ', ' having ', ' doing ',
      // Common sentence connectors
      ' that ', ' which ', ' who ', ' whom ', ' whose ', ' where ',
      ' because ', ' since ', ' although ', ' though ', ' while ',
    ];
    if (actionPatterns.some(pattern => compLower.includes(pattern))) return false;

    // Filter "&"/"and" category phrases like "AI-enhanced coding & collaboration"
    // Keeps real companies like "AT&T", "H&M", "Ernst & Young"
    if (compLower.includes('&') || compLower.includes(' and ')) {
      const separator = compLower.includes('&') ? '&' : ' and ';
      const parts = compLower.split(separator).map(p => p.trim());
      if (parts.length === 2) {
        const genericDescriptors = [
          'coding', 'collaboration', 'development', 'deployment', 'testing',
          'monitoring', 'analytics', 'automation', 'integration', 'optimization',
          'management', 'security', 'performance', 'infrastructure', 'scaling',
          'hosting', 'computing', 'networking', 'storage', 'processing',
          'training', 'inference', 'modeling', 'visualization', 'reporting',
        ];
        const endsWithDescriptor = (s: string) => genericDescriptors.some(d => s.endsWith(d));
        if (endsWithDescriptor(parts[0]) && endsWithDescriptor(parts[1])) return false;
      }
    }

    // Filter hyphenated descriptive phrases like "AI-enhanced coding tools"
    // Keeps real companies like "Micro-Star"
    if (comp.includes('-') && words.length >= 3) {
      const descriptorHyphens = ['-enhanced', '-powered', '-driven', '-based', '-enabled', '-native', '-first', '-focused', '-oriented', '-optimized'];
      if (descriptorHyphens.some(h => compLower.includes(h))) return false;
    }

    // Max 3 spaces (4 words) - company names rarely have more
    // Examples that pass: "The Home Depot", "JPMorgan Chase & Co"
    // Examples that fail: "As amazon is the best"
    const spaceCount = (comp.match(/\s/g) || []).length;
    if (spaceCount > 3) return false;
    
    if (/[.!?:]$/.test(comp)) return false;

    // Filter entries containing commas — company names almost never have commas
    // Catches: "Hands-on, cost-effective Linux VPS", "Fast, scalable hosting"
    if (comp.includes(',')) return false;

    const knownLowercaseBrands = ['npm', 'github', 'gitlab', 'docker', 'kubernetes', 'redis', 'mongodb'];
    if (comp === compLower && !knownLowercaseBrands.includes(compLower)) {
      if (!/[A-Z]/.test(comp) && comp.length > 5) return false;
    }
    
    return true;
  });
}

/**
 * Generate contextual prompts for GEO testing using sophisticated prompt generation
 * Returns array of objects with text and category for intent weighting
 */
async function generateGEOPrompts(config: DirectGEOConfig): Promise<Array<{ text: string; category?: string }>> {
  // If custom prompts are provided (from database), use them directly
  if (config.customPrompts && config.customPrompts.length > 0) {
    console.log(`✅ Using ${config.customPrompts.length} custom prompts from database`);
    
    // Normalize prompts to objects with text and category
    return config.customPrompts.map(p => 
      typeof p === 'string' ? { text: p } : p
    );
  }
  
  try {
    // Convert config to BrandInfo format
    const brandInfo = {
      companyName: config.brandName,
      companyDescription: config.description || `${config.brandName} is a company in the ${config.industry || 'technology'} industry`,
      industry: config.industry || 'technology',
      productsServices: config.keyProducts || ['software solutions'],
      idealCustomer: config.targetAudience || 'small to medium businesses',
      competitors: config.competitors || [],
    };

    // Generate prompts using the unified GPT-5.1 pipeline
    const generatedPrompts = await generateInitialPrompts(brandInfo);

    const allPrompts = generatedPrompts.map(p => ({ text: p.text, category: p.category }));

    console.log(`✅ Generated ${allPrompts.length} prompts with categories`);

    return allPrompts;

  } catch (error) {
    console.error('Failed to generate sophisticated prompts, falling back to basic prompts:', error);
    
    // Fallback to basic prompts without categories
    return generateBasicPrompts(config).map(text => ({ text }));
  }
}

/**
 * Fallback basic prompt generation
 */
function generateBasicPrompts(config: DirectGEOConfig): string[] {
  const { brandName, industry, keyProducts, competitors } = config;
  
  const basePrompts = [
    // Direct ranking prompts
    `What are the best ${keyProducts?.[0] || `${industry} tools`} in 2024?`,
    `Top 10 ${industry || 'software'} companies ranked by quality`,
    `Most recommended ${keyProducts?.[0] || `${industry} solutions`} for businesses`,
    
    // Comparison prompts
    competitors?.length 
      ? `${brandName} vs ${competitors.slice(0, 2).join(' vs ')} comparison`
      : `How does ${brandName} compare to other ${industry} solutions?`,
    
    // Alternative seeking prompts
    `Best alternatives to ${competitors?.[0] || `popular ${industry} tools`}`,
    `${brandName} competitors and alternatives`,
    
    // Recommendation prompts
    `Is ${brandName} worth it for ${keyProducts?.[0] || `${industry} needs`}?`,
    `${brandName} reviews and recommendations`,
    `Should I choose ${brandName} or other ${industry} options?`,
    
    // Problem-solving prompts
    keyProducts?.[0] 
      ? `Best ${keyProducts[0]} for small businesses`
      : `Top ${industry} solutions for startups`,
  ];

  return basePrompts.filter(Boolean);
}

/**
 * Check if provider API is available
 */
function isProviderAvailable(provider: string, apiKeys: DirectGEOConfig['apiKeys']): boolean {
  switch (provider) {
    case 'openai':
      return !!apiKeys.openai;
    case 'anthropic':
      return !!apiKeys.anthropic;
    case 'google':
      return !!apiKeys.google;
    case 'perplexity':
      return !!apiKeys.perplexity;
    default:
      return false;
  }
}

/**
 * Analyze a single prompt with a provider
 * Exported for use by single-prompt analysis service
 */
export async function analyzePromptWithProvider(
  prompt: string,
  provider: string,
  config: DirectGEOConfig
): Promise<PromptTest> {
  // Route to appropriate provider function
  switch (provider) {
    case 'openai':
      return await analyzeWithOpenAI(prompt, config);
    case 'perplexity':
      return await analyzeWithPerplexity(prompt, config);
    case 'anthropic':
      return await analyzeWithAnthropic(prompt, config);
    case 'google':
      return await analyzeWithGoogle(prompt, config);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Extract competitor positions using regex patterns (more reliable than LLM for structured lists)
 */
function extractCompetitorPositionsWithRegex(text: string, brandName: string): Record<string, number> {
  const positions: Record<string, number> = {};
  
  // Method 1: Standard numbered list "1. Company" or "1. **Company**"
  const numberedListRegex = /^(\d+)\.\s+\*?\*?([^*\n]+?)\*?\*?(?:\s*[-:]|$)/gm;
  let match;
  
  while ((match = numberedListRegex.exec(text)) !== null) {
    const pos = parseInt(match[1]);
    let company = match[2].trim();
    
    // Clean up company name (remove trailing colons, asterisks, markdown)
    company = company.replace(/[:\*]+$/, '').trim();
    company = company.split(/\n/)[0].trim(); // Take only first line
    company = company.replace(/\s*\(.*$/, '').trim(); // Strip parenthetical content (handles unclosed parens too)

    if (company && company.toLowerCase() !== brandName.toLowerCase() && company.length > 2 && quickValidateName(company)) {
      positions[company] = pos;
    }
  }

  // Method 2: "### 1st Place:" or "### 1st:" format
  const headingRankRegex = /###\s*(\d+)(?:st|nd|rd|th)\s+(?:Place)?:?\s*\*?\*?([^*\n]+)/gi;

  while ((match = headingRankRegex.exec(text)) !== null) {
    const pos = parseInt(match[1]);
    let company = match[2].trim();
    company = company.replace(/[:\*]+$/, '').trim();
    company = company.replace(/\s*\(.*$/, '').trim(); // Strip parenthetical content (handles unclosed parens too)

    if (company && company.toLowerCase() !== brandName.toLowerCase() && company.length > 2 && quickValidateName(company)) {
      if (!positions[company]) { // Don't overwrite if already found
        positions[company] = pos;
      }
    }
  }

  // Method 3: "1st Place: Company" or "Ranked 1st: Company" inline format
  const inlineRankRegex = /(?:Ranked\s+)?(\d+)(?:st|nd|rd|th)\s+(?:Place)?:?\s+\*?\*?([A-Z][^.\n]{2,40}?)\*?\*?(?=\s|$|\*|\n)/g;

  while ((match = inlineRankRegex.exec(text)) !== null) {
    const pos = parseInt(match[1]);
    let company = match[2].trim();
    company = company.replace(/[:\*]+$/, '').trim();
    company = company.replace(/\s*\(.*$/, '').trim(); // Strip parenthetical content (handles unclosed parens too)

    if (company && company.toLowerCase() !== brandName.toLowerCase() && company.length > 2 && quickValidateName(company)) {
      if (!positions[company]) {
        positions[company] = pos;
      }
    }
  }

  // Method 4: Markdown table rows (extract position from row order)
  // This is specifically for Perplexity responses with tables
  // Extract from tables ONLY if we found fewer than 3 numbered positions
  if (Object.keys(positions).length < 3) {
    const lines = text.split('\n');
    let inTable = false;
    let tablePosition = 0;
    
    for (const line of lines) {
      // Detect table separator (|----|----|----|)
      if (line.match(/^\|[\s\-:]+\|/)) {
        inTable = true;
        continue;
      }
      
      // If we're in a table, extract company names from rows
      if (inTable && line.startsWith('|')) {
        // Match: | **Company Name** | ... | ... |
        const rowMatch = line.match(/^\|\s*\*?\*?([^|\*\n]{3,50}?)\*?\*?\s*\|/);
        
        if (rowMatch) {
          let company = rowMatch[1].trim();
          company = company.replace(/\s*\(.*$/, '').trim(); // Strip parenthetical content (handles unclosed parens too)
          const companyLower = company.toLowerCase();

          // Skip if it looks like a table header (comprehensive list)
          const tableHeaderKeywords = [
            // Generic table headers
            'name', 'company', 'organization', 'entity', 'platform', 'tool', 'service',
            'product', 'solution', 'provider', 'vendor', 'brand', 'rank', 'ranking',
            // Industry-specific headers
            'accelerator', 'incubator', 'fund', 'investor', 'vc',
            'funding', 'investment', 'amount', 'valuation', 'equity', 'stake',
            'focus', 'industry', 'sector', 'vertical', 'category', 'type',
            'location', 'region', 'country', 'headquarters', 'hq',
            'founded', 'year', 'date', 'stage', 'status',
            'description', 'notes', 'details', 'summary', 'overview',
            'website', 'url', 'link', 'contact', 'email',
            // Metrics headers
            'score', 'rating', 'stars', 'reviews', 'users', 'customers',
            'revenue', 'arr', 'mrr', 'growth', 'size', 'employees',
          ];

          if (company === '' ||
              tableHeaderKeywords.some(kw => companyLower === kw || companyLower.includes(kw + ' ') || companyLower.startsWith(kw))) {
            continue;
          }
          
          tablePosition++;
          
          if (company && company.toLowerCase() !== brandName.toLowerCase() && quickValidateName(company)) {
            // Only add if not already found via numbered list
            if (!positions[company]) {
              positions[company] = tablePosition;
            }
          }
        }
      } else if (inTable) {
        // Empty line or non-table line means table ended
        inTable = false;
      }
    }
  }
  
  return positions;
}

/**
 * Merge LLM-extracted positions with regex-extracted positions,
 * cross-validating where both exist. Regex wins on mismatch (>1 apart).
 */
function mergeCompetitorPositions(
  analysis: any,
  regexPositions: Record<string, number>,
  brandName: string,
  providerTag: string
): Record<string, number> {
  const mergedPositions = { ...(analysis.competitorPositions || {}) };

  (analysis.competitorsMentioned || []).forEach((competitor: string) => {
    const regexMatch = Object.keys(regexPositions).find(
      regexComp => matchCompetitorNames(regexComp, competitor)
    );
    if (regexMatch) {
      const regexPos = regexPositions[regexMatch];
      const llmPos = mergedPositions[competitor];
      if (llmPos && regexPos && Math.abs(llmPos - regexPos) > 1) {
        console.warn(`[${providerTag}] Position mismatch for "${competitor}": LLM=${llmPos}, Regex=${regexPos}. Using regex.`);
        mergedPositions[competitor] = regexPos;
      } else if (!llmPos) {
        mergedPositions[competitor] = regexPos;
      }
    }
  });

  Object.entries(regexPositions).forEach(([company, position]) => {
    const alreadyMentioned = (analysis.competitorsMentioned || []).some(
      (comp: string) => matchCompetitorNames(comp, company)
    );
    if (!alreadyMentioned) {
      analysis.competitorsMentioned = [...(analysis.competitorsMentioned || []), company];
      mergedPositions[company] = position;
    }
  });

  return mergedPositions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity Normalization — dynamic alias resolution via LLM
// ─────────────────────────────────────────────────────────────────────────────

export interface NormalizationResult {
  aliasMap: Map<string, string>;      // raw lowercase → canonical display name
  entityTypes: Map<string, string>;   // canonical lowercase → type
  parentMap: Map<string, string>;     // canonical lowercase → parent company
  canonicalNames: string[];           // unique canonical names
}

/**
 * Normalize extracted entity names: deduplicate aliases, classify entity types,
 * and identify parent companies.  Uses a single LLM call with the model's world
 * knowledge so the approach is industry-agnostic (no hardcoded alias dictionary).
 *
 * On any failure the function returns an identity mapping so the existing
 * pipeline behaviour is preserved.
 */
export async function normalizeExtractedEntities(
  rawNames: string[],
  brandName: string,
  openaiApiKey: string
): Promise<NormalizationResult> {
  // 1. Deduplicate input using normalizeCompanyName
  const seenNormalized = new Map<string, string>(); // normalized → first raw display name
  for (const raw of rawNames) {
    const norm = normalizeCompanyName(raw);
    if (norm && !seenNormalized.has(norm)) {
      seenNormalized.set(norm, raw);
    }
  }
  const uniqueDisplayNames = [...seenNormalized.values()];

  // 2. Pre-group using matchCompetitorNames to catch acronyms/suffix variants locally
  const groups: string[][] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < uniqueDisplayNames.length; i++) {
    if (assigned.has(i)) continue;
    const group = [uniqueDisplayNames[i]];
    assigned.add(i);
    for (let j = i + 1; j < uniqueDisplayNames.length; j++) {
      if (assigned.has(j)) continue;
      if (matchCompetitorNames(uniqueDisplayNames[i], uniqueDisplayNames[j])) {
        group.push(uniqueDisplayNames[j]);
        assigned.add(j);
      }
    }
    groups.push(group);
  }

  // Build pre-grouped canonical names (pick longest display name in each group)
  const preGrouped = groups.map(g => g.reduce((a, b) => a.length >= b.length ? a : b));

  console.log(`[EntityNormalization] Pre-grouping: ${uniqueDisplayNames.length} unique → ${preGrouped.length} groups (${groups.filter(g => g.length > 1).length} multi-alias groups)`);

  // If 5 or fewer unique names, skip the LLM call — not worth the latency
  if (preGrouped.length <= 5) {
    console.log(`[EntityNormalization] Only ${preGrouped.length} groups, skipping LLM call`);
    return buildIdentityResult(rawNames);
  }

  // 3. Single LLM call to normalize aliases, classify types, identify parents
  const prompt = `You are an entity normalization expert. Given a list of brand/company/product names extracted from AI responses, your task is to:

1. **Group aliases** — names that refer to the same entity (e.g. "AWS" and "Amazon Web Services" are the same)
2. **Pick a canonical name** — the most commonly-used display name for each group
3. **Classify entity type** — one of: company, product, framework, hardware, program
4. **Identify parent company** — if the entity is a product/service of a larger company

BRAND BEING ANALYZED (exclude from output): "${brandName}"

ENTITY NAMES TO NORMALIZE:
${preGrouped.map((n, i) => `${i + 1}. ${n}`).join('\n')}

Return ONLY valid JSON (no markdown, no explanation):
{
  "entities": [
    {
      "canonical": "Amazon Web Services",
      "aliases": ["AWS", "Amazon Web Services"],
      "type": "company",
      "parent": null
    },
    {
      "canonical": "SageMaker",
      "aliases": ["SageMaker", "Amazon SageMaker"],
      "type": "product",
      "parent": "Amazon Web Services"
    }
  ]
}

Rules:
- Every input name MUST appear in exactly one aliases array
- canonical should be the most recognizable form of the name
- type must be one of: company, product, framework, hardware, program
- parent is null for top-level companies, otherwise the canonical name of the parent
- Do NOT include "${brandName}" in the output`;

  try {
    const openai = new OpenAI({ apiKey: openaiApiKey });
    const response = await retryWithBackoff(async () => {
      return openai.chat.completions.create({
        model: COMPETITOR_EXTRACTION_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_completion_tokens: 4000,
        response_format: { type: 'json_object' }
      });
    }, 2, 2000);

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    const entities: Array<{
      canonical: string;
      aliases: string[];
      type: string;
      parent: string | null;
    }> = parsed.entities || [];

    console.log(`[EntityNormalization] LLM returned ${entities.length} entities`);
    if (entities.length === 0) {
      console.warn('[EntityNormalization] LLM returned empty entities, using identity mapping');
      return buildIdentityResult(rawNames);
    }

    // Build result maps
    const aliasMap = new Map<string, string>();
    const entityTypes = new Map<string, string>();
    const parentMap = new Map<string, string>();
    const canonicalNames: string[] = [];

    for (const entity of entities) {
      const canonical = entity.canonical;
      const canonicalLower = canonical.toLowerCase();
      canonicalNames.push(canonical);

      // Map each alias (lowercased) → canonical display name
      for (const alias of entity.aliases) {
        aliasMap.set(alias.toLowerCase(), canonical);
      }
      // Also map the canonical itself
      aliasMap.set(canonicalLower, canonical);

      // Entity type
      const validTypes = new Set(['company', 'product', 'framework', 'hardware', 'program']);
      if (validTypes.has(entity.type)) {
        entityTypes.set(canonicalLower, entity.type);
      }

      // Parent company
      if (entity.parent) {
        parentMap.set(canonicalLower, entity.parent);
      }
    }

    // Inject pre-grouped aliases: the LLM only saw the canonical of each
    // pre-group, so other members (e.g. "AWS" when "Amazon Web Services"
    // was sent) need to point to whatever the LLM mapped the group canonical to.
    for (let gi = 0; gi < groups.length; gi++) {
      const groupCanonical = preGrouped[gi]; // longest name sent to LLM
      const llmTarget = aliasMap.get(groupCanonical.toLowerCase());
      if (llmTarget) {
        for (const member of groups[gi]) {
          aliasMap.set(member.toLowerCase(), llmTarget);
        }
      }
    }

    // Ensure every raw input name has a mapping (fallback to itself if LLM missed it)
    for (const raw of rawNames) {
      const lower = raw.toLowerCase();
      if (!aliasMap.has(lower)) {
        aliasMap.set(lower, raw);
        if (!canonicalNames.includes(raw)) {
          canonicalNames.push(raw);
        }
      }
    }

    console.log(`[EntityNormalization] ${rawNames.length} raw names → ${canonicalNames.length} canonical entities`);
    return { aliasMap, entityTypes, parentMap, canonicalNames };
  } catch (error) {
    console.warn('[EntityNormalization] LLM call failed, using identity mapping:', error);
    return buildIdentityResult(rawNames);
  }
}

/** Fallback: build an identity mapping where every name maps to itself. */
function buildIdentityResult(rawNames: string[]): NormalizationResult {
  const aliasMap = new Map<string, string>();
  const seen = new Set<string>();
  const canonicalNames: string[] = [];

  for (const raw of rawNames) {
    const lower = raw.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      aliasMap.set(lower, raw);
      canonicalNames.push(raw);
    }
  }

  return {
    aliasMap,
    entityTypes: new Map(),
    parentMap: new Map(),
    canonicalNames,
  };
}

/**
 * Extract brand position from bullet list format
 */
function extractBrandPositionFromBulletList(text: string, brandName: string): number | null {
  const lines = text.split('\n');
  let bulletPosition = 0;
  const brandLower = brandName.toLowerCase();

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Detect section headers (reset bullet count)
    // More specific patterns to avoid false resets on description lines
    const isMarkdownHeader = /^#{1,3}\s+/.test(trimmedLine);
    const isBoldHeader = /^\*\*[^*]+\*\*:?\s*$/.test(trimmedLine);
    // Only reset on standalone title lines (all caps or title case, ends with colon, no long descriptions)
    const isStandaloneHeader = /^[A-Z][A-Za-z\s]{2,30}:$/.test(trimmedLine) && !trimmedLine.includes(' - ');

    if (isMarkdownHeader || isBoldHeader || isStandaloneHeader) {
      bulletPosition = 0;
      continue;
    }

    // Match bullet list items: • Company, - Company, * Company
    // Allow lowercase start for brands like "iMerit"
    const bulletMatch = trimmedLine.match(/^[•\-\*]\s+\*?\*?([A-Za-z][A-Za-z0-9\s&\.]+)/);

    if (bulletMatch) {
      bulletPosition++;
      let company = bulletMatch[1].trim();

      // Clean up company name: remove trailing punctuation, markdown, descriptions
      company = company.replace(/[:\*]+$/, '').trim();
      company = company.replace(/\s+[-—–].*$/, '').trim();
      company = company.replace(/\s{2,}.*$/, '').trim();

      // Check if this is the brand
      if (company.toLowerCase() === brandLower) {
        return bulletPosition;
      }
    }
  }

  return null;
}

/**
 * Analyze with OpenAI using Responses API with web_search tool
 */
async function analyzeWithOpenAI(
  prompt: string,
  config: DirectGEOConfig
): Promise<PromptTest> {
  if (!config.apiKeys.openai) {
    console.error('❌ OpenAI API key is missing in config.apiKeys');
    throw new Error('OpenAI API key required for analysis');
  }

  const apiKey = config.apiKeys.openai.trim();
  const openai = new OpenAI({
    apiKey: apiKey,
  });

  try {
    // Use OpenAI Responses API with web_search tool for real-time data
    // Instructions mirror the ChatGPT frontend's query-reformulation behaviour:
    // without them the API often fails to resolve misspelled / ambiguous brand names.
    const instructions = 'You are a helpful assistant that answers user questions by searching the web. When the user asks about a brand, product, or company, if the name appears misspelled or ambiguous, search for the most likely intended brand or product and present accurate, detailed information from official sources.';

    const response = await retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout

      try {
        const res = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            instructions,
            tools: [
              {
                type: 'web_search',
                search_context_size: 'high',
                ...(config.country ? (() => { const geo = buildOpenAIGeoConfig(config.country!); return geo ? { user_location: geo } : {}; })() : {}),
              },
            ],
            tool_choice: { type: 'web_search' }, // Force web search
            input: prompt,
            include: ['web_search_call.action.sources'],
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          const errorText = await res.text();
          const error = new Error(`OpenAI Responses API error: ${res.status} - ${errorText.substring(0, 200)}`);
          (error as any).status = res.status;
          throw error;
        }

        return res;
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          const timeoutError = new Error('Request timeout after 90 seconds');
          (timeoutError as any).code = 'ETIMEDOUT';
          throw timeoutError;
        }
        throw err;
      }
    });

    const data = await response.json();

    // Extract response text, sources, and citations
    let text = '';
    const citations: Citation[] = [];
    const sources: Citation[] = [];

    for (const item of data.output || []) {
      // Get sources from web_search_call
      if (item.type === 'web_search_call' && item.action?.sources) {
        for (const s of item.action.sources) {
          sources.push({
            url: s.url?.replace(/\?utm_source=openai$/, '') || '',
            title: s.title || '',
          });
        }
      }

      // Get response text and citations from message
      if (item.type === 'message') {
        for (const c of item.content || []) {
          if (c.type === 'output_text') {
            text += c.text || '';
            // Extract inline citations from annotations
            for (const a of c.annotations || []) {
              if (a.type === 'url_citation') {
                citations.push({
                  title: a.title || '',
                  url: a.url?.replace(/\?utm_source=openai$/, '') || '',
                });
              }
            }
          }
        }
      }
    }

    // Deduplicate citations and sources
    const uniqueCitations = Array.from(
      new Map(citations.map(c => [c.url, c])).values()
    );
    const uniqueSources = Array.from(
      new Map(sources.map(s => [s.url, s])).values()
    );

    console.log(`[OpenAI] Response received with ${uniqueCitations.length} citations and ${uniqueSources.length} sources`);

    // Analyze the response for brand mentions and sentiment using AI
    const analysisPrompt = `Analyze this AI-generated response to determine brand visibility:

BRAND NAME: ${config.brandName}
WHAT "${config.brandName}" DOES: ${config.description || config.keyProducts?.join(', ') || 'Not specified'}
KNOWN DIRECT COMPETITORS: ${config.competitors?.join(', ') || 'None specified'}

RESPONSE TEXT:
"${text}"

Extract the following information:

1. **brandMentioned**: Is "${config.brandName}" mentioned anywhere in the response? (true/false)

2. **brandPosition**: What numerical ranking/position is "${config.brandName}" given?
   - Look for patterns like "1st", "2nd", "3rd", "#1", "first place", "ranked 1", etc.
   - Extract ONLY the number (1, 2, 3, etc.)
   - **IMPORTANT**: If the response is primarily/entirely dedicated to "${config.brandName}" (e.g., the question was specifically about "${config.brandName}" and the response focuses on answering about them), assign position 1 — the brand IS the featured subject.
   - If the response is a comparison/list and "${config.brandName}" is mentioned but has no explicit ranking, return null
   - Examples:
     * "### 1st: Y Combinator" → 1
     * "2nd Place: Y Combinator" → 2
     * "#3: Y Combinator" → 3
     * Response entirely about Y Combinator (brand-specific question) → 1
     * "Y Combinator is mentioned in a list but no ranking" → null

3. **competitorsMentioned**: Array of companies that DIRECTLY COMPETE with "${config.brandName}" in the same product category (EXCLUDING "${config.brandName}" itself)
   - "${config.brandName}" is: ${config.description || config.keyProducts?.join(', ') || 'a technology company'}${config.industry ? ` (industry: ${config.industry})` : ''}
   - A competitor is a company that offers SIMILAR or SUBSTITUTE products — a realistic alternative a buyer would evaluate
   - For reference, these are known competitors (but do NOT limit extraction to only these): ${config.competitors?.join(', ') || 'None'}
   - Include full company names with proper formatting (e.g., "Techstars", "500 Global", "Scale AI")
   - **CONTEXT-AWARE EXTRACTION**: Determine WHY each company/product is mentioned:
     * If the response RECOMMENDS, COMPARES, or LISTS it as an alternative/option/solution → it IS a competitor, even if it is an API provider, SDK, platform, or fintech service
     * Example: "For real-time balance tracking, consider Flinks, Atto, or Akoya" → all three are competitors
   - EXCLUDE only when a company is mentioned as an incidental building block, NOT as an alternative:
     * Dependencies, libraries, or frameworks used to BUILD products (e.g., React, NumPy, Docker, Redis) — unless the response recommends them as alternatives to "${config.brandName}"
     * Companies in completely different product categories with no functional overlap (e.g., Canva for a GPU cloud company)
     * Infrastructure providers mentioned ONLY as hosting/deployment targets (e.g., "deployed on AWS") — but if recommended as an alternative solution, include it
     * Generic terms, category headings, section labels, feature names, or sentence fragments
   - Return empty array [] if no relevant competitors are mentioned
   - **PRODUCT vs COMPANY naming**: Use the specific product/brand name when it represents a DISTINCT offering being compared (e.g., "Mastercard Cash Flow Analytics" not just "Mastercard"). Only prefer the parent company name when the product is a generic sub-feature.

4. **competitorPositions**: Object mapping competitor names to their positions (if they appear in a ranking)
   - Extract numerical positions for each competitor mentioned
   - Format: { "CompanyName": position_number }
   - Only include competitors that have an explicit position/ranking
   - Examples:
     * "2. Techstars" → { "Techstars": 2 }
     * "3rd: 500 Startups" → { "500 Startups": 3 }
     * From "Top 5: 1. Y Combinator, 2. Techstars, 3. 500 Startups"
       → { "Techstars": 2, "500 Startups": 3 }
   - Return empty object {} if no competitors have positions

5. **competitorSentiments**: Object mapping competitor names to sentiment about them in this specific response
   - Analyze how each competitor is portrayed/discussed in the response text
   - Format: { "CompanyName": "positive" | "neutral" | "negative" }
   - **positive**: Praised, recommended, highlighted positively, described with superlatives ("excellent", "best", "top", "leading", "outstanding")
   - **neutral**: Mentioned factually without strong opinion, listed in rankings without commentary, or described objectively
   - **negative**: Criticized, mentioned negatively, described as inferior or problematic
   - Examples:
     * "Techstars is excellent for mentorship and has strong network" → { "Techstars": "positive" }
     * "500 Global offers $150K for 6% equity" → { "500 Global": "neutral" }
     * "Antler has faced criticism for..." → { "Antler": "negative" }
   - Include ALL competitors from competitorsMentioned array
   - Default to "neutral" if no clear sentiment indicators are present

6. **sentiment**: Overall sentiment toward "${config.brandName}" in this response:
   - "positive" if the response praises, recommends, or ranks highly
   - "neutral" if factual/balanced with no clear opinion
   - "negative" if critical or dismissive

7. **confidence**: How confident are you in this analysis? (0.0 to 1.0)

Return ONLY a valid JSON object with these exact keys:
{
  "brandMentioned": boolean,
  "brandPosition": number or null,
  "competitorsMentioned": string[],
  "competitorPositions": { [key: string]: number },
  "competitorSentiments": { [key: string]: "positive" | "neutral" | "negative" },
  "sentiment": "positive" | "neutral" | "negative",
  "confidence": number,
  "explanation": "brief reasoning"
}`;

    // LLM extraction with retry (max 2 attempts, no regex fallback)
    let analysis: any = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const analysisResponse = await openai.chat.completions.create({
          model: COMPETITOR_EXTRACTION_MODEL,
          messages: [
            {
              role: 'system',
              content: 'You are an expert at analyzing AI responses for brand visibility. Extract position/ranking numbers carefully for both the brand and competitors. Respond ONLY with valid JSON - no markdown, no code blocks, just the JSON object.',
            },
            {
              role: 'user',
              content: analysisPrompt,
            },
          ],
          max_completion_tokens: 2000,
          response_format: { type: "json_object" },
        });

        const analysisText = analysisResponse.choices[0]?.message?.content || '{}';
        const cleanedText = analysisText.replace(/```json\n?|\n?```/g, '').trim();
        analysis = JSON.parse(cleanedText);
        cleanLLMAnalysisNames(analysis);
        break; // Success, exit retry loop
      } catch (parseError) {
        console.warn(`[OpenAI] Extraction attempt ${attempt}/2 failed:`, parseError);
        if (attempt === 2) {
          console.warn('[OpenAI] Both extraction attempts failed, using minimal safe fallback');
          analysis = {
            brandMentioned: await validateBrandMention(text, config.brandName, config.apiKeys.openai),
            brandPosition: null,
            competitorsMentioned: [],
            competitorPositions: {},
            competitorSentiments: {},
            sentiment: 'neutral',
            confidence: 0.3,
          };
        }
      }
    }

    const mergedPositions = analysis.competitorPositions || {};

    // POST-PROCESSING VALIDATION
    // 1. Validate brand mention using regex + LLM judge (more reliable than LLM extraction alone)
    const regexBrandMentioned = await validateBrandMention(text, config.brandName, config.apiKeys.openai);
    const llmBrandMentioned = analysis.brandMentioned || false;

    if (llmBrandMentioned !== regexBrandMentioned) {
      console.warn(`[OpenAI] Brand mention mismatch - LLM: ${llmBrandMentioned}, Regex: ${regexBrandMentioned}. Using validated result.`);
    }

    // 2. Filter competitors to only include valid company names
    const rawCompetitors = analysis.competitorsMentioned || [];
    const validatedCompetitors = filterValidCompetitors(rawCompetitors, config.brandName);

    if (rawCompetitors.length !== validatedCompetitors.length) {
      const filtered = rawCompetitors.filter((c: string) => !validatedCompetitors.includes(c));
      console.warn(`[OpenAI] Filtered ${filtered.length} invalid competitors:`, filtered.slice(0, 5));
    }

    // 3. Filter positions to only include validated competitors with valid range
    const validatedPositions: Record<string, number> = {};
    validatedCompetitors.forEach(comp => {
      const pos = mergedPositions[comp];
      if (pos && pos >= 1 && pos <= MAX_VALID_POSITION) {
        validatedPositions[comp] = pos;
      }
    });

    // 4. Filter sentiments to only include validated competitors
    const validatedSentiments: Record<string, 'positive' | 'neutral' | 'negative'> = {};
    validatedCompetitors.forEach(comp => {
      if (analysis.competitorSentiments?.[comp]) {
        validatedSentiments[comp] = analysis.competitorSentiments[comp];
      }
    });

    return {
      prompt,
      response: text,
      brandMentioned: regexBrandMentioned,
      brandPosition: validateBrandPosition(analysis.brandPosition),
      competitors: validatedCompetitors,
      competitorPositions: validatedPositions,
      competitorSentiments: validatedSentiments,
      sentiment: analysis.sentiment || 'neutral',
      confidence: analysis.confidence || 0.5,
      citations: uniqueCitations,
      sources: uniqueSources,
    };
  } catch (error) {
    console.error(`Error analyzing with OpenAI:`, error);
    throw error;
  }
}

/**
 * Analyze with Perplexity
 */
async function analyzeWithPerplexity(
  prompt: string,
  config: DirectGEOConfig
): Promise<PromptTest> {
  if (!config.apiKeys.perplexity) {
    throw new Error('Perplexity API key required for analysis');
  }

  const apiKey = config.apiKeys.perplexity;
  
  // Perplexity uses OpenAI-compatible API
  const perplexity = new OpenAI({
    apiKey: apiKey.trim(),
    baseURL: 'https://api.perplexity.ai',
  });

  try {
    // Get the provider's response to the prompt
    // Perplexity's sonar models are optimized for search and current information
    // Using sonar-pro for enhanced search quality and citations
    // Reference: https://docs.perplexity.ai/guides/model-cards
    console.log('[Perplexity] Testing prompt:', prompt.substring(0, 60) + '...');
    
    const perplexityGeo = config.country ? buildPerplexityGeoConfig(config.country) : undefined;

    const response: any = await retryWithBackoff(async () => {
      return perplexity.chat.completions.create({
        model: 'sonar-pro', // Pro model with enhanced search and citations
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
        ...(perplexityGeo ? {
          web_search_options: { user_location: perplexityGeo.user_location },
          search_language_filter: perplexityGeo.search_language_filter,
        } : {}),
      } as any);
    }, 4, 2000);

    const text = response.choices[0]?.message?.content || '';
    console.log('[Perplexity] Response received:', text.substring(0, 100) + '...');
    
    // Extract sources from Perplexity's search_results (rich data: title, url, date, snippet)
    // and citations (bare URL strings referenced inline in the response).
    // Perplexity docs: search_results is the primary field; citations is deprecated but still sent.
    const citations: Citation[] = [];
    const sources: Citation[] = [];

    if (response.search_results && Array.isArray(response.search_results)) {
      for (const sr of response.search_results) {
        if (sr && sr.url) {
          sources.push({
            url: sr.url,
            title: sr.title,
            snippet: sr.snippet,
            position: sources.length + 1,
          });
        }
      }
      console.log(`[Perplexity] Extracted ${sources.length} search_results as sources`);
    }

    if (response.citations && Array.isArray(response.citations)) {
      for (const [index, url] of response.citations.entries()) {
        if (typeof url === 'string') {
          // Enrich with title/snippet from search_results when available
          const matchingSource = sources.find(s => s.url === url);
          citations.push({
            url,
            title: matchingSource?.title,
            snippet: matchingSource?.snippet,
            position: index + 1,
          });
        }
      }
      console.log(`[Perplexity] Extracted ${citations.length} inline citations`);
    }

    // Use OpenAI to analyze the Perplexity response for brand mentions
    if (!config.apiKeys.openai) {
      throw new Error('OpenAI API key required for analyzing Perplexity responses');
    }

    const openai = new OpenAI({
      apiKey: config.apiKeys.openai.trim(),
    });

    // Analyze the response for brand mentions and sentiment using AI
    const analysisPrompt = `Analyze this AI-generated response to determine brand visibility:

BRAND NAME: ${config.brandName}
WHAT "${config.brandName}" DOES: ${config.description || config.keyProducts?.join(', ') || 'Not specified'}${config.industry ? `\nINDUSTRY: ${config.industry}` : ''}
KNOWN DIRECT COMPETITORS: ${config.competitors?.join(', ') || 'None specified'}

RESPONSE TEXT:
"${text}"

Extract the following information:

1. **brandMentioned**: Is "${config.brandName}" mentioned anywhere in the response? (true/false)

2. **brandPosition**: What numerical ranking/position is "${config.brandName}" given?
   - Look for patterns like "1st", "2nd", "3rd", "#1", "first place", "ranked 1", etc.
   - Extract ONLY the number (1, 2, 3, etc.)
   - **IMPORTANT**: If the response is primarily/entirely dedicated to "${config.brandName}" (brand-specific question), assign position 1.
   - If the response is a comparison/list and "${config.brandName}" is mentioned but has no explicit ranking, return null

3. **competitorsMentioned**: Array of companies that DIRECTLY COMPETE with "${config.brandName}" in the same product category (EXCLUDING "${config.brandName}" itself)
   - A competitor is a company that offers SIMILAR or SUBSTITUTE products — a realistic alternative a buyer would evaluate
   - For reference, these are known competitors (but do NOT limit extraction to only these): ${config.competitors?.join(', ') || 'None'}
   - Include full company names with proper formatting (e.g., "Techstars", "500 Global", "Scale AI")
   - **CONTEXT-AWARE EXTRACTION**: Determine WHY each company/product is mentioned:
     * If the response RECOMMENDS, COMPARES, or LISTS it as an alternative/option/solution → it IS a competitor, even if it is an API provider, SDK, platform, or fintech service
     * Example: "For real-time balance tracking, consider Flinks, Atto, or Akoya" → all three are competitors
   - EXCLUDE only when a company is mentioned as an incidental building block, NOT as an alternative:
     * Dependencies, libraries, or frameworks used to BUILD products (e.g., React, NumPy, Docker, Redis) — unless the response recommends them as alternatives to "${config.brandName}"
     * Companies in completely different product categories with no functional overlap (e.g., Canva for a GPU cloud company)
     * Infrastructure providers mentioned ONLY as hosting/deployment targets (e.g., "deployed on AWS") — but if recommended as an alternative solution, include it
     * Generic terms, category headings, section labels, feature names, or sentence fragments
   - Return empty array [] if no relevant competitors are mentioned
   - **PRODUCT vs COMPANY naming**: Use the specific product/brand name when it represents a DISTINCT offering being compared (e.g., "Mastercard Cash Flow Analytics" not just "Mastercard"). Only prefer the parent company name when the product is a generic sub-feature.

4. **competitorPositions**: Object mapping competitor names to their positions { "CompanyName": number }

5. **competitorSentiments**: Object mapping competitor names to sentiment about them in this specific response
   - Analyze how each competitor is portrayed/discussed in the response text
   - Format: { "CompanyName": "positive" | "neutral" | "negative" }
   - **positive**: Praised, recommended, highlighted positively, described with superlatives ("excellent", "best", "top", "leading", "outstanding")
   - **neutral**: Mentioned factually without strong opinion, listed in rankings without commentary, or described objectively
   - **negative**: Criticized, mentioned negatively, described as inferior or problematic
   - Examples:
     * "Techstars is excellent for mentorship and has strong network" → { "Techstars": "positive" }
     * "500 Global offers $150K for 6% equity" → { "500 Global": "neutral" }
     * "Antler has faced criticism for..." → { "Antler": "negative" }
   - Include ALL competitors from competitorsMentioned array
   - Default to "neutral" if no clear sentiment indicators are present

6. **sentiment**: Overall sentiment toward "${config.brandName}" in this response:
   - "positive" if the response praises, recommends, or ranks highly
   - "neutral" if factual/balanced with no clear opinion
   - "negative" if critical or dismissive

7. **confidence**: How confident are you in this analysis? (0.0 to 1.0)

Return ONLY a valid JSON object with these exact keys:
{
  "brandMentioned": boolean,
  "brandPosition": number or null,
  "competitorsMentioned": string[],
  "competitorPositions": { [key: string]: number },
  "competitorSentiments": { [key: string]: "positive" | "neutral" | "negative" },
  "sentiment": "positive" | "neutral" | "negative",
  "confidence": number,
  "explanation": "brief reasoning"
}`;

    // LLM extraction with retry (max 2 attempts, no regex fallback)
    let analysis: any = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const analysisResponse = await openai.chat.completions.create({
          model: COMPETITOR_EXTRACTION_MODEL,
          messages: [
            {
              role: 'system',
              content: 'You are an expert at analyzing AI responses for brand visibility. Extract position/ranking numbers carefully for both the brand and competitors. Respond ONLY with valid JSON - no markdown, no code blocks, just the JSON object.',
            },
            {
              role: 'user',
              content: analysisPrompt,
            },
          ],
          max_completion_tokens: 2000,
          response_format: { type: "json_object" },
        });

        const analysisText = analysisResponse.choices[0]?.message?.content || '{}';
        const cleanedText = analysisText.replace(/```json\n?|\n?```/g, '').trim();
        analysis = JSON.parse(cleanedText);
        cleanLLMAnalysisNames(analysis);
        break;
      } catch (parseError) {
        console.warn(`[Perplexity] Extraction attempt ${attempt}/2 failed:`, parseError);
        if (attempt === 2) {
          console.warn('[Perplexity] Both extraction attempts failed, using minimal safe fallback');
          analysis = {
            brandMentioned: await validateBrandMention(text, config.brandName, config.apiKeys.openai),
            brandPosition: null,
            competitorsMentioned: [],
            competitorPositions: {},
            competitorSentiments: {},
            sentiment: 'neutral',
            confidence: 0.3,
          };
        }
      }
    }

    const mergedPositions = analysis.competitorPositions || {};

    // CRITICAL: Validate brand mention using regex + LLM judge
    const regexBrandMentioned = await validateBrandMention(text, config.brandName, config.apiKeys.openai);

    // CRITICAL: Filter out generic terms that aren't real companies
    const validatedCompetitors = filterValidCompetitors(analysis.competitorsMentioned || [], config.brandName);

    // Filter positions and sentiments to only include validated competitors
    const validatedPositions: Record<string, number> = {};
    validatedCompetitors.forEach(comp => {
      const pos = mergedPositions[comp];
      if (pos && pos >= 1 && pos <= MAX_VALID_POSITION) validatedPositions[comp] = pos;
    });
    const validatedSentiments: Record<string, 'positive' | 'neutral' | 'negative'> = {};
    validatedCompetitors.forEach(comp => {
      if (analysis.competitorSentiments?.[comp]) validatedSentiments[comp] = analysis.competitorSentiments[comp];
    });

    return {
      prompt,
      response: text,
      brandMentioned: regexBrandMentioned,
      brandPosition: validateBrandPosition(analysis.brandPosition),
      competitors: validatedCompetitors,
      competitorPositions: validatedPositions,
      competitorSentiments: validatedSentiments,
      sentiment: analysis.sentiment || 'neutral',
      confidence: analysis.confidence || 0.5,
      citations,
      sources,
    };
  } catch (error: any) {
    console.error(`❌ Error analyzing with Perplexity:`, error.message || error);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, JSON.stringify(error.response.data, null, 2));
    }
    if (error.code) {
      console.error(`   Error code:`, error.code);
    }
    throw error;
  }
}

/**
 * Analyze with Anthropic (Claude)
 */
async function analyzeWithAnthropic(
  prompt: string,
  config: DirectGEOConfig
): Promise<PromptTest> {
  if (!config.apiKeys.anthropic) {
    throw new Error('Anthropic API key required for analysis');
  }

  const apiKey = config.apiKeys.anthropic;
  const anthropic = new Anthropic({
    apiKey: apiKey.trim(),
  });

  try {
    console.log('[Anthropic] Testing prompt:', prompt.substring(0, 60) + '...');

    const response = await retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      try {
        const res = await anthropic.messages.create(
          {
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 8192,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
            tools: [
              {
                type: 'web_search_20250305',
                name: 'web_search',
                ...(config.country ? (() => { const geo = buildClaudeGeoConfig(config.country!); return geo ? { user_location: geo } : {}; })() : {}),
              } as any,
            ],
          },
          {
            signal: controller.signal as any,
          }
        );
        clearTimeout(timeoutId);
        return res;
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          const timeoutError = new Error('Request timeout after 90 seconds');
          (timeoutError as any).code = 'ETIMEDOUT';
          throw timeoutError;
        }
        if (err.status) {
          (err as any).status = err.status;
        }
        throw err;
      }
    });

    let text = '';
    const citations: Citation[] = [];
    const sources: Citation[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        text += block.text;
        const textBlock = block as any;
        if (textBlock.citations && Array.isArray(textBlock.citations)) {
          for (const citation of textBlock.citations) {
            if (citation.type === 'web_search_result_location') {
              citations.push({
                url: citation.url || '',
                title: citation.title,
                snippet: citation.cited_text,
                position: citations.length + 1,
              });
            }
          }
        }
      }
      if (block.type === 'web_search_tool_result') {
        const resultBlock = block as any;
        if (resultBlock.content && Array.isArray(resultBlock.content)) {
          for (const result of resultBlock.content) {
            if (result.type === 'web_search_result' && result.url) {
              const existingUrls = sources.map(c => c.url);
              if (!existingUrls.includes(result.url)) {
                sources.push({
                  url: result.url,
                  title: result.title,
                  position: sources.length + 1,
                });
              }
            }
          }
        }
      }
    }

    console.log('[Anthropic] Response received:', text.substring(0, 100) + '...');

    if (!config.apiKeys.openai) {
      throw new Error('OpenAI API key required for analyzing Anthropic responses');
    }

    const openai = new OpenAI({
      apiKey: config.apiKeys.openai.trim(),
    });

    // Claude extraction prompt
    const analysisPrompt = `Analyze this AI-generated response to determine brand visibility:

BRAND NAME: ${config.brandName}
WHAT "${config.brandName}" DOES: ${config.description || config.keyProducts?.join(', ') || 'Not specified'}${config.industry ? `\nINDUSTRY: ${config.industry}` : ''}
KNOWN DIRECT COMPETITORS: ${config.competitors?.join(', ') || 'None specified'}

RESPONSE TEXT:
"${text}"

Extract the following information:

1. **brandMentioned**: Is "${config.brandName}" mentioned anywhere in the response? (true/false)
2. **brandPosition**: What numerical ranking/position is "${config.brandName}" given? Extract ONLY the number (1, 2, 3, etc.) or null if no explicit position. IMPORTANT: If the response is primarily/entirely dedicated to "${config.brandName}" (brand-specific question), assign position 1.
3. **competitorsMentioned**: Array of companies that DIRECTLY COMPETE with "${config.brandName}" in the same product category (EXCLUDING "${config.brandName}")
   - A competitor offers SIMILAR or SUBSTITUTE products — a realistic alternative a buyer would evaluate
   - For reference, these are known competitors (but do NOT limit extraction to only these): ${config.competitors?.join(', ') || 'None'}
   - Include full company names with proper formatting (e.g., "Techstars", "500 Global", "Scale AI")
   - **CONTEXT-AWARE**: If the response RECOMMENDS or COMPARES a company/API/SDK as an alternative → it IS a competitor, include it. EXCLUDE only: dependencies/libraries used as building blocks (NOT recommended as alternatives), companies in unrelated product categories, infrastructure mentioned ONLY as hosting (NOT as alternative solutions), generic terms/category headings/feature names
   - **PRODUCT vs COMPANY**: Use the specific product name when it is a distinct offering being compared (e.g., "Mastercard Cash Flow Analytics" not "Mastercard"). Only prefer parent company when the product is a generic sub-feature.
   - Return empty array [] if no relevant competitors are mentioned
4. **competitorPositions**: Object mapping competitor names to their positions { "CompanyName": number }
5. **competitorSentiments**: Object mapping competitor names to sentiment { "CompanyName": "positive" | "neutral" | "negative" }
6. **sentiment**: Overall sentiment toward "${config.brandName}" ("positive" | "neutral" | "negative")
7. **confidence**: How confident are you in this analysis? (0.0 to 1.0)

Return ONLY a valid JSON object with these exact keys:
{
  "brandMentioned": boolean,
  "brandPosition": number or null,
  "competitorsMentioned": string[],
  "competitorPositions": { [key: string]: number },
  "competitorSentiments": { [key: string]: "positive" | "neutral" | "negative" },
  "sentiment": "positive" | "neutral" | "negative",
  "confidence": number
}`;

    // LLM extraction with retry (max 2 attempts, no regex fallback)
    let analysis: any = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const analysisResponse = await openai.chat.completions.create({
          model: COMPETITOR_EXTRACTION_MODEL,
          messages: [
            {
              role: 'system',
              content: 'You are an expert at analyzing AI responses for brand visibility. Respond ONLY with valid JSON.',
            },
            {
              role: 'user',
              content: analysisPrompt,
            },
          ],
          max_completion_tokens: 2000,
          response_format: { type: "json_object" },
        });

        const analysisText = analysisResponse.choices[0]?.message?.content || '{}';
        const cleanedText = analysisText.replace(/```json\n?|\n?```/g, '').trim();
        analysis = JSON.parse(cleanedText);
        cleanLLMAnalysisNames(analysis);
        break;
      } catch (parseError) {
        console.warn(`[Anthropic] Extraction attempt ${attempt}/2 failed:`, parseError);
        if (attempt === 2) {
          console.warn('[Anthropic] Both extraction attempts failed, using minimal safe fallback');
          analysis = {
            brandMentioned: await validateBrandMention(text, config.brandName, config.apiKeys.openai),
            brandPosition: null,
            competitorsMentioned: [],
            competitorPositions: {},
            competitorSentiments: {},
            sentiment: 'neutral',
            confidence: 0.3,
          };
        }
      }
    }

    const mergedPositions = analysis.competitorPositions || {};

    const regexBrandMentioned = await validateBrandMention(text, config.brandName, config.apiKeys.openai);
    const validatedCompetitors = filterValidCompetitors(analysis.competitorsMentioned || [], config.brandName);

    // Filter positions and sentiments to only include validated competitors
    const validatedPositions: Record<string, number> = {};
    validatedCompetitors.forEach(comp => {
      const pos = mergedPositions[comp];
      if (pos && pos >= 1 && pos <= MAX_VALID_POSITION) validatedPositions[comp] = pos;
    });
    const validatedSentiments: Record<string, 'positive' | 'neutral' | 'negative'> = {};
    validatedCompetitors.forEach(comp => {
      if (analysis.competitorSentiments?.[comp]) validatedSentiments[comp] = analysis.competitorSentiments[comp];
    });

    return {
      prompt,
      response: text,
      brandMentioned: regexBrandMentioned,
      brandPosition: validateBrandPosition(analysis.brandPosition),
      competitors: validatedCompetitors,
      competitorPositions: validatedPositions,
      competitorSentiments: validatedSentiments,
      sentiment: analysis.sentiment || 'neutral',
      confidence: analysis.confidence || 0.5,
      citations,
      sources,
    };
  } catch (error: any) {
    console.error(`❌ [Anthropic] Error:`, error.message || error);
    if (error.status === 405) {
      throw new Error(`Anthropic API error: Method Not Allowed (405). Ensure web_search is enabled.`);
    }
    throw error;
  }
}

/**
 * Checks if an error is a retryable overload/rate-limit error (503, 429).
 */
function isModelOverloadError(error: any): boolean {
  const status = error.status || error.statusCode || error.httpCode;
  return status === 503 || status === 429;
}

/**
 * Calls Gemini via SDK with primary→fallback model cascade.
 * Tries GEMINI_PRIMARY_MODEL first; if it fails with 503/429 after retries,
 * falls back through GEMINI_FALLBACK_MODEL then GEMINI_FALLBACK_MODEL_LITE.
 */
async function callGeminiSdkWithFallback(
  genAI: InstanceType<typeof GoogleGenerativeAI>,
  prompt: string
): Promise<{ text: string; groundingMetadata: any; usedModel: string }> {
  const modelsToTry = [GEMINI_PRIMARY_MODEL, GEMINI_FALLBACK_MODEL, GEMINI_FALLBACK_MODEL_LITE];

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        tools: [{ googleSearch: {} }] as any,
      });

      const result = await retryWithBackoff(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);

        try {
          const res = await model.generateContent(prompt);
          clearTimeout(timeoutId);
          return res;
        } catch (err: any) {
          clearTimeout(timeoutId);
          if (err.name === 'AbortError') {
            const timeoutError = new Error('Request timeout after 90 seconds');
            (timeoutError as any).code = 'ETIMEDOUT';
            throw timeoutError;
          }
          if (err.status || err.statusCode) {
            (err as any).status = err.status || err.statusCode;
          }
          throw err;
        }
      });

      const response = result.response;
      return {
        text: response.text(),
        groundingMetadata: (response as any).candidates?.[0]?.groundingMetadata,
        usedModel: modelName,
      };
    } catch (err: any) {
      const isLast = modelName === GEMINI_FALLBACK_MODEL_LITE;
      if (!isLast && isModelOverloadError(err)) {
        const nextModel = modelName === GEMINI_PRIMARY_MODEL ? GEMINI_FALLBACK_MODEL : GEMINI_FALLBACK_MODEL_LITE;
        console.warn(`[Google] Model ${modelName} unavailable (${err.status}), falling back to ${nextModel}`);
        continue;
      }
      throw err; // Non-overload error or all models exhausted
    }
  }

  throw new Error(`All Gemini models exhausted (${[GEMINI_PRIMARY_MODEL, GEMINI_FALLBACK_MODEL, GEMINI_FALLBACK_MODEL_LITE].join(', ')})`);
}

/**
 * Analyze with Google (Gemini)
 * Uses gemini-3-flash-preview as primary with gemini-2.5-flash and gemini-2.5-flash-lite as fallbacks.
 * Each model attempt includes exponential backoff via retryWithBackoff.
 */
async function analyzeWithGoogle(
  prompt: string,
  config: DirectGEOConfig
): Promise<PromptTest> {
  if (!config.apiKeys.google) {
    throw new Error('Google API key required for analysis');
  }

  const apiKey = config.apiKeys.google;
  const genAI = new GoogleGenerativeAI(apiKey.trim());

  try {
    console.log('[Google] Testing prompt:', prompt.substring(0, 60) + '...');

    // Gemini geo-targeting: use BrightData proxy for non-US countries
    const needsProxy = config.country ? isGeminiProxyNeeded(config.country) : false;
    let text = '';
    let groundingMetadata: any = null;
    let usedModel = GEMINI_PRIMARY_MODEL;

    if (needsProxy && config.country) {
      // Proxied REST API call for geo-targeting
      const proxyUrl = buildGeminiProxyUrl(config.country);

      if (proxyUrl) {
        console.log(`[Google] Using BrightData proxy for country: ${config.country}`);
        const { HttpsProxyAgent } = await import('https-proxy-agent');
        const agent = new HttpsProxyAgent(proxyUrl);

        // Try primary model, fall back through stable models on 503/429
        const modelsToTry = [GEMINI_PRIMARY_MODEL, GEMINI_FALLBACK_MODEL, GEMINI_FALLBACK_MODEL_LITE];
        let lastError: any = null;

        for (const modelName of modelsToTry) {
          try {
            const endpoint = buildGeminiRestEndpoint(modelName);
            const restResult = await retryWithBackoff(async () => {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 90000);

              try {
                const res = await fetch(endpoint, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    tools: [{ googleSearch: {} }],
                  }),
                  signal: controller.signal,
                  // @ts-expect-error -- Node fetch accepts agent for proxy routing
                  agent,
                });
                clearTimeout(timeoutId);
                if (!res.ok) {
                  const errText = await res.text();
                  const error = new Error(`Gemini proxied API error: ${res.status} - ${errText.substring(0, 200)}`);
                  (error as any).status = res.status;
                  throw error;
                }
                return res.json();
              } catch (err: any) {
                clearTimeout(timeoutId);
                if (err.name === 'AbortError') {
                  const timeoutError = new Error('Request timeout after 90 seconds');
                  (timeoutError as any).code = 'ETIMEDOUT';
                  throw timeoutError;
                }
                throw err;
              }
            });

            const candidate = restResult.candidates?.[0];
            text = candidate?.content?.parts?.map((p: any) => p.text || '').join('') || '';
            groundingMetadata = candidate?.groundingMetadata;
            usedModel = modelName;
            lastError = null;
            break; // Success — stop trying models
          } catch (err: any) {
            lastError = err;
            const isLast = modelName === GEMINI_FALLBACK_MODEL_LITE;
            if (!isLast && isModelOverloadError(err)) {
              const nextModel = modelName === GEMINI_PRIMARY_MODEL ? GEMINI_FALLBACK_MODEL : GEMINI_FALLBACK_MODEL_LITE;
              console.warn(`[Google] Model ${modelName} unavailable (${err.status}), falling back to ${nextModel}`);
              continue;
            }
            throw err; // Non-overload error or all models exhausted
          }
        }
        if (lastError) throw lastError;
      } else {
        // BrightData not configured — fall back to SDK (no geo)
        console.warn('[Google] BrightData not configured, falling back to SDK without geo-targeting');
        const sdkResult = await callGeminiSdkWithFallback(genAI, prompt);
        text = sdkResult.text;
        groundingMetadata = sdkResult.groundingMetadata;
        usedModel = sdkResult.usedModel;
      }
    } else {
      // US or no country — use SDK directly
      const sdkResult = await callGeminiSdkWithFallback(genAI, prompt);
      text = sdkResult.text;
      groundingMetadata = sdkResult.groundingMetadata;
      usedModel = sdkResult.usedModel;
    }

    console.log(`[Google] Response received (model: ${usedModel}):`, text.substring(0, 100) + '...');

    // Extract raw citations from grounding metadata
    const rawCitations: Citation[] = [];

    if (groundingMetadata?.groundingChunks) {
      groundingMetadata.groundingChunks.forEach((chunk: any, idx: number) => {
        if (chunk.web) {
          rawCitations.push({
            url: chunk.web.uri || '',
            title: chunk.web.title,
            position: idx + 1,
          });
        }
      });
    }

    // Resolve Gemini grounding redirect URLs to get actual source URLs
    // Concurrency=2 to reduce pressure on Google's redirect endpoint
    // (Gemini prompts already run at concurrency=3, so 2 workers × 3 prompts = 6 max concurrent)
    const citations = rawCitations.length > 0
      ? await resolveGeminiGroundingUrls(rawCitations, 2)
      : [];

    if (citations.length > 0) {
      console.log(`[Google] Resolved ${citations.length} grounding URLs to actual sources`);
    }

    const searchQueries: string[] = [];
    if (groundingMetadata?.webSearchQueries) {
      searchQueries.push(...groundingMetadata.webSearchQueries);
    }

    if (!config.apiKeys.openai) {
      throw new Error('OpenAI API key required for analyzing Google responses');
    }

    const openai = new OpenAI({
      apiKey: config.apiKeys.openai.trim(),
    });

    // Gemini extraction prompt
    const analysisPrompt = `Analyze this AI-generated response to determine brand visibility:

BRAND NAME: ${config.brandName}
WHAT "${config.brandName}" DOES: ${config.description || config.keyProducts?.join(', ') || 'Not specified'}${config.industry ? `\nINDUSTRY: ${config.industry}` : ''}
KNOWN DIRECT COMPETITORS: ${config.competitors?.join(', ') || 'None specified'}

RESPONSE TEXT:
"${text}"

Extract the following information:

1. **brandMentioned**: Is "${config.brandName}" mentioned anywhere in the response? (true/false)
2. **brandPosition**: What numerical ranking/position is "${config.brandName}" given? Extract ONLY the number (1, 2, 3, etc.) or null if no explicit position. IMPORTANT: If the response is primarily/entirely dedicated to "${config.brandName}" (brand-specific question), assign position 1.
3. **competitorsMentioned**: Array of companies that DIRECTLY COMPETE with "${config.brandName}" in the same product category (EXCLUDING "${config.brandName}")
   - A competitor offers SIMILAR or SUBSTITUTE products — a realistic alternative a buyer would evaluate
   - For reference, these are known competitors (but do NOT limit extraction to only these): ${config.competitors?.join(', ') || 'None'}
   - Include full company names with proper formatting (e.g., "Techstars", "500 Global", "Scale AI")
   - **CONTEXT-AWARE**: If the response RECOMMENDS or COMPARES a company/API/SDK as an alternative → it IS a competitor, include it. EXCLUDE only: dependencies/libraries used as building blocks (NOT recommended as alternatives), companies in unrelated product categories, infrastructure mentioned ONLY as hosting (NOT as alternative solutions), generic terms/category headings/feature names
   - **PRODUCT vs COMPANY**: Use the specific product name when it is a distinct offering being compared (e.g., "Mastercard Cash Flow Analytics" not "Mastercard"). Only prefer parent company when the product is a generic sub-feature.
   - Return empty array [] if no relevant competitors are mentioned
4. **competitorPositions**: Object mapping competitor names to their positions { "CompanyName": number }
5. **competitorSentiments**: Object mapping competitor names to sentiment { "CompanyName": "positive" | "neutral" | "negative" }
6. **sentiment**: Overall sentiment toward "${config.brandName}" ("positive" | "neutral" | "negative")
7. **confidence**: How confident are you in this analysis? (0.0 to 1.0)

Return ONLY a valid JSON object with these exact keys:
{
  "brandMentioned": boolean,
  "brandPosition": number or null,
  "competitorsMentioned": string[],
  "competitorPositions": { [key: string]: number },
  "competitorSentiments": { [key: string]: "positive" | "neutral" | "negative" },
  "sentiment": "positive" | "neutral" | "negative",
  "confidence": number
}`;

    // LLM extraction with retry (max 2 attempts, no regex fallback)
    let analysis: any = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const analysisResponse = await openai.chat.completions.create({
          model: COMPETITOR_EXTRACTION_MODEL,
          messages: [
            {
              role: 'system',
              content: 'You are an expert at analyzing AI responses for brand visibility. Respond ONLY with valid JSON.',
            },
            {
              role: 'user',
              content: analysisPrompt,
            },
          ],
          max_completion_tokens: 2000,
          response_format: { type: "json_object" },
        });

        const analysisText = analysisResponse.choices[0]?.message?.content || '{}';
        const cleanedText = analysisText.replace(/```json\n?|\n?```/g, '').trim();
        analysis = JSON.parse(cleanedText);
        cleanLLMAnalysisNames(analysis);
        break;
      } catch (parseError) {
        console.warn(`[Google] Extraction attempt ${attempt}/2 failed:`, parseError);
        if (attempt === 2) {
          console.warn('[Google] Both extraction attempts failed, using minimal safe fallback');
          analysis = {
            brandMentioned: await validateBrandMention(text, config.brandName, config.apiKeys.openai),
            brandPosition: null,
            competitorsMentioned: [],
            competitorPositions: {},
            competitorSentiments: {},
            sentiment: 'neutral',
            confidence: 0.3,
          };
        }
      }
    }

    const mergedPositions = analysis.competitorPositions || {};

    const regexBrandMentioned = await validateBrandMention(text, config.brandName, config.apiKeys.openai);
    const validatedCompetitors = filterValidCompetitors(analysis.competitorsMentioned || [], config.brandName);

    // Filter positions and sentiments to only include validated competitors
    const validatedPositions: Record<string, number> = {};
    validatedCompetitors.forEach(comp => {
      const pos = mergedPositions[comp];
      if (pos && pos >= 1 && pos <= MAX_VALID_POSITION) validatedPositions[comp] = pos;
    });
    const validatedSentiments: Record<string, 'positive' | 'neutral' | 'negative'> = {};
    validatedCompetitors.forEach(comp => {
      if (analysis.competitorSentiments?.[comp]) validatedSentiments[comp] = analysis.competitorSentiments[comp];
    });

    return {
      prompt,
      response: text,
      brandMentioned: regexBrandMentioned,
      brandPosition: validateBrandPosition(analysis.brandPosition),
      competitors: validatedCompetitors,
      competitorPositions: validatedPositions,
      competitorSentiments: validatedSentiments,
      sentiment: analysis.sentiment || 'neutral',
      confidence: analysis.confidence || 0.5,
      citations,
      searchQueries,
    };
  } catch (error: any) {
    const status = error.status || error.statusCode;
    const isOverload = status === 503 || status === 429;
    console.error(
      `❌ [Google] Error (all models failed: ${GEMINI_PRIMARY_MODEL}, ${GEMINI_FALLBACK_MODEL}, ${GEMINI_FALLBACK_MODEL_LITE}):`,
      isOverload ? `Service overloaded (${status})` : error.message || error
    );
    throw error;
  }
}

/**
 * Calculate brand visibility metrics
 */
function calculateBrandMetrics(tests: PromptTest[]): {
  visibilityScore: number;
  averagePosition: number;
  mentionRate: number;
  sentiment: 'positive' | 'neutral' | 'negative';
} {
  const totalTests = tests.length;
  const mentionedTests = tests.filter(t => t.brandMentioned);
  const mentionRate = mentionedTests.length / totalTests;
  
  // Calculate average position (only for tests where brand was mentioned with valid position)
  // Position must be defined and not null to be valid (consistent with visibility-scoring.service.ts)
  const rankedTests = mentionedTests.filter(t =>
    t.brandPosition !== undefined &&
    t.brandPosition !== null &&
    t.brandPosition > 0
  );
  const averagePosition = rankedTests.length > 0
    ? Math.round((rankedTests.reduce((sum, t) => sum + (t.brandPosition ?? 0), 0) / rankedTests.length) * 10) / 10
    : 0;

  // Calculate visibility score using per-test Firegeo average (0-100)
  // Each test: 0 if not mentioned, 50 + positionBonus if mentioned
  // Average across ALL tests (properly weights mention rate and position)
  const firegeoScores = tests.map(t => {
    if (!t.brandMentioned) return 0;
    let score = 50;
    if (t.brandPosition !== undefined && t.brandPosition !== null && t.brandPosition > 0) {
      score += Math.max(0, (10 - t.brandPosition) / 10) * 50;
    }
    return Math.round(score);
  });
  const visibilityScore = firegeoScores.length > 0
    ? firegeoScores.reduce((a, b) => a + b, 0) / firegeoScores.length
    : 0;
  
  // Calculate overall sentiment
  const sentimentCounts = {
    positive: tests.filter(t => t.sentiment === 'positive').length,
    neutral: tests.filter(t => t.sentiment === 'neutral').length,
    negative: tests.filter(t => t.sentiment === 'negative').length,
  };
  
  const dominantSentiment = Object.entries(sentimentCounts)
    .sort(([,a], [,b]) => b - a)[0][0] as 'positive' | 'neutral' | 'negative';

  return {
    visibilityScore: Math.round(visibilityScore),
    averagePosition,
    mentionRate,
    sentiment: dominantSentiment,
  };
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(
  config: DirectGEOConfig,
  analyses: ProviderAnalysis[]
): string[] {
  const recommendations: string[] = [];
  const overallMentionRate = analyses.reduce((sum, a) => sum + a.mentionRate, 0) / analyses.length;
  const overallScore = analyses.reduce((sum, a) => sum + a.brandVisibilityScore, 0) / analyses.length;

  if (overallMentionRate < 0.3) {
    recommendations.push(`Increase content marketing and thought leadership to improve AI model awareness of ${config.brandName}`);
  }

  if (overallScore < 40) {
    recommendations.push(`Create more comprehensive documentation and case studies to help AI models better understand your value proposition`);
  }

  const avgPosition = analyses.reduce((sum, a) => sum + a.averagePosition, 0) / analyses.length;
  if (avgPosition > 5) {
    recommendations.push(`Focus on building authority through industry partnerships and customer testimonials to improve ranking positions`);
  }

  // Add competitor-specific recommendations
  const competitorMentions = analyses.flatMap(a => 
    a.promptTests.flatMap(t => t.competitors)
  ).reduce((acc, comp) => {
    acc[comp] = (acc[comp] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topCompetitor = Object.entries(competitorMentions)
    .sort(([,a], [,b]) => b - a)[0]?.[0];

  if (topCompetitor) {
    recommendations.push(`Study ${topCompetitor}'s content strategy and positioning to understand why they appear more frequently in AI responses`);
  }

  if (config.keyProducts?.length) {
    recommendations.push(`Create detailed product comparison pages and feature matrices to help AI models better categorize and recommend ${config.keyProducts.join(' and ')}`);
  }

  return recommendations;
}

/**
 * Main function to run direct GEO analysis
 */
export async function runDirectGEOAnalysis(config: DirectGEOConfig): Promise<DirectGEOResult> {
  console.log(`Starting direct GEO analysis for ${config.brandName}...`);
  
  // Generate test prompts - ALL 50 from PromptGeneration.txt specification
  const prompts = await generateGEOPrompts(config);
  console.log(`Generated ${prompts.length} test prompts`);
  
  // Get available providers - use all configured providers
  const availableProviders: string[] = [];
  if (config.apiKeys.openai) availableProviders.push('openai');
  if (config.apiKeys.anthropic) availableProviders.push('anthropic');
  if (config.apiKeys.google) availableProviders.push('google');
  if (config.apiKeys.perplexity) availableProviders.push('perplexity');
  
  if (availableProviders.length === 0) {
    throw new Error('At least one API key required (OpenAI, Anthropic, Google, or Perplexity)');
  }
  
  console.log(`Testing with ${availableProviders.length} provider(s): ${availableProviders.join(', ')}`);
  console.log(`Distributing ${prompts.length} prompts across providers...`);
  
  const analyses: ProviderAnalysis[] = [];
  
  // Calculate prompts per provider (distribute all 50 prompts evenly)
  const promptsPerProvider = Math.ceil(prompts.length / availableProviders.length);
  console.log(`Each provider will test ~${promptsPerProvider} prompts`);
  
  // Run analysis for each provider with its assigned prompts IN PARALLEL
  const providerAnalysisPromises = availableProviders.map(async (provider, i) => {
    // Get this provider's subset of prompts
    const startIdx = i * promptsPerProvider;
    const endIdx = Math.min(startIdx + promptsPerProvider, prompts.length);
    const providerPrompts = prompts.slice(startIdx, endIdx);
    
    console.log(`\n🔍 Analyzing with ${provider}: testing ${providerPrompts.length} prompts (${startIdx + 1}-${endIdx})...`);
    
    // Gemini needs throttling (503 overload errors), Perplexity has strict rate limits (429),
    // Anthropic Tier 1 has 30K input tokens/min — serialize calls to avoid exhausting budget
    // Anthropic: no pre-emptive throttle — retryWithBackoff handles 429s naturally
    const concurrency = provider === 'google' ? 3 : provider === 'perplexity' ? 2 : providerPrompts.length;
    const promptTestResults = await mapWithConcurrency(
      providerPrompts,
      async (promptObj) => {
        const promptText = typeof promptObj === 'string' ? promptObj : promptObj.text;
        const promptCategory = typeof promptObj === 'object' ? promptObj.category : undefined;

        try {
          const test = await analyzePromptWithProvider(promptText, provider, config);
          const testWithCategory = { ...test, promptCategory };
          console.log(`  ✓ [${provider}] "${promptText.substring(0, 50)}..." - Brand mentioned: ${test.brandMentioned}`);
          return testWithCategory;
        } catch (error) {
          console.error(`  ✗ [${provider}] Failed prompt: ${promptText.substring(0, 50)}...`, error);
          return null;
        }
      },
      concurrency
    );
    
    // Filter out failed tests (null values)
    const promptTests = promptTestResults.filter((test): test is NonNullable<typeof test> => test !== null);
    
    // Calculate metrics for this provider
    const metrics = calculateBrandMetrics(promptTests);
    
    console.log(`  ✅ ${provider} results: ${metrics.visibilityScore.toFixed(1)}/100 score, ${Math.round(metrics.mentionRate * 100)}% mention rate`);
    
    // Map provider names to display names
    const providerDisplayName = (p: string): string => {
      switch (p.toLowerCase()) {
        case 'openai': return 'ChatGPT'
        case 'google': return 'Gemini'
        case 'anthropic': return 'Claude'
        case 'perplexity': return 'Perplexity'
        default: return p.charAt(0).toUpperCase() + p.slice(1)
      }
    }
    
    return {
      provider: providerDisplayName(provider),
      promptTests,
      brandVisibilityScore: metrics.visibilityScore,
      averagePosition: metrics.averagePosition,
      mentionRate: metrics.mentionRate,
      sentiment: metrics.sentiment,
    };
  });
  
  // Wait for all providers to complete (providers also run in parallel!)
  const analysesResults = await Promise.all(providerAnalysisPromises);
  analyses.push(...analysesResults);

  // Collect all AI responses for validation pipeline
  const allResponses = analyses.flatMap(a =>
    a.promptTests.map(t => t.response)
  ).join('\n\n---\n\n');

  // Collect all competitor mentions (raw, before validation)
  const allCompetitorMentions = analyses.flatMap(a =>
    a.promptTests.flatMap(t => t.competitors)
  );

  // ── Entity normalization: deduplicate aliases across all providers ──
  console.log('\n🔄 Normalizing extracted entities...');
  let normResult: NormalizationResult | null = null;
  try {
    normResult = config.apiKeys.openai
      ? await normalizeExtractedEntities(
          allCompetitorMentions,
          config.brandName,
          config.apiKeys.openai
        )
      : buildIdentityResult(allCompetitorMentions);

    // Remap per-test data through the alias map
    for (const analysis of analyses) {
      for (const test of analysis.promptTests) {
        // Remap competitor names and deduplicate
        test.competitors = [...new Set(
          test.competitors.map(c => normResult!.aliasMap.get(c.toLowerCase()) || c)
        )];

        // Remap competitorPositions: on collision keep Math.min (best rank)
        if (test.competitorPositions) {
          const remapped: Record<string, number> = {};
          for (const [name, pos] of Object.entries(test.competitorPositions)) {
            const canonical = normResult!.aliasMap.get(name.toLowerCase()) || name;
            if (canonical in remapped) {
              remapped[canonical] = Math.min(remapped[canonical], pos as number);
            } else {
              remapped[canonical] = pos as number;
            }
          }
          test.competitorPositions = remapped;
        }

        // Remap competitorSentiments: on collision keep first
        if (test.competitorSentiments) {
          const remapped: Record<string, 'positive' | 'neutral' | 'negative'> = {};
          for (const [name, sentiment] of Object.entries(test.competitorSentiments)) {
            const canonical = normResult!.aliasMap.get(name.toLowerCase()) || name;
            if (!(canonical in remapped)) {
              remapped[canonical] = sentiment;
            }
          }
          test.competitorSentiments = remapped;
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ Entity normalization failed, continuing with raw names:', error);
  }

  // Snapshot raw (pre-validation) competitor data before validateCompetitors overwrites it
  for (const analysis of analyses) {
    for (const test of analysis.promptTests) {
      test.rawCompetitorsMentioned = [...test.competitors];
      test.rawCompetitorPositions = test.competitorPositions ? { ...test.competitorPositions } : {};
      test.rawCompetitorSentiments = test.competitorSentiments ? { ...test.competitorSentiments } : {};
    }
  }

  // Rebuild mentions from (possibly remapped) tests
  const canonicalMentions = analyses.flatMap(a =>
    a.promptTests.flatMap(t => t.competitors)
  );

  // Run multi-stage competitor validation pipeline
  console.log('\n🔬 Running AI competitor validation pipeline...');
  let validatedCompetitors: ValidatedCompetitor[] = [];

  try {
    validatedCompetitors = await validateCompetitors(
      allResponses,
      config.brandName,
      canonicalMentions,
      config.description,
      config.industry,
      config.competitors
    );

    // Enrich validated competitors with entity type and parent from normalization
    if (normResult) {
      for (const vc of validatedCompetitors) {
        const lower = vc.name.toLowerCase();
        const entityType = normResult.entityTypes.get(lower);
        if (entityType) {
          vc.entityType = entityType as ValidatedCompetitor['entityType'];
        }
        const parent = normResult.parentMap.get(lower);
        if (parent) {
          vc.parentCompany = parent;
        }
      }
    }

    console.log(`✅ Validated ${validatedCompetitors.length} competitors with AI pipeline`);

    // Update prompt tests to only include validated competitors
    const validatedNameSet = new Set(validatedCompetitors.map(c => c.name.toLowerCase()));

    for (const analysis of analyses) {
      for (const test of analysis.promptTests) {
        // Filter competitors to only validated ones
        test.competitors = test.competitors.filter(c =>
          validatedNameSet.has(c.toLowerCase())
        );

        // Clean competitorPositions to match
        if (test.competitorPositions) {
          const cleanedPositions: Record<string, number> = {};
          for (const [name, pos] of Object.entries(test.competitorPositions)) {
            if (validatedNameSet.has(name.toLowerCase())) {
              cleanedPositions[name] = pos as number;
            }
          }
          test.competitorPositions = cleanedPositions;
        }

        // Clean competitorSentiments to match
        if (test.competitorSentiments) {
          const cleanedSentiments: Record<string, 'positive' | 'neutral' | 'negative'> = {};
          for (const [name, sentiment] of Object.entries(test.competitorSentiments)) {
            if (validatedNameSet.has(name.toLowerCase())) {
              cleanedSentiments[name] = sentiment;
            }
          }
          test.competitorSentiments = cleanedSentiments;
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ Competitor validation pipeline failed, using regex-filtered results:', error);
    // Fall back to existing competitors (already regex-filtered)
  }

  // Recalculate competitor comparison with validated data
  const validatedMentions = analyses.flatMap(a =>
    a.promptTests.flatMap(t => t.competitors)
  );

  // Build competitor stats from validated competitors
  const competitorStats: CompetitorAnalysis[] = validatedCompetitors.map(vc => {
    const mentions = validatedMentions.filter(mention =>
      mention.toLowerCase() === vc.name.toLowerCase()
    ).length;

    // Aggregate position data from all prompt tests across all providers
    const positions: number[] = [];
    for (const a of analyses) {
      for (const test of a.promptTests) {
        if (test.competitorPositions) {
          for (const [name, pos] of Object.entries(test.competitorPositions)) {
            if (name.toLowerCase() === vc.name.toLowerCase() && pos >= 1) {
              positions.push(pos);
            }
          }
        }
      }
    }
    const averagePosition = positions.length > 0
      ? Math.round((positions.reduce((sum, p) => sum + p, 0) / positions.length) * 10) / 10
      : 0;

    return {
      name: vc.name,
      mentionCount: mentions,
      averagePosition,
      shareOfVoice: validatedMentions.length > 0 ? mentions / validatedMentions.length : 0,
    };
  }).filter(c => c.mentionCount > 0);

  // Sort by share of voice
  competitorStats.sort((a, b) => b.shareOfVoice - a.shareOfVoice);

  // Calculate overall score
  const overallScore = Math.round(
    analyses.reduce((sum, a) => sum + a.brandVisibilityScore, 0) / analyses.length
  );

  // Generate recommendations
  const recommendations = generateRecommendations(config, analyses);

  console.log(`✅ Analysis complete! Overall score: ${overallScore}/100`);
  console.log(`   Validated competitors: ${validatedCompetitors.length}`);
  console.log(`   High confidence: ${validatedCompetitors.filter(c => c.confidence === 'high').length}`);

  return {
    brandName: config.brandName,
    overallScore,
    analyses,
    competitorComparison: competitorStats,
    validatedCompetitors,
    recommendations,
    country: config.country,
    language: config.country ? getLanguageForCountry(config.country) : 'en',
    timestamp: new Date(),
  };
}

/**
 * Create a simplified configuration from minimal inputs
 */
export function createDirectGEOConfig(
  brandName: string,
  website?: string,
  options: {
    industry?: string;
    description?: string;
    competitors?: string[];
    customPrompts?: Array<string | { text: string; category?: string }>;
    apiKeys?: Partial<DirectGEOConfig['apiKeys']>;
    country?: CountryCode;
  } = {}
): DirectGEOConfig {
  // Get environment object safely (works in Node.js environment)
  const env = ((globalThis as any).process?.env ?? {});

  return {
    brandName,
    industry: options.industry || 'technology',
    description: options.description || `${brandName} is a company in the ${options.industry || 'technology'} industry`,
    competitors: options.competitors || [],
    customPrompts: options.customPrompts,
    country: options.country,
    apiKeys: {
      openai: options.apiKeys?.openai || env.OPENAI_API_KEY,
      anthropic: options.apiKeys?.anthropic || env.ANTHROPIC_API_KEY,
      google: options.apiKeys?.google || env.GEMINI_API_KEY || env.GOOGLE_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY,
      perplexity: options.apiKeys?.perplexity || env.PERPLEXITY_API_KEY,
    },
  };
}

// Export for testing
export const _internal = { retryWithBackoff };
