#!/usr/bin/env npx tsx
/**
 * END-TO-END extraction pipeline test.
 *
 * Makes REAL gpt-5.2 API calls using the EXACT same extraction prompt,
 * system message, model, and response_format used in production, then runs
 * the full post-processing chain:
 *   LLM call → JSON parse → cleanLLMAnalysisNames → filterValidCompetitors
 *   → position cap (1-20) → sentiment filter → validateBrandMention cross-check
 *   → validateBrandPosition → final PromptTest result
 *
 * Run:  npx tsx scripts/test-extraction-e2e.ts
 */

import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY in .env.local');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const MODEL = 'gpt-5.2';
const MAX_VALID_POSITION = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Production functions — copied verbatim
// ─────────────────────────────────────────────────────────────────────────────

function validateBrandPosition(position: number | null | undefined): number | undefined {
  if (position === null || position === undefined) return undefined;
  if (position >= 1 && position <= MAX_VALID_POSITION) return position;
  return undefined;
}

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

function cleanLLMAnalysisNames(analysis: any): void {
  if (analysis.competitorsMentioned && Array.isArray(analysis.competitorsMentioned)) {
    analysis.competitorsMentioned = analysis.competitorsMentioned
      .map((name: string) => name.replace(/\s*\(.*$/, '').trim())
      .filter((name: string) => name.length > 0);
  }
  if (analysis.competitorPositions && typeof analysis.competitorPositions === 'object') {
    const cleaned: Record<string, number> = {};
    for (const [name, pos] of Object.entries(analysis.competitorPositions)) {
      const clean = name.replace(/\s*\(.*$/, '').trim();
      if (clean.length > 0) {
        const numPos = pos as number;
        if (clean in cleaned) cleaned[clean] = Math.min(cleaned[clean], numPos);
        else cleaned[clean] = numPos;
      }
    }
    analysis.competitorPositions = cleaned;
  }
  if (analysis.competitorSentiments && typeof analysis.competitorSentiments === 'object') {
    const cleaned: Record<string, string> = {};
    for (const [name, sent] of Object.entries(analysis.competitorSentiments)) {
      const clean = name.replace(/\s*\(.*$/, '').trim();
      if (clean.length > 0) {
        if (!(clean in cleaned)) cleaned[clean] = sent as string;
      }
    }
    analysis.competitorSentiments = cleaned;
  }
}

function filterValidCompetitors(competitors: string[], brandName: string): string[] {
  if (!competitors || !Array.isArray(competitors)) return [];
  const brandLower = brandName.toLowerCase();
  const brandFirstWord = brandLower.split(/\s+/)[0];

  return competitors.filter(comp => {
    if (!comp || typeof comp !== 'string') return false;
    const compLower = comp.toLowerCase().trim();
    if (!compLower || compLower.length === 0) return false;
    if (compLower === brandLower || compLower.includes(brandLower)) return false;
    if (compLower.startsWith(brandFirstWord + ' ') || compLower.startsWith(brandFirstWord + "'s")) return false;

    const genericProductNames = [
      'ai sdk', 'ai gateway', 'ai agent', 'ai assistant', 'ai platform', 'ai api',
      'sdk', 'api', 'gateway', 'agent', 'cli', 'dashboard', 'platform',
      'payment gateway', 'payment api', 'payment platform', 'checkout',
      'edge functions', 'edge network', 'edge runtime', 'serverless functions',
      'analytics', 'insights', 'observability', 'monitoring',
      'preview deployments', 'preview environments', 'instant rollbacks',
      'automatic scaling', 'auto scaling', 'global cdn',
      'pro plan', 'enterprise plan', 'team plan', 'free tier',
      'managed infrastructure', 'infrastructure as code',
    ];
    if (genericProductNames.includes(compLower)) return false;

    const words = compLower.split(/\s+/);
    if (words.length === 2) {
      const genericSecondWords = [
        'sdk', 'api', 'cli', 'gateway', 'agent', 'platform', 'runtime',
        'functions', 'network', 'cdn', 'edge', 'proxy', 'cache',
        'dashboard', 'console', 'portal', 'studio', 'hub', 'center',
      ];
      if (genericSecondWords.includes(words[1])) {
        const genericFirstWords = ['ai', 'edge', 'cloud', 'serverless', 'managed', 'global', 'auto', 'instant'];
        if (genericFirstWords.includes(words[0])) return false;
      }
    }

    if (comp.length < 2 || comp.length > 40) return false;

    const genericTerms = [
      'networking', 'internships', 'internships and co', 'career fairs', 'career services',
      'job portals', 'online job portals', 'job boards', 'resume builders',
      'professional certifications', 'coding competitions', 'hackathons',
      'coding competitions and hackathons', 'technical blogs', 'portfolios',
      'technical blogs and portfolios', 'alumni networks', 'mentorship',
      'career advising', 'career coaching', 'mock interviews', 'interview prep',
      'company career pages', 'recruitment agencies', 'virtual career summit',
      'online courses', 'bootcamps', 'workshops', 'webinars', 'tutorials',
      'certification programs', 'degree programs', 'moocs', 'scholarships',
      'open source', 'software solutions', 'cloud services', 'web development',
      'mobile development', 'data science', 'machine learning', 'ai tools',
      'industry events', 'meetups', 'conferences', 'summits', 'forums',
      'communities', 'professional organizations', 'associations', 'groups',
      'platforms', 'resources', 'tools', 'services', 'solutions',
    ];
    if (genericTerms.includes(compLower)) return false;

    const categoryStarts = [
      'online ', 'virtual ', 'professional ', 'technical ', 'coding ',
      'career ', 'job ', 'industry ', 'software ', 'tech ', 'digital ',
      'ai ', 'commercial ', 'decentralized ', 'centralized ', 'distributed ',
    ];
    for (const start of categoryStarts) {
      if (compLower.startsWith(start)) {
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

    if (comp.includes('/')) {
      const slashExceptions = ['fly.io', 'bolt.new', 'ci/cd', 'gitlab ci/cd', 'next.js'];
      if (!slashExceptions.some(ex => compLower.includes(ex))) return false;
    }

    const pluralCategoryNouns = [
      'marketplaces', 'networks', 'services', 'providers', 'platforms',
      'solutions', 'tools', 'systems', 'agencies', 'organizations',
      'ecosystems', 'protocols', 'frameworks', 'offerings', 'alternatives', 'options',
    ];
    const lastWord = words[words.length - 1];
    if (pluralCategoryNouns.includes(lastWord)) {
      if (words.length >= 3) return false;
      if (words.length === 2) {
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
      ' is ', ' are ', ' was ', ' were ', ' has ', ' have ', ' had ',
      ' does ', ' do ', ' did ', ' can ', ' may ', ' must ',
      ' being ', ' been ', ' having ', ' doing ',
      ' that ', ' which ', ' who ', ' whom ', ' whose ', ' where ',
      ' because ', ' since ', ' although ', ' though ', ' while ',
    ];
    if (actionPatterns.some(pattern => compLower.includes(pattern))) return false;

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

    if (comp.includes('-') && words.length >= 3) {
      const descriptorHyphens = ['-enhanced', '-powered', '-driven', '-based', '-enabled', '-native', '-first', '-focused', '-oriented', '-optimized'];
      if (descriptorHyphens.some(h => compLower.includes(h))) return false;
    }

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

// ─────────────────────────────────────────────────────────────────────────────
// Build the EXACT same extraction prompt used in production
// ─────────────────────────────────────────────────────────────────────────────

function buildExtractionPrompt(
  brandName: string,
  description: string,
  competitors: string[],
  responseText: string
): string {
  return `Analyze this AI-generated response to determine brand visibility:

BRAND NAME: ${brandName}
WHAT "${brandName}" DOES: ${description}
KNOWN DIRECT COMPETITORS: ${competitors.join(', ') || 'None specified'}

RESPONSE TEXT:
"${responseText}"

Extract the following information:

1. **brandMentioned**: Is "${brandName}" mentioned anywhere in the response? (true/false)

2. **brandPosition**: What numerical ranking/position is "${brandName}" given?
   - Look for patterns like "1st", "2nd", "3rd", "#1", "first place", "ranked 1", etc.
   - Extract ONLY the number (1, 2, 3, etc.)
   - If no explicit position/ranking is found, return null
   - Examples:
     * "### 1st: Y Combinator" → 1
     * "2nd Place: Y Combinator" → 2
     * "#3: Y Combinator" → 3
     * "Y Combinator is mentioned but no ranking" → null

3. **competitorsMentioned**: Array of OTHER company/brand names mentioned in the response (EXCLUDING "${brandName}" itself)
   - Extract ALL proper company/brand names that compete with or are alternatives to "${brandName}": ${description}
   - For reference, these are known competitors (but do NOT limit extraction to only these): ${competitors.join(', ') || 'None'}
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

6. **sentiment**: Overall sentiment toward "${brandName}" in this response:
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
}

// ─────────────────────────────────────────────────────────────────────────────
// Full provider post-processing chain (EXACT prod logic)
// ─────────────────────────────────────────────────────────────────────────────

interface PromptTestResult {
  brandMentioned: boolean;
  brandPosition: number | undefined;
  competitors: string[];
  competitorPositions: Record<string, number>;
  competitorSentiments: Record<string, string>;
  sentiment: string;
  confidence: number;
}

async function runFullExtraction(
  brandName: string,
  description: string,
  competitors: string[],
  responseText: string
): Promise<{ raw: any; final: PromptTestResult }> {
  const prompt = buildExtractionPrompt(brandName, description, competitors, responseText);

  // Retry loop — exact prod logic
  let analysis: any = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const resp = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing AI responses for brand visibility. Extract position/ranking numbers carefully for both the brand and competitors. Respond ONLY with valid JSON - no markdown, no code blocks, just the JSON object.',
          },
          { role: 'user', content: prompt },
        ],
        max_completion_tokens: 2000,
        response_format: { type: 'json_object' },
      });
      const raw = resp.choices[0]?.message?.content || '{}';
      const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
      analysis = JSON.parse(cleaned);
      cleanLLMAnalysisNames(analysis);
      break;
    } catch (err) {
      console.warn(`  [attempt ${attempt}/2 failed]`, err instanceof Error ? err.message : err);
      if (attempt === 2) {
        analysis = {
          brandMentioned: validateBrandMention(responseText, brandName),
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

  const raw = JSON.parse(JSON.stringify(analysis)); // snapshot before mutation

  // Post-processing chain
  const mergedPositions = analysis.competitorPositions || {};
  const regexBrandMentioned = validateBrandMention(responseText, brandName);
  const validatedCompetitors = filterValidCompetitors(analysis.competitorsMentioned || [], brandName);

  const validatedPositions: Record<string, number> = {};
  validatedCompetitors.forEach(comp => {
    const pos = mergedPositions[comp];
    if (pos && pos >= 1 && pos <= MAX_VALID_POSITION) validatedPositions[comp] = pos;
  });

  const validatedSentiments: Record<string, string> = {};
  validatedCompetitors.forEach(comp => {
    if (analysis.competitorSentiments?.[comp]) validatedSentiments[comp] = analysis.competitorSentiments[comp];
  });

  return {
    raw,
    final: {
      brandMentioned: regexBrandMentioned,
      brandPosition: validateBrandPosition(analysis.brandPosition),
      competitors: validatedCompetitors,
      competitorPositions: validatedPositions,
      competitorSentiments: validatedSentiments,
      sentiment: analysis.sentiment || 'neutral',
      confidence: analysis.confidence || 0.5,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test scenarios
// ─────────────────────────────────────────────────────────────────────────────

interface Scenario {
  id: string;
  name: string;
  brandName: string;
  description: string;
  competitors: string[];
  responseText: string;
  assertions: (raw: any, final: PromptTestResult) => string[];  // returns list of failures
}

const scenarios: Scenario[] = [
  // ── 1. Numbered list, brand at #1 ─────────────────────────────────────
  {
    id: 'S01',
    name: 'Numbered list — brand ranked #1',
    brandName: 'Y Combinator',
    description: 'Startup accelerator',
    competitors: ['Techstars', '500 Global', 'Antler'],
    responseText: `Here are the top startup accelerators in 2025:

1. **Y Combinator** — The gold standard of accelerators, with alumni including Airbnb, Stripe, and DoorDash. They invest $500K for 7% equity.
2. **Techstars** — Known for its strong mentorship network and industry-specific programs.
3. **500 Global** — Offers a global reach with programs in over 75 countries.
4. **Antler** — Growing fast with a focus on early-stage company building.
5. **Seedcamp** — Europe's leading pre-seed fund and accelerator.`,
    assertions: (_raw, f) => {
      const fails: string[] = [];
      if (!f.brandMentioned) fails.push('brandMentioned should be true');
      if (f.brandPosition !== 1) fails.push(`brandPosition should be 1, got ${f.brandPosition}`);
      if (!f.competitors.includes('Techstars')) fails.push('missing Techstars');
      if (!f.competitors.includes('500 Global')) fails.push('missing 500 Global');
      if (!f.competitors.includes('Antler')) fails.push('missing Antler');
      if (!f.competitors.includes('Seedcamp')) fails.push('missing Seedcamp (discovered competitor)');
      if (f.competitorPositions['Techstars'] !== 2) fails.push(`Techstars pos should be 2, got ${f.competitorPositions['Techstars']}`);
      if (f.competitorPositions['Antler'] !== 4) fails.push(`Antler pos should be 4, got ${f.competitorPositions['Antler']}`);
      if (f.sentiment !== 'positive') fails.push(`sentiment should be positive, got ${f.sentiment}`);
      return fails;
    },
  },

  // ── 2. Brand not mentioned at all ─────────────────────────────────────
  {
    id: 'S02',
    name: 'Brand completely absent from response',
    brandName: 'Mudra',
    description: 'AI visibility analytics platform',
    competitors: ['Semrush', 'Ahrefs'],
    responseText: `When it comes to SEO tools, there are several excellent options:

- **Semrush** provides comprehensive keyword research and competitive analysis.
- **Ahrefs** is known for its backlink analysis and site audit capabilities.
- **Moz** offers a beginner-friendly interface with solid domain authority metrics.

Each tool has its strengths depending on your specific needs.`,
    assertions: (_raw, f) => {
      const fails: string[] = [];
      if (f.brandMentioned) fails.push('brandMentioned should be false');
      if (f.brandPosition !== undefined) fails.push(`brandPosition should be undefined, got ${f.brandPosition}`);
      if (!f.competitors.includes('Semrush')) fails.push('missing Semrush');
      if (!f.competitors.includes('Ahrefs')) fails.push('missing Ahrefs');
      if (!f.competitors.includes('Moz')) fails.push('missing Moz (discovered)');
      return fails;
    },
  },

  // ── 3. Brand mentioned in prose, no ranking ───────────────────────────
  {
    id: 'S03',
    name: 'Brand in prose, no explicit rank',
    brandName: 'Vercel',
    description: 'Frontend cloud platform and hosting',
    competitors: ['Netlify', 'Cloudflare Pages', 'AWS Amplify'],
    responseText: `For deploying modern web applications, Vercel has become a popular choice among developers due to its seamless integration with Next.js. Netlify is another strong option, particularly for JAMstack sites. Cloudflare Pages offers competitive pricing and edge network performance. AWS Amplify is suited for teams already in the AWS ecosystem.`,
    assertions: (_raw, f) => {
      const fails: string[] = [];
      if (!f.brandMentioned) fails.push('brandMentioned should be true');
      if (f.brandPosition !== undefined) fails.push(`brandPosition should be undefined (no ranking), got ${f.brandPosition}`);
      if (!f.competitors.includes('Netlify')) fails.push('missing Netlify');
      if (!f.competitors.includes('Cloudflare Pages')) fails.push('missing Cloudflare Pages');
      if (!f.competitors.includes('AWS Amplify')) fails.push('missing AWS Amplify');
      if (f.competitors.some(c => c.toLowerCase().includes('vercel'))) fails.push('brand should not be in competitors');
      return fails;
    },
  },

  // ── 4. Long list with 10 items, brand at position 7 ──────────────────
  {
    id: 'S04',
    name: 'Long numbered list, brand at #7',
    brandName: 'Render',
    description: 'Cloud hosting platform',
    competitors: ['Heroku', 'Railway', 'Fly.io'],
    responseText: `Top 10 cloud hosting platforms for developers in 2025:

1. AWS — The market leader with the broadest service catalog
2. Google Cloud Platform — Strong in AI/ML workloads
3. Microsoft Azure — Enterprise favorite with hybrid cloud support
4. DigitalOcean — Developer-friendly with simple pricing
5. Heroku — Pioneer of PaaS, great for quick deployments
6. Railway — Modern developer experience with instant deploys
7. Render — Excellent auto-scaling and free tier for side projects
8. Fly.io — Edge computing focus with global deployment
9. Vercel — Best-in-class for frontend and Next.js apps
10. Netlify — JAMstack specialist with great CI/CD`,
    assertions: (_raw, f) => {
      const fails: string[] = [];
      if (!f.brandMentioned) fails.push('brandMentioned should be true');
      if (f.brandPosition !== 7) fails.push(`brandPosition should be 7, got ${f.brandPosition}`);
      if (!f.competitors.includes('Heroku')) fails.push('missing Heroku');
      if (!f.competitors.includes('Railway')) fails.push('missing Railway');
      if (f.competitorPositions['Heroku'] !== 5) fails.push(`Heroku pos should be 5, got ${f.competitorPositions['Heroku']}`);
      if (f.competitorPositions['Railway'] !== 6) fails.push(`Railway pos should be 6, got ${f.competitorPositions['Railway']}`);
      // Should capture ALL 9 competitors (10 items minus brand)
      if (f.competitors.length < 7) fails.push(`Should have at least 7 competitors, got ${f.competitors.length}`);
      return fails;
    },
  },

  // ── 5. Descriptive phrases & category headings mixed in ──────────────
  {
    id: 'S05',
    name: 'Junk phrases mixed with real companies',
    brandName: 'Scale AI',
    description: 'AI data labeling and model evaluation platform',
    competitors: ['Labelbox', 'Snorkel AI', 'Appen'],
    responseText: `The AI data labeling landscape includes several key players and approaches:

**AI-enhanced coding & collaboration** tools are becoming more prevalent. Leading companies include:

- **Labelbox** — Comprehensive data labeling platform with strong enterprise features
- **Snorkel AI** — Pioneering programmatic labeling and data-centric AI
- **Appen** — One of the largest crowd-sourced data annotation services
- **Scale AI** is particularly noteworthy for its government contracts and high-quality training data.

Other approaches include cloud-native scaling services and ML-powered deployment tools that automate parts of the pipeline.`,
    assertions: (_raw, f) => {
      const fails: string[] = [];
      if (!f.brandMentioned) fails.push('brandMentioned should be true');
      if (!f.competitors.includes('Labelbox')) fails.push('missing Labelbox');
      if (!f.competitors.includes('Snorkel AI')) fails.push('missing Snorkel AI');
      if (!f.competitors.includes('Appen')) fails.push('missing Appen');
      // These MUST be filtered out
      if (f.competitors.some(c => c.toLowerCase().includes('ai-enhanced coding'))) fails.push('should have filtered "AI-enhanced coding & collaboration"');
      if (f.competitors.some(c => c.toLowerCase().includes('cloud-native'))) fails.push('should have filtered "cloud-native scaling services"');
      if (f.competitors.some(c => c.toLowerCase().includes('ml-powered'))) fails.push('should have filtered "ML-powered deployment tools"');
      if (f.competitors.some(c => c.toLowerCase().includes('scale ai'))) fails.push('brand (Scale AI) should not be in competitors');
      return fails;
    },
  },

  // ── 6. Negative sentiment about brand ─────────────────────────────────
  {
    id: 'S06',
    name: 'Negative sentiment toward brand',
    brandName: 'Heroku',
    description: 'Cloud PaaS platform',
    competitors: ['Railway', 'Render', 'Fly.io'],
    responseText: `Heroku was once the go-to platform for deploying web applications, but it has fallen behind in recent years. The removal of free dynos in 2022 alienated much of its developer community, and its pricing is now considered expensive compared to modern alternatives.

**Railway** has emerged as a strong replacement, offering a modern developer experience with competitive pricing. **Render** provides excellent auto-scaling capabilities and a generous free tier. **Fly.io** focuses on edge computing and global deployment.

Many developers have migrated away from Heroku to these newer platforms.`,
    assertions: (_raw, f) => {
      const fails: string[] = [];
      if (!f.brandMentioned) fails.push('brandMentioned should be true');
      if (f.sentiment !== 'negative') fails.push(`sentiment should be negative, got ${f.sentiment}`);
      if (!f.competitors.includes('Railway')) fails.push('missing Railway');
      if (!f.competitors.includes('Render')) fails.push('missing Render');
      // Railway and Render described positively in contrast
      const railwaySent = f.competitorSentiments['Railway'];
      if (railwaySent !== 'positive') fails.push(`Railway sentiment should be positive, got ${railwaySent}`);
      return fails;
    },
  },

  // ── 7. Very short response, single sentence ──────────────────────────
  {
    id: 'S07',
    name: 'Ultra-short response — one sentence',
    brandName: 'Stripe',
    description: 'Payment processing API',
    competitors: ['PayPal', 'Square', 'Adyen'],
    responseText: `Stripe is widely regarded as the best payment processing API for developers, though PayPal remains dominant in consumer payments.`,
    assertions: (_raw, f) => {
      const fails: string[] = [];
      if (!f.brandMentioned) fails.push('brandMentioned should be true');
      if (!f.competitors.includes('PayPal')) fails.push('missing PayPal');
      if (f.brandPosition !== undefined) fails.push(`brandPosition should be undefined (no ranking), got ${f.brandPosition}`);
      if (f.sentiment !== 'positive') fails.push(`sentiment should be positive, got ${f.sentiment}`);
      return fails;
    },
  },

  // ── 8. Ordinal positions (1st, 2nd, 3rd) not numbered list ───────────
  {
    id: 'S08',
    name: 'Ordinal format: 1st, 2nd, 3rd',
    brandName: 'Notion',
    description: 'Productivity and note-taking workspace',
    competitors: ['Obsidian', 'Coda', 'Confluence'],
    responseText: `In the productivity workspace category:

1st Place: **Notion** — Best all-around workspace with databases, docs, and wikis
2nd Place: **Obsidian** — Excellent for personal knowledge management with local-first approach
3rd Place: **Coda** — Strong for teams needing custom workflows and automations
4th Place: **Confluence** — Enterprise standard but showing its age`,
    assertions: (_raw, f) => {
      const fails: string[] = [];
      if (!f.brandMentioned) fails.push('brandMentioned should be true');
      if (f.brandPosition !== 1) fails.push(`brandPosition should be 1, got ${f.brandPosition}`);
      if (f.competitorPositions['Obsidian'] !== 2) fails.push(`Obsidian pos should be 2, got ${f.competitorPositions['Obsidian']}`);
      if (f.competitorPositions['Coda'] !== 3) fails.push(`Coda pos should be 3, got ${f.competitorPositions['Coda']}`);
      if (f.competitorPositions['Confluence'] !== 4) fails.push(`Confluence pos should be 4, got ${f.competitorPositions['Confluence']}`);
      return fails;
    },
  },

  // ── 9. Brand's own products extracted as competitors ──────────────────
  {
    id: 'S09',
    name: 'Brand products should NOT appear as competitors',
    brandName: 'Vercel',
    description: 'Frontend cloud platform, Next.js',
    competitors: ['Netlify', 'Cloudflare Pages'],
    responseText: `Vercel offers several products including the Vercel AI SDK, Vercel Edge Functions, and the Vercel Dashboard. Competing platforms include Netlify, which offers similar static hosting, and Cloudflare Pages with its global edge network.`,
    assertions: (_raw, f) => {
      const fails: string[] = [];
      if (!f.brandMentioned) fails.push('brandMentioned should be true');
      if (!f.competitors.includes('Netlify')) fails.push('missing Netlify');
      if (!f.competitors.includes('Cloudflare Pages')) fails.push('missing Cloudflare Pages');
      // Brand products must be filtered
      if (f.competitors.some(c => c.toLowerCase().includes('vercel'))) fails.push('Brand products (Vercel *) should not appear as competitors');
      return fails;
    },
  },

  // ── 10. Mixed competitor sentiments ───────────────────────────────────
  {
    id: 'S10',
    name: 'Competitors with mixed positive/negative sentiments',
    brandName: 'Datadog',
    description: 'Cloud monitoring and observability platform',
    competitors: ['New Relic', 'Grafana', 'Splunk'],
    responseText: `Datadog leads the cloud observability market with its excellent unified monitoring platform.

**New Relic** has struggled with pricing complaints and customer churn, though their recent free tier improvements helped. **Grafana** is outstanding for open-source teams, offering flexibility that proprietary tools can't match. **Splunk** faces criticism for its high costs and complex licensing, but remains strong in enterprise log management.`,
    assertions: (_raw, f) => {
      const fails: string[] = [];
      if (!f.brandMentioned) fails.push('brandMentioned should be true');
      if (f.sentiment !== 'positive') fails.push(`sentiment should be positive, got ${f.sentiment}`);
      // Sentiment accuracy for competitors
      const nrSent = f.competitorSentiments['New Relic'];
      const grafSent = f.competitorSentiments['Grafana'];
      const splSent = f.competitorSentiments['Splunk'];
      if (nrSent !== 'negative' && nrSent !== 'neutral') fails.push(`New Relic should be negative/neutral, got ${nrSent}`);
      if (grafSent !== 'positive') fails.push(`Grafana should be positive, got ${grafSent}`);
      if (splSent !== 'negative' && splSent !== 'neutral') fails.push(`Splunk should be negative/neutral, got ${splSent}`);
      return fails;
    },
  },

  // ── 11. Hash-position format (#1, #2, #3) ────────────────────────────
  {
    id: 'S11',
    name: 'Hash position format: #1, #2, #3',
    brandName: 'Figma',
    description: 'Collaborative design tool',
    competitors: ['Sketch', 'Adobe XD', 'Framer'],
    responseText: `Top design tools ranked:
#1: Figma — Industry standard for collaborative UI design
#2: Framer — Rising fast with powerful prototyping and publishing
#3: Sketch — Still popular on macOS but losing ground
#4: Adobe XD — Being sunset in favor of Figma integration`,
    assertions: (_raw, f) => {
      const fails: string[] = [];
      if (!f.brandMentioned) fails.push('brandMentioned should be true');
      if (f.brandPosition !== 1) fails.push(`brandPosition should be 1, got ${f.brandPosition}`);
      if (f.competitorPositions['Framer'] !== 2) fails.push(`Framer pos should be 2, got ${f.competitorPositions['Framer']}`);
      if (f.competitorPositions['Sketch'] !== 3) fails.push(`Sketch pos should be 3, got ${f.competitorPositions['Sketch']}`);
      if (f.competitorPositions['Adobe XD'] !== 4) fails.push(`Adobe XD pos should be 4, got ${f.competitorPositions['Adobe XD']}`);
      return fails;
    },
  },

  // ── 12. Brand only in URL (false positive test) ──────────────────────
  {
    id: 'S12',
    name: 'Brand only in URL — regex should override LLM',
    brandName: 'Linear',
    description: 'Project management tool',
    competitors: ['Jira', 'Asana'],
    responseText: `For project management, Jira remains the enterprise standard while Asana excels at team collaboration. You can learn more at https://linear.app/docs about another option.`,
    assertions: (_raw, f) => {
      const fails: string[] = [];
      // Brand "Linear" only appears in URL — regex cross-check should return false
      if (f.brandMentioned) fails.push('brandMentioned should be false (brand only in URL)');
      if (!f.competitors.includes('Jira')) fails.push('missing Jira');
      if (!f.competitors.includes('Asana')) fails.push('missing Asana');
      return fails;
    },
  },

  // ── 13. Empty/no competitors response ─────────────────────────────────
  {
    id: 'S13',
    name: 'Response about brand with zero competitors mentioned',
    brandName: 'Cursor',
    description: 'AI-powered code editor',
    competitors: ['GitHub Copilot', 'Cody'],
    responseText: `Cursor is an innovative AI-powered code editor that integrates large language models directly into the development workflow. It supports tab completion, inline editing, and chat-based code generation. The tool has gained significant traction among developers looking for AI assistance in their daily coding tasks.`,
    assertions: (_raw, f) => {
      const fails: string[] = [];
      if (!f.brandMentioned) fails.push('brandMentioned should be true');
      if (f.sentiment !== 'positive') fails.push(`sentiment should be positive, got ${f.sentiment}`);
      // No competitors mentioned in the text
      if (f.competitors.length > 0) fails.push(`Should have 0 competitors, got ${f.competitors.length}: [${f.competitors.join(', ')}]`);
      return fails;
    },
  },

  // ── 14. Brand at a late position (#5) ─────────────────────────────────
  {
    id: 'S14',
    name: 'Brand at position #5 in numbered list',
    brandName: 'Anthropic',
    description: 'AI safety company, maker of Claude',
    competitors: ['OpenAI', 'Google DeepMind', 'Meta AI'],
    responseText: `The leading AI research labs in 2025:

1. **OpenAI** — Creator of GPT-5 and ChatGPT, the most widely used AI
2. **Google DeepMind** — World-class research with Gemini models
3. **Meta AI** — Driving open-source AI with Llama models
4. **Mistral AI** — The European challenger with efficient models
5. **Anthropic** — Focused on AI safety with the Claude model family
6. **Cohere** — Enterprise-focused NLP and RAG solutions`,
    assertions: (_raw, f) => {
      const fails: string[] = [];
      if (!f.brandMentioned) fails.push('brandMentioned should be true');
      if (f.brandPosition !== 5) fails.push(`brandPosition should be 5, got ${f.brandPosition}`);
      if (!f.competitors.includes('OpenAI')) fails.push('missing OpenAI');
      if (!f.competitors.includes('Google DeepMind')) fails.push('missing Google DeepMind');
      if (!f.competitors.includes('Meta AI')) fails.push('missing Meta AI');
      if (!f.competitors.includes('Mistral AI')) fails.push('missing Mistral AI (discovered)');
      if (!f.competitors.includes('Cohere')) fails.push('missing Cohere (discovered)');
      if (f.competitorPositions['OpenAI'] !== 1) fails.push(`OpenAI pos should be 1, got ${f.competitorPositions['OpenAI']}`);
      return fails;
    },
  },

  // ── 15. Bullet list format (no numbers) ──────────────────────────────
  {
    id: 'S15',
    name: 'Bullet list — no numerical ranking',
    brandName: 'Supabase',
    description: 'Open-source Firebase alternative',
    competitors: ['Firebase', 'PlanetScale', 'Neon'],
    responseText: `Popular backend-as-a-service options include:

• **Supabase** — Open-source alternative to Firebase with PostgreSQL
• **Firebase** — Google's real-time database with excellent mobile SDKs
• **PlanetScale** — Serverless MySQL with branching workflows
• **Neon** — Serverless PostgreSQL with autoscaling
• **Appwrite** — Self-hosted backend server for web and mobile

Each has different strengths depending on your database and hosting requirements.`,
    assertions: (_raw, f) => {
      const fails: string[] = [];
      if (!f.brandMentioned) fails.push('brandMentioned should be true');
      if (f.brandPosition !== undefined) fails.push(`brandPosition should be undefined (bullets, no ranking), got ${f.brandPosition}`);
      if (!f.competitors.includes('Firebase')) fails.push('missing Firebase');
      if (!f.competitors.includes('PlanetScale')) fails.push('missing PlanetScale');
      if (!f.competitors.includes('Neon')) fails.push('missing Neon');
      if (!f.competitors.includes('Appwrite')) fails.push('missing Appwrite (discovered)');
      return fails;
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║   E2E Extraction Pipeline — Live gpt-5.2 API Tests             ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  console.log(`Model: ${MODEL}`);
  console.log(`Scenarios: ${scenarios.length}\n`);

  let totalPass = 0;
  let totalFail = 0;
  const allFailures: { id: string; name: string; failures: string[] }[] = [];

  for (const s of scenarios) {
    process.stdout.write(`  ${s.id} ${s.name.padEnd(55)}`);
    try {
      const { raw, final } = await runFullExtraction(s.brandName, s.description, s.competitors, s.responseText);
      const failures = s.assertions(raw, final);

      if (failures.length === 0) {
        console.log('✅');
        totalPass++;
      } else {
        console.log(`❌ (${failures.length} issues)`);
        totalFail++;
        allFailures.push({ id: s.id, name: s.name, failures });
        // Print raw LLM output for debugging
        console.log(`     Raw LLM: mentioned=${raw.brandMentioned}, pos=${raw.brandPosition}, comps=[${(raw.competitorsMentioned||[]).join(', ')}]`);
        console.log(`     Final:   mentioned=${final.brandMentioned}, pos=${final.brandPosition}, comps=[${final.competitors.join(', ')}]`);
        console.log(`     Positions: ${JSON.stringify(final.competitorPositions)}`);
        console.log(`     Sentiments: ${JSON.stringify(final.competitorSentiments)}`);
        for (const f of failures) {
          console.log(`     → ${f}`);
        }
      }
    } catch (err: any) {
      console.log(`💥 ERROR: ${err.message}`);
      totalFail++;
      allFailures.push({ id: s.id, name: s.name, failures: [`EXCEPTION: ${err.message}`] });
    }
  }

  // Summary
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(`Total: ${scenarios.length}  |  ✅ Passed: ${totalPass}  |  ❌ Failed: ${totalFail}`);

  if (allFailures.length > 0) {
    console.log('\n── Failed scenarios ────────────────────────────────────────────');
    for (const f of allFailures) {
      console.log(`  ${f.id}: ${f.name}`);
      f.failures.forEach(msg => console.log(`    → ${msg}`));
    }
  }

  const totalAssertions = scenarios.reduce((sum, s) => {
    // Rough count — each assertion function checks multiple things
    return sum + 4; // average
  }, 0);

  console.log(`\nApprox assertions checked: ${totalAssertions}+`);
  console.log(totalFail === 0 ? '\n🎉 All scenarios passed!' : `\n⚠️  ${totalFail} scenario(s) had issues.`);

  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
