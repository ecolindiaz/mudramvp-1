#!/usr/bin/env npx tsx
/**
 * Test script for the competitor extraction & filtering pipeline.
 * Mirrors the exact logic from:
 *   - direct-geo-analysis.service.ts (filterValidCompetitors, validateBrandPosition,
 *     validateBrandMention, cleanLLMAnalysisNames, normalizeCompanyName, MAX_VALID_POSITION)
 *   - app/api/prompts/[id]/route.ts (normalizeForAggregation, brandPosition ?? null coercion,
 *     competitorSentiments passthrough, normalized aggregation)
 *
 * Run:  npx tsx scripts/test-extraction-pipeline.ts
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. Functions copied verbatim from production code
// ─────────────────────────────────────────────────────────────────────────────

const MAX_VALID_POSITION = 20;

function validateBrandPosition(position: number | null | undefined): number | undefined {
  if (position === null || position === undefined) return undefined;
  if (position >= 1 && position <= MAX_VALID_POSITION) return position;
  return undefined;
}

function validateBrandMention(text: string, brandName: string): boolean {
  const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const trimmedBrand = brandName.trim();
  const escapedBrand = escapeRegex(trimmedBrand);
  if (!escapedBrand) return false;

  // Phase 1: Light clean — strip URLs and code, but keep bare domains intact.
  const lightCleaned = text
    .replace(/https?:\/\/[^\s]+/g, ' ')
    .replace(/www\.[^\s]+/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 1a) Exact brand match
  const exactPattern = new RegExp(`\\b${escapedBrand}\\b`, 'i');
  if (exactPattern.test(lightCleaned)) return true;

  // 1b) If brand has a TLD suffix ("Daytona.io"), also match bare base name ("Daytona")
  const brandBase = trimmedBrand.replace(/\.[a-z]{2,}$/i, '');
  if (brandBase.toLowerCase() !== trimmedBrand.toLowerCase() && brandBase.length >= 2) {
    const basePattern = new RegExp(`\\b${escapeRegex(brandBase)}\\b`, 'i');
    if (basePattern.test(lightCleaned)) return true;
  }

  // Phase 2: Full clean — also strip bare domains for variant-aware matching.
  const fullCleaned = lightCleaned
    .replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (exactPattern.test(fullCleaned)) return true;

  // Variant-aware fallback for merged/split brand forms
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

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s*\(.*?\)\s*$/, '')
    .replace(/\s*(inc\.?|llc\.?|ltd\.?|corp\.?|co\.?|company)$/i, '')
    .replace(/[,!?'"()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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
        if (!(clean in cleaned)) {
          cleaned[clean] = sent as string;
        }
      }
    }
    analysis.competitorSentiments = cleaned;
  }
}

function normalizeForAggregation(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s*\(.*?\)\s*$/, '')
    .replace(/\s*(inc\.?|llc\.?|ltd\.?|corp\.?|co\.?|company)$/i, '')
    .replace(/[,!?'"()&]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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
      'coding competitions and hackackathons', 'technical blogs', 'portfolios',
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

    // NEW: Filter "&"/"and" category phrases
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

    // NEW: Filter hyphenated descriptive phrases
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

// Simulates the position cap in provider post-processing
function filterCompetitorPositions(
  positions: Record<string, number>,
  validatedCompetitors: string[]
): Record<string, number> {
  const result: Record<string, number> = {};
  validatedCompetitors.forEach(comp => {
    const pos = positions[comp];
    if (pos && pos >= 1 && pos <= MAX_VALID_POSITION) {
      result[comp] = pos;
    }
  });
  return result;
}

// Simulates brandPosition coercion fix (|| vs ??)
function coerceBrandPositionOld(pos: any): number | null {
  return pos || null; // BUG: turns 0 into null
}
function coerceBrandPositionNew(pos: any): number | null {
  return pos ?? null; // FIX: preserves 0
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Test runner
// ─────────────────────────────────────────────────────────────────────────────

interface TestCase {
  id: number;
  group: string;
  name: string;
  fn: () => { pass: boolean; detail?: string };
}

const tests: TestCase[] = [];
let nextId = 1;

function test(group: string, name: string, fn: () => { pass: boolean; detail?: string }) {
  tests.push({ id: nextId++, group, name, fn });
}

function assertEqual<T>(actual: T, expected: T, label?: string): { pass: boolean; detail?: string } {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  return {
    pass,
    detail: pass ? undefined : `${label || 'Value'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  };
}

function assertIncludes(arr: string[], item: string): { pass: boolean; detail?: string } {
  const pass = arr.includes(item);
  return { pass, detail: pass ? undefined : `Expected array to include "${item}", got [${arr.join(', ')}]` };
}

function assertNotIncludes(arr: string[], item: string): { pass: boolean; detail?: string } {
  const pass = !arr.includes(item);
  return { pass, detail: pass ? undefined : `Expected array NOT to include "${item}"` };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Test cases (100 edge cases across all functions)
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════
// GROUP A: validateBrandPosition (15 cases)
// ═══════════════════════════════════════════════════════════════════════════

test('validateBrandPosition', 'null → undefined', () =>
  assertEqual(validateBrandPosition(null), undefined));

test('validateBrandPosition', 'undefined → undefined', () =>
  assertEqual(validateBrandPosition(undefined), undefined));

test('validateBrandPosition', '0 → undefined (invalid)', () =>
  assertEqual(validateBrandPosition(0), undefined));

test('validateBrandPosition', '-1 → undefined (negative)', () =>
  assertEqual(validateBrandPosition(-1), undefined));

test('validateBrandPosition', '1 → 1 (minimum valid)', () =>
  assertEqual(validateBrandPosition(1), 1));

test('validateBrandPosition', '10 → 10 (mid-range)', () =>
  assertEqual(validateBrandPosition(10), 10));

test('validateBrandPosition', '20 → 20 (max valid)', () =>
  assertEqual(validateBrandPosition(20), 20));

test('validateBrandPosition', '21 → undefined (over cap)', () =>
  assertEqual(validateBrandPosition(21), undefined));

test('validateBrandPosition', '100 → undefined (way over cap)', () =>
  assertEqual(validateBrandPosition(100), undefined));

test('validateBrandPosition', '999 → undefined (nonsensical)', () =>
  assertEqual(validateBrandPosition(999), undefined));

test('validateBrandPosition', '5.5 → 5.5 (float passes if in range)', () =>
  assertEqual(validateBrandPosition(5.5), 5.5));

test('validateBrandPosition', '0.5 → undefined (sub-1 float)', () =>
  assertEqual(validateBrandPosition(0.5), undefined));

test('validateBrandPosition', '20.1 → undefined (just over cap)', () =>
  assertEqual(validateBrandPosition(20.1), undefined));

test('validateBrandPosition', '-100 → undefined (large negative)', () =>
  assertEqual(validateBrandPosition(-100), undefined));

test('validateBrandPosition', '3 → 3 (typical position)', () =>
  assertEqual(validateBrandPosition(3), 3));

// ═══════════════════════════════════════════════════════════════════════════
// GROUP B: validateBrandMention (59 cases)
// ═══════════════════════════════════════════════════════════════════════════

test('validateBrandMention', 'exact match in text', () =>
  assertEqual(validateBrandMention('I recommend Vercel for deployment', 'Vercel'), true));

test('validateBrandMention', 'case-insensitive match', () =>
  assertEqual(validateBrandMention('Use VERCEL for your apps', 'Vercel'), true));

test('validateBrandMention', 'no match', () =>
  assertEqual(validateBrandMention('Netlify is a great platform', 'Vercel'), false));

test('validateBrandMention', 'partial word should NOT match (Vercellio)', () =>
  assertEqual(validateBrandMention('Vercellio is something else', 'Vercel'), false));

test('validateBrandMention', 'match at start of text', () =>
  assertEqual(validateBrandMention('Vercel offers great DX', 'Vercel'), true));

test('validateBrandMention', 'match at end of text', () =>
  assertEqual(validateBrandMention('Deploy with Vercel', 'Vercel'), true));

test('validateBrandMention', 'brand in URL should NOT match', () =>
  assertEqual(validateBrandMention('Visit https://vercel.com/docs for info', 'Vercel'), false));

test('validateBrandMention', 'brand in code block should NOT match', () =>
  assertEqual(validateBrandMention('Run ```npx vercel deploy``` to start', 'Vercel'), false));

test('validateBrandMention', 'brand in backtick should NOT match', () =>
  assertEqual(validateBrandMention('Use `vercel` CLI tool', 'Vercel'), false));

test('validateBrandMention', 'brand with special chars (C++) — \\b boundary limitation', () =>
  assertEqual(validateBrandMention('Learn C++ for systems programming', 'C++'), false));

test('validateBrandMention', 'brand in www URL should NOT match', () =>
  assertEqual(validateBrandMention('Go to www.vercel.com for details', 'Vercel'), false));

test('validateBrandMention', 'empty text', () =>
  assertEqual(validateBrandMention('', 'Vercel'), false));

// Domain-format brand names (7 cases)
test('validateBrandMention', 'brand "Daytona" found within "Daytona.io" bare domain', () =>
  assertEqual(validateBrandMention('Daytona.io focused on sub-90ms provisioning', 'Daytona'), true));

test('validateBrandMention', 'exact domain brand "Daytona.io" matched', () =>
  assertEqual(validateBrandMention('Daytona.io focused on sub-90ms provisioning', 'Daytona.io'), true));

test('validateBrandMention', 'domain brand "Daytona.io" matches bare base "Daytona"', () =>
  assertEqual(validateBrandMention('Daytona is great for dev environments', 'Daytona.io'), true));

test('validateBrandMention', 'brand "E2B" found within "E2B.dev" bare domain', () =>
  assertEqual(validateBrandMention('E2B.dev or Runloop.ai for sandboxes', 'E2B'), true));

test('validateBrandMention', 'domain false positive "scaleai.ca" should NOT match "Scale AI"', () =>
  assertEqual(validateBrandMention('Visit scaleai.ca', 'Scale AI'), false));

test('validateBrandMention', 'brand "Runloop" found within "Runloop.ai" bare domain', () =>
  assertEqual(validateBrandMention('Consider Runloop.ai for orchestration', 'Runloop'), true));

test('validateBrandMention', 'brand in full URL should NOT match even for domain brands', () =>
  assertEqual(validateBrandMention('Visit https://daytona.io/docs for info', 'Daytona'), false));

// Domain-format & edge-case brands — 40 real-company cases
// ─────────────────────────────────────────────────────────

// --- .io TLD brands ---
test('validateBrandMention', 'Fly.io: brand "Fly.io" in bare domain text', () =>
  assertEqual(validateBrandMention('Fly.io offers edge hosting with Machines API', 'Fly.io'), true));

test('validateBrandMention', 'Fly.io: base name "Fly" extracted from domain brand', () =>
  assertEqual(validateBrandMention('Fly makes edge deployment simple', 'Fly.io'), true));

test('validateBrandMention', 'Gitpod: brand "Gitpod" found within "Gitpod.io"', () =>
  assertEqual(validateBrandMention('Gitpod.io provides cloud development environments', 'Gitpod'), true));

test('validateBrandMention', 'CodeSandbox: brand found within "CodeSandbox.io"', () =>
  assertEqual(validateBrandMention('CodeSandbox.io is great for prototyping', 'CodeSandbox'), true));

// --- .dev TLD brands ---
test('validateBrandMention', 'E2B.dev: exact domain brand match', () =>
  assertEqual(validateBrandMention('Use E2B.dev for AI code sandboxes', 'E2B.dev'), true));

test('validateBrandMention', 'E2B.dev: base "E2B" matches when brand registered as E2B.dev', () =>
  assertEqual(validateBrandMention('E2B provides secure sandbox environments', 'E2B.dev'), true));

test('validateBrandMention', 'Val Town: brand "Val Town" with .town TLD in text', () =>
  assertEqual(validateBrandMention('Val Town lets you write serverless functions', 'Val Town'), true));

// --- .ai TLD brands ---
test('validateBrandMention', 'Runloop.ai: exact domain brand match', () =>
  assertEqual(validateBrandMention('Runloop.ai orchestrates AI agent infrastructure', 'Runloop.ai'), true));

test('validateBrandMention', 'Together AI: plain text mention (no domain)', () =>
  assertEqual(validateBrandMention('Together AI offers open-source model hosting', 'Together AI'), true));

test('validateBrandMention', 'Together AI: should NOT match unrelated "together.ai" domain only', () =>
  assertEqual(validateBrandMention('Visit https://together.ai for pricing', 'Together AI'), false));

// --- .sh / .build / .run TLD brands ---
test('validateBrandMention', 'Bun: brand "Bun" found within "Bun.sh" bare domain', () =>
  assertEqual(validateBrandMention('Bun.sh is a fast JavaScript runtime', 'Bun'), true));

test('validateBrandMention', 'Bun.sh: exact domain brand match', () =>
  assertEqual(validateBrandMention('Bun.sh outperforms Node in benchmarks', 'Bun.sh'), true));

test('validateBrandMention', 'Astro: brand found within "Astro.build"', () =>
  assertEqual(validateBrandMention('Astro.build is great for content-driven sites', 'Astro'), true));

test('validateBrandMention', 'Remix: brand found within "Remix.run"', () =>
  assertEqual(validateBrandMention('Remix.run supports nested routing', 'Remix'), true));

test('validateBrandMention', 'Remix.run: exact domain brand match', () =>
  assertEqual(validateBrandMention('Check out Remix.run for full-stack React', 'Remix.run'), true));

// --- .app / .com TLD brands where domain != brand identity ---
test('validateBrandMention', 'Linear: plain text match (not confused with linear.app domain)', () =>
  assertEqual(validateBrandMention('Linear is great for issue tracking', 'Linear'), true));

test('validateBrandMention', 'Render: plain text match for common-word brand', () =>
  assertEqual(validateBrandMention('Render makes cloud deployment straightforward', 'Render'), true));

test('validateBrandMention', 'Railway: brand in URL should NOT match', () =>
  assertEqual(validateBrandMention('Deploy at https://railway.app/new', 'Railway'), false));

// --- .js ecosystem brands (dot in official name) ---
test('validateBrandMention', 'Next.js: exact match with dot in brand name', () =>
  assertEqual(validateBrandMention('Next.js supports server components', 'Next.js'), true));

test('validateBrandMention', 'Vue.js: exact match with dot in brand name', () =>
  assertEqual(validateBrandMention('Vue.js has a reactive data model', 'Vue.js'), true));

test('validateBrandMention', 'Node.js: exact match with dot in brand name', () =>
  assertEqual(validateBrandMention('Node.js runs on the V8 engine', 'Node.js'), true));

test('validateBrandMention', 'Three.js: brand in backticks should NOT match', () =>
  assertEqual(validateBrandMention('Import `three.js` in your module', 'Three.js'), false));

// --- Multi-word brands vs domain false positives ---
test('validateBrandMention', 'Hugging Face: plain text two-word brand match', () =>
  assertEqual(validateBrandMention('Hugging Face hosts thousands of models', 'Hugging Face'), true));

test('validateBrandMention', 'Hugging Face: should NOT match "huggingface.co" URL', () =>
  assertEqual(validateBrandMention('See https://huggingface.co/models for details', 'Hugging Face'), false));

test('validateBrandMention', 'OpenAI: single-word brand match (no space)', () =>
  assertEqual(validateBrandMention('OpenAI released GPT-4 in 2023', 'OpenAI'), true));

test('validateBrandMention', 'OpenAI: should NOT match "openai.com" URL', () =>
  assertEqual(validateBrandMention('Visit https://openai.com/api for docs', 'OpenAI'), false));

test('validateBrandMention', 'Scale AI: domain "scale.com" should NOT match', () =>
  assertEqual(validateBrandMention('Go to https://scale.com for enterprise AI', 'Scale AI'), false));

test('validateBrandMention', 'Weights & Biases: ampersand brand in plain text', () =>
  assertEqual(validateBrandMention('Weights & Biases tracks ML experiments', 'Weights & Biases'), true));

// --- Short brands that could collide with domain fragments ---
test('validateBrandMention', 'Go: short brand exact match in plain text', () =>
  assertEqual(validateBrandMention('Go is a statically typed language', 'Go'), true));

test('validateBrandMention', 'Qt: short brand "Qt" in "Qt.io" bare domain', () =>
  assertEqual(validateBrandMention('Qt.io provides cross-platform UI frameworks', 'Qt'), true));

test('validateBrandMention', 'V8: short brand should NOT match inside "V8.dev" URL', () =>
  assertEqual(validateBrandMention('Read https://v8.dev/blog for engine updates', 'V8'), false));

test('validateBrandMention', 'D3: short brand found within "D3.js" in plain text', () =>
  assertEqual(validateBrandMention('D3.js powers interactive data visualizations', 'D3'), true));

// --- Rebranded / alternate domain companies ---
test('validateBrandMention', 'Replit: current name matches (formerly Repl.it)', () =>
  assertEqual(validateBrandMention('Replit is an online IDE for collaborative coding', 'Replit'), true));

test('validateBrandMention', 'Notion: plain text match despite notion.so domain', () =>
  assertEqual(validateBrandMention('Notion is widely used for team wikis', 'Notion'), true));

test('validateBrandMention', 'Deno: brand in "Deno.land" bare domain', () =>
  assertEqual(validateBrandMention('Deno.land introduced a secure runtime', 'Deno'), true));

test('validateBrandMention', 'Cursor: brand "Cursor" should NOT match "cursor.com" URL', () =>
  assertEqual(validateBrandMention('Download at https://cursor.com/downloads', 'Cursor'), false));

// --- Mixed context: brand + unrelated domains in same text ---
test('validateBrandMention', 'Stripe: brand survives when unrelated domains present', () =>
  assertEqual(validateBrandMention('Stripe handles payments; see example.com for demo', 'Stripe'), true));

test('validateBrandMention', 'Supabase: brand in text alongside bare competitor domain', () =>
  assertEqual(validateBrandMention('Supabase vs firebase.google.com for backends', 'Supabase'), true));

test('validateBrandMention', 'Discord: brand in text but also in www URL should match plain mention', () =>
  assertEqual(validateBrandMention('Discord is popular. See www.discord.com for details', 'Discord'), true));

test('validateBrandMention', 'Slack: brand ONLY in URL, no plain text mention', () =>
  assertEqual(validateBrandMention('Message us at https://slack.com/org/mudra', 'Slack'), false));

// ═══════════════════════════════════════════════════════════════════════════
// GROUP C: filterValidCompetitors — real company names KEPT (15 cases)
// ═══════════════════════════════════════════════════════════════════════════

const brand = 'Y Combinator';

test('filterValid:keep', 'Techstars (real competitor)', () =>
  assertIncludes(filterValidCompetitors(['Techstars'], brand), 'Techstars'));

test('filterValid:keep', '500 Global (real competitor)', () =>
  assertIncludes(filterValidCompetitors(['500 Global'], brand), '500 Global'));

test('filterValid:keep', 'Scale AI (2 words, real company)', () =>
  assertIncludes(filterValidCompetitors(['Scale AI'], brand), 'Scale AI'));

test('filterValid:keep', 'AT&T (ampersand in real company)', () =>
  assertIncludes(filterValidCompetitors(['AT&T'], brand), 'AT&T'));

test('filterValid:keep', 'H&M (short ampersand company)', () =>
  assertIncludes(filterValidCompetitors(['H&M'], brand), 'H&M'));

test('filterValid:keep', 'Ernst & Young (3 words with &)', () =>
  assertIncludes(filterValidCompetitors(['Ernst & Young'], brand), 'Ernst & Young'));

test('filterValid:keep', 'Micro-Star (hyphenated real company)', () =>
  assertIncludes(filterValidCompetitors(['Micro-Star'], brand), 'Micro-Star'));

test('filterValid:keep', 'Render Network (singular, not plural)', () =>
  assertIncludes(filterValidCompetitors(['Render Network'], brand), 'Render Network'));

test('filterValid:keep', 'Ocean Protocol (singular, not plural)', () =>
  assertIncludes(filterValidCompetitors(['Ocean Protocol'], brand), 'Ocean Protocol'));

test('filterValid:keep', 'npm (known lowercase brand)', () =>
  assertIncludes(filterValidCompetitors(['npm'], brand), 'npm'));

test('filterValid:keep', 'docker (known lowercase brand)', () =>
  assertIncludes(filterValidCompetitors(['docker'], brand), 'docker'));

test('filterValid:keep', 'Antler (single word, proper case)', () =>
  assertIncludes(filterValidCompetitors(['Antler'], brand), 'Antler'));

test('filterValid:keep', 'a16z (mixed case short)', () =>
  assertIncludes(filterValidCompetitors(['a16z'], brand), 'a16z'));

test('filterValid:keep', 'Entrepreneurs First (2 words, proper)', () =>
  assertIncludes(filterValidCompetitors(['Entrepreneurs First'], brand), 'Entrepreneurs First'));

test('filterValid:reject', 'fly.io (all lowercase >5 chars, not in known brands)', () =>
  assertNotIncludes(filterValidCompetitors(['fly.io'], brand), 'fly.io'));

// ═══════════════════════════════════════════════════════════════════════════
// GROUP D: filterValidCompetitors — generic/invalid names REJECTED (30 cases)
// ═══════════════════════════════════════════════════════════════════════════

test('filterValid:reject', 'empty string', () =>
  assertNotIncludes(filterValidCompetitors([''], brand), ''));

test('filterValid:reject', 'brand name itself', () =>
  assertNotIncludes(filterValidCompetitors(['Y Combinator'], 'Y Combinator'), 'Y Combinator'));

test('filterValid:reject', 'brand as prefix (Y Combinator AI)', () => {
  const r = filterValidCompetitors(['Y Combinator AI'], 'Y Combinator');
  return assertNotIncludes(r, 'Y Combinator AI');
});

test('filterValid:reject', 'brand first word product (Vercel AI)', () =>
  assertNotIncludes(filterValidCompetitors(['Vercel AI'], 'Vercel'), 'Vercel AI'));

test('filterValid:reject', 'AI-enhanced coding & collaboration (& category)', () =>
  assertNotIncludes(filterValidCompetitors(['AI-enhanced coding & collaboration'], brand), 'AI-enhanced coding & collaboration'));

test('filterValid:reject', 'development & deployment (& both generic)', () =>
  assertNotIncludes(filterValidCompetitors(['development & deployment'], brand), 'development & deployment'));

test('filterValid:reject', 'monitoring & analytics (& both generic)', () =>
  assertNotIncludes(filterValidCompetitors(['monitoring & analytics'], brand), 'monitoring & analytics'));

test('filterValid:reject', 'training and inference (and both generic)', () =>
  assertNotIncludes(filterValidCompetitors(['training and inference'], brand), 'training and inference'));

test('filterValid:reject', 'AI-powered deployment tools (hyphenated desc)', () =>
  assertNotIncludes(filterValidCompetitors(['AI-powered deployment tools'], brand), 'AI-powered deployment tools'));

test('filterValid:reject', 'Cloud-native scaling service (hyphenated desc)', () =>
  assertNotIncludes(filterValidCompetitors(['Cloud-native scaling service'], brand), 'Cloud-native scaling service'));

test('filterValid:reject', 'Data-driven analytics platform (hyphenated desc)', () =>
  assertNotIncludes(filterValidCompetitors(['Data-driven analytics platform'], brand), 'Data-driven analytics platform'));

test('filterValid:reject', 'ML-enhanced model training (hyphenated desc)', () =>
  assertNotIncludes(filterValidCompetitors(['ML-enhanced model training'], brand), 'ML-enhanced model training'));

test('filterValid:reject', 'API-first development tools (hyphenated desc)', () =>
  assertNotIncludes(filterValidCompetitors(['API-first development tools'], brand), 'API-first development tools'));

test('filterValid:reject', 'AI SDK (generic 2-word)', () =>
  assertNotIncludes(filterValidCompetitors(['AI SDK'], brand), 'AI SDK'));

test('filterValid:reject', 'Cloud Platform (generic 2-word)', () =>
  assertNotIncludes(filterValidCompetitors(['Cloud Platform'], brand), 'Cloud Platform'));

test('filterValid:reject', 'AI model/data marketplaces (slash)', () =>
  assertNotIncludes(filterValidCompetitors(['AI model/data marketplaces'], brand), 'AI model/data marketplaces'));

test('filterValid:reject', 'GPU/CPU compute (slash)', () =>
  assertNotIncludes(filterValidCompetitors(['GPU/CPU compute'], brand), 'GPU/CPU compute'));

test('filterValid:reject', 'cloud services (generic term)', () =>
  assertNotIncludes(filterValidCompetitors(['cloud services'], brand), 'cloud services'));

test('filterValid:reject', 'online courses (generic term)', () =>
  assertNotIncludes(filterValidCompetitors(['online courses'], brand), 'online courses'));

test('filterValid:reject', 'career services (category + generic)', () =>
  assertNotIncludes(filterValidCompetitors(['career services'], brand), 'career services'));

test('filterValid:reject', 'decentralized compute networks (3w plural)', () =>
  assertNotIncludes(filterValidCompetitors(['decentralized compute networks'], brand), 'decentralized compute networks'));

test('filterValid:reject', 'AI cloud marketplace (3w generic combo)', () =>
  assertNotIncludes(filterValidCompetitors(['AI cloud marketplace'], brand), 'AI cloud marketplace'));

test('filterValid:reject', 'the Best Accelerator (starts with "the")', () =>
  assertNotIncludes(filterValidCompetitors(['the Best Accelerator'], brand), 'the Best Accelerator'));

test('filterValid:reject', 'Others share enthusiasm (starts with "others")', () =>
  assertNotIncludes(filterValidCompetitors(['Others share enthusiasm'], brand), 'Others share enthusiasm'));

test('filterValid:reject', 'Reach out directly (starts with "reach out")', () =>
  assertNotIncludes(filterValidCompetitors(['Reach out directly'], brand), 'Reach out directly'));

test('filterValid:reject', 'Sign up now (starts with "sign up")', () =>
  assertNotIncludes(filterValidCompetitors(['Sign up now'], brand), 'Sign up now'));

test('filterValid:reject', 'Posts highlight mentorship (action "highlight")', () =>
  assertNotIncludes(filterValidCompetitors(['Posts highlight mentorship'], brand), 'Posts highlight mentorship'));

test('filterValid:reject', 'Competitor. (ends with period)', () =>
  assertNotIncludes(filterValidCompetitors(['Competitor.'], brand), 'Competitor.'));

test('filterValid:reject', 'super long name that is clearly invalid! (ends with !)', () =>
  assertNotIncludes(filterValidCompetitors(['super long name that is clearly invalid!'], brand), 'super long name that is clearly invalid!'));

test('filterValid:reject', 'lowercase multiword not a brand (all lowercase >5 chars)', () =>
  assertNotIncludes(filterValidCompetitors(['some random thing'], brand), 'some random thing'));

// ═══════════════════════════════════════════════════════════════════════════
// GROUP E: cleanLLMAnalysisNames (8 cases)
// ═══════════════════════════════════════════════════════════════════════════

test('cleanLLMAnalysis', 'strips parentheticals from competitor names', () => {
  const a = { competitorsMentioned: ['Y Combinator (Online/Hybrid)', 'Techstars (US)'] };
  cleanLLMAnalysisNames(a);
  return assertEqual(a.competitorsMentioned, ['Y Combinator', 'Techstars']);
});

test('cleanLLMAnalysis', 'strips empty names after cleaning', () => {
  const a = { competitorsMentioned: ['(just parens)', 'Real Company'] };
  cleanLLMAnalysisNames(a);
  return assertEqual(a.competitorsMentioned, ['Real Company']);
});

test('cleanLLMAnalysis', 'cleans positions: keeps min on collision', () => {
  const a = { competitorPositions: { 'Techstars (US)': 2, 'Techstars (Global)': 5 } };
  cleanLLMAnalysisNames(a);
  return assertEqual(a.competitorPositions, { 'Techstars': 2 });
});

test('cleanLLMAnalysis', 'cleans positions: normal no collision', () => {
  const a = { competitorPositions: { 'Antler (EU)': 4 } };
  cleanLLMAnalysisNames(a);
  return assertEqual(a.competitorPositions, { 'Antler': 4 });
});

test('cleanLLMAnalysis', 'cleans sentiments: keeps first on collision', () => {
  const a = { competitorSentiments: { 'Techstars (US)': 'positive', 'Techstars (EU)': 'negative' } };
  cleanLLMAnalysisNames(a);
  return assertEqual(a.competitorSentiments, { 'Techstars': 'positive' });
});

test('cleanLLMAnalysis', 'no-op when no parentheticals', () => {
  const a = { competitorsMentioned: ['Antler', '500 Global'], competitorPositions: { 'Antler': 3 } };
  cleanLLMAnalysisNames(a);
  return assertEqual(a.competitorsMentioned, ['Antler', '500 Global']);
});

test('cleanLLMAnalysis', 'handles missing fields gracefully', () => {
  const a = {};
  cleanLLMAnalysisNames(a);
  return assertEqual(Object.keys(a).length, 0);
});

test('cleanLLMAnalysis', 'handles nested parens: "Foo (Bar (Baz))"', () => {
  const a = { competitorsMentioned: ['Foo (Bar (Baz))'] };
  cleanLLMAnalysisNames(a);
  return assertEqual(a.competitorsMentioned, ['Foo']);
});

// ═══════════════════════════════════════════════════════════════════════════
// GROUP F: normalizeForAggregation — deduplication (10 cases)
// ═══════════════════════════════════════════════════════════════════════════

test('normalizeAgg', 'Scale AI ≠ ScaleAI (space preserved — known limitation)', () => {
  const a = normalizeForAggregation('Scale AI');
  const b = normalizeForAggregation('ScaleAI');
  return { pass: a !== b, detail: a === b ? `Both normalize to "${a}"` : undefined };
});

test('normalizeAgg', 'Techstars == TECHSTARS', () =>
  assertEqual(normalizeForAggregation('Techstars'), normalizeForAggregation('TECHSTARS')));

test('normalizeAgg', 'strips Inc suffix', () =>
  assertEqual(normalizeForAggregation('Stripe Inc.'), 'stripe'));

test('normalizeAgg', 'strips LLC suffix', () =>
  assertEqual(normalizeForAggregation('OpenAI LLC'), 'openai'));

test('normalizeAgg', 'strips parenthetical', () =>
  assertEqual(normalizeForAggregation('Y Combinator (W24)'), 'y combinator'));

test('normalizeAgg', 'strips ampersand', () =>
  assertEqual(normalizeForAggregation('AT&T'), 'att'));

test('normalizeAgg', 'collapses whitespace', () =>
  assertEqual(normalizeForAggregation('  500   Global  '), '500 global'));

test('normalizeAgg', 'strips commas and quotes', () =>
  assertEqual(normalizeForAggregation('"Anthropic,"'), 'anthropic'));

test('normalizeAgg', 'empty string stays empty', () =>
  assertEqual(normalizeForAggregation(''), ''));

test('normalizeAgg', 'preserves periods (io.net)', () =>
  assertEqual(normalizeForAggregation('io.net'), 'io.net'));

// ═══════════════════════════════════════════════════════════════════════════
// GROUP G: filterCompetitorPositions — position cap in post-processing (8 cases)
// ═══════════════════════════════════════════════════════════════════════════

test('positionCap', 'valid position 1 passes through', () => {
  const r = filterCompetitorPositions({ 'Techstars': 1 }, ['Techstars']);
  return assertEqual(r, { 'Techstars': 1 });
});

test('positionCap', 'valid position 20 passes through', () => {
  const r = filterCompetitorPositions({ 'Techstars': 20 }, ['Techstars']);
  return assertEqual(r, { 'Techstars': 20 });
});

test('positionCap', 'position 21 is capped (excluded)', () => {
  const r = filterCompetitorPositions({ 'Techstars': 21 }, ['Techstars']);
  return assertEqual(r, {});
});

test('positionCap', 'position 0 is excluded', () => {
  const r = filterCompetitorPositions({ 'Techstars': 0 }, ['Techstars']);
  return assertEqual(r, {});
});

test('positionCap', 'position 100 is excluded (nonsensical)', () => {
  const r = filterCompetitorPositions({ 'Antler': 100 }, ['Antler']);
  return assertEqual(r, {});
});

test('positionCap', 'negative position excluded', () => {
  const r = filterCompetitorPositions({ 'Foo': -3 }, ['Foo']);
  return assertEqual(r, {});
});

test('positionCap', 'non-validated competitor excluded even with valid pos', () => {
  const r = filterCompetitorPositions({ 'Techstars': 2, 'Fake': 1 }, ['Techstars']);
  return assertEqual(r, { 'Techstars': 2 });
});

test('positionCap', 'mixed: some valid, some over cap', () => {
  const r = filterCompetitorPositions(
    { 'A': 3, 'B': 25, 'C': 10, 'D': 0 },
    ['A', 'B', 'C', 'D']
  );
  return assertEqual(r, { 'A': 3, 'C': 10 });
});

// ═══════════════════════════════════════════════════════════════════════════
// GROUP H: brandPosition coercion (|| vs ??) (4 cases)
// ═══════════════════════════════════════════════════════════════════════════

test('coercion', 'old || coercion: 0 becomes null (BUG)', () =>
  assertEqual(coerceBrandPositionOld(0), null));

test('coercion', 'new ?? coercion: 0 preserved (FIX)', () =>
  assertEqual(coerceBrandPositionNew(0), 0));

test('coercion', 'both: null stays null', () => {
  const pass = coerceBrandPositionOld(null) === null && coerceBrandPositionNew(null) === null;
  return { pass };
});

test('coercion', 'both: undefined becomes null', () => {
  const pass = coerceBrandPositionOld(undefined) === null && coerceBrandPositionNew(undefined) === null;
  return { pass };
});

// ═══════════════════════════════════════════════════════════════════════════
// GROUP I: normalizeCompanyName (5 cases)
// ═══════════════════════════════════════════════════════════════════════════

test('normalizeCompanyName', 'strips Inc', () =>
  assertEqual(normalizeCompanyName('Stripe Inc'), 'stripe'));

test('normalizeCompanyName', 'strips parenthetical', () =>
  assertEqual(normalizeCompanyName('io.net (GPU DePIN)'), 'io.net'));

test('normalizeCompanyName', 'preserves periods', () =>
  assertEqual(normalizeCompanyName('io.net'), 'io.net'));

test('normalizeCompanyName', 'normalizes whitespace', () =>
  assertEqual(normalizeCompanyName('  500   Global  '), '500 global'));

test('normalizeCompanyName', 'strips quotes and commas', () =>
  assertEqual(normalizeCompanyName('"OpenAI,"'), 'openai'));

// ═══════════════════════════════════════════════════════════════════════════
// GROUP J: End-to-end simulated extraction pipeline (3 multi-step cases)
// ═══════════════════════════════════════════════════════════════════════════

test('e2e', 'full pipeline: LLM output → clean → filter → position cap → aggregate', () => {
  // Simulate LLM extraction output (what gpt-5.2 would return)
  const llmOutput = {
    brandMentioned: true,
    brandPosition: 1,
    competitorsMentioned: [
      'Techstars (US)',
      'Techstars (Global)',
      '500 Global',
      'AI-enhanced coding & collaboration',
      'Cloud-native scaling service',
      'Antler',
      'career services',
      'Others share enthusiasm',
      'Seedcamp',
    ],
    competitorPositions: {
      'Techstars (US)': 2,
      'Techstars (Global)': 5,
      '500 Global': 3,
      'Antler': 25, // over cap
      'Seedcamp': 4,
    },
    competitorSentiments: {
      'Techstars (US)': 'positive',
      'Techstars (Global)': 'negative',
      '500 Global': 'neutral',
      'Antler': 'positive',
      'Seedcamp': 'neutral',
    },
  };

  // Step 1: cleanLLMAnalysisNames
  cleanLLMAnalysisNames(llmOutput);
  // Techstars deduped: position=min(2,5)=2, sentiment=first=positive

  // Step 2: filterValidCompetitors
  const validComps = filterValidCompetitors(llmOutput.competitorsMentioned, 'Y Combinator');

  // Step 3: position cap
  const validPositions = filterCompetitorPositions(llmOutput.competitorPositions, validComps);

  // Step 4: validateBrandPosition
  const brandPos = validateBrandPosition(llmOutput.brandPosition);

  // Verify
  const checks = [
    // Techstars deduplicated to single entry
    validComps.includes('Techstars'),
    // Generic phrases removed
    !validComps.includes('AI-enhanced coding & collaboration'),
    !validComps.includes('Cloud-native scaling service'),
    !validComps.includes('career services'),
    !validComps.includes('Others share enthusiasm'),
    // Real competitors kept
    validComps.includes('500 Global'),
    validComps.includes('Antler'),
    validComps.includes('Seedcamp'),
    // Position cap: Antler (25) excluded
    validPositions['Antler'] === undefined,
    // Techstars gets min position (2)
    validPositions['Techstars'] === 2,
    // Brand position valid
    brandPos === 1,
  ];

  const allPass = checks.every(Boolean);
  return {
    pass: allPass,
    detail: allPass ? undefined : `Checks: ${checks.map((c, i) => `${i}:${c}`).join(', ')}. validComps=${JSON.stringify(validComps)}, positions=${JSON.stringify(validPositions)}`,
  };
});

test('e2e', 'aggregation normalization deduplicates case/suffix variants', () => {
  // Simulate competitor names from different analysis runs
  // Note: "Scale AI" vs "ScaleAI" do NOT merge (space preserved — known limitation)
  // But case differences and suffix differences DO merge
  const run1Competitors = ['Techstars', '500 Global', 'Anthropic'];
  const run2Competitors = ['TECHSTARS', '500 Global Inc.', 'Anthropic'];

  // Aggregate with normalization (mirrors route.ts logic)
  const metricsMap = new Map<string, { displayName: string; mentions: number }>();

  for (const comp of [...run1Competitors, ...run2Competitors]) {
    const key = normalizeForAggregation(comp);
    if (!key) continue;
    if (!metricsMap.has(key)) {
      metricsMap.set(key, { displayName: comp, mentions: 0 });
    }
    metricsMap.get(key)!.mentions += 1;
  }

  const results = Array.from(metricsMap.values());

  const checks = [
    // Should have 3 unique competitors (case/suffix merged)
    results.length === 3,
    // Techstars / TECHSTARS merged
    results.find(r => r.displayName === 'Techstars')?.mentions === 2,
    // 500 Global / 500 Global Inc. merged
    results.find(r => r.displayName === '500 Global')?.mentions === 2,
    // Anthropic from both runs merged
    results.find(r => r.displayName === 'Anthropic')?.mentions === 2,
  ];

  const allPass = checks.every(Boolean);
  return {
    pass: allPass,
    detail: allPass ? undefined : `Results: ${JSON.stringify(results)}`,
  };
});

test('e2e', 'competitorSentiments passthrough: non-empty sentiments flow through', () => {
  // Simulate the matchingTest data as stored in GeoAnalysisResult
  const matchingTest = {
    brandMentioned: true,
    brandPosition: 0, // edge case: position 0
    sentiment: 'positive',
    response: 'Some response text...',
    competitors: ['Techstars', 'Antler'],
    competitorPositions: { 'Techstars': 2, 'Antler': 3 },
    competitorSentiments: { 'Techstars': 'positive', 'Antler': 'negative' },
  };

  // Simulate old behavior (missing competitorSentiments)
  const oldResult = {
    brandPosition: matchingTest.brandPosition || null, // BUG: 0 → null
    // competitorSentiments NOT included (old bug)
  };

  // Simulate new behavior
  const newResult = {
    brandPosition: matchingTest.brandPosition ?? null, // FIX: 0 → 0
    competitorSentiments: matchingTest.competitorSentiments || {}, // FIX: included
  };

  const checks = [
    // Old: position 0 coerced to null
    oldResult.brandPosition === null,
    // New: position 0 preserved
    newResult.brandPosition === 0,
    // New: sentiments present
    newResult.competitorSentiments['Techstars'] === 'positive',
    newResult.competitorSentiments['Antler'] === 'negative',
  ];

  const allPass = checks.every(Boolean);
  return { pass: allPass, detail: allPass ? undefined : `old=${JSON.stringify(oldResult)}, new=${JSON.stringify(newResult)}` };
});

// ═══════════════════════════════════════════════════════════════════════════
// GROUP K: LLM JSON parse robustness (7 cases)
// Mirrors: the `analysisText.replace(/```json\n?|\n?```/g, '').trim()` +
//          `JSON.parse(cleanedText)` logic in all 4 providers
// ═══════════════════════════════════════════════════════════════════════════

function parseLLMResponse(raw: string): { parsed: any; ok: boolean } {
  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
    const result = JSON.parse(cleaned);
    return { parsed: result, ok: true };
  } catch {
    return { parsed: null, ok: false };
  }
}

test('jsonParse', 'clean JSON parses fine', () => {
  const { ok, parsed } = parseLLMResponse('{"brandMentioned": true, "brandPosition": 2}');
  return { pass: ok && parsed.brandMentioned === true && parsed.brandPosition === 2 };
});

test('jsonParse', 'markdown-wrapped ```json ... ``` is stripped', () => {
  const raw = '```json\n{"brandMentioned": true, "brandPosition": 3}\n```';
  const { ok, parsed } = parseLLMResponse(raw);
  return { pass: ok && parsed.brandPosition === 3, detail: ok ? undefined : 'Failed to parse markdown-wrapped JSON' };
});

test('jsonParse', 'markdown-wrapped without newlines', () => {
  const raw = '```json{"brandMentioned": false}```';
  const { ok, parsed } = parseLLMResponse(raw);
  return { pass: ok && parsed.brandMentioned === false };
});

test('jsonParse', 'empty string → parse fails', () => {
  const { ok } = parseLLMResponse('');
  return { pass: !ok };
});

test('jsonParse', 'just "null" text → parse succeeds (valid JSON)', () => {
  const { ok, parsed } = parseLLMResponse('null');
  return { pass: ok && parsed === null };
});

test('jsonParse', 'truncated JSON → parse fails', () => {
  const { ok } = parseLLMResponse('{"brandMentioned": true, "brand');
  return { pass: !ok };
});

test('jsonParse', 'leading/trailing whitespace stripped', () => {
  const raw = '  \n  {"brandMentioned": true}  \n  ';
  const { ok, parsed } = parseLLMResponse(raw);
  return { pass: ok && parsed.brandMentioned === true };
});

// ═══════════════════════════════════════════════════════════════════════════
// GROUP L: LLM retry loop simulation (6 cases)
// Mirrors: the `for (let attempt = 1; attempt <= 2; attempt++)` in all 4 providers
// ═══════════════════════════════════════════════════════════════════════════

type MockCall = { response: string; throws?: boolean };

function simulateRetryExtraction(
  calls: MockCall[],
  responseText: string,
  brandName: string
): any {
  let analysis: any = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const call = calls[attempt - 1];
    if (!call) break;
    try {
      if (call.throws) throw new Error('API error');
      const cleaned = call.response.replace(/```json\n?|\n?```/g, '').trim();
      analysis = JSON.parse(cleaned);
      cleanLLMAnalysisNames(analysis);
      break; // success
    } catch {
      if (attempt === 2) {
        // Minimal safe fallback (mirrors prod exactly)
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
  return analysis;
}

test('retryLoop', 'attempt 1 succeeds → uses first result', () => {
  const a = simulateRetryExtraction(
    [{ response: '{"brandMentioned": true, "brandPosition": 1, "competitorsMentioned": ["Techstars"]}' }],
    'Y Combinator is #1', 'Y Combinator'
  );
  return { pass: a.brandMentioned === true && a.brandPosition === 1 && a.competitorsMentioned[0] === 'Techstars' };
});

test('retryLoop', 'attempt 1 bad JSON, attempt 2 succeeds', () => {
  const a = simulateRetryExtraction(
    [
      { response: '{bad json' },
      { response: '{"brandMentioned": false, "brandPosition": null, "competitorsMentioned": ["Antler"]}' },
    ],
    'No mention', 'Y Combinator'
  );
  return { pass: a.brandMentioned === false && a.competitorsMentioned[0] === 'Antler' };
});

test('retryLoop', 'both attempts fail → minimal safe fallback', () => {
  const a = simulateRetryExtraction(
    [{ response: 'garbage' }, { response: 'still garbage' }],
    'Y Combinator is the top accelerator', 'Y Combinator'
  );
  const checks = [
    a.brandMentioned === true,  // falls back to regex
    a.brandPosition === null,
    a.competitorsMentioned.length === 0,
    Object.keys(a.competitorPositions).length === 0,
    Object.keys(a.competitorSentiments).length === 0,
    a.sentiment === 'neutral',
    a.confidence === 0.3,
  ];
  return { pass: checks.every(Boolean), detail: checks.every(Boolean) ? undefined : `Fallback: ${JSON.stringify(a)}` };
});

test('retryLoop', 'API throw on attempt 1, good JSON on attempt 2', () => {
  const a = simulateRetryExtraction(
    [
      { response: '', throws: true },
      { response: '{"brandMentioned": true, "brandPosition": 5, "competitorsMentioned": []}' },
    ],
    'text', 'BrandX'
  );
  return { pass: a.brandPosition === 5 };
});

test('retryLoop', 'both API throws → fallback with brand not in text', () => {
  const a = simulateRetryExtraction(
    [{ response: '', throws: true }, { response: '', throws: true }],
    'This text has no brand', 'MissingBrand'
  );
  return { pass: a.brandMentioned === false && a.confidence === 0.3 };
});

test('retryLoop', 'attempt 1 returns markdown-wrapped JSON → parses fine', () => {
  const a = simulateRetryExtraction(
    [{ response: '```json\n{"brandMentioned": true, "brandPosition": 2, "competitorsMentioned": ["Foo"]}\n```' }],
    'text', 'Brand'
  );
  return { pass: a.brandMentioned === true && a.brandPosition === 2 };
});

// ═══════════════════════════════════════════════════════════════════════════
// GROUP M: Brand mention regex cross-check override (5 cases)
// Mirrors: the post-processing where `regexBrandMentioned` overrides LLM
//   const regexBrandMentioned = validateBrandMention(text, config.brandName);
//   ...
//   brandMentioned: regexBrandMentioned, // ALWAYS use regex, not LLM
// ═══════════════════════════════════════════════════════════════════════════

function simulateCrossCheck(
  llmSaysMentioned: boolean,
  responseText: string,
  brandName: string
): { finalMentioned: boolean; mismatch: boolean } {
  const regexResult = validateBrandMention(responseText, brandName);
  return {
    finalMentioned: regexResult, // prod always uses regex
    mismatch: llmSaysMentioned !== regexResult,
  };
}

test('crossCheck', 'LLM=true, regex=true → true, no mismatch', () => {
  const r = simulateCrossCheck(true, 'Vercel is great', 'Vercel');
  return { pass: r.finalMentioned === true && r.mismatch === false };
});

test('crossCheck', 'LLM=true, regex=false → false (regex wins, brand only in URL)', () => {
  const r = simulateCrossCheck(true, 'Check https://vercel.com for details', 'Vercel');
  return { pass: r.finalMentioned === false && r.mismatch === true };
});

test('crossCheck', 'LLM=false, regex=true → true (regex catches what LLM missed)', () => {
  const r = simulateCrossCheck(false, 'Deploy on Vercel today', 'Vercel');
  return { pass: r.finalMentioned === true && r.mismatch === true };
});

test('crossCheck', 'LLM=false, regex=false → false, no mismatch', () => {
  const r = simulateCrossCheck(false, 'Netlify and Cloudflare are alternatives', 'Vercel');
  return { pass: r.finalMentioned === false && r.mismatch === false };
});

test('crossCheck', 'LLM=true but brand only in code block → false (regex wins)', () => {
  const r = simulateCrossCheck(true, 'Install with ```vercel deploy```', 'Vercel');
  return { pass: r.finalMentioned === false && r.mismatch === true };
});

// ═══════════════════════════════════════════════════════════════════════════
// GROUP N: Sentiment filtering to validated competitors only (4 cases)
// Mirrors: the post-processing sentiment filter in all 4 providers
//   validatedCompetitors.forEach(comp => {
//     if (analysis.competitorSentiments?.[comp]) validatedSentiments[comp] = ...
//   });
// ═══════════════════════════════════════════════════════════════════════════

function filterSentiments(
  rawSentiments: Record<string, string>,
  validatedCompetitors: string[]
): Record<string, string> {
  const result: Record<string, string> = {};
  validatedCompetitors.forEach(comp => {
    if (rawSentiments[comp]) result[comp] = rawSentiments[comp];
  });
  return result;
}

test('sentimentFilter', 'only validated comps get sentiments', () => {
  const raw = { 'Techstars': 'positive', 'career services': 'neutral', 'Antler': 'negative' };
  const valid = ['Techstars', 'Antler']; // "career services" was filtered out
  const result = filterSentiments(raw, valid);
  return assertEqual(result, { 'Techstars': 'positive', 'Antler': 'negative' });
});

test('sentimentFilter', 'no sentiments data → empty result', () => {
  const result = filterSentiments({}, ['Techstars']);
  return assertEqual(result, {});
});

test('sentimentFilter', 'competitor has no sentiment entry → skipped', () => {
  const raw = { 'Techstars': 'positive' };
  const result = filterSentiments(raw, ['Techstars', 'Antler']);
  return assertEqual(result, { 'Techstars': 'positive' });
});

test('sentimentFilter', 'all comps filtered out → empty result', () => {
  const raw = { 'career services': 'neutral', 'AI tools': 'positive' };
  const result = filterSentiments(raw, []);
  return assertEqual(result, {});
});

// ═══════════════════════════════════════════════════════════════════════════
// GROUP O: Full per-provider post-processing chain (4 cases)
// Mirrors: the EXACT sequence in analyzeWithOpenAI / Perplexity / Anthropic / Google:
//   1. LLM call + JSON parse (with retry)
//   2. cleanLLMAnalysisNames()
//   3. mergedPositions = analysis.competitorPositions || {}
//   4. regexBrandMentioned = validateBrandMention()
//   5. validatedCompetitors = filterValidCompetitors()
//   6. position cap (1-20, validated comps only)
//   7. sentiment filter (validated comps only)
//   8. validateBrandPosition()
//   9. return final PromptTest
// ═══════════════════════════════════════════════════════════════════════════

interface PromptTestResult {
  brandMentioned: boolean;
  brandPosition: number | undefined;
  competitors: string[];
  competitorPositions: Record<string, number>;
  competitorSentiments: Record<string, string>;
  sentiment: string;
  confidence: number;
}

function simulateProviderPostProcessing(
  llmJson: string,
  responseText: string,
  brandName: string
): PromptTestResult {
  // Step 1-2: Parse + clean (with retry — simulate single success here)
  let analysis: any;
  try {
    const cleaned = llmJson.replace(/```json\n?|\n?```/g, '').trim();
    analysis = JSON.parse(cleaned);
    cleanLLMAnalysisNames(analysis);
  } catch {
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

  // Step 3: Use LLM positions directly (no regex merge — that's the change!)
  const mergedPositions = analysis.competitorPositions || {};

  // Step 4: Regex brand mention cross-check (ALWAYS overrides LLM)
  const regexBrandMentioned = validateBrandMention(responseText, brandName);

  // Step 5: Filter competitors
  const validatedCompetitors = filterValidCompetitors(analysis.competitorsMentioned || [], brandName);

  // Step 6: Position cap (1-20, validated comps only)
  const validatedPositions: Record<string, number> = {};
  validatedCompetitors.forEach(comp => {
    const pos = mergedPositions[comp];
    if (pos && pos >= 1 && pos <= MAX_VALID_POSITION) {
      validatedPositions[comp] = pos;
    }
  });

  // Step 7: Sentiment filter (validated comps only)
  const validatedSentiments: Record<string, string> = {};
  validatedCompetitors.forEach(comp => {
    if (analysis.competitorSentiments?.[comp]) {
      validatedSentiments[comp] = analysis.competitorSentiments[comp];
    }
  });

  // Step 8-9: Final result
  return {
    brandMentioned: regexBrandMentioned,
    brandPosition: validateBrandPosition(analysis.brandPosition),
    competitors: validatedCompetitors,
    competitorPositions: validatedPositions,
    competitorSentiments: validatedSentiments,
    sentiment: analysis.sentiment || 'neutral',
    confidence: analysis.confidence || 0.5,
  };
}

test('providerChain', 'happy path: real companies, valid positions, brand in text', () => {
  const llmJson = JSON.stringify({
    brandMentioned: true,
    brandPosition: 1,
    competitorsMentioned: ['Techstars', '500 Global', 'Antler'],
    competitorPositions: { 'Techstars': 2, '500 Global': 3, 'Antler': 4 },
    competitorSentiments: { 'Techstars': 'positive', '500 Global': 'neutral', 'Antler': 'positive' },
    sentiment: 'positive',
    confidence: 0.95,
  });
  const r = simulateProviderPostProcessing(llmJson, 'Y Combinator is the #1 accelerator with Techstars at #2', 'Y Combinator');
  const checks = [
    r.brandMentioned === true,
    r.brandPosition === 1,
    r.competitors.length === 3,
    r.competitorPositions['Techstars'] === 2,
    r.competitorSentiments['Techstars'] === 'positive',
    r.sentiment === 'positive',
  ];
  return { pass: checks.every(Boolean), detail: checks.every(Boolean) ? undefined : JSON.stringify(r) };
});

test('providerChain', 'LLM hallucinates brand mention (only in URL) → regex overrides to false', () => {
  const llmJson = JSON.stringify({
    brandMentioned: true, // LLM says yes
    brandPosition: 1,
    competitorsMentioned: ['Techstars'],
    competitorPositions: { 'Techstars': 2 },
    competitorSentiments: { 'Techstars': 'neutral' },
    sentiment: 'positive',
    confidence: 0.8,
  });
  // Brand only appears in URL — regex should say false
  const r = simulateProviderPostProcessing(llmJson, 'Check https://ycombinator.com for details. Techstars is a competitor.', 'Y Combinator');
  return { pass: r.brandMentioned === false, detail: `brandMentioned=${r.brandMentioned}` };
});

test('providerChain', 'mixed valid/invalid comps + over-cap positions + garbage sentiments', () => {
  const llmJson = JSON.stringify({
    brandMentioned: true,
    brandPosition: 42, // over cap
    competitorsMentioned: [
      'Techstars',
      'AI-enhanced coding & collaboration', // filtered: & category
      'Cloud-driven deployment service',    // filtered: hyphenated desc
      'career services',                     // filtered: generic term
      'Seedcamp',
    ],
    competitorPositions: {
      'Techstars': 2,
      'AI-enhanced coding & collaboration': 1,
      'Cloud-driven deployment service': 3,
      'career services': 99,
      'Seedcamp': 25, // over cap
    },
    competitorSentiments: {
      'Techstars': 'positive',
      'AI-enhanced coding & collaboration': 'positive',
      'career services': 'neutral',
      'Seedcamp': 'negative',
    },
    sentiment: 'neutral',
    confidence: 0.7,
  });
  const r = simulateProviderPostProcessing(llmJson, 'Y Combinator leads with Techstars and Seedcamp.', 'Y Combinator');
  const checks = [
    r.brandMentioned === true,
    r.brandPosition === undefined, // 42 over cap
    r.competitors.includes('Techstars'),
    r.competitors.includes('Seedcamp'),
    !r.competitors.includes('AI-enhanced coding & collaboration'),
    !r.competitors.includes('Cloud-driven deployment service'),
    !r.competitors.includes('career services'),
    r.competitorPositions['Techstars'] === 2,
    r.competitorPositions['Seedcamp'] === undefined, // 25 over cap
    r.competitorSentiments['Techstars'] === 'positive',
    r.competitorSentiments['career services'] === undefined,
  ];
  return { pass: checks.every(Boolean), detail: checks.every(Boolean) ? undefined : `checks=${checks.map((c,i)=>`${i}:${c}`)} result=${JSON.stringify(r)}` };
});

test('providerChain', 'malformed LLM JSON → safe fallback, brand detected by regex', () => {
  const r = simulateProviderPostProcessing(
    'This is not JSON at all',
    'Vercel is the best deployment platform. Netlify is also good.',
    'Vercel'
  );
  const checks = [
    r.brandMentioned === true,  // regex detects "Vercel"
    r.brandPosition === undefined,
    r.competitors.length === 0,  // fallback has empty competitors
    r.confidence === 0.3,
    r.sentiment === 'neutral',
  ];
  return { pass: checks.every(Boolean), detail: checks.every(Boolean) ? undefined : JSON.stringify(r) };
});

// ═══════════════════════════════════════════════════════════════════════════
// GROUP P: Deep view API aggregation chain (3 cases)
// Mirrors: app/api/prompts/[id]/route.ts — the filteredTestResults.forEach
//   loop that builds competitorMetrics with normalization, then computes
//   visibility, avgPosition, dominant sentiment per competitor
// ═══════════════════════════════════════════════════════════════════════════

interface SimulatedTestResult {
  brandMentioned: boolean;
  brandPosition: number | null;
  competitorsMentioned: string[];
  competitorPositions: Record<string, number>;
  competitorSentiments: Record<string, string>;
}

function simulateAggregation(testResults: SimulatedTestResult[]) {
  const totalTests = testResults.length;

  // Mirrors the exact code in route.ts
  const competitorMetrics = new Map<string, {
    displayName: string;
    mentions: number;
    firegeoScores: number[];
    positions: number[];
    sentiments: string[];
  }>();

  testResults.forEach(result => {
    const competitors = result.competitorsMentioned || [];
    const competitorPositions = result.competitorPositions || {};
    const competitorSentiments = result.competitorSentiments || {};
    const competitorsFromPositions = Object.keys(competitorPositions);
    const competitorsFromSentiments = Object.keys(competitorSentiments);
    const allCompetitorsInTest = new Set([...competitors, ...competitorsFromPositions, ...competitorsFromSentiments]);

    allCompetitorsInTest.forEach(competitor => {
      const normalizedKey = normalizeForAggregation(competitor);
      if (!normalizedKey) return;
      if (!competitorMetrics.has(normalizedKey)) {
        competitorMetrics.set(normalizedKey, {
          displayName: competitor,
          mentions: 0,
          firegeoScores: [],
          positions: [],
          sentiments: [],
        });
      }
      const metrics = competitorMetrics.get(normalizedKey)!;
      metrics.mentions += 1;
      const compPosition = competitorPositions[competitor] ?? null;
      let score = 50;
      if (compPosition != null && compPosition > 0) {
        score += Math.max(0, (10 - compPosition) / 10) * 50;
      }
      metrics.firegeoScores.push(Math.round(score));
      if (competitorPositions[competitor] != null) {
        metrics.positions.push(competitorPositions[competitor]);
      }
      if (competitorSentiments[competitor]) {
        metrics.sentiments.push(competitorSentiments[competitor]);
      }
    });
  });

  return Array.from(competitorMetrics.entries()).map(([_key, metrics]) => {
    const avgPosition = metrics.positions.length > 0
      ? Math.round((metrics.positions.reduce((s, p) => s + p, 0) / metrics.positions.length) * 10) / 10
      : null;
    const firegeoSum = metrics.firegeoScores.reduce((a, b) => a + b, 0);
    const visibility = totalTests > 0 ? Math.round(firegeoSum / totalTests) : 0;
    const sentimentCount = {
      positive: metrics.sentiments.filter(s => s === 'positive').length,
      neutral: metrics.sentiments.filter(s => s === 'neutral').length,
      negative: metrics.sentiments.filter(s => s === 'negative').length,
    };
    let dominantSentiment = 'Neutral';
    if (metrics.sentiments.length > 0) {
      if (sentimentCount.positive > sentimentCount.neutral && sentimentCount.positive > sentimentCount.negative) dominantSentiment = 'Positive';
      else if (sentimentCount.negative > sentimentCount.neutral && sentimentCount.negative > sentimentCount.positive) dominantSentiment = 'Negative';
    }
    return {
      name: metrics.displayName,
      visibility,
      mentions: metrics.mentions,
      position: avgPosition,
      sentiment: dominantSentiment,
    };
  });
}

test('aggregation', 'case variants merge: "Techstars" + "TECHSTARS" → 1 entry with 2 mentions', () => {
  const results = simulateAggregation([
    { brandMentioned: true, brandPosition: 1, competitorsMentioned: ['Techstars'], competitorPositions: { 'Techstars': 2 }, competitorSentiments: { 'Techstars': 'positive' } },
    { brandMentioned: true, brandPosition: 1, competitorsMentioned: ['TECHSTARS'], competitorPositions: { 'TECHSTARS': 3 }, competitorSentiments: { 'TECHSTARS': 'neutral' } },
  ]);
  const ts = results.find(r => r.name === 'Techstars');
  return {
    pass: results.length === 1 && ts !== undefined && ts.mentions === 2 && ts.position === 2.5,
    detail: `results=${JSON.stringify(results)}`,
  };
});

test('aggregation', 'competitor only in positions (not in mentions array) still aggregated', () => {
  const results = simulateAggregation([
    { brandMentioned: true, brandPosition: 1, competitorsMentioned: [], competitorPositions: { 'Antler': 5 }, competitorSentiments: {} },
  ]);
  return { pass: results.length === 1 && results[0].name === 'Antler' && results[0].position === 5 };
});

test('aggregation', 'competitor only in sentiments (not in mentions or positions) still aggregated', () => {
  const results = simulateAggregation([
    { brandMentioned: true, brandPosition: 1, competitorsMentioned: [], competitorPositions: {}, competitorSentiments: { 'Seedcamp': 'negative' } },
  ]);
  return { pass: results.length === 1 && results[0].name === 'Seedcamp' && results[0].sentiment === 'Negative' };
});

// ═══════════════════════════════════════════════════════════════════════════
// GROUP Q: Firegeo visibility score calculation (4 cases)
// Mirrors: the per-test scoring in route.ts:
//   if (!mentioned) → 0
//   if mentioned: 50 + max(0, (10 - position) / 10) * 50
//   then average across ALL tests
// ═══════════════════════════════════════════════════════════════════════════

function calcFiregeoScore(mentioned: boolean, position: number | null): number {
  if (!mentioned) return 0;
  let score = 50;
  if (position != null && position > 0) {
    score += Math.max(0, (10 - position) / 10) * 50;
  }
  return Math.round(score);
}

test('firegeo', 'not mentioned → 0', () =>
  assertEqual(calcFiregeoScore(false, null), 0));

test('firegeo', 'mentioned, no position → 50', () =>
  assertEqual(calcFiregeoScore(true, null), 50));

test('firegeo', 'mentioned, position 1 → 95 (50 + 45)', () =>
  assertEqual(calcFiregeoScore(true, 1), 95));

test('firegeo', 'mentioned, position 10 → 50 (50 + 0)', () =>
  assertEqual(calcFiregeoScore(true, 10), 50));

// ─────────────────────────────────────────────────────────────────────────────
// 4. Runner
// ─────────────────────────────────────────────────────────────────────────────

// Silence console.warn from validateBrandPosition during tests
const origWarn = console.warn;
console.warn = () => {};

let passed = 0;
let failed = 0;
const failures: { id: number; group: string; name: string; detail?: string }[] = [];

const groupCounts: Record<string, { pass: number; fail: number }> = {};

for (const t of tests) {
  if (!groupCounts[t.group]) groupCounts[t.group] = { pass: 0, fail: 0 };

  try {
    const result = t.fn();
    if (result.pass) {
      passed++;
      groupCounts[t.group].pass++;
    } else {
      failed++;
      groupCounts[t.group].fail++;
      failures.push({ id: t.id, group: t.group, name: t.name, detail: result.detail });
    }
  } catch (err: any) {
    failed++;
    groupCounts[t.group].fail++;
    failures.push({ id: t.id, group: t.group, name: t.name, detail: `THREW: ${err.message}` });
  }
}

console.warn = origWarn;

// ─────────────────────────────────────────────────────────────────────────────
// 5. Report
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║   Tracked Prompts Extraction Pipeline — Test Report         ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

console.log(`Total tests: ${tests.length}`);
console.log(`✅ Passed:   ${passed}`);
console.log(`❌ Failed:   ${failed}\n`);

console.log('── Per-group breakdown ──────────────────────────────────────');
for (const [group, counts] of Object.entries(groupCounts)) {
  const status = counts.fail === 0 ? '✅' : '❌';
  console.log(`  ${status} ${group.padEnd(30)} ${counts.pass}/${counts.pass + counts.fail}`);
}

if (failures.length > 0) {
  console.log('\n── Failures ────────────────────────────────────────────────');
  for (const f of failures) {
    console.log(`  ❌ #${f.id} [${f.group}] ${f.name}`);
    if (f.detail) console.log(`     ${f.detail}`);
  }
}

console.log('\n' + (failed === 0
  ? '🎉 All tests passed!'
  : `⚠️  ${failed} test(s) failed — review above.`));

process.exit(failed > 0 ? 1 : 0);
