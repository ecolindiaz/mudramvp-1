#!/usr/bin/env node
/**
 * Production-mimic competitor pipeline test
 *
 * Tests the FULL flow: LLM extraction → filterValidCompetitors → storage →
 * query-time isValidCompetitorName → aggregation (SOV, avg position, sentiment,
 * display-name dedup, short→long merge).
 *
 * Run:  node mudra-app/scripts/test-competitor-pipeline.js
 */

const fs = require('fs');
const path = require('path');

// ─── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(label);
    console.log(`  ✗ FAIL: ${label}`);
  }
}

function assertClose(actual, expected, tolerance, label) {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (ok) {
    passed++;
  } else {
    failed++;
    failures.push(`${label} (got ${actual}, want ${expected}±${tolerance})`);
    console.log(`  ✗ FAIL: ${label} — got ${actual}, want ${expected}±${tolerance}`);
  }
}

// ─── Extract production functions from source (no TS compiler needed) ──────────
// NOTE: eval() is used intentionally to extract TS functions and run them in plain
// Node.js. This script is a local dev-only test tool — never deployed.

function loadFilterValidCompetitors() {
  const code = fs.readFileSync(
    path.join(__dirname, '..', 'lib', 'services', 'direct-geo-analysis.service.ts'),
    'utf8'
  );
  const m = code.match(
    /export function filterValidCompetitors\(competitors: string\[\], brandName: string\): string\[\] \{[\s\S]*?\n\}/
  );
  if (!m) throw new Error('Cannot extract filterValidCompetitors');
  let fn = m[0]
    .replace('export function', 'function')
    .replace(/: string\[\]/g, '')
    .replace(/: string/g, '')
    .replace(/: boolean/g, '');
  // eslint-disable-next-line no-eval
  eval(fn);
  return filterValidCompetitors;
}

function loadQuickValidateName() {
  const code = fs.readFileSync(
    path.join(__dirname, '..', 'lib', 'services', 'competitor-validation.service.ts'),
    'utf8'
  );
  const m = code.match(
    /export function quickValidateName\(name: string\): boolean \{[\s\S]*?\n\}/
  );
  if (!m) throw new Error('Cannot extract quickValidateName');
  let fn = m[0]
    .replace('export function', 'function')
    .replace(/\(name: string\): boolean/, '(name)');
  // eslint-disable-next-line no-eval
  eval(fn);
  return quickValidateName;
}

function loadIsValidCompetitorName() {
  const code = fs.readFileSync(
    path.join(__dirname, '..', 'app', 'api', 'analysis', 'competitors', 'route.ts'),
    'utf8'
  );

  const kcMatch = code.match(
    /const KNOWN_COMPANIES = new Set\(\[([\s\S]*?)\]\)/
  );
  if (!kcMatch) throw new Error('Cannot extract KNOWN_COMPANIES');

  const fnMatch = code.match(
    /function isValidCompetitorName\(name: string\): boolean \{[\s\S]*?\n\}/
  );
  if (!fnMatch) throw new Error('Cannot extract isValidCompetitorName');

  let fnCode = fnMatch[0].replace(/\(name: string\): boolean/, '(name)');
  const qvn = loadQuickValidateName();

  const fullCode = `
    const KNOWN_COMPANIES = new Set([${kcMatch[1]}]);
    const quickValidateName = ${qvn.toString()};
    ${fnCode}
  `;
  // eslint-disable-next-line no-eval
  eval(fullCode);
  return isValidCompetitorName;
}

// ─── Load functions ────────────────────────────────────────────────────────────

const filterValidCompetitors = loadFilterValidCompetitors();
const quickValidateName = loadQuickValidateName();
const isValidCompetitorName = loadIsValidCompetitorName();

// =============================================================================
// PART 1: FALSE POSITIVE FILTERING
// These should ALL be filtered out — category headings, feature labels, etc.
// =============================================================================
console.log('\n══════════════════════════════════════════════════');
console.log(' PART 1 — False positive filtering (must REJECT)');
console.log('══════════════════════════════════════════════════\n');

const confirmedFalsePositives = [
  // Category headings from real profiles
  'Core Identity', 'Primary Strength', 'Best For', 'Security',
  'Engagement Model', 'Build speed', 'Deployment latency',
  'Free tier generosity', 'Infrastructure Control',
  'Low-latency Performance', 'MVP / Early-stage',
  'Data-heavy / Analytics', 'Setup & Git integration',
  // Feature comparisons
  'Hands-on, cost-effective Linux VPS', 'Fast, scalable hosting',
  // Abstract concept pairs
  'Data Model', 'Cloud Security', 'Service Quality', 'Code Coverage',
  'Key Performance', 'Main Focus', 'Base Cost', 'High Latency',
  'Low Speed', 'System Integration', 'Platform Reliability',
  'Developer Experience', 'User Management', 'Network Efficiency',
  'Overall Performance', 'Total Cost', 'Vendor Management',
  'Resource Capacity', 'Price Tier', 'Security Compliance',
  'Build Automation', 'API Integration', 'Data Quality',
  'Cost Pricing', 'High Speed', 'Model Accuracy',
  // Single-word abstract
  'Performance', 'Reliability', 'Scalability', 'Automation',
  'Integration', 'Deployment', 'Compliance', 'Governance',
  // Phrases with slashes / commas
  'API / SDK flexibility',
  'Serverless, edge-first', 'Fast, reliable CDN',
  // Sentences / descriptions
  'Others share enthusiasm for the platform',
  'Check out their pricing page',
  'Leading cloud hosting provider',
  'The best tool for developers',
];

console.log('  filterValidCompetitors():');
{
  const leaked = filterValidCompetitors(confirmedFalsePositives, 'TestBrand');
  for (const fp of confirmedFalsePositives) {
    const wasKept = leaked.includes(fp);
    assert(!wasKept, `filterValidCompetitors rejects "${fp}"`);
  }
}

console.log('  quickValidateName():');
{
  for (const fp of confirmedFalsePositives) {
    if (fp.length < 2) continue;
    const wasKept = quickValidateName(fp);
    assert(!wasKept, `quickValidateName rejects "${fp}"`);
  }
}

console.log('  isValidCompetitorName():');
{
  for (const fp of confirmedFalsePositives) {
    if (fp.length < 2) continue;
    const wasKept = isValidCompetitorName(fp);
    assert(!wasKept, `isValidCompetitorName rejects "${fp}"`);
  }
}

// =============================================================================
// PART 2: REAL COMPANY PRESERVATION (CRITICAL — don't over-filter!)
// These must ALL pass. Being too aggressive here is WORSE than letting
// a few false positives through.
// =============================================================================
console.log('\n══════════════════════════════════════════════════');
console.log(' PART 2 — Real company preservation (must KEEP)');
console.log('══════════════════════════════════════════════════\n');

const realCompanies = [
  // Cloud & Hosting
  'AWS', 'Google Cloud', 'Azure', 'Vercel', 'Netlify', 'Heroku',
  'Railway', 'Render', 'DigitalOcean', 'Cloudflare', 'Fastly',
  'Akamai', 'Fly.io', 'Firebase', 'Supabase', 'PlanetScale', 'Neon',
  // DevOps
  'GitHub', 'GitLab', 'Docker', 'Kubernetes', 'Terraform', 'Pulumi',
  'CircleCI', 'Jenkins', 'Harness',
  // Monitoring
  'Datadog', 'New Relic', 'Sentry', 'Splunk', 'Grafana', 'Dynatrace',
  'LogRocket', 'FullStory', 'Hotjar', 'PagerDuty',
  // AI/ML
  'OpenAI', 'Anthropic', 'Cohere', 'Mistral', 'Hugging Face',
  'Replicate', 'Modal', 'LangChain', 'Pinecone', 'Weaviate',
  'Scale AI', 'Stability AI',
  // Databases
  'MongoDB', 'PostgreSQL', 'Redis', 'Elasticsearch', 'CockroachDB',
  'Snowflake', 'Fauna',
  // E-commerce
  'Shopify', 'Stripe', 'PayPal', 'Square', 'BigCommerce',
  // CMS & Web
  'Contentful', 'Sanity', 'Strapi', 'WordPress', 'Webflow', 'Wix',
  'Squarespace',
  // Security
  'CrowdStrike', 'Zscaler', 'Okta', 'Auth0', 'Snyk',
  'Palo Alto Networks', 'SentinelOne', 'Fortinet',
  // Analytics
  'Amplitude', 'Mixpanel', 'Segment', 'Polar Analytics',
  // Misc known
  'Twilio', 'SendGrid', 'Slack', 'Notion', 'Airtable', 'Zapier',
  'Retool', 'Algolia', 'LaunchDarkly', 'JFrog', 'HashiCorp',
  // Names that COULD look like abstract combos but are real companies
  'Core Scientific', 'Digital Ocean', 'Carbon Black',
  'Elastic', 'Confluent', 'Databricks', 'Palantir',
  // 2-word names that must NOT be confused with category headings
  'Signal AI', 'Weights & Biases', 'Together AI',
  // Startup accelerators
  'Techstars', '500 Global', 'Seedcamp', 'MassChallenge', 'Antler',
  'Entrepreneurs First',
];

console.log('  filterValidCompetitors():');
{
  const kept = filterValidCompetitors(realCompanies, 'TestBrand');
  for (const name of realCompanies) {
    const wasKept = kept.includes(name);
    assert(wasKept, `filterValidCompetitors keeps "${name}"`);
  }
}

console.log('  isValidCompetitorName() (includes KNOWN_COMPANIES whitelist):');
{
  for (const name of realCompanies) {
    const wasKept = isValidCompetitorName(name);
    assert(wasKept, `isValidCompetitorName keeps "${name}"`);
  }
}


// =============================================================================
// PART 3: BRAND SELF-EXCLUSION
// The user's own brand and its sub-products should be excluded.
// =============================================================================
console.log('\n══════════════════════════════════════════════════');
console.log(' PART 3 — Brand self-exclusion');
console.log('══════════════════════════════════════════════════\n');

{
  const brand = 'Vercel';
  const mixed = ['Netlify', 'Vercel', 'Vercel AI', "Vercel's Edge Network", 'AWS', 'Render'];
  const kept = filterValidCompetitors(mixed, brand);
  assert(!kept.includes('Vercel'), 'Excludes exact brand "Vercel"');
  assert(!kept.includes('Vercel AI'), 'Excludes brand product "Vercel AI"');
  assert(!kept.includes("Vercel's Edge Network"), "Excludes brand possessive");
  assert(kept.includes('Netlify'), 'Keeps competitor "Netlify"');
  assert(kept.includes('AWS'), 'Keeps competitor "AWS"');
  assert(kept.includes('Render'), 'Keeps competitor "Render"');
}


// =============================================================================
// PART 4: FULL AGGREGATION PIPELINE (mimic competitors/route.ts GET handler)
// =============================================================================
console.log('\n══════════════════════════════════════════════════');
console.log(' PART 4 — Full aggregation pipeline');
console.log('══════════════════════════════════════════════════\n');

// Build mock GeoAnalysisResult rows, same shape as Prisma returns
function buildMockAnalyses() {
  return [
    // --- Run 1 ---
    {
      id: 'run-1',
      createdAt: new Date('2026-02-10'),
      summary: JSON.stringify({}),
      analyses: JSON.stringify([
        {
          provider: 'ChatGPT',
          promptTests: [
            {
              competitorsMentioned: ['Netlify', 'AWS', 'Render', 'Core Identity', 'Railway'],
              competitorPositions: { 'Netlify': 1, 'AWS': 2, 'Render': 3 },
              competitorSentiments: { 'Netlify': 'positive', 'AWS': 'neutral', 'Render': 'positive', 'Core Identity': 'neutral', 'Railway': 'neutral' },
            },
            {
              competitorsMentioned: ['Netlify', 'AWS', 'Primary Strength', 'Railway'],
              competitorPositions: { 'Netlify': 2, 'AWS': 1 },
              competitorSentiments: { 'Netlify': 'positive', 'AWS': 'positive', 'Primary Strength': 'neutral', 'Railway': 'positive' },
            },
          ],
        },
        {
          provider: 'Claude',
          promptTests: [
            {
              competitorsMentioned: ['Netlify', 'netlify', 'Render', 'Cloudflare', 'Build speed'],
              competitorPositions: { 'Netlify': 1, 'Render': 2, 'Cloudflare': 3 },
              competitorSentiments: { 'Netlify': 'positive', 'Render': 'neutral', 'Cloudflare': 'positive', 'Build speed': 'neutral' },
            },
          ],
        },
        {
          provider: 'Perplexity',
          promptTests: [
            {
              competitorsMentioned: ['Netlify', 'aws', 'Render', 'Free tier generosity', 'Cloudflare Pages'],
              competitorPositions: { 'Netlify': 1, 'aws': 3 },
              competitorSentiments: { 'Netlify': 'positive', 'aws': 'negative', 'Render': 'neutral', 'Cloudflare Pages': 'positive' },
            },
          ],
        },
        {
          provider: 'Gemini',
          promptTests: [
            {
              competitorsMentioned: ['netlify', 'AWS', 'Cloudflare', 'Railway', 'Low-latency Performance', 'Hands-on, cost-effective Linux VPS'],
              competitorPositions: { 'netlify': 2, 'AWS': 1, 'Railway': 4 },
              competitorSentiments: { 'netlify': 'neutral', 'AWS': 'positive', 'Cloudflare': 'neutral', 'Railway': 'negative' },
            },
          ],
        },
      ]),
    },
    // --- Run 2 ---
    {
      id: 'run-2',
      createdAt: new Date('2026-02-11'),
      summary: JSON.stringify({}),
      analyses: JSON.stringify([
        {
          provider: 'ChatGPT',
          promptTests: [
            {
              competitorsMentioned: ['Netlify', 'AWS', 'Render', 'Railway', 'Fastly'],
              competitorPositions: { 'Netlify': 1, 'AWS': 2, 'Render': 3, 'Railway': 5 },
              competitorSentiments: { 'Netlify': 'positive', 'AWS': 'neutral', 'Render': 'positive', 'Railway': 'neutral', 'Fastly': 'neutral' },
            },
          ],
        },
        {
          provider: 'Claude',
          promptTests: [
            {
              competitorsMentioned: ['NETLIFY', 'AWS', 'Cloudflare', 'Render', 'Security'],
              competitorPositions: { 'NETLIFY': 2, 'AWS': 1, 'Cloudflare': 3 },
              competitorSentiments: { 'NETLIFY': 'neutral', 'AWS': 'positive', 'Cloudflare': 'neutral', 'Render': 'positive' },
            },
          ],
        },
      ]),
    },
  ];
}

// Reimplement the aggregation logic from competitors/route.ts exactly
function aggregateCompetitors(geoAnalyses, userBrandName) {
  const competitorMentionMap = new Map();
  const competitorDisplayNames = new Map();

  const addCompetitorMention = (rawName, position, sentiment, provider) => {
    const trimmedName = rawName.trim();
    if (!isValidCompetitorName(trimmedName)) return;

    const lowerKey = trimmedName.toLowerCase();
    if (!competitorMentionMap.has(lowerKey)) {
      competitorMentionMap.set(lowerKey, []);
      competitorDisplayNames.set(lowerKey, new Map());
    }
    const displayCounts = competitorDisplayNames.get(lowerKey);
    displayCounts.set(trimmedName, (displayCounts.get(trimmedName) || 0) + 1);
    competitorMentionMap.get(lowerKey).push({ name: trimmedName, position, sentiment, provider });
  };

  for (const analysis of geoAnalyses) {
    let analysesData = [];
    if (typeof analysis.analyses === 'string') {
      try { analysesData = JSON.parse(analysis.analyses); } catch { analysesData = []; }
    } else if (Array.isArray(analysis.analyses)) {
      analysesData = analysis.analyses;
    }

    for (const providerAnalysis of analysesData) {
      const promptTests = providerAnalysis.promptTests || providerAnalysis.tests || [];
      const provider = providerAnalysis.provider || 'unknown';

      for (const test of promptTests) {
        const competitors = test.competitors || test.competitorsMentioned || [];
        const positions = test.competitorPositions || {};
        const sentiments = test.competitorSentiments || {};

        for (const competitorName of competitors) {
          if (!competitorName || typeof competitorName !== 'string') continue;
          const trimmedName = competitorName.trim();
          const lowerName = trimmedName.toLowerCase();
          if (lowerName === userBrandName ||
              lowerName.includes(userBrandName) ||
              userBrandName.includes(lowerName)) continue;

          addCompetitorMention(
            trimmedName,
            positions[competitorName] || positions[trimmedName] || null,
            sentiments[competitorName] || sentiments[trimmedName] || 'neutral',
            provider
          );
        }
      }
    }
  }

  // Dedup merge: short → long
  const companySuffixes = new Set([
    'network', 'ai', 'labs', 'protocol', 'cloud', 'tech', 'technologies',
    'digital', 'studio', 'studios', 'global', 'group', 'hq', 'io',
    'platform', 'software', 'computing', 'systems', 'data', 'health',
  ]);
  const allKeys = Array.from(competitorMentionMap.keys());
  for (const key of allKeys) {
    const keyWords = key.split(/\s+/);
    if (keyWords.length !== 1) continue;
    for (const otherKey of allKeys) {
      if (key === otherKey) continue;
      const otherWords = otherKey.split(/\s+/);
      if (otherWords.length !== 2) continue;
      if (otherWords[0] === key && companySuffixes.has(otherWords[1])) {
        const shortMentions = competitorMentionMap.get(key) || [];
        const longMentions = competitorMentionMap.get(otherKey) || [];
        competitorMentionMap.set(otherKey, [...longMentions, ...shortMentions]);
        const shortDisplay = competitorDisplayNames.get(key);
        const longDisplay = competitorDisplayNames.get(otherKey);
        if (shortDisplay && longDisplay) {
          shortDisplay.forEach((count, name) => {
            longDisplay.set(name, (longDisplay.get(name) || 0) + count);
          });
        }
        competitorMentionMap.delete(key);
        competitorDisplayNames.delete(key);
        break;
      }
    }
  }

  const getBestDisplayName = (lowerKey) => {
    const displayCounts = competitorDisplayNames.get(lowerKey);
    if (!displayCounts || displayCounts.size === 0) return lowerKey;
    let bestName = lowerKey, maxCount = 0;
    displayCounts.forEach((count, name) => {
      if (count > maxCount) { maxCount = count; bestName = name; }
    });
    return bestName;
  };

  let totalMentions = 0;
  competitorMentionMap.forEach(mentions => { totalMentions += mentions.length; });

  const results = [];
  competitorMentionMap.forEach((mentions, lowerKey) => {
    const mentionCount = mentions.length;
    const displayName = getBestDisplayName(lowerKey);
    const shareOfVoice = totalMentions > 0 ? (mentionCount / totalMentions) * 100 : 0;
    const positionsWithValues = mentions.filter(m => m.position !== null && m.position > 0);
    const averagePosition = positionsWithValues.length > 0
      ? positionsWithValues.reduce((sum, m) => sum + (m.position || 0), 0) / positionsWithValues.length
      : 0;
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    mentions.forEach(m => { sentimentCounts[m.sentiment]++; });
    const overallSentiment = Object.entries(sentimentCounts)
      .sort(([, a], [, b]) => b - a)[0][0];

    results.push({
      name: displayName,
      mentionCount,
      shareOfVoice: Math.round(shareOfVoice * 10) / 10,
      averagePosition: Math.round(averagePosition * 10) / 10,
      sentiment: overallSentiment,
    });
  });

  return {
    competitors: results.sort((a, b) => b.shareOfVoice - a.shareOfVoice),
    totalMentions,
  };
}

// Run the pipeline on mock data
const mockAnalyses = buildMockAnalyses();
const result = aggregateCompetitors(mockAnalyses, 'vercel');

const find = (name) => result.competitors.find(c => c.name.toLowerCase() === name.toLowerCase());

// --- 4a: False positives must NOT appear in output ---
console.log('  4a. False positives excluded from aggregation:');
{
  const fpNames = ['Core Identity', 'Primary Strength', 'Build speed',
                   'Free tier generosity', 'Low-latency Performance', 'Security',
                   'Hands-on, cost-effective Linux VPS'];
  for (const fp of fpNames) {
    const found = result.competitors.find(c => c.name === fp);
    assert(!found, `"${fp}" excluded from final output`);
  }
}

// --- 4b: Real competitors MUST appear ---
console.log('  4b. Real competitors present in aggregation:');
{
  assert(!!find('Netlify'), 'Netlify present');
  assert(!!find('AWS'), 'AWS present');
  assert(!!find('Render'), 'Render present');
  assert(!!find('Railway'), 'Railway present');
  assert(!!find('Cloudflare'), 'Cloudflare present');
  assert(!!find('Fastly'), 'Fastly present');
}

// --- 4c: Case-insensitive dedup ---
console.log('  4c. Case-insensitive deduplication:');
{
  const netlifyEntries = result.competitors.filter(c => c.name.toLowerCase() === 'netlify');
  assert(netlifyEntries.length === 1, 'Netlify deduped to single entry');
  const awsEntries = result.competitors.filter(c => c.name.toLowerCase() === 'aws');
  assert(awsEntries.length === 1, 'AWS deduped to single entry');
}

// --- 4d: Mention counts ---
console.log('  4d. Mention counts:');
{
  // Netlify mentions across all mock data:
  // Run1: ChatGPT p1(Netlify), ChatGPT p2(Netlify), Claude(Netlify, netlify),
  //        Perplexity(Netlify), Gemini(netlify) = 6
  // Run2: ChatGPT(Netlify), Claude(NETLIFY) = 2
  // Total: 8
  const netlify = find('Netlify');
  assert(netlify && netlify.mentionCount === 8, `Netlify mentions = 8 (got ${netlify?.mentionCount})`);

  // AWS: Run1: ChatGPT p1, p2, Perplexity(aws), Gemini = 4
  //      Run2: ChatGPT, Claude = 2  →  Total: 6
  const aws = find('AWS');
  assert(aws && aws.mentionCount === 6, `AWS mentions = 6 (got ${aws?.mentionCount})`);

  // Render: Run1: ChatGPT p1, Claude, Perplexity = 3
  //         Run2: ChatGPT, Claude = 2  →  Total: 5
  const render = find('Render');
  assert(render && render.mentionCount === 5, `Render mentions = 5 (got ${render?.mentionCount})`);
}

// --- 4e: Share of voice ---
console.log('  4e. Share of Voice (SOV):');
{
  const total = result.totalMentions;
  const netlify = find('Netlify');
  const aws = find('AWS');

  if (netlify) {
    const expectedSOV = Math.round((8 / total) * 1000) / 10;
    assertClose(netlify.shareOfVoice, expectedSOV, 0.1, `Netlify SOV ≈ ${expectedSOV}%`);
  }
  if (aws) {
    const expectedSOV = Math.round((6 / total) * 1000) / 10;
    assertClose(aws.shareOfVoice, expectedSOV, 0.1, `AWS SOV ≈ ${expectedSOV}%`);
  }

  // SOVs must sum to ~100%
  const sovSum = result.competitors.reduce((s, c) => s + c.shareOfVoice, 0);
  assertClose(sovSum, 100, 1.5, `SOV sum ≈ 100% (got ${sovSum.toFixed(1)}%)`);
}

// --- 4f: Average position ---
console.log('  4f. Average position:');
{
  // Netlify positions: Run1 ChatGPT(1), ChatGPT(2), Claude(1), Perplexity(1), Gemini(2)
  //                    Run2 ChatGPT(1), Claude(2)
  // = [1,2,1,1,2,1,2] → sum=10, count=7, avg=10/7≈1.4
  const netlify = find('Netlify');
  if (netlify) {
    assertClose(netlify.averagePosition, 1.4, 0.1, `Netlify avg position ≈ 1.4`);
  }

  // AWS positions: Run1 ChatGPT(2), ChatGPT(1), Perplexity(3), Gemini(1)
  //               Run2 ChatGPT(2), Claude(1)
  // = [2,1,3,1,2,1] → sum=10, count=6, avg=10/6≈1.7
  const aws = find('AWS');
  if (aws) {
    assertClose(aws.averagePosition, 1.7, 0.1, `AWS avg position ≈ 1.7`);
  }

  // Railway: Run1 Gemini(4), Run2 ChatGPT(5) → [4,5] → avg 4.5
  const railway = find('Railway');
  if (railway) {
    assertClose(railway.averagePosition, 4.5, 0.1, `Railway avg position ≈ 4.5`);
  }

  // Render: Run1 ChatGPT(3), Claude(2), Run2 ChatGPT(3) → [3,2,3] → avg 2.7
  const render = find('Render');
  if (render) {
    assertClose(render.averagePosition, 2.7, 0.1, `Render avg position ≈ 2.7`);
  }
}

// --- 4g: Sentiment (majority vote) ---
console.log('  4g. Sentiment (majority vote):');
{
  // Netlify: positive×5, neutral×3 → positive wins
  const netlify = find('Netlify');
  assert(netlify && netlify.sentiment === 'positive', `Netlify sentiment = positive (got ${netlify?.sentiment})`);

  // AWS: positive×3, neutral×2, negative×1 → positive wins
  const aws = find('AWS');
  assert(aws && aws.sentiment === 'positive', `AWS sentiment = positive (got ${aws?.sentiment})`);
}

// --- 4h: Display name (most frequent casing wins) ---
console.log('  4h. Display name (most-frequent casing):');
{
  const netlify = find('Netlify');
  assert(netlify && netlify.name === 'Netlify', `Display name is "Netlify" not "${netlify?.name}"`);

  const aws = find('AWS');
  assert(aws && aws.name === 'AWS', `Display name is "AWS" not "${aws?.name}"`);
}

// --- 4i: Ranking order (sorted by SOV descending) ---
console.log('  4i. Ranking order (SOV descending):');
{
  for (let i = 1; i < result.competitors.length; i++) {
    const prev = result.competitors[i - 1];
    const curr = result.competitors[i];
    assert(
      prev.shareOfVoice >= curr.shareOfVoice,
      `Ranking: "${prev.name}" (${prev.shareOfVoice}%) ≥ "${curr.name}" (${curr.shareOfVoice}%)`
    );
  }
}


// =============================================================================
// PART 5: DEDUP MERGE (short → long name)
// =============================================================================
console.log('\n══════════════════════════════════════════════════');
console.log(' PART 5 — Dedup merge (short name → long name)');
console.log('══════════════════════════════════════════════════\n');

{
  const mergeAnalyses = [{
    id: 'merge-1',
    createdAt: new Date(),
    summary: '{}',
    analyses: JSON.stringify([{
      provider: 'ChatGPT',
      promptTests: [
        {
          competitorsMentioned: ['Akash', 'Akash Network', 'Akash', 'Render'],
          competitorPositions: { 'Akash': 1, 'Akash Network': 2, 'Render': 3 },
          competitorSentiments: { 'Akash': 'positive', 'Akash Network': 'neutral', 'Render': 'neutral' },
        },
      ],
    }]),
  }];

  const mergeResult = aggregateCompetitors(mergeAnalyses, 'testbrand');

  const akashEntries = mergeResult.competitors.filter(c => c.name.toLowerCase().includes('akash'));
  assert(akashEntries.length === 1, 'Akash + Akash Network merged to 1 entry');
  if (akashEntries.length === 1) {
    // Display name uses most-frequent casing: "Akash"×2 vs "Akash Network"×1 → "Akash" wins
    assert(akashEntries[0].name === 'Akash', `Merged display name is most-frequent "Akash" (got "${akashEntries[0].name}")`);
    assert(akashEntries[0].mentionCount === 3, `Merged count = 3 (got ${akashEntries[0].mentionCount})`);
    // Positions: Akash(1), Akash Network(2), Akash(1) → after merge [2,1,1] → avg=4/3≈1.3
    assertClose(akashEntries[0].averagePosition, 1.3, 0.1, 'Merged avg position correct');
  }
}


// =============================================================================
// PART 6: EDGE CASES
// =============================================================================
console.log('\n══════════════════════════════════════════════════');
console.log(' PART 6 — Edge cases');
console.log('══════════════════════════════════════════════════\n');

console.log('  6a. Empty / null / malformed inputs:');
{
  assert(filterValidCompetitors([], 'Brand').length === 0, 'Empty array → empty');
  assert(filterValidCompetitors(null, 'Brand').length === 0, 'null → empty');
  assert(filterValidCompetitors(undefined, 'Brand').length === 0, 'undefined → empty');
  assert(filterValidCompetitors([null, '', '  ', undefined, 123], 'Brand').length === 0, 'Junk entries → empty');
}

console.log('  6b. Whitespace handling:');
{
  // Light padding (1 space) is fine — the function trims internally for checks
  // but heavy padding (2+ spaces) can hit the max-3-spaces check on the raw string
  const r = filterValidCompetitors([' Netlify', 'AWS ', ' Render'], 'Brand');
  assert(r.length === 3, 'Single-space-padded names kept');
  // Double-space padding hits the spaceCount > 3 check on raw comp string
  const r2 = filterValidCompetitors(['  Netlify  '], 'Brand');
  assert(r2.length === 0, 'Heavy whitespace padding → rejected by space count (expected)');
}

console.log('  6c. Very long names rejected:');
{
  const longName = 'A'.repeat(50) + ' Inc';
  const r = filterValidCompetitors([longName], 'Brand');
  assert(r.length === 0, '50+ char name rejected');
}

console.log('  6d. Single character rejected:');
{
  const r = filterValidCompetitors(['A'], 'Brand');
  assert(r.length === 0, 'Single char name rejected');
}

console.log('  6e. Position=0 treated as no position:');
{
  const analyses = [{
    id: 'edge-1', createdAt: new Date(), summary: '{}',
    analyses: JSON.stringify([{
      provider: 'ChatGPT',
      promptTests: [{
        competitorsMentioned: ['Netlify'],
        competitorPositions: { 'Netlify': 0 },
        competitorSentiments: { 'Netlify': 'neutral' },
      }],
    }]),
  }];
  const r = aggregateCompetitors(analyses, 'testbrand');
  const netlify = r.competitors.find(c => c.name === 'Netlify');
  assert(netlify && netlify.averagePosition === 0, 'Position 0 → avgPos 0 (no valid positions)');
}

console.log('  6f. Cloudflare vs Cloudflare Pages NOT merged (Pages not in suffixes):');
{
  const analyses = [{
    id: 'edge-2', createdAt: new Date(), summary: '{}',
    analyses: JSON.stringify([{
      provider: 'ChatGPT',
      promptTests: [{
        competitorsMentioned: ['Cloudflare', 'Cloudflare Pages'],
        competitorPositions: {},
        competitorSentiments: {},
      }],
    }]),
  }];
  const r = aggregateCompetitors(analyses, 'testbrand');
  const cf = r.competitors.filter(c => c.name.toLowerCase().includes('cloudflare'));
  assert(cf.length === 2, `Cloudflare + Cloudflare Pages = 2 entries (got ${cf.length})`);
}

console.log('  6g. Zero-mention edge case:');
{
  const analyses = [{
    id: 'edge-3', createdAt: new Date(), summary: '{}',
    analyses: JSON.stringify([{
      provider: 'ChatGPT',
      promptTests: [{
        competitorsMentioned: [],
        competitorPositions: {},
        competitorSentiments: {},
      }],
    }]),
  }];
  const r = aggregateCompetitors(analyses, 'testbrand');
  assert(r.totalMentions === 0, 'No mentions → totalMentions = 0');
  assert(r.competitors.length === 0, 'No mentions → empty competitors');
}

console.log('  6h. All competitors are the brand → empty result:');
{
  const analyses = [{
    id: 'edge-4', createdAt: new Date(), summary: '{}',
    analyses: JSON.stringify([{
      provider: 'ChatGPT',
      promptTests: [{
        competitorsMentioned: ['Vercel', 'Vercel AI', 'Vercel SDK'],
        competitorPositions: { 'Vercel': 1 },
        competitorSentiments: { 'Vercel': 'positive' },
      }],
    }]),
  }];
  const r = aggregateCompetitors(analyses, 'vercel');
  assert(r.competitors.length === 0, 'Only brand entries → empty competitors');
}


// =============================================================================
// PART 7: REALISTIC LLM EXTRACTION SCENARIO
// Simulates what GPT-5.2 actually returns for a "Scale AI vs Cohere" comparison
// =============================================================================
console.log('\n══════════════════════════════════════════════════');
console.log(' PART 7 — Realistic LLM extraction scenario');
console.log('══════════════════════════════════════════════════\n');

{
  const rawExtraction = [
    // Real competitors
    'Cohere', 'Anthropic', 'OpenAI', 'Hugging Face', 'Mistral',
    'Google DeepMind', 'Meta AI', 'Stability AI', 'Together AI',
    'Weights & Biases', 'Labelbox', 'Snorkel AI',
    // Comparison headings (the bug)
    'Core Identity', 'Primary Strength', 'Best For',
    'Data Quality', 'Model Accuracy', 'Infrastructure Control',
    'Engagement Model', 'Deployment latency', 'Cost Pricing',
    // Feature labels
    'Build speed', 'Free tier generosity', 'Low-latency Performance',
    'Setup & Git integration', 'Security',
    // Slash patterns
    'MVP / Early-stage', 'Data-heavy / Analytics',
    // Comma patterns
    'Hands-on, cost-effective Linux VPS',
  ];

  const filtered = filterValidCompetitors(rawExtraction, 'Scale AI');

  const expectedKept = [
    'Cohere', 'Anthropic', 'OpenAI', 'Hugging Face', 'Mistral',
    'Google DeepMind', 'Meta AI', 'Stability AI', 'Together AI',
    'Weights & Biases', 'Labelbox', 'Snorkel AI',
  ];
  for (const name of expectedKept) {
    assert(filtered.includes(name), `Realistic: keeps "${name}"`);
  }

  const expectedRemoved = [
    'Core Identity', 'Primary Strength', 'Best For',
    'Data Quality', 'Model Accuracy', 'Infrastructure Control',
    'Engagement Model', 'Deployment latency', 'Cost Pricing',
    'Build speed', 'Free tier generosity', 'Low-latency Performance',
    'Setup & Git integration', 'Security',
    'MVP / Early-stage', 'Data-heavy / Analytics',
    'Hands-on, cost-effective Linux VPS',
  ];
  for (const name of expectedRemoved) {
    assert(!filtered.includes(name), `Realistic: rejects "${name}"`);
  }

  console.log(`  → Kept ${filtered.length} real companies, rejected ${rawExtraction.length - filtered.length} false positives`);
}


// =============================================================================
// PART 8: MULTI-RUN POSITION TREND ACCURACY
// Verifies that positions are tracked correctly across multiple analysis runs,
// which feeds the competitor ranking chart on the dashboard.
// =============================================================================
console.log('\n══════════════════════════════════════════════════');
console.log(' PART 8 — Multi-run position trend accuracy');
console.log('══════════════════════════════════════════════════\n');

{
  // 3 runs showing Netlify climbing from position 4 → 2 → 1
  const trendAnalyses = [
    {
      id: 'trend-1', createdAt: new Date('2026-02-08'), summary: '{}',
      analyses: JSON.stringify([{
        provider: 'ChatGPT',
        promptTests: [
          { competitorsMentioned: ['Netlify', 'AWS'], competitorPositions: { 'Netlify': 4, 'AWS': 1 }, competitorSentiments: {} },
          { competitorsMentioned: ['Netlify', 'AWS'], competitorPositions: { 'Netlify': 3, 'AWS': 1 }, competitorSentiments: {} },
        ],
      }]),
    },
    {
      id: 'trend-2', createdAt: new Date('2026-02-10'), summary: '{}',
      analyses: JSON.stringify([{
        provider: 'ChatGPT',
        promptTests: [
          { competitorsMentioned: ['Netlify', 'AWS'], competitorPositions: { 'Netlify': 2, 'AWS': 1 }, competitorSentiments: {} },
          { competitorsMentioned: ['Netlify', 'AWS'], competitorPositions: { 'Netlify': 2, 'AWS': 2 }, competitorSentiments: {} },
        ],
      }]),
    },
    {
      id: 'trend-3', createdAt: new Date('2026-02-12'), summary: '{}',
      analyses: JSON.stringify([{
        provider: 'ChatGPT',
        promptTests: [
          { competitorsMentioned: ['Netlify', 'AWS'], competitorPositions: { 'Netlify': 1, 'AWS': 2 }, competitorSentiments: {} },
          { competitorsMentioned: ['Netlify', 'AWS'], competitorPositions: { 'Netlify': 1, 'AWS': 3 }, competitorSentiments: {} },
        ],
      }]),
    },
  ];

  const trendResult = aggregateCompetitors(trendAnalyses, 'testbrand');
  const netlify = trendResult.competitors.find(c => c.name === 'Netlify');
  const aws = trendResult.competitors.find(c => c.name === 'AWS');

  // Netlify: [4,3,2,2,1,1] → avg = 13/6 ≈ 2.2
  if (netlify) {
    assertClose(netlify.averagePosition, 2.2, 0.1, 'Netlify trend avg position ≈ 2.2');
  }

  // AWS: [1,1,1,2,2,3] → avg = 10/6 ≈ 1.7
  if (aws) {
    assertClose(aws.averagePosition, 1.7, 0.1, 'AWS trend avg position ≈ 1.7');
  }

  // Equal SOV since both appear in every test
  assert(netlify && aws && netlify.shareOfVoice === aws.shareOfVoice,
    `Equal appearances → equal SOV (Netlify=${netlify?.shareOfVoice}%, AWS=${aws?.shareOfVoice}%)`);
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
  for (const f of failures) {
    console.log(`    ✗ ${f}`);
  }
}
console.log('');
process.exit(failed > 0 ? 1 : 0);
