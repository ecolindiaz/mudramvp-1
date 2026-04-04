import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { logAIModelCall } from './ai-model-logging.service';
import { safeParseArray, safeParseICPArray } from '@/lib/utils/safe-parse-array';

export interface BrandInfo {
  companyName: string;
  companyDescription: string;
  industry: string;
  productsServices: string[];
  idealCustomer: string;
  competitors: string[];
  // Enriched fields (optional — backward-compatible)
  websiteUrl?: string;
  productsWithDescriptions?: string[];   // "Product Name - Description" format
  icpSegments?: string[];                // individual ICP segments as array
  inferredBusinessType?: string;         // saas | ecommerce | agency | marketplace | enterprise | other
  trackingCountries?: string[];
  primaryCountry?: string;
  userRole?: string;
}

// --- Batch generation for AI-assisted prompt creation ---

// --- Prompt validation types ---

export interface PromptValidationResult {
  passed: InitialGeneratedPrompt[];
  rejected: InitialGeneratedPrompt[];
  metrics: PromptValidationMetrics;
}

export interface PromptValidationMetrics {
  totalChecked: number;
  bestOpeningCount: number;
  bestOpeningPct: number;
  bestOpeningMinTarget: number;
  bestOpeningMaxAllowed: number;
  brandLeakCount: number;
  titleCaseCount: number;
  firstPersonCount: number;
  firstPersonPct: number;
  scenarioBasedCount: number;
  scenarioBasedPct: number;
  competitorVsCount: number;
  retryTriggered: boolean;
  retryCount: number;
}

export interface BatchGeneratedPrompt {
  text: string
  category: 'Organic' | 'Competitor' | 'How-to Guides' | 'Brand-Specific' | 'Generic'
}

/**
 * Generate a batch of prompts based on a user description, with auto-assigned categories.
 * Uses Claude Sonnet 4.5 for high-quality structured generation.
 */
export async function generateBatchPrompts(
  description: string,
  count: number,
  existingPrompts: string[],
  brandInfo: BrandInfo
): Promise<BatchGeneratedPrompt[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured');
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const systemPrompt = `You generate natural-language search queries to test a brand's visibility in generative AI engines.

You will be given:
- A description of what kind of prompts the user wants
- Brand context (company, industry, ICP, competitors)
- A list of existing prompts to avoid duplicating

Generate exactly ${count} unique search queries that a real person would type into ChatGPT, Perplexity, or Google.

Category distribution guidelines:
- Organic (~50%): Discovery queries with intent + situational context where the brand could naturally appear
- Generic (~10%): Short discovery queries of 5-15 words that anchor a broad category to a specific use case, vertical, or goal. NOT bare keywords.
- Competitor: ~70% discovery ("alternatives to [Competitor]") + ~30% direct comparison ("[Brand] vs [Competitor]"). NEVER generate "[Competitor A] vs [Competitor B]" without the brand — those exclude the tracked brand from AI responses.
- How-to Guides: Actionable task/how-to queries related to the brand's domain
- Brand-Specific: Direct queries mentioning the brand name

Rules:
- Each query must be a natural search question or phrase (not a keyword)
- Do NOT duplicate or closely paraphrase any existing prompt
- Vary query styles: questions, comparisons, "best of" lists, how-tos, etc.
- Keep queries concise (under 120 characters each)
- Organic prompts must NOT contain the brand name
- Keep a small buying-intent slice in Organic: aim for 10-20% of Organic prompts to start with "Best"
- No more than 20% of Organic prompts may start with "Best"
- Do NOT use Title Case (e.g., "Best Tools For Small Businesses" is WRONG — use sentence case)
- Include some first-person/conversational prompts: "I need...", "looking for...", "my team..."

BAD examples (do NOT generate):
- "Best Project Management Software For Small Businesses" (Title Case, keyword-stuffed)
- "Top Enterprise Solutions For Data Analytics" (nobody searches like this)
GOOD examples:
- "I need a project management tool for a remote team of 15"
- "affordable alternatives to [competitor] for startups"

Return ONLY valid JSON (no markdown, no code blocks) in this exact format:
{
  "prompts": [
    { "text": "query text here", "category": "Organic" },
    ...
  ]
}

Categories must be exactly one of: "Organic", "Generic", "Competitor", "How-to Guides", "Brand-Specific"`;

  const existingList = existingPrompts.length > 0
    ? `\n\nExisting prompts (DO NOT duplicate):\n${existingPrompts.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
    : '';

  const userPrompt = `Description of desired prompts: ${description}

Brand context:
- Company: ${brandInfo.companyName}
- Industry: ${brandInfo.industry}
- Description: ${brandInfo.companyDescription}
- Products/Services: ${brandInfo.productsServices.join(', ')}
- Ideal Customer: ${brandInfo.idealCustomer}
- Competitors: ${brandInfo.competitors.join(', ')}${existingList}

Generate exactly ${count} prompts now.`;

  console.log(`[BatchGeneration] Generating ${count} prompts with Claude Sonnet 4.5, description: "${description}"`);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userPrompt },
    ],
  });

  const content = response.content[0]?.type === 'text' ? response.content[0].text : '';
  if (!content) {
    throw new Error('Empty response from Claude Sonnet 4.5');
  }

  // Extract JSON from response (Claude may wrap in markdown code blocks)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to extract JSON from Claude response');
  }

  let parsed: { prompts: BatchGeneratedPrompt[] };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('Failed to parse AI response as JSON');
  }

  if (!Array.isArray(parsed.prompts) || parsed.prompts.length !== count) {
    throw new Error(
      `Expected ${count} prompts but got ${parsed.prompts?.length ?? 0}`
    );
  }

  const validCategories = ['Organic', 'Generic', 'Competitor', 'How-to Guides', 'Brand-Specific', 'FAQ'];
  for (const prompt of parsed.prompts) {
    if (!prompt.text || typeof prompt.text !== 'string') {
      throw new Error('Invalid prompt: missing text');
    }
    if (!validCategories.includes(prompt.category)) {
      throw new Error(`Invalid category "${prompt.category}" for prompt "${prompt.text}"`);
    }
  }

  console.log(`[BatchGeneration] Successfully generated ${parsed.prompts.length} prompts`);

  // Light validation + deterministic rewrite for batch (no retry — small count, user can regenerate)
  const asInitial = parsed.prompts.map(p => ({
    text: p.text,
    category: p.category as InitialGeneratedPrompt['category'],
  }));
  const batchValidation = validatePromptQuality(asInitial, brandInfo.companyName);
  if (batchValidation.rejected.length > 0) {
    const rewritten = deterministicRewrite(batchValidation.rejected, brandInfo.companyName);
    const final = enforceBestBeginningOrganicCoverage([...batchValidation.passed, ...rewritten]);
    console.log(`[BatchGeneration] Validation: ${batchValidation.rejected.length} rewritten`);
    return final as BatchGeneratedPrompt[];
  }

  return enforceBestBeginningOrganicCoverage(parsed.prompts as BatchGeneratedPrompt[]) as BatchGeneratedPrompt[];
}

/**
 * Infer business type from industry, description, and services
 */
export function inferBusinessType(
  industry: string,
  description: string,
  services: string[]
): string {
  const text = `${industry} ${description} ${services.join(' ')}`.toLowerCase();

  if (/\b(saas|software as a service|subscription|platform|api|devtool|developer tool)\b/.test(text)) return 'saas';
  if (/\b(ecommerce|e-commerce|shopify|store|retail|shop|merch|product catalog)\b/.test(text)) return 'ecommerce';
  if (/\b(agency|consulting|consultancy|freelance|studio|services firm)\b/.test(text)) return 'agency';
  if (/\b(marketplace|two.?sided|buyer.?seller|matchmak)\b/.test(text)) return 'marketplace';
  if (/\b(enterprise|b2b|fortune\s?\d|large.?scale)\b/.test(text)) return 'enterprise';
  return 'other';
}

/**
 * Convert brand profile to BrandInfo format
 */
interface BrandProfileInput {
  companyName?: string | null;
  companyWebsite?: string | null;
  companyDescription?: string | null;
  companyIndustry?: string | null;
  companyServices?: string | string[] | null;
  companyICP?: unknown;
  competitors?: string[] | string | null;
  trackingCountries?: string[] | null;
  primaryCountry?: string | null;
  userRole?: string | null;
}

export function profileToBrandInfo(profile: BrandProfileInput): BrandInfo {
  // Handle competitors - could be array or comma-separated string
  let competitors: string[] = [];
  if (Array.isArray(profile.competitors)) {
    competitors = profile.competitors.filter((c): c is string => typeof c === 'string' && c.trim().length > 0);
  } else if (typeof profile.competitors === 'string' && profile.competitors.trim()) {
    competitors = profile.competitors.split(',').map((c: string) => c.trim()).filter((c: string) => c);
  }

  const services = safeParseArray(profile.companyServices, ['Software']);

  const description = profile.companyDescription || 'A technology company';
  const industry = profile.companyIndustry || 'Technology';
  const icpArray = safeParseICPArray(profile.companyICP, ['Small to medium businesses']);
  const icp = icpArray.join(', ');

  // Products with descriptions: keep items that contain " - " (Firecrawl format)
  const productsWithDescriptions = services.some((s: string) => s.includes(' - '))
    ? services
    : undefined;

  // ICP segments: only set when there are genuinely multiple ICPs
  const icpSegments = icpArray.length > 1 ? icpArray : undefined;

  // Filter out the "Industry competitors" sentinel
  const realCompetitors = competitors.filter(c => c !== 'Industry competitors');

  return {
    companyName: profile.companyName || 'Unknown Company',
    companyDescription: description,
    industry,
    productsServices: services,
    idealCustomer: icp,
    competitors: realCompetitors.length > 0 ? realCompetitors : [],
    websiteUrl: profile.companyWebsite || undefined,
    productsWithDescriptions,
    icpSegments,
    inferredBusinessType: inferBusinessType(industry, description, services),
    trackingCountries: profile.trackingCountries || undefined,
    primaryCountry: profile.primaryCountry || undefined,
    userRole: profile.userRole || undefined,
  };
}

// --- Initial prompt generation for onboarding (GPT-5.2, JSON, business-type-aware) ---

export interface InitialGeneratedPrompt {
  text: string;
  category: 'Organic' | 'Competitor' | 'How-to Guides' | 'Brand-Specific' | 'FAQ' | 'Generic';
}

function getBusinessTypeGuidance(type: string): string {
  switch (type) {
    case 'saas':
      return `- Include prompts about pricing tiers, feature comparisons, integrations, and migration from competitors
- Generate FAQ prompts around onboarding, security, and API capabilities
- Organic queries must include ICP context: "I need [category] software for [specific situation from ICP]"`;
    case 'ecommerce':
      return `- Include prompts about product reviews, shipping, returns, and deals
- Generate FAQ prompts around sizing, availability, and payment options
- Organic queries must include ICP context: "looking for [product type] for [specific occasion/use case from ICP]"`;
    case 'agency':
      return `- Include prompts about case studies, expertise, industry specialization, and ROI
- Generate FAQ prompts around process, timelines, and deliverables
- Organic queries must include ICP context: "I need a [service type] agency for [specific industry/need from ICP]"`;
    case 'marketplace':
      return `- Include prompts about selection, trustworthiness, fees, and buyer/seller experiences
- Generate FAQ prompts around listing, payments, and dispute resolution
- Organic queries must include ICP context: "looking for a marketplace for [specific category from ICP]"`;
    case 'enterprise':
      return `- Include prompts about scalability, compliance, security certifications, and SLAs
- Generate FAQ prompts around enterprise deployment, custom contracts, and support tiers
- Organic queries must include ICP context: "enterprise [solution type] for [specific industry/need from ICP]"`;
    default:
      return `- Generate a diverse mix of discovery, comparison, and informational queries
- Include FAQ prompts derived from the company's specific products and services`;
  }
}

/**
 * Compute exact per-category counts that sum to totalPrompts.
 * 6 categories: Organic 40%, Generic 10%, Competitor 12%, How-to 12%, FAQ 15%, Brand-Specific remainder (~11%).
 */
function computeCategoryCounts(totalPrompts: number): Record<string, number> {
  const organic    = Math.round(totalPrompts * 0.40);
  const generic    = Math.round(totalPrompts * 0.10);
  const competitor = Math.round(totalPrompts * 0.12);
  const howto      = Math.round(totalPrompts * 0.12);
  const faq        = Math.round(totalPrompts * 0.15);
  const brand      = totalPrompts - organic - generic - competitor - howto - faq; // absorbs rounding
  return { Organic: organic, Generic: generic, Competitor: competitor, 'How-to Guides': howto, 'Brand-Specific': brand, FAQ: faq };
}

function getBestBeginningOrganicQuota(organicCount: number): { min: number; max: number } {
  const max = Math.floor(organicCount * 0.35);
  if (organicCount < 5 || max === 0) {
    return { min: 0, max };
  }

  const min = organicCount >= 20
    ? 8
    : organicCount >= 10
      ? 4
      : 2;

  return { min: Math.min(min, max), max };
}

function normalizePromptKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[?!.\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripLeadingArticle(text: string, language: 'en' | 'es'): string {
  const articleRegex = language === 'es'
    ? /^(un|una|unos|unas|el|la|los|las)\s+/i
    : /^(a|an|the)\s+/i;

  return text.replace(articleRegex, '').trim();
}

// --- Prompt quality validation (pure functions) ---

/** Common acronyms to preserve during sentence-case conversion */
const PRESERVE_ACRONYMS = new Set([
  'API', 'APIs', 'SaaS', 'CRM', 'AI', 'AWS', 'GCP', 'B2B', 'B2C', 'SEO',
  'CMS', 'ERP', 'HR', 'UI', 'UX', 'CI', 'CD', 'SDK', 'CLI', 'MVP', 'KPI',
  'ROI', 'SQL', 'NoSQL', 'DevOps', 'MLOps', 'LLM', 'GPT', 'NLP', 'IoT',
  'VPN', 'DNS', 'CDN', 'SSO', 'OAuth', 'HIPAA', 'SOC', 'GDPR', 'PCI',
  'USD', 'EUR', 'GBP', 'SMB', 'SMBs', 'QA', 'OKR', 'OKRs', 'HRIS',
]);

/**
 * Validate a batch of generated prompts for quality issues.
 * Pure function — no side effects.
 */
export function validatePromptQuality(
  prompts: InitialGeneratedPrompt[],
  brandName: string,
  language: 'en' | 'es' = 'en'
): PromptValidationResult {
  const passed: InitialGeneratedPrompt[] = [];
  const rejected: InitialGeneratedPrompt[] = [];

  // Pre-compute brand detection patterns
  const brandLower = brandName.toLowerCase().trim();
  const fullBrandRegex = new RegExp(
    `\\b${brandName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'
  );
  const brandWords = brandLower.split(/\s+/).filter(w => w.length > 3);
  const brandWordRegexes = brandWords.map(
    w => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
  );

  // Separate organic vs non-organic (Generic is validated separately below)
  const organic = prompts.filter(p => p.category === 'Organic');
  const generic = prompts.filter(p => p.category === 'Generic');
  const brandSpecific = prompts.filter(p => p.category === 'Brand-Specific');
  const faqPrompts = prompts.filter(p => p.category === 'FAQ');
  const competitorPrompts2 = prompts.filter(p => p.category === 'Competitor');
  const howToPrompts = prompts.filter(p => p.category === 'How-to Guides');

  // How-to passes through (hard to validate mechanically)
  passed.push(...howToPrompts);

  // Competitor: reject head-to-head "X vs Y" patterns where brand is NOT present
  const vsRegex = /\b\w+\s+(?:vs\.?|versus)\s+\w+/i;
  let competitorVsCount = 0;
  for (const prompt of competitorPrompts2) {
    if (vsRegex.test(prompt.text) && !fullBrandRegex.test(prompt.text)) {
      competitorVsCount++;
      rejected.push(prompt);
    } else {
      passed.push(prompt);
    }
  }

  // Generic: must be ≤20 words (contextual short queries, not bare keywords)
  for (const prompt of generic) {
    const wordCount = prompt.text.trim().split(/\s+/).length;
    if (wordCount <= 20) {
      passed.push(prompt);
    } else {
      rejected.push(prompt);
    }
  }

  // Brand-Specific: must contain brand name
  for (const prompt of brandSpecific) {
    if (fullBrandRegex.test(prompt.text)) {
      passed.push(prompt);
    } else {
      rejected.push(prompt);
    }
  }

  // FAQ: must start with question word
  const questionWordRegex = language === 'es'
    ? /^(¿)?(cómo|qué|por qué|cuál|dónde|cuándo|cuánto|puede|es|tiene|hay|se puede)\b/i
    : /^(how|what|why|can|is|does|do|which|should|when|where|will|are)\b/i;
  for (const prompt of faqPrompts) {
    if (questionWordRegex.test(prompt.text.trim())) {
      passed.push(prompt);
    } else {
      rejected.push(prompt);
    }
  }

  // Track "Best" openings allowed (max 35% of organic count)
  const { min: minBestTarget, max: maxBestAllowed } = getBestBeginningOrganicQuota(organic.length);
  let bestCount = 0;

  // Metrics counters (computed over organic only)
  let brandLeakCount = 0;
  let titleCaseCount = 0;
  let firstPersonCount = 0;
  let scenarioBasedCount = 0;

  // First-person patterns
  const firstPersonRegex = language === 'es'
    ? /^(necesito|estoy buscando|mi equipo|busco|quiero|estamos)/i
    : /^(I\s|I'm|I've|my\s|we\s|we're|we've|our\s|looking for|trying to)/i;

  // Scenario-based: numbers, dollar amounts, team sizes, company stages, roles, verticals
  const scenarioRegex = /(\d+\s*(engineers?|developers?|employees?|people|person|team)|series [A-C]|\$[\d,]+|USD|startup with|company of|freelancer|solo founder|non-technical)/i;

  for (const prompt of organic) {
    const text = prompt.text;
    const textLower = text.toLowerCase().trim();
    let reject = false;

    // 1. Brand name leak check (word-boundary, case-insensitive)
    if (fullBrandRegex.test(text)) {
      reject = true;
      brandLeakCount++;
    } else if (brandWordRegexes.some(rx => rx.test(text))) {
      reject = true;
      brandLeakCount++;
    }

    // 2. Title Case detection (ratio-based: catches patterns with interspersed acronyms)
    const tcWords = text.split(/\s+/).filter(w => /^[A-Za-z]/.test(w));
    const tcNonAcronym = tcWords.filter(w => !PRESERVE_ACRONYMS.has(w));
    const tcCapitalized = tcNonAcronym.filter(w => /^[A-Z]/.test(w)).length;
    if (tcNonAcronym.length >= 4 && tcCapitalized / tcNonAcronym.length >= 0.5) {
      if (!reject) {
        reject = true;
      }
      titleCaseCount++;
    }

    // 3. Operational/How-To leak detection for Organic prompts
    const operationalPattern = language === 'es'
      ? /^(?:¿)?cómo (?:puedo|podemos|puedo yo|puede mi equipo) (configurar|migrar|instalar|integrar|conectar|detener|manejar|agregar|detectar|acelerar)/i
      : /^how (?:can|do|should) (?:I|we|my team|our team) (set up|roll back|configure|migrate|stop|handle|add|detect|install|integrate|connect|speed up|manage|enforce|keep|centralize)/i;

    if (operationalPattern.test(text)) {
      if (!reject) {
        reject = true;
      }
    }

    // 4. "Best"/"Mejor" opening — allow up to 35%, reject excess
    const bestOpener = language === 'es' ? textLower.startsWith('mejor ') || textLower.startsWith('mejores ') : textLower.startsWith('best ');
    if (bestOpener) {
      bestCount++;
      if (bestCount > maxBestAllowed && !reject) {
        reject = true;
      }
    }

    // 4b. English-leak rejection for Spanish prompts
    if (language === 'es' && !reject) {
      // Reject English openers
      const englishOpenerPattern = /^(best |i need |how can i |which |what |where can |looking for |trying to )/i;
      // Reject common English words that have obvious Spanish equivalents mid-sentence
      const englishMidPattern = /\b(alternatives|cheaper than|moving away|instead of|looking for|affordable|tools for|platforms for|software for)\b/i;
      if (englishOpenerPattern.test(text) || englishMidPattern.test(text)) {
        reject = true;
      }
    }

    // 5. First-person metric (count only, no rejection)
    if (firstPersonRegex.test(text)) {
      firstPersonCount++;
    }

    // 6. Scenario-based metric (count only, no rejection)
    if (scenarioRegex.test(text)) {
      scenarioBasedCount++;
    }

    if (reject) {
      rejected.push(prompt);
    } else {
      passed.push(prompt);
    }
  }

  const organicCount = organic.length || 1; // avoid division by zero
  return {
    passed,
    rejected,
    metrics: {
      totalChecked: prompts.length,
      bestOpeningCount: bestCount,
      bestOpeningPct: Math.round((bestCount / organicCount) * 100),
      bestOpeningMinTarget: minBestTarget,
      bestOpeningMaxAllowed: maxBestAllowed,
      brandLeakCount,
      titleCaseCount,
      firstPersonCount,
      firstPersonPct: Math.round((firstPersonCount / organicCount) * 100),
      scenarioBasedCount,
      scenarioBasedPct: Math.round((scenarioBasedCount / organicCount) * 100),
      competitorVsCount,
      retryTriggered: false,
      retryCount: 0,
    },
  };
}

/** Rotating alternatives for "Best X" rewrites */
const BEST_ALTERNATIVES = [
  'most recommended', 'top-rated', 'most popular', 'well-reviewed',
  'highest-rated', 'leading', 'most reliable', 'go-to',
];

const BEST_ALTERNATIVES_ES = [
  'más recomendadas', 'mejor valoradas', 'más populares',
  'más confiables', 'líderes', 'más usadas',
];

/**
 * Apply deterministic fixes to 1-5 rejected prompts.
 * Returns rewritten prompts with original categories preserved.
 */
export function deterministicRewrite(
  rejected: InitialGeneratedPrompt[],
  brandName: string,
  language: 'en' | 'es' = 'en'
): InitialGeneratedPrompt[] {
  let bestAltIndex = 0;
  const brandLower = brandName.toLowerCase().trim();
  const brandWords = brandLower.split(/\s+/).filter(w => w.length > 3);
  const brandWordRegexes = brandWords.map(
    w => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
  );
  // Full brand name regex (case insensitive)
  const fullBrandRegex = new RegExp(
    `\\b${brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'
  );

  const brandReplacementPhrase = language === 'es' ? 'este tipo de herramienta' : 'this kind of tool';

  return rejected.map(prompt => {
    let text = prompt.text;

    // Fix 1: Remove brand name leaks (skip for Brand-Specific — they MUST contain the brand)
    if (prompt.category !== 'Brand-Specific') {
      text = text.replace(fullBrandRegex, brandReplacementPhrase);
      for (const rx of brandWordRegexes) {
        text = text.replace(rx, brandReplacementPhrase);
      }
      // Clean up double brand replacement from multi-word brands
      const escPhrase = brandReplacementPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      text = text.replace(new RegExp(`(${escPhrase}\\s*){2,}`, 'gi'), `${brandReplacementPhrase} `);
    }

    // Fix 2: Rewrite "Best X" / English leak openers
    if (language === 'es') {
      // Rewrite English "Best" → Spanish "¿Cuáles son las más recomendadas"
      if (text.trimStart().toLowerCase().startsWith('best ')) {
        const alt = BEST_ALTERNATIVES_ES[bestAltIndex % BEST_ALTERNATIVES_ES.length];
        bestAltIndex++;
        text = text.replace(/^(\s*)best\s+/i, `$1¿Cuáles son las ${alt} `);
      }
      // Rewrite "I need" → "Necesito"
      text = text.replace(/^(\s*)I need\s+/i, '$1Necesito ');
      // Rewrite "How can I" → "¿Cómo puedo"
      text = text.replace(/^(\s*)How can I\s+/i, '$1¿Cómo puedo ');
      // Rewrite "Which platform" → "¿Qué plataforma"
      text = text.replace(/^(\s*)Which platform\s+/i, '$1¿Qué plataforma ');
      // Rewrite "Which" → "¿Cuál"
      text = text.replace(/^(\s*)Which\s+/i, '$1¿Cuál ');
      // Rewrite "What" → "¿Qué"
      text = text.replace(/^(\s*)What\s+/i, '$1¿Qué ');
      // Fix mid-sentence English words
      text = text.replace(/\balternatives\b/gi, 'alternativas');
      text = text.replace(/\bcheaper than\b/gi, 'más barato que');
      text = text.replace(/\bmoving away from\b/gi, 'migrar desde');
      text = text.replace(/\binstead of\b/gi, 'en vez de');
      text = text.replace(/\blooking for\b/gi, 'buscando');
      text = text.replace(/\baffordable\b/gi, 'asequible');
    } else if (text.trimStart().toLowerCase().startsWith('best ')) {
      const alt = BEST_ALTERNATIVES[bestAltIndex % BEST_ALTERNATIVES.length];
      bestAltIndex++;
      text = text.replace(/^(\s*)best\s+/i, `$1what are the ${alt} `);
    }

    // Fix 3: Fix Title Case to sentence case, preserving acronyms
    // Check each word — if 50%+ of words (excluding acronyms) are capitalized, convert
    const words = text.split(/\s+/);
    const nonAcronymWords = words.filter(w => !PRESERVE_ACRONYMS.has(w) && /^[A-Za-z]/.test(w));
    const capitalizedCount = nonAcronymWords.filter(w => /^[A-Z]/.test(w)).length;
    if (nonAcronymWords.length >= 4 && capitalizedCount / nonAcronymWords.length >= 0.5) {
      text = toSentenceCase(text);
    }

    return { text: text.trim(), category: prompt.category };
  });
}

/**
 * Convert text to sentence case, preserving acronyms and proper nouns at start.
 */
function toSentenceCase(text: string): string {
  // Split into words, lowercase those that aren't acronyms
  const words = text.split(/(\s+)/);
  return words.map((word, i) => {
    // Preserve whitespace tokens
    if (/^\s+$/.test(word)) return word;
    // Preserve known acronyms
    if (PRESERVE_ACRONYMS.has(word)) return word;
    // Keep first real word's first letter capitalized
    if (i === 0 || (i > 0 && words.slice(0, i).every(w => /^\s*$/.test(w)))) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    // All-caps words 2-5 chars are likely acronyms not in our set — preserve
    if (/^[A-Z]{2,5}$/.test(word)) return word;
    // Otherwise lowercase
    return word.toLowerCase();
  }).join('');
}

function finalizeBestBeginningText(text: string): string {
  const cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/[?!.\s]+$/g, '')
    .trim();

  return toSentenceCase(cleaned);
}

function rewriteOrganicPromptToBestBeginning(
  text: string,
  language: 'en' | 'es' = 'en'
): string | null {
  const cleaned = text.replace(/\s+/g, ' ').trim().replace(/[?!.\s]+$/g, '');
  if (!cleaned) return null;

  if (language === 'es') {
    if (/^mejor\b/i.test(cleaned)) return null;

    const replacements: Array<{
      regex: RegExp;
      to: (...args: string[]) => string;
    }> = [
      {
        regex: /^(?:¿)?cu[aá]l es la mejor (.+)$/i,
        to: (_match, tail) => `Mejor ${stripLeadingArticle(tail, language)}`,
      },
      {
        regex: /^(?:¿)?qu[eé] deber[ií]a usar para (.+)$/i,
        to: (_match, tail) => `Mejor opción para ${tail}`,
      },
      {
        regex: /^(?:¿)?qu[eé] (plataforma|herramienta|software|solución|servicio|proveedor) (?:maneja|soporta) (.+)$/i,
        to: (_match, kind, tail) => `Mejor ${kind} para ${tail}`,
      },
      {
        regex: /^(?:¿)?qu[eé] herramientas ayudan con (.+)$/i,
        to: (_match, tail) => `Mejores herramientas para ${tail}`,
      },
      {
        regex: /^(?:estoy )?buscando (.+)$/i,
        to: (_match, tail) => `Mejor ${stripLeadingArticle(tail, language)}`,
      },
    ];

    for (const replacement of replacements) {
      const match = cleaned.match(replacement.regex);
      if (!match) continue;

      const rewritten = finalizeBestBeginningText(replacement.to(...match));
      return /^mejor\b/i.test(rewritten) ? rewritten : null;
    }

    return null;
  }

  if (/^best\b/i.test(cleaned)) return null;

  const replacements: Array<{
    regex: RegExp;
    to: (...args: string[]) => string;
  }> = [
    {
      regex: /^what(?:'s| is) the best (.+)$/i,
      to: (_match, tail) => `Best ${stripLeadingArticle(tail, language)}`,
    },
    {
      regex: /^what(?:'s| is) a (?:solid|good|great|decent) alternative to (.+)$/i,
      to: (_match, tail) => `Best alternative to ${tail}`,
    },
    {
      regex: /^which (platform|tool|tools|software|vendor|solution|solutions|service|services|provider|providers|app|apps) is best for (.+)$/i,
      to: (_match, kind, tail) => `Best ${kind} for ${tail}`,
    },
    {
      regex: /^which .+? is best for (.+)$/i,
      to: (_match, tail) => `Best option for ${tail}`,
    },
    {
      regex: /^what should i use for (.+)$/i,
      to: (_match, tail) => `Best option for ${tail}`,
    },
    {
      regex: /^what (platform|tool|tools|software|vendor|solution|solutions|service|services|provider|providers|app|apps) (?:handles|supports) (.+)$/i,
      to: (_match, kind, tail) => `Best ${kind} for ${tail}`,
    },
    {
      regex: /^which (platform|tool|tools|software|vendor|solution|solutions|service|services|provider|providers|app|apps) (?:handles|supports) (.+)$/i,
      to: (_match, kind, tail) => `Best ${kind} for ${tail}`,
    },
    {
      regex: /^what (tools|platforms|software|solutions|services|vendors|providers) (?:help with|help|are people using for|do people recommend for) (.+)$/i,
      to: (_match, kind, tail) => `Best ${kind} for ${tail}`,
    },
    {
      regex: /^(?:trying to find|looking for) (.+)$/i,
      to: (_match, tail) => `Best ${stripLeadingArticle(tail, language)}`,
    },
  ];

  for (const replacement of replacements) {
    const match = cleaned.match(replacement.regex);
    if (!match) continue;

    const rewritten = finalizeBestBeginningText(replacement.to(...match));
    return /^best\b/i.test(rewritten) ? rewritten : null;
  }

  return null;
}

function getBestBeginningRewritePriority(text: string, language: 'en' | 'es'): number {
  const cleaned = text.trim().toLowerCase();

  if ((language === 'es' ? /^mejor\b/ : /^best\b/).test(cleaned)) return -1;
  if (/\bbest\b/.test(cleaned) || /\bmejor\b/.test(cleaned)) return 0;
  if (/^(what should i use|which |what (platform|tool|tools|software|vendor|solution|service|provider)|looking for|trying to find)/i.test(text)) {
    return 1;
  }
  if (/^(¿)?(cu[aá]l|qu[eé]|buscando)/i.test(text)) {
    return 1;
  }
  return 2;
}

export function enforceBestBeginningOrganicCoverage<T extends { text: string; category?: string | null }>(
  prompts: T[],
  language: 'en' | 'es' = 'en'
): T[] {
  const organicIndices = prompts
    .map((prompt, index) => ({ prompt, index }))
    .filter(({ prompt }) => prompt.category === 'Organic');

  const { min } = getBestBeginningOrganicQuota(organicIndices.length);
  if (min === 0) return prompts;

  const bestPrefix = language === 'es' ? /^mejor\b/i : /^best\b/i;
  const currentCount = organicIndices.filter(({ prompt }) => bestPrefix.test(prompt.text.trim())).length;
  const deficit = min - currentCount;

  if (deficit <= 0) return prompts;

  const nextPrompts = [...prompts];
  const seen = new Set(nextPrompts.map((prompt) => normalizePromptKey(prompt.text)));
  const candidates = organicIndices
    .filter(({ prompt }) => !bestPrefix.test(prompt.text.trim()))
    .sort((a, b) => (
      getBestBeginningRewritePriority(a.prompt.text, language) -
      getBestBeginningRewritePriority(b.prompt.text, language)
    ));

  let rewrites = 0;

  for (const candidate of candidates) {
    if (rewrites >= deficit) break;

    const rewritten = rewriteOrganicPromptToBestBeginning(candidate.prompt.text, language);
    if (!rewritten) continue;

    const originalKey = normalizePromptKey(candidate.prompt.text);
    const rewrittenKey = normalizePromptKey(rewritten);
    if (rewrittenKey !== originalKey && seen.has(rewrittenKey)) continue;

    seen.delete(originalKey);
    seen.add(rewrittenKey);
    nextPrompts[candidate.index] = {
      ...candidate.prompt,
      text: rewritten,
    };
    rewrites++;
  }

  return nextPrompts;
}

/**
 * Get expanded style anchors for prompt generation.
 * Always returns anchors — GPT-5.2 needs concrete examples even with Reddit context.
 */
function getStyleAnchors(language: 'en' | 'es'): string {
  if (language === 'es') {
    return `

Style anchors — match this register in Spanish. These are examples of HOW prompts should sound:

GOOD Generic (short discovery queries, 5-15 words — anchor to a use case, vertical, or goal):
- "herramientas de gestión de proyectos para equipos de desarrollo"
- "software CRM para equipos de ventas B2B con ciclo largo"
- "plataformas de email marketing para recuperar carritos abandonados"
- "herramientas de facturación para freelancers con clientes internacionales"

GOOD Organic — descubrimiento corto (6-10 palabras, 5 estilos de inicio — incluir ~15-20% así):
- "mejor software de gestión de gastos empresarial" (mejor)
- "top plataformas de tarjetas corporativas para empresas" (top)
- "¿cuál es el mejor software de cuentas por pagar?" (cuál)
- "¿qué herramienta de control de gastos es mejor?" (qué)
- "principales herramientas de automatización financiera para empresas" (principales)

GOOD Organic — largo natural (la mayoría del Organic, directo, conciso — menos de 20 palabras):
- "Mejor plataforma de datos de entrenamiento para modelos multimodales"
- "¿Cuál es la mejor plataforma para correr cargas de IA sin manejar Kubernetes?"
- "¿Qué herramientas usan las startups para desplegar modelos de ML rápido?"
- "Alternativas a [competidor] para [caso de uso]?"
- "¿Qué debería usar en vez de manejar AWS yo mismo?"
- "¿Cuál es la mejor herramienta de gestión de proyectos para equipos remotos?"
- "Busco una plataforma de email marketing que sea fácil de usar"
- "¿Cómo puedo automatizar reportes financieros sin hacerlo manual?"
- "¿Qué usan las empresas para enriquecer datos de contacto B2B?"

GOOD "Mejor" Organic (apunta a 25-35% del Organic):
- "Mejores empresas de etiquetado de datos para entrenar modelos de IA"
- "Mejor plataforma para desplegar aplicaciones fullstack"
- "Mejor software de gestión de gastos para equipos remotos"
- "Mejor infraestructura de IA para startups"

GOOD How-to (with tool-seeking bridge):
- "cómo automatizar reportes financieros, ¿qué herramientas ayudan con esto?"
- "cómo mejorar el SEO de mi sitio web, ¿qué plataformas recomiendan?"

GOOD FAQ (with recommendation context):
- "¿Qué herramientas recomiendan para gestión de proyectos en equipos remotos?"
- "¿Cuál es la mejor plataforma de email marketing para startups?"

GOOD (decision-help):
- "¿Vale la pena pagar por la versión premium de herramientas de diseño?"
- "¿Cuál debería usar si mi equipo es 100% remoto?"
- "Opiniones honestas sobre [categoría] en 2026"
- "¿Qué cambió en herramientas de [categoría] este año?"

GOOD (budget/cost):
- "Alternativas gratuitas a [herramienta cara] para startups"
- "Herramientas de [categoría] con planes para equipos pequeños"
- "Comparación de precios de plataformas de [categoría]"

BAD (do NOT generate prompts like these):
- "Mejores Herramientas De Gestión De Proyectos Para Empresas" (Title Case antinatural)
- "Mejor Software De CRM Para Ventas B2B En 2026" (keyword-stuffed, Title Case)
- "Top 10 Plataformas De Marketing Digital" (suena a artículo SEO, no a búsqueda real)
- "Mejores Soluciones Empresariales De Análisis De Datos" (nadie busca así)`;
  }

  return `

Style anchors — match this register. These are examples of HOW prompts should sound:

GOOD Generic (short discovery queries, 5-15 words — anchor to a use case, vertical, or goal):
- "data labeling platforms for training foundational models"
- "CRM software that works well for outbound sales teams"
- "email marketing tools for e-commerce abandoned cart flows"
- "free invoicing tools for freelancers with international clients"
- "AI writing assistants for long-form content marketing"
- "companies that provide training data for AI research labs"
- "deploy and manage ML models in production"

GOOD Organic — short top-of-funnel discovery (6-10 words, 5 opener styles — include ~15-20% like these):
- "best expense management tools for businesses" (best)
- "top corporate card platforms for companies" (top)
- "which spend management solutions are best?" (which)
- "what's the best accounts payable software?" (what's)
- "leading finance automation tools for companies" (leading)
- "best approval workflow tools in finance" (best)
- "top platforms for automating corporate expenses" (top)
- "which company has the best spend controls?" (which)
- "what's the best tool for tracking expenses?" (what's)
- "leading data labeling platforms for AI teams" (leading)

GOOD Organic — natural-length (the majority of Organic, direct, concise — most under 20 words):
- "Best training data platform for multimodal models"
- "Best LLM evaluation tool for enterprise procurement teams"
- "What's the best platform to run AI workloads without managing Kubernetes?"
- "What infrastructure do startups use to deploy ML models fast?"
- "What should I use for large-scale async pipelines in Python?"
- "What tools are people using instead of doing [task] manually?"
- "What's the best way to find and qualify B2B leads faster?"
- "How can I run agent-written code without risking my own infrastructure?"
- "What should I use instead of [competitor] if I also want [feature]?"
- "What spend management tools work well for a growing SaaS?"
- "Which platform handles both virtual cards and invoice payments?"
- "[competitor] alternatives for [use case]?"
- "trying to find a CRM that doesn't require a PhD to set up"
- "where can I run batch ML jobs without managing clusters?"

GOOD "Best" Organic (aim for 25-35% of Organic — these are the highest-signal buying-intent queries):
- "Best data labeling companies for training AI models"
- "Best platforms to deploy fullstack applications"
- "Best expense management software for remote teams"
- "Best AI infrastructure for startups"
- "Best corporate card for SaaS companies"
- "Best all-in-one finance platform for growing startups"
- "Best code execution sandbox for AI agents"
- "Best serverless hosting for Next.js in 2026"

GOOD How-to (MUST end with tool-seeking bridge):
- "how to automate financial reporting — what tools help with this?"
- "how to improve SEO rankings, what platforms do people recommend?"
- "how to set up CI/CD for a small team, what tools should I look at?"

GOOD FAQ (MUST include recommendation-seeking language):
- "what tools do people recommend for project management in remote teams?"
- "which email marketing platform is best for startups?"
- "what CRM should I use if I have a small sales team?"

GOOD (decision-help):
- "is it worth paying for premium project management tools?"
- "which should I use if my team is fully remote?"
- "thoughts on [category] tools in 2026?"
- "honest opinion — do I really need a dedicated [tool type]?"
- "what's the difference between [concept A] and [concept B]?"
- "has anyone actually switched from [competitor] and been happy?"

GOOD (budget/cost):
- "affordable alternatives to [expensive tool] for startups"
- "free tools for [use case] that are actually good"
- "pricing comparison of [category] platforms"
- "[category] tools with decent free tiers"

GOOD (time-anchored):
- "latest AI tools for [use case] in 2026"
- "what changed in [category] this year?"
- "best new [category] tools released recently"
- "current state of [technology/category]"

BAD (do NOT generate prompts like these — these will be rejected):
- "Best Project Management Software For Small Businesses" (Title Case, generic, keyword-stuffed)
- "Best CRM Tools For B2B Sales Teams In 2026" (Title Case, reads like an SEO article headline)
- "Top Enterprise Data Analytics Solutions For Business Intelligence" (nobody searches like this)
- "Best Cloud-Based Accounting Software For Growing Businesses" (marketing copy, not a real search)
- "Leading Customer Engagement Platforms For Digital Marketing" (pure keyword stuffing)
- "Best Affordable Email Marketing Platforms For Startups" (fine as ONE prompt but not as a pattern)`;
}

/**
 * Request replacement prompts from GPT-5.2 when >5 are rejected.
 * Uses lower temperature and includes rejected prompts as negative examples.
 */
async function requestReplacementPrompts(
  count: number,
  brandInfo: BrandInfo,
  rejectedTexts: string[],
  language: 'en' | 'es' = 'en'
): Promise<InitialGeneratedPrompt[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const languageNote = language === 'es'
    ? 'Generate ALL prompts in natural Spanish. Do NOT translate English — use culturally appropriate phrasing.'
    : '';

  const systemPrompt = `Generate exactly ${count} Organic search queries for testing AI engine visibility.

HARD RULES (violations will be rejected):
1. The brand name "${brandInfo.companyName}" must NOT appear in any prompt
2. If you generate 5+ prompts, include exactly 1 prompt that starts with "Best" to preserve buying-intent coverage
3. No Title Case patterns (e.g., "Best Tools For Small Businesses" is WRONG)
4. Keep most prompts SHORT and DIRECT — under 20 words. Do NOT pad with backstory.
5. Vary openings: "What should I use...", "Which platform...", "How can I...", "[competitor] alternatives..."
6. No more than 20% of Organic prompts should start with "I need". Use question forms instead.

These prompts were already rejected — do NOT repeat these patterns:
${rejectedTexts.map(t => `- "${t}"`).join('\n')}

${languageNote}
${getStyleAnchors(language)}

Return ONLY valid JSON: { "prompts": [{ "text": "...", "category": "Organic" }] }`;

  const userPrompt = `Brand: ${brandInfo.companyName}
Industry: ${brandInfo.industry}
Products: ${brandInfo.productsServices.slice(0, 5).join(', ')}
ICP: ${brandInfo.idealCustomer}

Generate ${count} replacement Organic prompts now.`;

  console.log(`[PromptValidation] Requesting ${count} replacement prompts via GPT-5.2...`);

  const response = await openai.chat.completions.create({
    model: 'gpt-5.2-2025-12-11',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.5,
    max_completion_tokens: 1500,
  });

  const content = response.choices[0]?.message?.content || '';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn('[PromptValidation] Failed to extract JSON from replacement response');
    return [];
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { prompts: InitialGeneratedPrompt[] };
    if (!Array.isArray(parsed.prompts)) return [];
    // Force category to Organic and basic text validation
    return parsed.prompts
      .filter(p => p.text && typeof p.text === 'string')
      .map(p => ({ text: p.text, category: 'Organic' as const }));
  } catch {
    console.warn('[PromptValidation] Failed to parse replacement response');
    return [];
  }
}

/**
 * Generate initial prompts for a brand during onboarding.
 * Uses GPT-5.2 with JSON output, 5 categories including FAQ,
 * business-type-aware guidance, and richer product/ICP context.
 */
export async function generateInitialPrompts(brandInfo: BrandInfo, redditContext?: string | null, language: 'en' | 'es' = 'en'): Promise<InitialGeneratedPrompt[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const totalPrompts = 70;

  const counts = computeCategoryCounts(totalPrompts);

  const businessType = brandInfo.inferredBusinessType || 'other';
  const businessGuidance = getBusinessTypeGuidance(businessType);

  const languageInstruction = language === 'es'
    ? `\n\nIMPORTANT: Generate ALL queries in Spanish (Español). The prompts should be phrased as a native Spanish speaker would naturally search. Do NOT simply translate English queries — use culturally appropriate phrasing.`
    : '';

  // Style anchors: always include — GPT-5.2 needs concrete examples even with Reddit context
  const styleAnchors = getStyleAnchors(language);

  const systemPrompt = `You generate natural-language search queries to test a brand's visibility in generative AI engines (ChatGPT, Perplexity, Gemini, Claude).

Generate exactly ${totalPrompts} unique search queries with this EXACT category distribution:

1. **Organic** — exactly ${counts['Organic']} prompts: Discovery queries where the user is **searching for a product, platform, tool, or solution** to evaluate or buy. The brand name must NOT appear. These must express buying/evaluation intent — NOT ask how to accomplish a technical task. "Best deploy platform for Next.js" is good (looking for a tool). "How can we roll back after a bad deploy?" is bad (asking how to do a task — that belongs in How-to Guides).
   IMPORTANT: ~15-20% of Organic prompts (about ${Math.round(counts['Organic'] * 0.18)} prompts) must be SHORT top-of-funnel discovery queries of 6-10 words — just the product category with no persona or qualifying context. These are how people START searching. Use these 5 openers spread evenly: "best", "top", "which ... is/are best?", "what's the best ...?", "leading". The remaining ~80% should be your normal natural-length prompts (8-20 words).
2. **Generic** — exactly ${counts['Generic']} prompts: Short discovery queries of 5-15 words that add a USE CASE or CONTEXT to a broad category search. NOT bare keywords — instead, anchor the query to a specific workflow, vertical, or goal. Example: "data labeling platforms for training foundational models" instead of just "data labeling platform". The brand name must NOT appear in these.
3. **Competitor** — exactly ${counts['Competitor']} prompts, split into two sub-types:

   **Discovery (~70%):** Open-ended queries seeking alternatives to a competitor. The brand name must NOT appear — this tests whether the AI discovers the brand unprompted.
   **Direct Comparison (~30%):** Head-to-head queries that include BOTH the brand name AND one competitor — this tests how the AI ranks the brand against a specific rival.

COMPETITOR RULES (critical):
- Discovery patterns: "[Competitor] alternatives for [use case]", "what to use instead of [Competitor]", "cheaper than [Competitor]", "moving away from [Competitor]"
- Direct comparison patterns: "[Brand] vs [Competitor] for [use case]", "[Competitor] vs [Brand] for [use case]", "compare [Brand] and [Competitor] for [use case]"
- NEVER generate "[Competitor A] vs [Competitor B]" without the brand — those exclude the tracked brand from AI responses entirely
- Each prompt should mention exactly ONE competitor. Spread across all listed competitors.

GOOD Discovery: "Labelbox alternatives for training data", "what should I use instead of Snorkel AI", "cheaper than Cohere for NLP"
GOOD Direct: "${brandInfo.companyName} vs Labelbox for training data", "compare ${brandInfo.companyName} and Cohere for NLP"
BAD: "Snorkel AI vs Labelbox for training data" (two competitors, brand excluded)
4. **How-to Guides** — exactly ${counts['How-to Guides']} prompts: Actionable task/how-to queries related to the brand's domain. Each MUST end with a tool-seeking phrase like "...what tools help with this?" or "...what platforms do people recommend?"
5. **Brand-Specific** — exactly ${counts['Brand-Specific']} prompts: Direct queries mentioning the brand name.
6. **FAQ** — exactly ${counts['FAQ']} prompts: Question-style prompts with recommendation-seeking language. Must start with a question word (How, What, Why, Can, Is, Does, Which, etc.) and include language that invites tool/product recommendations.

Business type: ${businessType}
${businessGuidance}

ORGANIC STYLE RULES (critical — follow these strictly):
- Every Organic prompt MUST have clear intent. Keep most prompts SHORT and DIRECT — under 20 words.${language === 'es' ? ' "¿Cuál es la mejor plataforma para correr cargas de IA sin manejar Kubernetes?" is good. "somos una empresa SaaS con procesamiento pesado de datos, ¿qué plataformas cloud sirven para escalar jobs en contenedores bajo demanda?" is too long and over-specific.' : ' "What\'s the best platform to run AI workloads without managing Kubernetes?" is good. "we\'re a SaaS company with heavy batch data processing, what cloud platforms are good for scaling containerized batch jobs on demand?" is too long and over-specific.'}
- Some prompts can include light situational context (role, company type, use case) but do NOT pad every prompt with backstory. A minority should have context, the majority should be concise direct questions.
- TOP-OF-FUNNEL DISCOVERY: About ${Math.round(counts['Organic'] * 0.18)} of the Organic prompts must be SHORT pure-discovery queries (6-10 words). These are simple product-category searches with no persona or context. ${language === 'es' ? 'Use these 5 opener styles and spread evenly: "mejor [categoría]", "top [categoría]", "¿cuál es el mejor [categoría]?", "¿qué [categoría] es mejor?", "principales [categoría]". Examples: "mejor software de gestión de gastos empresarial", "top plataformas de tarjetas corporativas para empresas", "¿cuál es el mejor software de cuentas por pagar?", "principales herramientas de automatización financiera".' : 'Use these 5 opener styles and spread evenly across the short prompts: "best [category]", "top [category]", "which [category] is/are best?", "what\'s the best [category]?", "leading [category]". Examples: "best expense management tools for businesses", "top corporate card platforms for companies", "which spend management solutions are best?", "what\'s the best accounts payable software?", "leading finance automation tools for companies". Do NOT use "best" for more than 2 of these.'} Every prompt must be at least 6 words and make natural sense as a real search query.
- Do NOT put the brand name in any Organic or Generic prompt. These test whether AI discovers the brand unprompted.
${language === 'es'
  ? `- Keep a strong buying-intent slice in Organic: target 25-35% of Organic prompts starting exactly with "Mejor" or "Mejores". "Mejor X para Y" is the #1 query pattern that triggers AI engines to list and compare brands — prioritize it. These should feel like real buyer searches, not SEO headlines.
- No more than 35% of Organic prompts may start with the word "Mejor"/"Mejores". Vary the rest of your openings: "¿Qué debería usar para...", "¿Cuál es la mejor plataforma para...", "¿Dónde puedo...", "¿Qué herramientas recomiendan para..."
- No more than 20% of Organic prompts should start with "Necesito" or "Busco". Strongly prefer question forms: "¿Qué debería usar para...", "¿Cuál es la mejor...", "¿Dónde puedo...", "¿Cómo puedo..."
- At least 10% must be decision-help or opinion-seeking: "¿vale la pena...", "¿cuál debería usar...", "opiniones sobre..."
- CRITICAL: Do NOT use any English words as prompt openers. Never start a prompt with "Best", "I need", "How can I", "Which", "What" — use their Spanish equivalents: "Mejor", "Necesito", "¿Cómo puedo", "¿Cuál", "¿Qué".`
  : `- Keep a strong buying-intent slice in Organic: target 25-35% of Organic prompts starting exactly with "Best". "Best X for Y" is the #1 query pattern that triggers AI engines to list and compare brands — prioritize it. These should feel like real buyer searches, not SEO headlines.
- No more than 35% of Organic prompts may start with the word "best". Vary the rest of your openings: "What should I use for...", "Which platform is best for...", "Where can I...", "What tools do people recommend for..."
- No more than 20% of Organic prompts should start with "I need". Strongly prefer question forms: "What should I use for...", "Which platform is best for...", "What's the best way to...", "Where can I...", "How can I..."
- At least 10% must be decision-help or opinion-seeking: "is it worth...", "which should I use...", "thoughts on..."`}
- Cover topics relevant to the ICP but do NOT force ICP-specific backstory into every prompt.
- Include some time-anchored queries: "in 2026", "latest", "right now"
- Include some budget/cost queries: ${language === 'es' ? '"gratis", "asequible", "precios"' : '"free", "affordable", "pricing"'}

${language === 'es'
  ? `ORGANIC INTENT FILTER (critical — these MUST be followed):
- Organic prompts must seek a PRODUCT or SOLUTION. They must NOT describe a technical task or operational procedure.
- REJECT patterns: "¿Cómo puedo/podemos [configurar|migrar|instalar|integrar|conectar|detener|manejar|agregar|detectar|acelerar]..." — these are operational questions, not product discovery. Move them to How-to Guides.
- GOOD: "Mejor plataforma para preview deployments" (seeking a product)
- GOOD: "¿Qué debería usar para automatizar el seguimiento de gastos?" (seeking a tool)
- BAD: "¿Cómo podemos hacer rollback después de un deploy fallido?" (operational task)
- BAD: "¿Cómo puedo configurar controles de tarjeta por rol y departamento?" (configuration task)
- BAD: "¿Cómo aceleran los equipos de finanzas el cierre mensual?" (process question)

BUYER VOCABULARY RULE (critical for technical brands):
- Write prompts using the BUYER's vocabulary, not the PRODUCT TEAM's vocabulary. A VP evaluating tools does not search "flujos de adaptación LoRA" — they search "mejor plataforma de fine-tuning de modelos."
- Use plain-language descriptions of outcomes and problems, not technical implementation jargon.
- GOOD: "Mejores empresas de etiquetado de datos para entrenar modelos de IA"
- GOOD: "Mejor plataforma de fine-tuning de modelos para equipos enterprise"
- BAD: "proveedores de GPU que soporten flujos de adaptación LoRA" (engineer-spec)
- BAD: "plataformas que hagan stream de stdout desde ejecución remota de código" (insider jargon)
- Rule of thumb: if a non-technical decision-maker at the ICP company wouldn't use these exact words, simplify them.`
  : `ORGANIC INTENT FILTER (critical — these MUST be followed):
- Organic prompts must seek a PRODUCT or SOLUTION. They must NOT describe a technical task or operational procedure.
- REJECT patterns: "How can I/we [set up|roll back|configure|migrate|stop|handle|add|detect|install|integrate|connect|speed up]..." — these are operational questions, not product discovery. Move them to How-to Guides.
- GOOD: "Best platform for preview deployments" (seeking a product)
- GOOD: "What should I use for automated expense tracking?" (seeking a tool)
- BAD: "How can we roll back instantly after a bad frontend deploy?" (operational task)
- BAD: "How can I set up card controls by role and department?" (configuration task)
- BAD: "How do finance teams speed up month-end close?" (process question)

BUYER VOCABULARY RULE (critical for technical brands):
- Write prompts using the BUYER's vocabulary, not the PRODUCT TEAM's vocabulary. A VP evaluating tools does not search "LoRA adaptation workflows" — they search "best model fine-tuning platform."
- Use plain-language descriptions of outcomes and problems, not technical implementation jargon.
- GOOD: "Best data labeling companies for training AI models"
- GOOD: "Best model fine-tuning platform for enterprise teams"
- BAD: "GPU providers that support LoRA adaptation workflows out of the box" (engineer-spec)
- BAD: "platforms that stream stdout from remote code execution" (insider jargon)
- BAD: "best infrastructure for running asynchronous reinforcement learning at scale" (researcher language)
- Rule of thumb: if a non-technical decision-maker at the ICP company wouldn't use these exact words, simplify them.`}${styleAnchors}

ANTI-HALLUCINATION RULE:
- ONLY reference products, features, and competitors that are explicitly listed in the brand context below. Do NOT invent product names, competitor names, or feature names.

ANTI-DUPLICATE RULE:
- No two prompts may share the same core intent. Each prompt must test a distinct discovery angle.

OTHER RULES:
- Mention specific products/services by name in at least 30% of non-Organic, non-Generic queries
- Keep queries concise (under 120 characters each)

Return ONLY valid JSON (no markdown, no code blocks):
{
  "prompts": [
    { "text": "query text", "category": "Organic" },
    ...
  ]
}

Categories must be exactly one of: "Organic", "Generic", "Competitor", "How-to Guides", "Brand-Specific", "FAQ"

If the Website URL is a subdomain (e.g., markets.example.com, developer.example.com, docs.example.com), tailor ALL prompts specifically to the content and services hosted on that subdomain — not the general company. Infer the subdomain's focus area from its prefix (e.g., "markets" → trading/financial markets, "developer"/"docs" → developer documentation/APIs, "blog" → content/articles).${languageInstruction}`;

  // Build rich user prompt with individual products and ICP segments
  const productsSection = brandInfo.productsWithDescriptions
    ? brandInfo.productsWithDescriptions.map((p, i) => `  ${i + 1}. ${p}`).join('\n')
    : brandInfo.productsServices.map((p, i) => `  ${i + 1}. ${p}`).join('\n');

  const icpSection = brandInfo.icpSegments
    ? brandInfo.icpSegments.map((s, i) => `  ${i + 1}. ${s}`).join('\n')
    : `  1. ${brandInfo.idealCustomer}`;

  const redditSection = redditContext
    ? `\n\nReal conversations from Reddit:
Below are real discussions from people searching for solutions in this space. Use their language style, phrasing, pain points, and the way they describe problems to make generated prompts sound natural and colloquial — like real searches, not marketing copy.
${redditContext}`
    : '';

  // Detect subdomain and add focus instruction
  const websiteUrl = brandInfo.websiteUrl || 'N/A';
  let subdomainFocus = '';
  if (websiteUrl !== 'N/A') {
    try {
      const hostname = new URL(websiteUrl.includes('://') ? websiteUrl : `https://${websiteUrl}`).hostname.replace(/^www\./, '');
      const parts = hostname.split('.');
      if (parts.length > 2) {
        const subdomain = parts.slice(0, -2).join('.');
        subdomainFocus = `\nFocus: Generate prompts specifically for the content and services on ${websiteUrl}, not the general ${brandInfo.companyName} company. The subdomain "${subdomain}" indicates a specialized area — tailor all queries accordingly.`;
      }
    } catch { /* not a valid URL, skip */ }
  }

  const countriesSection = brandInfo.trackingCountries && brandInfo.trackingCountries.length > 0
    ? `\nTracking Countries: ${brandInfo.trackingCountries.join(', ')}`
    : '';

  const roleSection = brandInfo.userRole
    ? `\nUser Role: ${brandInfo.userRole}`
    : '';

  const userPrompt = `Brand: ${brandInfo.companyName}
Website: ${websiteUrl}${subdomainFocus}
Industry: ${brandInfo.industry}
Description: ${brandInfo.companyDescription}${countriesSection}${roleSection}

Products/Services:
${productsSection}

Target Customer Segments:
${icpSection}

Competitors: ${brandInfo.competitors.length > 0 ? brandInfo.competitors.join(', ') : 'None provided'}${redditSection}

Generate exactly ${totalPrompts} prompts now.`;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  console.log(`[InitialPrompts] Generating ${totalPrompts} ${language === 'es' ? 'Spanish' : 'English'} prompts via GPT-5.2 (business type: ${businessType})...`);

  const response = await openai.chat.completions.create({
    model: 'gpt-5.2-2025-12-11',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_completion_tokens: 6000,
  });

  const content = response.choices[0]?.message?.content || '';
  if (!content) {
    throw new Error('Empty response from GPT-5.2');
  }

  // Extract JSON from response (model may wrap in markdown code blocks)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to extract JSON from GPT-5.2 response');
  }

  let parsed: { prompts: InitialGeneratedPrompt[] };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('Failed to parse GPT-5.2 response as JSON');
  }

  if (!Array.isArray(parsed.prompts) || parsed.prompts.length === 0) {
    throw new Error(`Expected ${totalPrompts} prompts but got ${parsed.prompts?.length ?? 0}`);
  }

  const validCategories = ['Organic', 'Generic', 'Competitor', 'How-to Guides', 'Brand-Specific', 'FAQ'];
  const validated = parsed.prompts.filter(
    p => p.text && typeof p.text === 'string' && validCategories.includes(p.category)
  );

  console.log(`[InitialPrompts] Generated ${validated.length} valid prompts (requested ${totalPrompts})`);

  // --- Quality validation gate ---
  const validation = validatePromptQuality(validated, brandInfo.companyName, language);
  const { passed, rejected, metrics } = validation;

  console.log(`[PromptValidation] Checked ${metrics.totalChecked} prompts: ${rejected.length} rejected, ` +
    `best=${metrics.bestOpeningPct}% (target ${metrics.bestOpeningMinTarget}-${metrics.bestOpeningMaxAllowed}), ` +
    `brandLeaks=${metrics.brandLeakCount}, ` +
    `titleCase=${metrics.titleCaseCount}, firstPerson=${metrics.firstPersonPct}%, ` +
    `scenario=${metrics.scenarioBasedPct}%, competitorVs=${metrics.competitorVsCount}`);

  const finalPrompts = [...passed];

  if (rejected.length > 0) {
    if (rejected.length > 5) {
      // Too many rejections — request replacements from GPT-5.2
      metrics.retryTriggered = true;
      metrics.retryCount = 1;
      const rejectedTexts = rejected.map(p => p.text);
      const replacements = await requestReplacementPrompts(
        rejected.length, brandInfo, rejectedTexts, language
      );
      if (replacements.length === 0) {
        // API failed — fall back to deterministic rewrite of originals
        const rewritten = deterministicRewrite(rejected, brandInfo.companyName, language);
        finalPrompts.push(...rewritten);
        console.log(`[PromptValidation] Replacement API failed, deterministically rewrote ${rewritten.length} original rejected prompts`);
      } else {
        // Validate replacements (one pass, no further retry)
        const replacementValidation = validatePromptQuality(replacements, brandInfo.companyName, language);
        finalPrompts.push(...replacementValidation.passed);
        // Any still-rejected replacements get deterministic rewrite
        if (replacementValidation.rejected.length > 0) {
          const rewritten = deterministicRewrite(replacementValidation.rejected, brandInfo.companyName, language);
          finalPrompts.push(...rewritten);
        }
        console.log(`[PromptValidation] Retry: ${replacements.length} requested, ` +
          `${replacementValidation.passed.length} passed, ${replacementValidation.rejected.length} rewritten`);
      }
    } else {
      // 1-5 rejections — apply fast deterministic fixes
      const rewritten = deterministicRewrite(rejected, brandInfo.companyName, language);
      finalPrompts.push(...rewritten);
      console.log(`[PromptValidation] Deterministically rewrote ${rewritten.length} prompts`);
    }
  }

  const adjustedPrompts = enforceBestBeginningOrganicCoverage(finalPrompts, language);
  const bestPrefix = language === 'es' ? /^mejor\b/i : /^best\b/i;
  const bestBeforeAdjustment = finalPrompts.filter(
    (prompt) => prompt.category === 'Organic' && bestPrefix.test(prompt.text.trim())
  ).length;
  const bestAfterAdjustment = adjustedPrompts.filter(
    (prompt) => prompt.category === 'Organic' && bestPrefix.test(prompt.text.trim())
  ).length;

  if (bestAfterAdjustment > bestBeforeAdjustment) {
    console.log(
      `[PromptValidation] Added ${bestAfterAdjustment - bestBeforeAdjustment} ` +
      `${language === 'es' ? '"Mejor"' : '"Best"'}-starting Organic prompts for buying-intent coverage`
    );
  }

  // Fire-and-forget observability logging
  logAIModelCall({
    feature: 'onboarding',
    endpoint: 'prompts/generate-initial',
    model: 'gpt-5.2-2025-12-11',
    provider: 'openai',
    status: 'success',
    metadata: JSON.parse(JSON.stringify({
      promptCount: adjustedPrompts.length,
      validationMetrics: metrics,
      language,
    })),
  }).catch(() => {});

  return adjustedPrompts;
}
