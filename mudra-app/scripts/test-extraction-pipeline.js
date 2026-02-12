#!/usr/bin/env node
/**
 * End-to-end extraction pipeline test
 *
 * Mimics the EXACT production path for each provider:
 *   1. Real AI response text (realistic content)
 *   2. Simulated LLM extraction JSON (what GPT-5.2 returns)
 *   3. cleanLLMAnalysisNames()    — strips "(url)" suffixes
 *   4. validateBrandMention()      — regex overrides LLM
 *   5. validateBrandPosition()     — clamps 1..20
 *   6. filterValidCompetitors()    — strips junk
 *   7. Position + sentiment pruning to only validated competitors
 *   8. Full aggregation across multiple runs
 *
 * NOTE: eval() is used intentionally to extract TypeScript functions from source
 * and run them in plain Node.js. This is a local dev-only test script.
 *
 * Run:  node mudra-app/scripts/test-extraction-pipeline.js
 */

const fs = require('fs');
const path = require('path');

// ─── Test harness ──────────────────────────────────────────────────────────────

let passed = 0, failed = 0;
const failures = [];

function assert(cond, label) {
  if (cond) { passed++; } else { failed++; failures.push(label); console.log(`  ✗ ${label}`); }
}
function assertEq(a, b, label) {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (ok) { passed++; } else {
    failed++; failures.push(label);
    console.log(`  ✗ ${label}\n      got:  ${JSON.stringify(a)}\n      want: ${JSON.stringify(b)}`);
  }
}
function assertClose(a, b, tol, label) {
  if (Math.abs(a - b) <= tol) { passed++; } else {
    failed++; failures.push(`${label} (${a} vs ${b})`);
    console.log(`  ✗ ${label} — got ${a}, want ${b}±${tol}`);
  }
}

// ─── Load production functions from source ─────────────────────────────────────

function loadFromFile(filePath, fnRegex) {
  const code = fs.readFileSync(path.join(__dirname, '..', filePath), 'utf8');
  const m = code.match(fnRegex);
  if (!m) throw new Error(`Cannot extract from ${filePath}`);
  return m[0];
}

function stripTS(code) {
  return code
    .replace(/export\s+/g, '')
    // Strip return type annotations like ): string[] { or ): number | undefined {
    .replace(/\)\s*:\s*[^{]+\{/, ') {')
    // Strip parameter type annotations like param: string, param: number | null | undefined
    .replace(/(\w)\s*:\s*(string\[\]|string|boolean|number|any|void|Record<[^>]+>|undefined)(\s*\|\s*(string\[\]|string|boolean|number|any|null|undefined))*/g, '$1')
    .replace(/\bas\s+(string|number|any)\b/g, '')
    // Only strip generics attached to identifiers (e.g. Set<string>) not comparison operators
    .replace(/(\w)<[^>]+>/g, '$1');
}

// Load cleanLLMAnalysisNames
{
  let src = loadFromFile(
    'lib/services/direct-geo-analysis.service.ts',
    /(export\s+)?function cleanLLMAnalysisNames\(analysis[^)]*\)[^{]*\{[\s\S]*?\n\}/
  );
  /* eslint-disable no-eval -- intentional: extracting TS functions for testing */
  eval(stripTS(src));
}

// Load validateBrandMention
{
  let src = loadFromFile(
    'lib/services/direct-geo-analysis.service.ts',
    /function validateBrandMention\(text[^)]*\)[^{]*\{[\s\S]*?\n\}/
  );
  eval(stripTS(src));
}

// Load validateBrandPosition + MAX_VALID_POSITION
// Use var so it's hoisted to function/module scope, not block-scoped
var MAX_VALID_POSITION;
{
  const code = fs.readFileSync(
    path.join(__dirname, '..', 'lib/services/direct-geo-analysis.service.ts'), 'utf8'
  );
  const m = code.match(/const MAX_VALID_POSITION = (\d+);/);
  MAX_VALID_POSITION = parseInt(m[1], 10);
  let src = loadFromFile(
    'lib/services/direct-geo-analysis.service.ts',
    /(export\s+)?function validateBrandPosition\(position[^)]*\)[^{]*\{[\s\S]*?\n\}/
  );
  eval(stripTS(src));
}

// Load filterValidCompetitors
{
  let src = loadFromFile(
    'lib/services/direct-geo-analysis.service.ts',
    /(export\s+)?function filterValidCompetitors\(competitors[^)]*\)[^{]*\{[\s\S]*?\n\}/
  );
  eval(stripTS(src));
}

// Load quickValidateName (needed by isValidCompetitorName)
let quickValidateNameFn;
{
  let src = loadFromFile(
    'lib/services/competitor-validation.service.ts',
    /(export\s+)?function quickValidateName\(name[^)]*\)[^{]*\{[\s\S]*?\n\}/
  );
  eval(stripTS(src));
  quickValidateNameFn = quickValidateName;
}

// Load isValidCompetitorName + KNOWN_COMPANIES
let isValidCompetitorNameFn;
{
  const code = fs.readFileSync(
    path.join(__dirname, '..', 'app/api/analysis/competitors/route.ts'), 'utf8'
  );
  const kcMatch = code.match(/const KNOWN_COMPANIES = new Set\(\[([\s\S]*?)\]\)/);
  const fnMatch = code.match(/function isValidCompetitorName\(name[^)]*\)[^{]*\{[\s\S]*?\n\}/);
  const fullCode = `
    const KNOWN_COMPANIES = new Set([${kcMatch[1]}]);
    const quickValidateName = quickValidateNameFn;
    ${stripTS(fnMatch[0])}
  `;
  eval(fullCode);
  isValidCompetitorNameFn = isValidCompetitorName;
}
/* eslint-enable no-eval */

// ─── Production post-processing pipeline (exact copy from service) ─────────────

function runPostProcessing(responseText, llmExtractionJSON, config) {
  const analysis = typeof llmExtractionJSON === 'string'
    ? JSON.parse(llmExtractionJSON)
    : { ...llmExtractionJSON };

  // Deep-copy arrays/objects so we don't mutate input
  if (analysis.competitorsMentioned) analysis.competitorsMentioned = [...analysis.competitorsMentioned];
  if (analysis.competitorPositions) analysis.competitorPositions = { ...analysis.competitorPositions };
  if (analysis.competitorSentiments) analysis.competitorSentiments = { ...analysis.competitorSentiments };

  cleanLLMAnalysisNames(analysis);

  const regexBrandMentioned = validateBrandMention(responseText, config.brandName);
  const brandPosition = validateBrandPosition(analysis.brandPosition);

  const rawCompetitors = analysis.competitorsMentioned || [];
  const validatedCompetitors = filterValidCompetitors(rawCompetitors, config.brandName);

  const mergedPositions = analysis.competitorPositions || {};
  const validatedPositions = {};
  validatedCompetitors.forEach(comp => {
    const pos = mergedPositions[comp];
    if (pos && pos >= 1 && pos <= MAX_VALID_POSITION) {
      validatedPositions[comp] = pos;
    }
  });

  const validatedSentiments = {};
  validatedCompetitors.forEach(comp => {
    if (analysis.competitorSentiments?.[comp]) {
      validatedSentiments[comp] = analysis.competitorSentiments[comp];
    }
  });

  return {
    brandMentioned: regexBrandMentioned,
    brandPosition,
    competitors: validatedCompetitors,
    competitorPositions: validatedPositions,
    competitorSentiments: validatedSentiments,
    sentiment: analysis.sentiment || 'neutral',
    confidence: analysis.confidence || 0.5,
    _filtered: rawCompetitors.filter(c => !validatedCompetitors.includes(c)),
  };
}


// =============================================================================
// SCENARIO 1: Structured comparison with section headings (THE BUG)
// =============================================================================
console.log('\n══════════════════════════════════════════════════');
console.log(' SCENARIO 1 — Structured comparison headings');
console.log('══════════════════════════════════════════════════\n');
{
  const responseText = `
## Vercel vs Netlify: A Comprehensive Comparison

### Core Identity
Vercel is a frontend cloud platform built by the creators of Next.js. Netlify pioneered the Jamstack movement.

### Primary Strength
Vercel excels at Next.js deployments with zero-config. Netlify offers broader framework support.

### Build Speed
Vercel uses Turbopack for significantly faster builds. Netlify's build system is reliable but slower.

### Deployment Latency
Both platforms deploy globally via CDN. Vercel's Edge Network has a slight edge.

### Free Tier Generosity
Netlify's free tier includes 100GB bandwidth vs Vercel's 100GB. Both are generous.

### Best For
- Vercel: Next.js apps, React projects, enterprise teams
- Netlify: Static sites, Hugo/Gatsby, indie developers

### Other Alternatives
Consider AWS Amplify, Cloudflare Pages, Railway, and Render for different use cases.
`;

  const llmExtraction = {
    brandMentioned: true, brandPosition: null,
    competitorsMentioned: [
      'Netlify', 'AWS Amplify', 'Cloudflare Pages', 'Railway', 'Render',
      'Core Identity', 'Primary Strength', 'Build Speed',
      'Deployment Latency', 'Free Tier Generosity', 'Best For',
    ],
    competitorPositions: {},
    competitorSentiments: {
      'Netlify': 'positive', 'AWS Amplify': 'neutral', 'Cloudflare Pages': 'neutral',
      'Railway': 'neutral', 'Render': 'neutral', 'Core Identity': 'neutral',
    },
    sentiment: 'positive', confidence: 0.85,
  };

  const result = runPostProcessing(responseText, llmExtraction, { brandName: 'Vercel' });

  assert(result.brandMentioned === true, 'Brand "Vercel" detected');
  assert(result.brandPosition === undefined, 'No explicit ranking → undefined');

  assert(result.competitors.includes('Netlify'), 'Keeps Netlify');
  assert(result.competitors.includes('AWS Amplify'), 'Keeps AWS Amplify');
  assert(result.competitors.includes('Cloudflare Pages'), 'Keeps Cloudflare Pages');
  assert(result.competitors.includes('Railway'), 'Keeps Railway');
  assert(result.competitors.includes('Render'), 'Keeps Render');
  assertEq(result.competitors.length, 5, 'Exactly 5 valid competitors');

  assert(!result.competitors.includes('Core Identity'), 'Filtered Core Identity');
  assert(!result.competitors.includes('Primary Strength'), 'Filtered Primary Strength');
  assert(!result.competitors.includes('Build Speed'), 'Filtered Build Speed');
  assert(!result.competitors.includes('Deployment Latency'), 'Filtered Deployment Latency');
  assert(!result.competitors.includes('Free Tier Generosity'), 'Filtered Free Tier Generosity');
  assert(!result.competitors.includes('Best For'), 'Filtered Best For');

  assert(result.competitorSentiments['Netlify'] === 'positive', 'Netlify sentiment preserved');
  assert(!('Core Identity' in result.competitorSentiments), 'No sentiment for filtered entry');
  assertEq(Object.keys(result.competitorSentiments).length, 5, 'Sentiments only for 5 valid');
}


// =============================================================================
// SCENARIO 2: Numbered ranking list (ideal case)
// =============================================================================
console.log('\n══════════════════════════════════════════════════');
console.log(' SCENARIO 2 — Numbered ranking list');
console.log('══════════════════════════════════════════════════\n');
{
  const responseText = `
Top 7 startup accelerators for 2026:
1. Y Combinator  2. Techstars  3. 500 Global  4. Seedcamp
5. Antler  6. MassChallenge  7. Entrepreneurs First
Honorable mentions: Boost VC, Creative Destruction Lab, Plug and Play.
`;

  const llmExtraction = {
    brandMentioned: true, brandPosition: 1,
    competitorsMentioned: [
      'Techstars', '500 Global', 'Seedcamp', 'Antler', 'MassChallenge',
      'Entrepreneurs First', 'Boost VC', 'Creative Destruction Lab', 'Plug and Play',
    ],
    competitorPositions: {
      'Techstars': 2, '500 Global': 3, 'Seedcamp': 4, 'Antler': 5,
      'MassChallenge': 6, 'Entrepreneurs First': 7,
    },
    competitorSentiments: {
      'Techstars': 'positive', '500 Global': 'positive', 'Seedcamp': 'positive',
      'Antler': 'positive', 'MassChallenge': 'positive',
      'Entrepreneurs First': 'positive', 'Boost VC': 'neutral',
      'Creative Destruction Lab': 'neutral', 'Plug and Play': 'neutral',
    },
    sentiment: 'positive', confidence: 0.95,
  };

  const result = runPostProcessing(responseText, llmExtraction, { brandName: 'Y Combinator' });

  assert(result.brandMentioned === true, 'Y Combinator detected');
  assert(result.brandPosition === 1, 'Y Combinator position = 1');
  assertEq(result.competitors.length, 9, 'All 9 competitors kept');
  assert(result.competitorPositions['Techstars'] === 2, 'Techstars position = 2');
  assert(result.competitorPositions['Entrepreneurs First'] === 7, 'EF position = 7');
  assert(!('Boost VC' in result.competitorPositions), 'Honorable mention has no position');
  assert(result.competitorSentiments['Techstars'] === 'positive', 'Techstars sentiment');
}


// =============================================================================
// SCENARIO 3: cleanLLMAnalysisNames — strips "(url)" suffixes
// =============================================================================
console.log('\n══════════════════════════════════════════════════');
console.log(' SCENARIO 3 — Parenthetical stripping');
console.log('══════════════════════════════════════════════════\n');
{
  const llmExtraction = {
    brandMentioned: true, brandPosition: null,
    competitorsMentioned: [
      'Netlify (https://netlify.com)',
      'Railway (formerly Up)',
      'Render (render.com)',
      'AWS Amplify (by Amazon)',
      'Vercel',
      'Cloudflare',
    ],
    competitorPositions: {
      'Netlify (https://netlify.com)': 1,
      'Railway (formerly Up)': 2,
      'Render (render.com)': 3,
    },
    competitorSentiments: {
      'Netlify (https://netlify.com)': 'positive',
      'Railway (formerly Up)': 'neutral',
      'Render (render.com)': 'positive',
      'AWS Amplify (by Amazon)': 'neutral',
      'Cloudflare': 'neutral',
    },
    sentiment: 'positive', confidence: 0.9,
  };

  const result = runPostProcessing('Vercel is great. Netlify, Railway, Render are alternatives.',
    llmExtraction, { brandName: 'Vercel' });

  assert(result.competitors.includes('Netlify'), '"Netlify (url)" → "Netlify"');
  assert(result.competitors.includes('Railway'), '"Railway (formerly Up)" → "Railway"');
  assert(result.competitors.includes('Render'), '"Render (render.com)" → "Render"');
  assert(result.competitors.includes('AWS Amplify'), '"AWS Amplify (by Amazon)" → "AWS Amplify"');
  assert(!result.competitors.includes('Vercel'), 'Brand excluded');

  assert(result.competitorPositions['Netlify'] === 1, 'Position mapped to cleaned name');
  assert(result.competitorPositions['Railway'] === 2, 'Position mapped to cleaned name');
  assert(result.competitorSentiments['Netlify'] === 'positive', 'Sentiment mapped to cleaned name');
}


// =============================================================================
// SCENARIO 4: Brand position validation
// =============================================================================
console.log('\n══════════════════════════════════════════════════');
console.log(' SCENARIO 4 — Brand position validation');
console.log('══════════════════════════════════════════════════\n');
{
  assert(validateBrandPosition(1) === 1, 'pos 1 → 1');
  assert(validateBrandPosition(5) === 5, 'pos 5 → 5');
  assert(validateBrandPosition(20) === 20, 'pos 20 → 20 (max)');
  assert(validateBrandPosition(0) === undefined, 'pos 0 → undefined');
  assert(validateBrandPosition(-1) === undefined, 'pos -1 → undefined');
  assert(validateBrandPosition(21) === undefined, 'pos 21 → undefined');
  assert(validateBrandPosition(100) === undefined, 'pos 100 → undefined');
  assert(validateBrandPosition(null) === undefined, 'pos null → undefined');
  assert(validateBrandPosition(undefined) === undefined, 'pos undefined → undefined');
}


// =============================================================================
// SCENARIO 5: Brand mention regex overrides LLM
// =============================================================================
console.log('\n══════════════════════════════════════════════════');
console.log(' SCENARIO 5 — Brand mention regex validation');
console.log('══════════════════════════════════════════════════\n');
{
  assert(validateBrandMention('Vercel is great for Next.js', 'Vercel') === true, 'Simple mention');
  assert(validateBrandMention('Try VERCEL for your next project', 'Vercel') === true, 'Case insensitive');
  assert(validateBrandMention('Netlify and AWS are popular', 'Vercel') === false, 'Not mentioned');
  assert(validateBrandMention('The vercellini tool', 'Vercel') === false, 'Substring fails word boundary');
  assert(validateBrandMention('Visit https://vercel.com for more', 'Vercel') === false, 'URL stripped');
  assert(validateBrandMention('Run ```npx vercel deploy```', 'Vercel') === false, 'Code block stripped');
  assert(validateBrandMention('Scale AI provides labeling', 'Scale AI') === true, 'Multi-word brand');
  assert(validateBrandMention('Scaling AI models is complex', 'Scale AI') === false, '"Scaling AI" ≠ "Scale AI"');
  assert(validateBrandMention('Vercel', 'Vercel') === true, 'Brand alone');
  assert(validateBrandMention('Deploy with Vercel.', 'Vercel') === true, 'Brand before period');

  // Override: LLM says true but regex says false
  const llm = {
    brandMentioned: true, brandPosition: 1,
    competitorsMentioned: ['Netlify'],
    competitorPositions: { 'Netlify': 2 },
    competitorSentiments: { 'Netlify': 'neutral' },
    sentiment: 'positive', confidence: 0.8,
  };
  const r = runPostProcessing('Netlify is the best Jamstack platform', llm, { brandName: 'Vercel' });
  assert(r.brandMentioned === false, 'Regex overrides LLM hallucinated brand mention → false');
}


// =============================================================================
// SCENARIO 6: Scale AI vs Cohere table comparison (the exact bug)
// =============================================================================
console.log('\n══════════════════════════════════════════════════');
console.log(' SCENARIO 6 — Scale AI vs Cohere feature table');
console.log('══════════════════════════════════════════════════\n');
{
  const responseText = `
## Scale AI vs Cohere: Head-to-Head

| Category | Scale AI | Cohere |
|----------|----------|--------|
| Core Identity | Data infrastructure | Enterprise NLP |
| Primary Strength | Human-in-the-loop labeling | RAG & retrieval |
| Best For | Large enterprises | Mid-market teams |

Also consider: Anthropic, OpenAI, Hugging Face, Mistral, Together AI, Labelbox.
`;

  const llmExtraction = {
    brandMentioned: true, brandPosition: null,
    competitorsMentioned: [
      'Cohere', 'Anthropic', 'OpenAI', 'Hugging Face', 'Mistral',
      'Together AI', 'Labelbox',
      'Core Identity', 'Primary Strength', 'Best For',
      'Deployment Latency', 'Free Tier Generosity',
      'Infrastructure Control', 'Security', 'Data Quality', 'Model Accuracy',
    ],
    competitorPositions: {},
    competitorSentiments: {
      'Cohere': 'positive', 'Anthropic': 'neutral', 'OpenAI': 'neutral',
      'Hugging Face': 'neutral', 'Mistral': 'neutral', 'Together AI': 'neutral',
      'Labelbox': 'neutral', 'Core Identity': 'neutral',
    },
    sentiment: 'positive', confidence: 0.85,
  };

  const result = runPostProcessing(responseText, llmExtraction, { brandName: 'Scale AI' });

  const expected = ['Cohere', 'Anthropic', 'OpenAI', 'Hugging Face', 'Mistral', 'Together AI', 'Labelbox'];
  for (const n of expected) assert(result.competitors.includes(n), `Keeps "${n}"`);
  assertEq(result.competitors.length, 7, `Exactly 7 competitors (got ${result.competitors.length})`);

  const junk = ['Core Identity', 'Primary Strength', 'Best For', 'Deployment Latency',
    'Free Tier Generosity', 'Infrastructure Control', 'Security', 'Data Quality', 'Model Accuracy'];
  for (const n of junk) assert(!result.competitors.includes(n), `Filtered "${n}"`);
}


// =============================================================================
// SCENARIO 7: Comma, slash, hyphen junk patterns
// =============================================================================
console.log('\n══════════════════════════════════════════════════');
console.log(' SCENARIO 7 — Comma, slash, hyphen patterns');
console.log('══════════════════════════════════════════════════\n');
{
  const llmExtraction = {
    brandMentioned: true, brandPosition: 2,
    competitorsMentioned: [
      'Hetzner', 'DigitalOcean', 'Linode', 'Vultr', 'OVHcloud',
      'Hands-on, cost-effective Linux VPS', 'Fast, scalable hosting',
      'MVP / Early-stage', 'Data-heavy / Analytics', 'API / SDK flexibility',
      'Low-latency Performance', 'High-availability Infrastructure',
      'Setup & Git integration',
    ],
    competitorPositions: { 'Hetzner': 1, 'DigitalOcean': 3, 'Linode': 4 },
    competitorSentiments: {
      'Hetzner': 'positive', 'DigitalOcean': 'positive', 'Linode': 'neutral',
      'Vultr': 'neutral', 'OVHcloud': 'neutral',
    },
    sentiment: 'positive', confidence: 0.8,
  };

  const result = runPostProcessing('Railway is a modern PaaS. Hetzner great VPS.', llmExtraction, { brandName: 'Railway' });

  assertEq(result.competitors.length, 5, '5 real hosting companies kept');
  assert(result.competitors.includes('Hetzner'), 'Hetzner kept');
  assert(result.competitors.includes('OVHcloud'), 'OVHcloud kept');
  assert(!result.competitors.includes('Hands-on, cost-effective Linux VPS'), 'Comma filtered');
  assert(!result.competitors.includes('MVP / Early-stage'), 'Slash filtered');
  assert(!result.competitors.includes('Low-latency Performance'), 'Hyphen-abstract filtered');
  assert(!result.competitors.includes('Setup & Git integration'), 'Ampersand feature filtered');
  assert(result.competitorPositions['Hetzner'] === 1, 'Hetzner position preserved');
  assert(result.brandPosition === 2, 'Brand position = 2');
}


// =============================================================================
// SCENARIO 8: Position collision after name cleaning
// =============================================================================
console.log('\n══════════════════════════════════════════════════');
console.log(' SCENARIO 8 — Position collision after cleaning');
console.log('══════════════════════════════════════════════════\n');
{
  const llmExtraction = {
    brandMentioned: true, brandPosition: 1,
    competitorsMentioned: ['Netlify (netlify.com)', 'Netlify', 'AWS'],
    competitorPositions: { 'Netlify (netlify.com)': 3, 'Netlify': 2, 'AWS': 4 },
    competitorSentiments: { 'Netlify (netlify.com)': 'positive', 'Netlify': 'neutral', 'AWS': 'neutral' },
    sentiment: 'positive', confidence: 0.9,
  };

  const result = runPostProcessing('Vercel vs Netlify. AWS is another option.', llmExtraction, { brandName: 'Vercel' });

  // After cleaning: both map to "Netlify". Position collision: min(3, 2) = 2
  assert(result.competitorPositions['Netlify'] === 2, 'Position collision → min(3,2) = 2');
  assert(result.competitorPositions['AWS'] === 4, 'AWS position intact');
}


// =============================================================================
// SCENARIO 9: Full multi-provider aggregation (2 runs × 4 providers)
// =============================================================================
console.log('\n══════════════════════════════════════════════════');
console.log(' SCENARIO 9 — Full multi-provider aggregation');
console.log('══════════════════════════════════════════════════\n');
{
  const config = { brandName: 'Vercel' };
  const text = 'Vercel is a modern platform.';

  const extractions = [
    { provider: 'ChatGPT', run: 1,
      llm: { brandMentioned: true, brandPosition: 1,
        competitorsMentioned: ['Netlify', 'AWS Amplify', 'Cloudflare Pages', 'Core Identity', 'Render'],
        competitorPositions: { 'Netlify': 2, 'AWS Amplify': 3, 'Cloudflare Pages': 4, 'Render': 5 },
        competitorSentiments: { 'Netlify': 'positive', 'AWS Amplify': 'neutral', 'Cloudflare Pages': 'neutral', 'Render': 'neutral' },
        sentiment: 'positive', confidence: 0.9 }},
    { provider: 'Claude', run: 1,
      llm: { brandMentioned: true, brandPosition: 1,
        competitorsMentioned: ['Netlify', 'Render', 'Railway', 'Build Speed'],
        competitorPositions: { 'Netlify': 2, 'Render': 3, 'Railway': 4 },
        competitorSentiments: { 'Netlify': 'positive', 'Render': 'positive', 'Railway': 'neutral' },
        sentiment: 'positive', confidence: 0.9 }},
    { provider: 'Perplexity', run: 1,
      llm: { brandMentioned: true, brandPosition: 1,
        competitorsMentioned: ['Netlify', 'Cloudflare Pages', 'Railway', 'Deployment Latency'],
        competitorPositions: { 'Netlify': 2, 'Railway': 3 },
        competitorSentiments: { 'Netlify': 'positive', 'Cloudflare Pages': 'neutral', 'Railway': 'neutral' },
        sentiment: 'positive', confidence: 0.85 }},
    { provider: 'Gemini', run: 1,
      llm: { brandMentioned: true, brandPosition: 2,
        competitorsMentioned: ['Netlify', 'AWS Amplify', 'Render', 'Free Tier Generosity'],
        competitorPositions: { 'Netlify': 1, 'AWS Amplify': 3, 'Render': 4 },
        competitorSentiments: { 'Netlify': 'positive', 'AWS Amplify': 'neutral', 'Render': 'neutral' },
        sentiment: 'neutral', confidence: 0.85 }},
    { provider: 'ChatGPT', run: 2,
      llm: { brandMentioned: true, brandPosition: 1,
        competitorsMentioned: ['Netlify', 'AWS Amplify', 'Render', 'Cloudflare Pages', 'Railway'],
        competitorPositions: { 'Netlify': 2, 'AWS Amplify': 3, 'Render': 4, 'Cloudflare Pages': 5, 'Railway': 6 },
        competitorSentiments: { 'Netlify': 'positive', 'AWS Amplify': 'neutral', 'Render': 'positive', 'Cloudflare Pages': 'neutral', 'Railway': 'neutral' },
        sentiment: 'positive', confidence: 0.9 }},
    { provider: 'Claude', run: 2,
      llm: { brandMentioned: true, brandPosition: 1,
        competitorsMentioned: ['NETLIFY', 'Render', 'Cloudflare Pages', 'Security'],
        competitorPositions: { 'NETLIFY': 2, 'Render': 3, 'Cloudflare Pages': 4 },
        competitorSentiments: { 'NETLIFY': 'neutral', 'Render': 'positive', 'Cloudflare Pages': 'neutral' },
        sentiment: 'positive', confidence: 0.9 }},
  ];

  const processedResults = extractions.map(e => ({
    ...e,
    result: runPostProcessing(text, e.llm, config),
  }));

  // No false positives in any result
  for (const e of processedResults) {
    for (const junk of ['Core Identity', 'Build Speed', 'Deployment Latency', 'Free Tier Generosity', 'Security']) {
      assert(!e.result.competitors.includes(junk), `${e.provider} R${e.run}: no "${junk}"`);
    }
  }

  // Aggregate (mimic route.ts)
  const mentionMap = new Map();
  const displayMap = new Map();

  for (const e of processedResults) {
    for (const comp of e.result.competitors) {
      const key = comp.toLowerCase();
      if (!mentionMap.has(key)) { mentionMap.set(key, []); displayMap.set(key, new Map()); }
      mentionMap.get(key).push({
        position: e.result.competitorPositions[comp] || null,
        sentiment: e.result.competitorSentiments[comp] || 'neutral',
      });
      const dc = displayMap.get(key);
      dc.set(comp, (dc.get(comp) || 0) + 1);
    }
  }

  let totalMentions = 0;
  mentionMap.forEach(m => totalMentions += m.length);

  const aggregated = [];
  mentionMap.forEach((mentions, key) => {
    let bestName = key, maxC = 0;
    displayMap.get(key).forEach((c, n) => { if (c > maxC) { maxC = c; bestName = n; } });
    const mc = mentions.length;
    const sov = Math.round((mc / totalMentions) * 1000) / 10;
    const withPos = mentions.filter(m => m.position !== null && m.position > 0);
    const avgPos = withPos.length > 0
      ? Math.round(withPos.reduce((s, m) => s + m.position, 0) / withPos.length * 10) / 10 : 0;
    const sc = { positive: 0, neutral: 0, negative: 0 };
    mentions.forEach(m => sc[m.sentiment]++);
    const sent = Object.entries(sc).sort(([,a],[,b]) => b - a)[0][0];
    aggregated.push({ name: bestName, mentionCount: mc, shareOfVoice: sov, averagePosition: avgPos, sentiment: sent });
  });
  aggregated.sort((a, b) => b.shareOfVoice - a.shareOfVoice);

  const findAgg = (n) => aggregated.find(c => c.name.toLowerCase() === n.toLowerCase());

  const netlify = findAgg('Netlify');
  assert(netlify && netlify.name === 'Netlify', 'Display name = "Netlify"');
  assert(netlify && netlify.mentionCount === 6, `Netlify = 6 mentions (got ${netlify?.mentionCount})`);
  assert(netlify && netlify.sentiment === 'positive', 'Netlify sentiment = positive');
  // Netlify positions: [2,2,2,1,2,2] → 11/6 ≈ 1.8
  assertClose(netlify.averagePosition, 1.8, 0.1, 'Netlify avg pos ≈ 1.8');

  const render = findAgg('Render');
  assert(render && render.mentionCount === 5, `Render = 5 mentions (got ${render?.mentionCount})`);

  const sovSum = aggregated.reduce((s, c) => s + c.shareOfVoice, 0);
  assertClose(sovSum, 100, 1.5, `SOV ≈ 100% (got ${sovSum.toFixed(1)}%)`);
  assert(aggregated[0].name === 'Netlify', 'Netlify ranked #1 by SOV');

  console.log(`\n  Aggregated (${aggregated.length} competitors):`);
  console.log('  ' + '-'.repeat(72));
  console.log(`  ${'#'.padEnd(4)}${'Name'.padEnd(22)}${'Mentions'.padEnd(10)}${'SOV'.padEnd(8)}${'AvgPos'.padEnd(8)}Sentiment`);
  console.log('  ' + '-'.repeat(72));
  aggregated.forEach((c, i) => {
    console.log(`  ${String(i+1).padEnd(4)}${c.name.padEnd(22)}${String(c.mentionCount).padEnd(10)}${(c.shareOfVoice+'%').padEnd(8)}${(c.averagePosition||'—').toString().padEnd(8)}${c.sentiment}`);
  });
}


// =============================================================================
// SCENARIO 10: Citation suffixes in names
// =============================================================================
console.log('\n\n══════════════════════════════════════════════════');
console.log(' SCENARIO 10 — Citation suffixes');
console.log('══════════════════════════════════════════════════\n');
{
  const llmExtraction = {
    brandMentioned: true, brandPosition: null,
    competitorsMentioned: [
      'Datadog (https://datadoghq.com)', 'New Relic (https://newrelic.com)',
      'Grafana (now Grafana Labs)', 'Sentry', 'Dynatrace',
    ],
    competitorPositions: { 'Datadog (https://datadoghq.com)': 1, 'New Relic (https://newrelic.com)': 2, 'Grafana (now Grafana Labs)': 3 },
    competitorSentiments: { 'Datadog (https://datadoghq.com)': 'positive', 'New Relic (https://newrelic.com)': 'positive', 'Grafana (now Grafana Labs)': 'neutral', 'Sentry': 'neutral', 'Dynatrace': 'neutral' },
    sentiment: 'neutral', confidence: 0.9,
  };

  const result = runPostProcessing('Splunk is used for log analysis.', llmExtraction, { brandName: 'Splunk' });

  assert(result.competitors.includes('Datadog'), '"Datadog (url)" → "Datadog"');
  assert(result.competitors.includes('New Relic'), '"New Relic (url)" → "New Relic"');
  assert(result.competitors.includes('Grafana'), '"Grafana (now ...)" → "Grafana"');
  assert(result.competitorPositions['Datadog'] === 1, 'Datadog pos = 1');
  assert(result.competitorPositions['New Relic'] === 2, 'New Relic pos = 2');
  assert(result.competitorSentiments['Datadog'] === 'positive', 'Datadog sentiment');
}


// =============================================================================
// SCENARIO 11: Empty / garbage LLM output
// =============================================================================
console.log('\n══════════════════════════════════════════════════');
console.log(' SCENARIO 11 — Empty / garbage LLM output');
console.log('══════════════════════════════════════════════════\n');
{
  const r1 = runPostProcessing('Some text', {
    brandMentioned: false, brandPosition: null,
    competitorsMentioned: [], competitorPositions: {}, competitorSentiments: {},
    sentiment: 'neutral', confidence: 0.5,
  }, { brandName: 'Vercel' });
  assertEq(r1.competitors.length, 0, 'Empty → 0 competitors');

  const r2 = runPostProcessing('Some text', {
    brandMentioned: true, brandPosition: null,
    competitorsMentioned: ['Core Identity', 'Build Speed', 'Security', 'Performance', '', '  '],
    competitorPositions: {}, competitorSentiments: {},
    sentiment: 'neutral', confidence: 0.3,
  }, { brandName: 'Vercel' });
  assertEq(r2.competitors.length, 0, 'All-junk → 0 competitors');
  assert(r2._filtered.length > 0, 'Filtered items tracked');
}


// =============================================================================
// SUMMARY
// =============================================================================
console.log('\n══════════════════════════════════════════════════');
console.log(' SUMMARY');
console.log('══════════════════════════════════════════════════\n');
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
if (failures.length > 0) {
  console.log('\n  Failures:');
  for (const f of failures) console.log(`    ✗ ${f}`);
}
console.log('');
process.exit(failed > 0 ? 1 : 0);
