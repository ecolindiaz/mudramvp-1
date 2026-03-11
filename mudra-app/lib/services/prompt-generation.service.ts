import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { logAIModelCall } from './ai-model-logging.service';
import { safeParseICPArray } from '@/lib/utils/safe-parse-array';

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
  brandLeakCount: number;
  titleCaseCount: number;
  firstPersonCount: number;
  firstPersonPct: number;
  scenarioBasedCount: number;
  scenarioBasedPct: number;
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
- Generic (~10%): Short, broad queries of 3-8 words with NO situational context
- Competitor: Queries comparing or seeking alternatives to competitors
- How-to Guides: Actionable task/how-to queries related to the brand's domain
- Brand-Specific: Direct queries mentioning the brand name

Rules:
- Each query must be a natural search question or phrase (not a keyword)
- Do NOT duplicate or closely paraphrase any existing prompt
- Vary query styles: questions, comparisons, "best of" lists, how-tos, etc.
- Keep queries concise (under 120 characters each)
- Organic prompts must NOT contain the brand name
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
    const final = [...batchValidation.passed, ...rewritten];
    console.log(`[BatchGeneration] Validation: ${batchValidation.rejected.length} rewritten`);
    return final as BatchGeneratedPrompt[];
  }

  return parsed.prompts;
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
export function profileToBrandInfo(profile: any): BrandInfo {
  // Handle competitors - could be array or comma-separated string
  let competitors: string[] = [];
  if (Array.isArray(profile.competitors)) {
    competitors = profile.competitors;
  } else if (typeof profile.competitors === 'string' && profile.competitors.trim()) {
    competitors = profile.competitors.split(',').map((c: string) => c.trim()).filter((c: string) => c);
  }

  const services = profile.companyServices
    ? profile.companyServices.split(',').map((s: string) => s.trim())
    : ['Software'];

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
  const otherNonOrganic = prompts.filter(p =>
    p.category !== 'Organic' && p.category !== 'Generic' &&
    p.category !== 'Brand-Specific' && p.category !== 'FAQ'
  );

  // Competitor and How-to pass through (hard to validate mechanically)
  passed.push(...otherNonOrganic);

  // Generic: must be ≤10 words
  for (const prompt of generic) {
    const wordCount = prompt.text.trim().split(/\s+/).length;
    if (wordCount <= 10) {
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

  // Track "Best" openings allowed (max 20% of organic count)
  const maxBestAllowed = Math.floor(organic.length * 0.20);
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

    // 3. "Best" opening — allow up to 20%, reject excess
    if (textLower.startsWith('best ')) {
      bestCount++;
      if (bestCount > maxBestAllowed && !reject) {
        reject = true;
      }
    }

    // 4. First-person metric (count only, no rejection)
    if (firstPersonRegex.test(text)) {
      firstPersonCount++;
    }

    // 5. Scenario-based metric (count only, no rejection)
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
      brandLeakCount,
      titleCaseCount,
      firstPersonCount,
      firstPersonPct: Math.round((firstPersonCount / organicCount) * 100),
      scenarioBasedCount,
      scenarioBasedPct: Math.round((scenarioBasedCount / organicCount) * 100),
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

/**
 * Apply deterministic fixes to 1-5 rejected prompts.
 * Returns rewritten prompts with original categories preserved.
 */
export function deterministicRewrite(
  rejected: InitialGeneratedPrompt[],
  brandName: string
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

  return rejected.map(prompt => {
    let text = prompt.text;

    // Fix 1: Remove brand name leaks (skip for Brand-Specific — they MUST contain the brand)
    if (prompt.category !== 'Brand-Specific') {
      text = text.replace(fullBrandRegex, 'this kind of tool');
      for (const rx of brandWordRegexes) {
        text = text.replace(rx, 'this kind of tool');
      }
      // Clean up double "this kind of tool" from multi-word brands
      text = text.replace(/(this kind of tool\s*){2,}/gi, 'this kind of tool ');
    }

    // Fix 2: Rewrite "Best X" openings
    if (text.trimStart().toLowerCase().startsWith('best ')) {
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

/**
 * Get expanded style anchors for prompt generation.
 * Always returns anchors — GPT-5.2 needs concrete examples even with Reddit context.
 */
function getStyleAnchors(language: 'en' | 'es'): string {
  if (language === 'es') {
    return `

Style anchors — match this register in Spanish. These are examples of HOW prompts should sound:

GOOD Generic (short, broad, 3-8 words):
- "mejores herramientas de gestión de proyectos"
- "software CRM para empresas"
- "plataformas de email marketing"

GOOD Organic (directo, conciso — la mayoría menos de 20 palabras):
- "¿Cuál es la mejor plataforma para correr cargas de IA sin manejar Kubernetes?"
- "¿Qué herramientas usan las startups para desplegar modelos de ML rápido?"
- "Alternativas a [competidor] para [caso de uso]?"
- "¿Qué debería usar en vez de manejar AWS yo mismo?"
- "¿Cuál es la mejor herramienta de gestión de proyectos para equipos remotos?"
- "Busco una plataforma de email marketing que sea fácil de usar"
- "¿Cómo puedo automatizar reportes financieros sin hacerlo manual?"
- "¿Qué usan las empresas para enriquecer datos de contacto B2B?"

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

GOOD Generic (short, broad, 3-8 words — NO situational context):
- "best project management tools"
- "CRM software for small business"
- "email marketing platforms"
- "free invoicing tools"
- "AI writing assistants"

GOOD Organic (direct, concise — most under 20 words, prefer question forms over "I need" statements):
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
2. Maximum 1 prompt may start with "Best"
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

1. **Organic** — exactly ${counts['Organic']} prompts: Discovery queries with BOTH (a) clear intent AND (b) situational context from the ICP. The brand name must NOT appear in these.
2. **Generic** — exactly ${counts['Generic']} prompts: Short, broad queries of 3-8 words with NO situational context. Think keyword-level searches. The brand name must NOT appear in these.
3. **Competitor** — exactly ${counts['Competitor']} prompts: Queries comparing or seeking alternatives to the brand's competitors.
4. **How-to Guides** — exactly ${counts['How-to Guides']} prompts: Actionable task/how-to queries related to the brand's domain. Each MUST end with a tool-seeking phrase like "...what tools help with this?" or "...what platforms do people recommend?"
5. **Brand-Specific** — exactly ${counts['Brand-Specific']} prompts: Direct queries mentioning the brand name.
6. **FAQ** — exactly ${counts['FAQ']} prompts: Question-style prompts with recommendation-seeking language. Must start with a question word (How, What, Why, Can, Is, Does, Which, etc.) and include language that invites tool/product recommendations.

Business type: ${businessType}
${businessGuidance}

ORGANIC STYLE RULES (critical — follow these strictly):
- Every Organic prompt MUST have clear intent. Keep most prompts SHORT and DIRECT — under 20 words. "What's the best platform to run AI workloads without managing Kubernetes?" is good. "we're a SaaS company with heavy batch data processing, what cloud platforms are good for scaling containerized batch jobs on demand?" is too long and over-specific.
- Some prompts can include light situational context (role, company type, use case) but do NOT pad every prompt with backstory. A minority should have context, the majority should be concise direct questions.
- Do NOT put the brand name in any Organic or Generic prompt. These test whether AI discovers the brand unprompted.
- No more than 20% of Organic prompts may start with the word "best". Vary your openings: "What should I use for...", "Which platform is best for...", "How can I...", "[competitor] alternatives for...", "Where can I..."
- No more than 20% of Organic prompts should start with "I need". Strongly prefer question forms: "What should I use for...", "Which platform is best for...", "What's the best way to...", "Where can I...", "How can I..."
- At least 10% must be decision-help or opinion-seeking: "is it worth...", "which should I use...", "thoughts on..."
- Cover topics relevant to the ICP but do NOT force ICP-specific backstory into every prompt.
- Include some time-anchored queries: "in 2026", "latest", "right now"
- Include some budget/cost queries: "free", "affordable", "pricing"${styleAnchors}

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
    `best=${metrics.bestOpeningPct}%, brandLeaks=${metrics.brandLeakCount}, ` +
    `titleCase=${metrics.titleCaseCount}, firstPerson=${metrics.firstPersonPct}%, ` +
    `scenario=${metrics.scenarioBasedPct}%`);

  let finalPrompts = [...passed];

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
        const rewritten = deterministicRewrite(rejected, brandInfo.companyName);
        finalPrompts.push(...rewritten);
        console.log(`[PromptValidation] Replacement API failed, deterministically rewrote ${rewritten.length} original rejected prompts`);
      } else {
        // Validate replacements (one pass, no further retry)
        const replacementValidation = validatePromptQuality(replacements, brandInfo.companyName, language);
        finalPrompts.push(...replacementValidation.passed);
        // Any still-rejected replacements get deterministic rewrite
        if (replacementValidation.rejected.length > 0) {
          const rewritten = deterministicRewrite(replacementValidation.rejected, brandInfo.companyName);
          finalPrompts.push(...rewritten);
        }
        console.log(`[PromptValidation] Retry: ${replacements.length} requested, ` +
          `${replacementValidation.passed.length} passed, ${replacementValidation.rejected.length} rewritten`);
      }
    } else {
      // 1-5 rejections — apply fast deterministic fixes
      const rewritten = deterministicRewrite(rejected, brandInfo.companyName);
      finalPrompts.push(...rewritten);
      console.log(`[PromptValidation] Deterministically rewrote ${rewritten.length} prompts`);
    }
  }

  // Fire-and-forget observability logging
  logAIModelCall({
    feature: 'onboarding',
    endpoint: 'prompts/generate-initial',
    model: 'gpt-5.2-2025-12-11',
    provider: 'openai',
    status: 'success',
    metadata: JSON.parse(JSON.stringify({
      promptCount: finalPrompts.length,
      validationMetrics: metrics,
      language,
    })),
  }).catch(() => {});

  return finalPrompts;
}
