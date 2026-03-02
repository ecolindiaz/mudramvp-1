import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

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
}

// --- Batch generation for AI-assisted prompt creation ---

export interface BatchGeneratedPrompt {
  text: string
  category: 'Organic' | 'Competitor' | 'How-to Guides' | 'Brand-Specific'
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
- Organic (~60%): Generic discovery queries where the brand could naturally appear
- Competitor: Queries comparing or seeking alternatives to competitors
- How-to Guides: Actionable task/how-to queries related to the brand's domain
- Brand-Specific: Direct queries mentioning the brand name

Rules:
- Each query must be a natural search question or phrase (not a keyword)
- Do NOT duplicate or closely paraphrase any existing prompt
- Vary query styles: questions, comparisons, "best of" lists, how-tos, etc.
- Keep queries concise (under 120 characters each)

Return ONLY valid JSON (no markdown, no code blocks) in this exact format:
{
  "prompts": [
    { "text": "query text here", "category": "Organic" },
    ...
  ]
}

Categories must be exactly one of: "Organic", "Competitor", "How-to Guides", "Brand-Specific"`;

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

  const validCategories = ['Organic', 'Competitor', 'How-to Guides', 'Brand-Specific', 'FAQ'];
  for (const prompt of parsed.prompts) {
    if (!prompt.text || typeof prompt.text !== 'string') {
      throw new Error('Invalid prompt: missing text');
    }
    if (!validCategories.includes(prompt.category)) {
      throw new Error(`Invalid category "${prompt.category}" for prompt "${prompt.text}"`);
    }
  }

  console.log(`[BatchGeneration] Successfully generated ${parsed.prompts.length} prompts`);
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
  const icp = profile.companyICP || 'Small to medium businesses';

  // Products with descriptions: keep items that contain " - " (Firecrawl format)
  const productsWithDescriptions = services.some((s: string) => s.includes(' - '))
    ? services
    : undefined;

  // ICP segments: split by comma if there are multiple
  const icpSegments = icp.includes(',')
    ? icp.split(',').map((s: string) => s.trim()).filter((s: string) => s)
    : undefined;

  return {
    companyName: profile.companyName || 'Unknown Company',
    companyDescription: description,
    industry,
    productsServices: services,
    idealCustomer: icp,
    competitors: competitors.length > 0 ? competitors : ['Industry competitors'],
    websiteUrl: profile.companyWebsite || undefined,
    productsWithDescriptions,
    icpSegments,
    inferredBusinessType: inferBusinessType(industry, description, services),
  };
}

// --- Initial prompt generation for onboarding (GPT-5.1, JSON, business-type-aware) ---

export interface InitialGeneratedPrompt {
  text: string;
  category: 'Organic' | 'Competitor' | 'How-to Guides' | 'Brand-Specific' | 'FAQ';
}

function getBusinessTypeGuidance(type: string): string {
  switch (type) {
    case 'saas':
      return `- Include prompts about pricing tiers, feature comparisons, integrations, and migration from competitors
- Generate FAQ prompts around onboarding, security, and API capabilities
- Add "best [category] software for [use case]" style organic queries`;
    case 'ecommerce':
      return `- Include prompts about product reviews, shipping, returns, and deals
- Generate FAQ prompts around sizing, availability, and payment options
- Add "best [product type] for [occasion/use case]" style organic queries`;
    case 'agency':
      return `- Include prompts about case studies, expertise, industry specialization, and ROI
- Generate FAQ prompts around process, timelines, and deliverables
- Add "best [service type] agency for [industry/need]" style organic queries`;
    case 'marketplace':
      return `- Include prompts about selection, trustworthiness, fees, and buyer/seller experiences
- Generate FAQ prompts around listing, payments, and dispute resolution
- Add "best marketplace for [category]" style organic queries`;
    case 'enterprise':
      return `- Include prompts about scalability, compliance, security certifications, and SLAs
- Generate FAQ prompts around enterprise deployment, custom contracts, and support tiers
- Add "enterprise [solution type] for [industry]" style organic queries`;
    default:
      return `- Generate a diverse mix of discovery, comparison, and informational queries
- Include FAQ prompts derived from the company's specific products and services`;
  }
}

/**
 * Compute exact per-category counts that sum to totalPrompts.
 * Organic gets 50%, with the remainder split across the other 4 categories.
 */
function computeCategoryCounts(totalPrompts: number): Record<string, number> {
  const organic = Math.round(totalPrompts * 0.50);
  const remaining = totalPrompts - organic;
  const competitor = Math.round(remaining * 0.25);   // ~12.5% of total
  const faq        = Math.round(remaining * 0.30);   // ~15%   of total
  const howto      = Math.round(remaining * 0.22);   // ~11%   of total
  const brand      = remaining - competitor - faq - howto; // ~11.5% of total (absorbs rounding)
  return { Organic: organic, Competitor: competitor, 'How-to Guides': howto, 'Brand-Specific': brand, FAQ: faq };
}

/**
 * Generate initial prompts for a brand during onboarding.
 * Uses GPT-5.1 with JSON output, 5 categories including FAQ,
 * business-type-aware guidance, and richer product/ICP context.
 */
export async function generateInitialPrompts(brandInfo: BrandInfo, redditContext?: string | null, language: 'en' | 'es' = 'en'): Promise<InitialGeneratedPrompt[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const productCount = brandInfo.productsServices.length;
  const icpCount = brandInfo.icpSegments?.length ?? 1;
  const totalPrompts = Math.min(60, 40 + Math.min(productCount * 2, 10) + Math.min(icpCount * 2, 10));

  const counts = computeCategoryCounts(totalPrompts);

  const businessType = brandInfo.inferredBusinessType || 'other';
  const businessGuidance = getBusinessTypeGuidance(businessType);

  const languageInstruction = language === 'es'
    ? `\n\nIMPORTANT: Generate ALL queries in Spanish (Español). The prompts should be phrased as a native Spanish speaker would naturally search. Do NOT simply translate English queries — use culturally appropriate phrasing.`
    : '';

  // Style anchors: when Reddit context is unavailable, inject example queries
  // so the model sees the conversational register we want.
  const styleAnchors = redditContext ? '' : `

Style reference — these are real queries people type into AI assistants. Match this register:
- "I'm building a SaaS app and need a deployment platform — what are my options?"
- "Our finance team wastes 10 hours/week on expense reports. What tools actually automate this?"
- "Is it worth switching from [Competitor] to something else? We're a 50-person startup"
- "Can someone explain the difference between edge functions and serverless?"
- "Freelancer here getting paid in USD but living abroad — best way to manage this?"
- "My team just hit 20 engineers, what do companies our size use for X?"`;

  const systemPrompt = `You generate natural-language search queries to test a brand's visibility in generative AI engines (ChatGPT, Perplexity, Gemini, Claude).

Generate exactly ${totalPrompts} unique search queries with this EXACT category distribution:

1. **Organic** — exactly ${counts['Organic']} prompts: Generic discovery queries where the brand could naturally appear. The brand name must NOT appear in these.
2. **Competitor** — exactly ${counts['Competitor']} prompts: Queries comparing or seeking alternatives to the brand's competitors.
3. **How-to Guides** — exactly ${counts['How-to Guides']} prompts: Actionable task/how-to queries related to the brand's domain.
4. **Brand-Specific** — exactly ${counts['Brand-Specific']} prompts: Direct queries mentioning the brand name.
5. **FAQ** — exactly ${counts['FAQ']} prompts: Question-style prompts derived from specific products/services and customer needs.

Business type: ${businessType}
${businessGuidance}

ORGANIC STYLE RULES (critical — follow these strictly):
- Do NOT put the brand name in any Organic prompt. Organic tests whether AI discovers the brand unprompted.
- No more than 20% of Organic prompts may start with the word "best". Vary your openings.
- At least 15% of Organic prompts must be conversational/personal: "I need...", "looking for...", "I'm trying to...", "my team needs..."
- At least 10% must be scenario-based with real-world context: "our company just raised Series A and we need...", "I'm a freelancer earning in USD..."
- At least 10% must be decision-help or opinion-seeking: "is it worth...", "which should I use...", "thoughts on..."
- Include some time-anchored queries: "in 2025", "latest", "right now"
- Include some budget/cost queries: "free", "affordable", "pricing"
- Match how real people talk to ChatGPT/Perplexity — casual, context-rich, sometimes messy${styleAnchors}

OTHER RULES:
- Mention specific products/services by name in at least 30% of non-Organic queries
- Keep queries concise (under 120 characters each)
- FAQ queries must start with a question word (How, What, Why, Can, Is, Does, etc.)

Return ONLY valid JSON (no markdown, no code blocks):
{
  "prompts": [
    { "text": "query text", "category": "Organic" },
    ...
  ]
}

Categories must be exactly one of: "Organic", "Competitor", "How-to Guides", "Brand-Specific", "FAQ"

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

  const userPrompt = `Brand: ${brandInfo.companyName}
Website: ${websiteUrl}${subdomainFocus}
Industry: ${brandInfo.industry}
Description: ${brandInfo.companyDescription}

Products/Services:
${productsSection}

Target Customer Segments:
${icpSection}

Competitors: ${brandInfo.competitors.join(', ')}${redditSection}

Generate exactly ${totalPrompts} prompts now.`;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  console.log(`[InitialPrompts] Generating ${totalPrompts} ${language === 'es' ? 'Spanish' : 'English'} prompts via GPT-5.1 (business type: ${businessType})...`);

  const response = await openai.chat.completions.create({
    model: 'gpt-5.1',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_completion_tokens: 4000,
  });

  const content = response.choices[0]?.message?.content || '';
  if (!content) {
    throw new Error('Empty response from GPT-5.1');
  }

  // Extract JSON from response (model may wrap in markdown code blocks)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to extract JSON from GPT-5.1 response');
  }

  let parsed: { prompts: InitialGeneratedPrompt[] };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('Failed to parse GPT-5.1 response as JSON');
  }

  if (!Array.isArray(parsed.prompts) || parsed.prompts.length === 0) {
    throw new Error(`Expected ${totalPrompts} prompts but got ${parsed.prompts?.length ?? 0}`);
  }

  const validCategories = ['Organic', 'Competitor', 'How-to Guides', 'Brand-Specific', 'FAQ'];
  const validated = parsed.prompts.filter(
    p => p.text && typeof p.text === 'string' && validCategories.includes(p.category)
  );

  console.log(`[InitialPrompts] Generated ${validated.length} valid prompts (requested ${totalPrompts})`);
  return validated;
}
