import { generateSophisticatedPrompts, profileToBrandInfo, type GeneratedPrompts } from './prompt-generation.service';
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
      
      const delay = initialDelay * Math.pow(2, attempt);
      console.warn(`⚠️  Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms due to: ${error.message}`);
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
 * Validate brand mention using regex with word boundaries
 */
function validateBrandMention(text: string, brandName: string): boolean {
  const escapedBrand = brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\b${escapedBrand}\\b`, 'i');
  
  const cleanedText = text
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/www\.[^\s]+/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '');
  
  return pattern.test(cleanedText);
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
    if (pluralCategoryNouns.includes(lastWord)) {
      if (words.length >= 3) {
        // 3+ words ending in plural category noun → always filter
        return false;
      }
      if (words.length === 2) {
        // 2-word: only filter if first word is also generic
        const genericFirstWordsForCategory = [
          'ai', 'cloud', 'data', 'web', 'digital', 'enterprise', 'commercial',
          'decentralized', 'centralized', 'distributed', 'gpu', 'compute',
          'edge', 'serverless', 'managed', 'global', 'auto', 'instant',
          'online', 'virtual', 'professional', 'technical', 'coding',
          'career', 'job', 'industry', 'software', 'tech', 'open',
          'annotation', 'labeling', 'training',
        ];
        if (genericFirstWordsForCategory.includes(words[0])) return false;
      }
    }

    // Expanded 3+ word generic combo: first word generic AND last word generic tech term → filter
    if (words.length >= 3) {
      const genericFirstSet = [
        'ai', 'edge', 'cloud', 'serverless', 'managed', 'global', 'auto', 'instant',
        'decentralized', 'centralized', 'distributed', 'gpu', 'compute', 'data',
        'web', 'digital', 'enterprise', 'commercial', 'open',
      ];
      const genericLastSet = [
        'sdk', 'gateway', 'service', 'platform', 'runtime', 'functions',
        'network', 'cdn', 'edge', 'proxy', 'cache', 'dashboard', 'console',
        'portal', 'studio', 'hub', 'center', 'marketplace', 'provider',
        'solution', 'tool', 'system', 'framework', 'protocol', 'ecosystem',
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

    // Generate sophisticated prompts using the Mudra system
    const generatedPrompts = await generateSophisticatedPrompts(brandInfo);
    
    // Combine all prompt categories with their categories for intent weighting
    const allPrompts = [
      ...generatedPrompts.organic.map(text => ({ text, category: 'Organic' })),
      ...generatedPrompts.competitor.map(text => ({ text, category: 'Competitor' })),
      ...generatedPrompts.howToGuides.map(text => ({ text, category: 'How-to Guides' })),
      ...generatedPrompts.brandSpecific.map(text => ({ text, category: 'Brand-Specific' })),
    ];

    console.log(`✅ Generated ${allPrompts.length} sophisticated prompts with categories`);
    console.log(`   - Organic: ${generatedPrompts.organic.length}`);
    console.log(`   - Competitor: ${generatedPrompts.competitor.length}`);
    console.log(`   - How-to Guides: ${generatedPrompts.howToGuides.length}`);
    console.log(`   - Brand-Specific: ${generatedPrompts.brandSpecific.length}`);
    
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
    // No system prompt - let the model respond naturally to simulate real user searches
    const response = await retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      try {
        const res = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            tools: [
              {
                type: 'web_search',
                search_context_size: 'high',
                ...(config.country ? (() => { const geo = buildOpenAIGeoConfig(config.country!); return geo ? { user_location: geo } : {}; })() : {}),
              },
            ],
            tool_choice: { type: 'web_search' }, // Force web search
            input: prompt, // Direct prompt without system instructions
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
          const timeoutError = new Error('Request timeout after 60 seconds');
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
   - If no explicit position/ranking is found, return null
   - Examples:
     * "### 1st: Y Combinator" → 1
     * "2nd Place: Y Combinator" → 2
     * "#3: Y Combinator" → 3
     * "Y Combinator is mentioned but no ranking" → null

3. **competitorsMentioned**: Array of OTHER company/brand names mentioned in the response (EXCLUDING "${config.brandName}" itself)
   - Extract ALL proper company/brand names that compete with or are alternatives to "${config.brandName}": ${config.description || config.keyProducts?.join(', ') || 'similar services'}
   - For reference, these are known competitors (but do NOT limit extraction to only these): ${config.competitors?.join(', ') || 'None'}
   - Include EVERY company name found in rankings, comparisons, lists, or as alternatives (not just top 3-5)
   - Capture ALL companies even if they appear later in long lists (positions 4, 5, 6, 7, etc.)
   - Include full company names with proper formatting (e.g., "Techstars", "500 Global", "Scale AI")
   - EXCLUDE companies mentioned only as integration partners, tool mentions, or passing examples
   - EXCLUDE companies with completely different service offerings (e.g., if analyzing an accelerator, exclude payment processors, hosting providers, design tools)
   - Return empty array [] if no relevant competitors are mentioned
   - **CRITICAL**: Only return actual COMPANY/BRAND NAMES. Never include:
     * Sentence fragments like "Others share enthusiasm" or "Posts highlight..."
     * Action phrases like "Reach out directly" or "Sign up now"
     * Generic descriptions like "leading platform" or "top tool"
     * Category headings like "AI model/data marketplaces" or "GPU compute networks"
     * Marketing copy or testimonials

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
            brandMentioned: validateBrandMention(text, config.brandName),
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
    // 1. Validate brand mention using regex (more reliable than LLM)
    const regexBrandMentioned = validateBrandMention(text, config.brandName);
    const llmBrandMentioned = analysis.brandMentioned || false;

    if (llmBrandMentioned !== regexBrandMentioned) {
      console.warn(`[OpenAI] Brand mention mismatch - LLM: ${llmBrandMentioned}, Regex: ${regexBrandMentioned}. Using regex result.`);
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
      citations: uniqueCitations.length > 0 ? uniqueCitations : undefined,
      sources: uniqueSources.length > 0 ? uniqueSources : undefined,
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
  
  console.log('[Perplexity] API Key configured:', apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4));

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

    const response: any = await perplexity.chat.completions.create({
      model: 'sonar-pro', // Pro model with enhanced search and citations
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 1200,
      ...(perplexityGeo ? {
        web_search_options: { user_location: perplexityGeo.user_location },
        search_language_filter: perplexityGeo.search_language_filter,
      } : {}),
    } as any);

    const text = response.choices[0]?.message?.content || '';
    console.log('[Perplexity] Response received:', text.substring(0, 100) + '...');
    
    // Extract citations from Perplexity response
    // Perplexity returns citations in the response object
    const citations: Citation[] = [];
    
    if (response.citations && Array.isArray(response.citations)) {
      response.citations.forEach((url: string, index: number) => {
        citations.push({
          url: url,
          position: index + 1,
        });
      });
      console.log(`[Perplexity] Extracted ${citations.length} citations`);
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
COMPETITORS: ${config.competitors?.join(', ') || 'None specified'}

RESPONSE TEXT:
"${text}"

Extract the following information:

1. **brandMentioned**: Is "${config.brandName}" mentioned anywhere in the response? (true/false)

2. **brandPosition**: What numerical ranking/position is "${config.brandName}" given?
   - Look for patterns like "1st", "2nd", "3rd", "#1", "first place", "ranked 1", etc.
   - Extract ONLY the number (1, 2, 3, etc.)
   - If no explicit position/ranking is found, return null
   - Examples:
     * "### 1st: Y Combinator" → 1
     * "2nd Place: Y Combinator" → 2  
     * "#3: Y Combinator" → 3
     * "Y Combinator is mentioned but no ranking" → null

3. **competitorsMentioned**: Array of OTHER company/brand names mentioned in the response (EXCLUDING "${config.brandName}" itself)
   - Extract ALL proper company names that are competitors, alternatives, or mentioned alongside the brand
   - Include EVERY company name found in rankings, comparisons, lists, or as alternatives (not just top 3-5)
   - Include full company names with proper formatting (e.g., "Techstars", "500 Global", "a16z", "Entrepreneurs First", "Boost VC")
   - Capture ALL companies even if they appear later in long lists (positions 4, 5, 6, 7, etc.)
   - Exclude generic terms like "startups", "companies", "accelerators" unless they are actual brand names
   - Return empty array [] if no competitors are mentioned
   - Examples:
     * From "Top 5 accelerators: 1. Y Combinator, 2. Techstars, 3. 500 Global, 4. Seedcamp, 5. MassChallenge"
       → competitorsMentioned should be: ["Techstars", "500 Global", "Seedcamp", "MassChallenge"]
     * From "Top 7: 1. YC, 2. Techstars, 3. 500 Global, 4. a16z Speedrun, 5. Antler, 6. Entrepreneurs First, 7. Boost VC"
       → competitorsMentioned should be: ["Techstars", "500 Global", "a16z Speedrun", "Antler", "Entrepreneurs First", "Boost VC"]

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
        break;
      } catch (parseError) {
        console.warn(`[Perplexity] Extraction attempt ${attempt}/2 failed:`, parseError);
        if (attempt === 2) {
          console.warn('[Perplexity] Both extraction attempts failed, using minimal safe fallback');
          analysis = {
            brandMentioned: validateBrandMention(text, config.brandName),
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

    // CRITICAL: Validate brand mention using regex (not just LLM analysis)
    const regexBrandMentioned = validateBrandMention(text, config.brandName);

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
      citations: citations.length > 0 ? citations : undefined,
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
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      
      try {
        const res = await anthropic.messages.create(
          {
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 1500,
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
                max_uses: 5,
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
          const timeoutError = new Error('Request timeout after 60 seconds');
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

    const analysisPrompt = `Analyze this AI-generated response to determine brand visibility:

BRAND NAME: ${config.brandName}
COMPETITORS: ${config.competitors?.join(', ') || 'None specified'}

RESPONSE TEXT:
"${text}"

Extract the following information:

1. **brandMentioned**: Is "${config.brandName}" mentioned anywhere in the response? (true/false)
2. **brandPosition**: What numerical ranking/position is "${config.brandName}" given? Extract ONLY the number (1, 2, 3, etc.) or null if no explicit position
3. **competitorsMentioned**: Array of OTHER company/brand names mentioned in the response (EXCLUDING "${config.brandName}")
   - Extract ALL proper company/brand names that compete with or are alternatives to "${config.brandName}"
   - For reference, these are known competitors (but do NOT limit extraction to only these): ${config.competitors?.join(', ') || 'None'}
   - Include EVERY company name found in rankings, comparisons, lists, or as alternatives (not just top 3-5)
   - Capture ALL companies even if they appear later in long lists (positions 4, 5, 6, 7, etc.)
   - Include full company names with proper formatting (e.g., "Techstars", "500 Global", "Scale AI")
   - Exclude generic terms like "startups", "companies", "accelerators" unless they are actual brand names
   - Exclude category headings like "AI model/data marketplaces" or "GPU compute networks"
   - Return empty array [] if no competitors are mentioned
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
            brandMentioned: validateBrandMention(text, config.brandName),
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

    const regexBrandMentioned = validateBrandMention(text, config.brandName);
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
      citations: citations.length > 0 ? citations : undefined,
      sources: sources.length > 0 ? sources : undefined,
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
 * Analyze with Google (Gemini)
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

    if (needsProxy && config.country) {
      // Proxied REST API call for geo-targeting
      const proxyUrl = buildGeminiProxyUrl(config.country);
      const endpoint = buildGeminiRestEndpoint('gemini-3-flash-preview');

      if (proxyUrl) {
        console.log(`[Google] Using BrightData proxy for country: ${config.country}`);
        const { HttpsProxyAgent } = await import('https-proxy-agent');
        const agent = new HttpsProxyAgent(proxyUrl);

        const restResult = await retryWithBackoff(async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000);

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
              const timeoutError = new Error('Request timeout after 60 seconds');
              (timeoutError as any).code = 'ETIMEDOUT';
              throw timeoutError;
            }
            throw err;
          }
        });

        const candidate = restResult.candidates?.[0];
        text = candidate?.content?.parts?.map((p: any) => p.text || '').join('') || '';
        groundingMetadata = candidate?.groundingMetadata;
      } else {
        // BrightData not configured — fall back to SDK (no geo)
        console.warn('[Google] BrightData not configured, falling back to SDK without geo-targeting');
        const model = genAI.getGenerativeModel({
          model: 'gemini-3-flash-preview',
          tools: [{ googleSearch: {} }] as any,
        });
        const result = await retryWithBackoff(async () => {
          const res = await model.generateContent(prompt);
          return res;
        });
        const response = result.response;
        text = response.text();
        groundingMetadata = (response as any).candidates?.[0]?.groundingMetadata;
      }
    } else {
      // US or no country — use SDK directly (current behavior)
      const model = genAI.getGenerativeModel({
        model: 'gemini-3-flash-preview',
        tools: [{ googleSearch: {} }] as any,
      });

      const result = await retryWithBackoff(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        try {
          const res = await model.generateContent(prompt);
          clearTimeout(timeoutId);
          return res;
        } catch (err: any) {
          clearTimeout(timeoutId);
          if (err.name === 'AbortError') {
            const timeoutError = new Error('Request timeout after 60 seconds');
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
      text = response.text();
      groundingMetadata = (response as any).candidates?.[0]?.groundingMetadata;
    }

    console.log('[Google] Response received:', text.substring(0, 100) + '...');

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

    const analysisPrompt = `Analyze this AI-generated response to determine brand visibility:

BRAND NAME: ${config.brandName}
COMPETITORS: ${config.competitors?.join(', ') || 'None specified'}

RESPONSE TEXT:
"${text}"

Extract the following information:

1. **brandMentioned**: Is "${config.brandName}" mentioned anywhere in the response? (true/false)
2. **brandPosition**: What numerical ranking/position is "${config.brandName}" given? Extract ONLY the number (1, 2, 3, etc.) or null if no explicit position
3. **competitorsMentioned**: Array of OTHER company/brand names mentioned in the response (EXCLUDING "${config.brandName}")
   - Extract ALL proper company/brand names that compete with or are alternatives to "${config.brandName}"
   - For reference, these are known competitors (but do NOT limit extraction to only these): ${config.competitors?.join(', ') || 'None'}
   - Include EVERY company name found in rankings, comparisons, lists, or as alternatives (not just top 3-5)
   - Capture ALL companies even if they appear later in long lists (positions 4, 5, 6, 7, etc.)
   - Include full company names with proper formatting (e.g., "Techstars", "500 Global", "Scale AI")
   - Exclude generic terms like "startups", "companies", "accelerators" unless they are actual brand names
   - Exclude category headings like "AI model/data marketplaces" or "GPU compute networks"
   - Return empty array [] if no competitors are mentioned
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
            brandMentioned: validateBrandMention(text, config.brandName),
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

    const regexBrandMentioned = validateBrandMention(text, config.brandName);
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
      citations: citations.length > 0 ? citations : undefined,
      searchQueries: searchQueries.length > 0 ? searchQueries : undefined,
    };
  } catch (error: any) {
    console.error(`❌ [Google] Error:`, error.message || error);
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
    
    // Gemini needs throttling (503 overload errors), other providers can run fully parallel
    const concurrency = provider === 'google' ? 3 : providerPrompts.length;
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

  // Run multi-stage competitor validation pipeline
  console.log('\n🔬 Running AI competitor validation pipeline...');
  let validatedCompetitors: ValidatedCompetitor[] = [];

  try {
    validatedCompetitors = await validateCompetitors(
      allResponses,
      config.brandName,
      allCompetitorMentions
    );

    console.log(`✅ Validated ${validatedCompetitors.length} competitors with AI pipeline`);

    // Update prompt tests to only include validated competitors
    const validatedNameSet = new Set(validatedCompetitors.map(c => c.name.toLowerCase()));

    for (const analysis of analyses) {
      for (const test of analysis.promptTests) {
        // Filter competitors to only validated ones
        test.competitors = test.competitors.filter(c =>
          validatedNameSet.has(c.toLowerCase())
        );
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

    return {
      name: vc.name,
      mentionCount: mentions,
      averagePosition: 0, // Could be calculated if we tracked competitor positions
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
