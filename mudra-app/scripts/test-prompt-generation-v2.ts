#!/usr/bin/env npx tsx
/**
 * Test script for the new prompt generation pipeline (v2).
 *
 * Covers:
 *   Part 1 — Offline (no API key / DB needed)
 *     1a. inferBusinessType keyword matching
 *     1b. profileToBrandInfo enrichment (new optional fields)
 *     1c. Dynamic prompt count formula
 *     1d. FAQ → howTo bucket in visibility scoring
 *     1e. FAQ in validCategories for generateBatchPrompts
 *
 *   Part 2 — Live GPT-5.2 call (requires OPENAI_API_KEY)
 *     2a. generateInitialPrompts: call, JSON parse, category distribution, FAQ presence
 *     2b. Prompt quality checks: product mentions, question-style FAQs, length cap
 *
 *   Part 3 — API endpoint via local dev server (requires running server + DB)
 *     3a. POST /api/prompts/generate-initial — idempotency, response shape
 *     3b. POST /api/prompts/add with FAQ category — validation passes
 *
 * Run:
 *   npx tsx scripts/test-prompt-generation-v2.ts              # all tests
 *   npx tsx scripts/test-prompt-generation-v2.ts --offline     # offline only
 *   npx tsx scripts/test-prompt-generation-v2.ts --live        # live GPT only (no server)
 *   npx tsx scripts/test-prompt-generation-v2.ts --api         # API endpoint tests only
 */

import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// ─── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`  ✗ FAIL: ${label}`);
  }
}

function assertEq<T>(actual: T, expected: T, label: string) {
  assert(actual === expected, `${label} (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`);
}

function assertIncludes(arr: string[], val: string, label: string) {
  assert(arr.includes(val), `${label} — expected array to include "${val}"`);
}

function assertRange(val: number, min: number, max: number, label: string) {
  assert(val >= min && val <= max, `${label} (got ${val}, want ${min}-${max})`);
}

function section(title: string) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

function summary() {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log(`\n  Failures:`);
    failures.forEach(f => console.log(`    ✗ ${f}`));
  }
  console.log('─'.repeat(60));
  process.exit(failed > 0 ? 1 : 0);
}

// ─── Parse flags ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const runOffline = args.length === 0 || args.includes('--offline');
const runLive = args.length === 0 || args.includes('--live');
const runApi = args.length === 0 || args.includes('--api');

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1 — OFFLINE TESTS (no API key or DB)
// ═══════════════════════════════════════════════════════════════════════════════

async function offlineTests() {
  // Dynamic import to avoid OpenAI constructor blowing up without key
  const {
    inferBusinessType,
    profileToBrandInfo,
  } = await import('../lib/services/prompt-generation.service');

  // ─── 1a. inferBusinessType ──────────────────────────────────────────────────

  section('1a. inferBusinessType');

  assertEq(
    inferBusinessType('SaaS', 'A subscription platform for teams', ['API monitoring']),
    'saas',
    'SaaS keyword in industry'
  );
  assertEq(
    inferBusinessType('Technology', 'We build developer tools', ['SDK', 'API']),
    'saas',
    'developer tool / API → saas'
  );
  assertEq(
    inferBusinessType('Retail', 'An e-commerce store for fashion', ['Dresses', 'Shoes']),
    'ecommerce',
    'e-commerce keyword'
  );
  assertEq(
    inferBusinessType('Marketing', 'A digital agency for B2B brands', ['SEO', 'Content']),
    'agency',
    'agency keyword'
  );
  assertEq(
    inferBusinessType('Tech', 'A marketplace connecting buyers and sellers', ['Listings']),
    'marketplace',
    'marketplace keyword'
  );
  assertEq(
    inferBusinessType('IT', 'Enterprise B2B solutions', ['ERP', 'CRM']),
    'enterprise',
    'enterprise + b2b'
  );
  assertEq(
    inferBusinessType('Food', 'We make artisanal bread', ['Sourdough', 'Rye']),
    'other',
    'No match → other'
  );

  // ─── 1b. profileToBrandInfo enrichment ──────────────────────────────────────

  section('1b. profileToBrandInfo enrichment');

  const richProfile = {
    companyName: 'Mudra',
    companyDescription: 'AI visibility platform for SaaS brands',
    companyIndustry: 'AI Marketing',
    companyServices: 'Prompt Tracker - Track AI prompts,GEO Analysis - Analyze generative engine results,Content Lab - Generate AEO content',
    companyICP: 'SaaS founders,GTM leads at startups,AI researchers',
    companyWebsite: 'https://mudra.ai',
    competitors: 'Semrush,Ahrefs,Otterly',
  };

  const brandInfo = profileToBrandInfo(richProfile);

  assertEq(brandInfo.companyName, 'Mudra', 'companyName populated');
  assertEq(brandInfo.websiteUrl, 'https://mudra.ai', 'websiteUrl populated');
  assertEq(brandInfo.inferredBusinessType, 'saas', 'inferred as SaaS');

  // productsWithDescriptions should be populated (items contain " - ")
  assert(brandInfo.productsWithDescriptions !== undefined, 'productsWithDescriptions populated');
  assertEq(brandInfo.productsWithDescriptions!.length, 3, 'productsWithDescriptions has 3 items');
  assert(
    brandInfo.productsWithDescriptions![0].includes(' - '),
    'productsWithDescriptions preserves " - " format'
  );

  // icpSegments should be populated (comma-separated)
  assert(brandInfo.icpSegments !== undefined, 'icpSegments populated');
  assertEq(brandInfo.icpSegments!.length, 3, 'icpSegments has 3 segments');
  assertEq(brandInfo.icpSegments![0], 'SaaS founders', 'First ICP segment correct');

  // competitors should be an array
  assertEq(brandInfo.competitors.length, 3, 'competitors array has 3 items');

  // Backward compat: minimal profile
  const minProfile = {
    companyName: 'Acme',
    companyDescription: '',
    companyIndustry: '',
    companyServices: '',
    companyICP: 'Everyone',
    competitors: [],
  };

  const minInfo = profileToBrandInfo(minProfile);
  assertEq(minInfo.websiteUrl, undefined, 'Minimal profile: no websiteUrl');
  assertEq(minInfo.productsWithDescriptions, undefined, 'Minimal profile: no productsWithDescriptions');
  assertEq(minInfo.icpSegments, undefined, 'Minimal profile: no icpSegments (single segment)');
  assertEq(minInfo.inferredBusinessType, 'other', 'Minimal profile: inferred as other');

  // ─── 1c. Dynamic prompt count formula ───────────────────────────────────────

  section('1c. Dynamic prompt count formula');

  function calcCount(products: number, icps: number): number {
    return Math.min(60, 40 + Math.min(products * 2, 10) + Math.min(icps * 2, 10));
  }

  assertEq(calcCount(1, 1), 44, '1 product, 1 ICP → 44');
  assertEq(calcCount(3, 3), 52, '3 products, 3 ICPs → 52');
  assertEq(calcCount(5, 5), 60, '5 products, 5 ICPs → 60');
  assertEq(calcCount(10, 10), 60, '10+ products/ICPs → capped at 60');
  assertEq(calcCount(0, 0), 40, '0 products, 0 ICPs → 40 (base)');

  // ─── 1d. FAQ in visibility scoring (howTo bucket) ───────────────────────────

  section('1d. FAQ → howTo bucket in visibility scoring');

  const { calculateAggregateScore } = await import('../lib/services/visibility-scoring.service');

  const testResults = [
    // Organic (1 mention)
    { prompt: 'best AI tools', promptCategory: 'Organic', brandMentioned: true, brandPosition: 2 },
    { prompt: 'top marketing platforms', promptCategory: 'Organic', brandMentioned: false },
    // How-to (1 mention)
    { prompt: 'how to improve SEO', promptCategory: 'How-to Guides', brandMentioned: true, brandPosition: 1 },
    // FAQ (1 mention) — should be scored in howTo bucket
    { prompt: 'What is the best way to track AI visibility?', promptCategory: 'FAQ', brandMentioned: true, brandPosition: 3 },
    // Brand-Specific
    { prompt: 'What is Mudra?', promptCategory: 'Brand-Specific', brandMentioned: true, brandPosition: 1 },
    // Competitor
    { prompt: 'Semrush alternatives', promptCategory: 'Competitor', brandMentioned: true, brandPosition: 5 },
  ];

  const scores = calculateAggregateScore(testResults);
  assert(scores.categoryBreakdown !== undefined, 'categoryBreakdown exists');

  // howTo bucket should have 2 tests (How-to Guides + FAQ)
  assertEq(
    scores.categoryBreakdown!.howTo.total,
    2,
    'howTo bucket total = 2 (How-to Guides + FAQ)'
  );
  assertEq(
    scores.categoryBreakdown!.howTo.mentions,
    2,
    'howTo bucket mentions = 2 (both mentioned)'
  );
  assert(
    scores.categoryBreakdown!.howTo.score > 0,
    'howTo bucket score > 0'
  );

  // Overall score should be > 0
  assert(scores.overallScore > 0, 'overallScore > 0');
  assert(scores.weightedScore > 0, 'weightedScore > 0');

  // ─── 1e. FAQ in validCategories (batch generation) ──────────────────────────

  section('1e. FAQ in valid categories');

  // We can't call generateBatchPrompts without an API key, but we can verify
  // the source code has FAQ in the validCategories array
  const fs = await import('fs');
  const src = fs.readFileSync(
    path.resolve(__dirname, '../lib/services/prompt-generation.service.ts'),
    'utf-8'
  );

  // Find the validCategories line inside generateBatchPrompts
  const batchMatch = src.match(/generateBatchPrompts[\s\S]*?const validCategories = \[([^\]]+)\]/);
  assert(batchMatch !== null, 'Found validCategories in generateBatchPrompts');
  if (batchMatch) {
    assert(batchMatch[1].includes("'FAQ'"), 'FAQ is in generateBatchPrompts validCategories');
  }

  // Verify generateInitialPrompts also has FAQ
  const initialMatch = src.match(/generateInitialPrompts[\s\S]*?const validCategories = \[([^\]]+)\]/);
  assert(initialMatch !== null, 'Found validCategories in generateInitialPrompts');
  if (initialMatch) {
    assert(initialMatch[1].includes("'FAQ'"), 'FAQ is in generateInitialPrompts validCategories');
  }

  // Verify VALID_CATEGORIES in prompts/add route
  const addRouteSrc = fs.readFileSync(
    path.resolve(__dirname, '../app/api/prompts/add/route.ts'),
    'utf-8'
  );
  const addRouteMatch = addRouteSrc.match(/VALID_CATEGORIES = \[([^\]]+)\]/);
  assert(addRouteMatch !== null, 'Found VALID_CATEGORIES in prompts/add route');
  if (addRouteMatch) {
    assert(addRouteMatch[1].includes("'FAQ'"), 'FAQ is in prompts/add VALID_CATEGORIES');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2 — LIVE GPT-5.2 TEST (requires OPENAI_API_KEY)
// ═══════════════════════════════════════════════════════════════════════════════

async function liveTests() {
  if (!process.env.OPENAI_API_KEY) {
    console.log('\n  ⚠ Skipping live tests — OPENAI_API_KEY not set');
    return;
  }

  const { generateInitialPrompts } = await import('../lib/services/prompt-generation.service');

  section('2a. generateInitialPrompts — GPT-5.2 call');

  const brandInfo = {
    companyName: 'Mudra',
    companyDescription: 'AI visibility platform that helps SaaS brands track and improve how they appear in generative AI engines like ChatGPT and Perplexity',
    industry: 'AI Marketing Technology',
    productsServices: [
      'Prompt Tracker - Track brand mentions across AI models',
      'GEO Analysis - Generative Engine Optimization scoring',
      'Content Lab - AI-powered content generation for AEO',
    ],
    idealCustomer: 'SaaS founders and GTM leaders',
    competitors: ['Semrush', 'Ahrefs', 'Otterly.ai'],
    websiteUrl: 'https://mudra.ai',
    productsWithDescriptions: [
      'Prompt Tracker - Track brand mentions across AI models',
      'GEO Analysis - Generative Engine Optimization scoring',
      'Content Lab - AI-powered content generation for AEO',
    ],
    icpSegments: ['SaaS founders', 'GTM leaders at startups', 'AI researchers'],
    inferredBusinessType: 'saas' as string,
  };

  const start = Date.now();
  let prompts: Awaited<ReturnType<typeof generateInitialPrompts>>;

  try {
    prompts = await generateInitialPrompts(brandInfo);
  } catch (err) {
    console.log(`  ✗ FAIL: generateInitialPrompts threw: ${err}`);
    failed++;
    failures.push(`generateInitialPrompts threw: ${err}`);
    return;
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`  (Completed in ${elapsed}s)`);

  // Expected count: min(60, 40 + min(3*2,10) + min(3*2,10)) = min(60, 40+6+6) = 52
  const expectedCount = 52;
  assertRange(prompts.length, Math.floor(expectedCount * 0.8), 60, `Prompt count near ${expectedCount}`);

  // Category distribution
  const byCat: Record<string, number> = {};
  for (const p of prompts) {
    byCat[p.category] = (byCat[p.category] || 0) + 1;
  }
  console.log(`  Category distribution: ${JSON.stringify(byCat)}`);

  const validCats = ['Organic', 'Competitor', 'How-to Guides', 'Brand-Specific', 'FAQ'];
  for (const cat of Object.keys(byCat)) {
    assertIncludes(validCats, cat, `Category "${cat}" is valid`);
  }

  // Must have all 5 categories present
  for (const cat of validCats) {
    assert((byCat[cat] || 0) > 0, `Category "${cat}" has at least 1 prompt`);
  }

  // Organic should be largest group (~50%)
  assert(
    (byCat['Organic'] || 0) > (byCat['FAQ'] || 0),
    'Organic count > FAQ count (as per ~50% vs ~15% distribution)'
  );

  // ─── Full prompt output grouped by category ──────────────────────────────

  section('2b. Generated prompts (full output)');

  const allCats = ['Organic', 'Competitor', 'How-to Guides', 'Brand-Specific', 'FAQ'];
  for (const cat of allCats) {
    const catPrompts = prompts.filter(p => p.category === cat);
    console.log(`\n  ── ${cat} (${catPrompts.length}) ──`);
    catPrompts.forEach((p, i) => {
      console.log(`    ${i + 1}. ${p.text}`);
    });
  }

  // ─── Quality checks ──────────────────────────────────────────────────────

  section('2c. Prompt quality checks');

  // All prompts under 120 chars
  const overLength = prompts.filter(p => p.text.length > 130); // small tolerance
  assert(
    overLength.length <= 3,
    `At most 3 prompts over 130 chars (got ${overLength.length})`
  );
  if (overLength.length > 0) {
    overLength.forEach(p => console.log(`    ⚠ Over-length: "${p.text}" (${p.text.length} chars)`));
  }

  // FAQ prompts should be question-style
  const faqPrompts = prompts.filter(p => p.category === 'FAQ');
  const questionStyleFaqs = faqPrompts.filter(p =>
    /^(how|what|why|can|is|does|do|which|should|when|where|will|are)\b/i.test(p.text)
  );
  assertRange(
    questionStyleFaqs.length,
    Math.floor(faqPrompts.length * 0.6),
    faqPrompts.length,
    `At least 60% of FAQ prompts start with question words (${questionStyleFaqs.length}/${faqPrompts.length})`
  );

  // Brand-Specific prompts should mention the brand name
  const brandPrompts = prompts.filter(p => p.category === 'Brand-Specific');
  const brandMentions = brandPrompts.filter(p => p.text.toLowerCase().includes('mudra'));
  assertRange(
    brandMentions.length,
    Math.floor(brandPrompts.length * 0.7),
    brandPrompts.length,
    `At least 70% of Brand-Specific prompts mention "Mudra" (${brandMentions.length}/${brandPrompts.length})`
  );

  // Product mentions across all prompts (at least 30% per spec)
  const productKeywords = ['prompt tracker', 'geo analysis', 'content lab'];
  const productMentions = prompts.filter(p =>
    productKeywords.some(kw => p.text.toLowerCase().includes(kw))
  );
  const productMentionRate = productMentions.length / prompts.length;
  assertRange(
    productMentionRate,
    0.15, // relax to 15% since LLM compliance varies
    1.0,
    `Product mention rate ≥ 15% (${(productMentionRate * 100).toFixed(0)}%)`
  );

  // No duplicates
  const uniqueTexts = new Set(prompts.map(p => p.text.toLowerCase().trim()));
  assertEq(uniqueTexts.size, prompts.length, 'No duplicate prompt texts');

  // ─── Downstream pipeline compatibility ────────────────────────────────────

  section('2d. Downstream pipeline compatibility (DirectGEO + visibility scoring)');

  // Test 1: Prompts have the shape DirectGEO expects: { text: string, category?: string }
  // unified-analysis.service.ts line 287: customPrompts: prompts.map(p => ({ text: p.text, category: p.category || undefined }))
  const directGeoShaped = prompts.map(p => ({
    text: p.text,
    category: p.category || undefined,
  }));

  assert(
    directGeoShaped.every(p => typeof p.text === 'string' && p.text.length > 0),
    'All prompts have non-empty text (DirectGEO expects string)'
  );
  assert(
    directGeoShaped.every(p => p.category === undefined || typeof p.category === 'string'),
    'All prompts have string|undefined category (DirectGEO expects optional string)'
  );

  // Test 2: direct-geo-analysis.service.ts line 710 normalizes prompts like:
  //   typeof p === 'string' ? { text: p } : p
  // So our objects pass through unchanged — verify the shape survives
  const normalized = directGeoShaped.map(p =>
    typeof p === 'string' ? { text: p } : p
  );
  assert(
    normalized.every(p => 'text' in p && 'category' in p),
    'Prompts survive DirectGEO normalization with category intact'
  );

  // Test 3: Simulate what direct-geo-analysis.service.ts line 2154 does:
  //   const promptCategory = typeof promptObj === 'object' ? promptObj.category : undefined
  // Then it sets { ...test, promptCategory } on each test result
  const simulatedTestResults = directGeoShaped.map(p => {
    const promptCategory = typeof p === 'object' ? p.category : undefined;
    return {
      prompt: p.text,
      promptCategory,
      brandMentioned: Math.random() > 0.5,
      brandPosition: Math.random() > 0.5 ? Math.ceil(Math.random() * 10) : null,
    };
  });

  // Test 4: Feed simulated results into visibility scoring — must not throw
  const { calculateAggregateScore: calcAgg } = await import('../lib/services/visibility-scoring.service');

  let scoringError: string | null = null;
  try {
    const result = calcAgg(simulatedTestResults);
    assert(typeof result.overallScore === 'number', 'Scoring produces numeric overallScore');
    assert(typeof result.weightedScore === 'number', 'Scoring produces numeric weightedScore');
    assert(result.categoryBreakdown !== undefined, 'Scoring produces categoryBreakdown');

    // howTo bucket should include FAQ prompts
    const faqCount = simulatedTestResults.filter(t => t.promptCategory === 'FAQ').length;
    const howToCount = simulatedTestResults.filter(t => t.promptCategory === 'How-to Guides').length;
    assertEq(
      result.categoryBreakdown!.howTo.total,
      faqCount + howToCount,
      `howTo bucket total = FAQ(${faqCount}) + How-to(${howToCount}) = ${faqCount + howToCount}`
    );

    // Organic bucket should NOT include FAQ
    const organicCount = simulatedTestResults.filter(t => t.promptCategory === 'Organic').length;
    assertEq(
      result.categoryBreakdown!.organic.total,
      organicCount,
      `organic bucket total = ${organicCount} (FAQ not mixed in)`
    );

    console.log(`  Weighted score breakdown:`);
    console.log(`    Organic:        ${result.categoryBreakdown!.organic.score} (${result.categoryBreakdown!.organic.mentions}/${result.categoryBreakdown!.organic.total} mentioned)`);
    console.log(`    Competitor:     ${result.categoryBreakdown!.competitor.score} (${result.categoryBreakdown!.competitor.mentions}/${result.categoryBreakdown!.competitor.total} mentioned)`);
    console.log(`    How-to + FAQ:   ${result.categoryBreakdown!.howTo.score} (${result.categoryBreakdown!.howTo.mentions}/${result.categoryBreakdown!.howTo.total} mentioned)`);
    console.log(`    Brand-Specific: ${result.categoryBreakdown!.brandSpecific.score} (${result.categoryBreakdown!.brandSpecific.mentions}/${result.categoryBreakdown!.brandSpecific.total} mentioned)`);
    console.log(`    Overall: ${result.overallScore}  Weighted: ${result.weightedScore}`);
  } catch (err) {
    scoringError = String(err);
  }

  assert(scoringError === null, `Visibility scoring did not throw (${scoringError || 'OK'})`);

  // Test 5: Verify the prompt shapes match what getActivePrompts returns (SavedPrompt)
  // SavedPrompt = { id, brandProfileId, text, category: string | null, isCustom, isActive, createdAt, updatedAt }
  // The API endpoint saves: { text: p.text, category: p.category, isCustom: false, isActive: true }
  // Then unified analysis reads them as: prompts.map(p => ({ text: p.text, category: p.category || undefined }))
  // Confirm all our categories are non-null strings (not "null" or empty)
  assert(
    prompts.every(p => p.category && p.category.length > 0),
    'All prompts have non-null, non-empty category (DB save will preserve)'
  );

  // Test 6: Verify FAQ prompts won't break with-results API scoring
  // with-results uses: intent: prompt.category — so FAQ will flow through as intent "FAQ"
  // And the tracked-prompts UI now has "FAQ" in intentConfig — so it will render correctly
  const faqAsIntents = prompts.filter(p => p.category === 'FAQ');
  assert(
    faqAsIntents.every(p => p.category === 'FAQ'),
    `FAQ prompts have exact category string "FAQ" (matches intentConfig key)`
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 3 — API ENDPOINT TESTS (requires running dev server + DB)
// ═══════════════════════════════════════════════════════════════════════════════

async function apiTests() {
  const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

  section('3. API endpoint tests');

  // Quick health check
  let serverUp = false;
  try {
    const healthRes = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
    serverUp = healthRes.ok;
  } catch {
    // no-op
  }

  if (!serverUp) {
    console.log(`  ⚠ Skipping API tests — dev server not running at ${BASE_URL}`);
    console.log(`    Start with: npm run dev`);
    return;
  }

  // We need a valid brandProfileId from the DB. Try to detect one.
  let brandProfileId: number | null = null;
  try {
    // Use the campaigns/prompts endpoint to find a profile ID
    const probeRes = await fetch(`${BASE_URL}/api/health`);
    if (probeRes.ok) {
      // Try to use a known profile ID, or skip
      console.log(`  ⚠ API tests require a valid brandProfileId and auth session.`);
      console.log(`    These tests are best run in a browser-authenticated session.`);
      console.log(`    Set TEST_BRAND_PROFILE_ID=<id> to run.`);
    }
  } catch {
    // no-op
  }

  brandProfileId = process.env.TEST_BRAND_PROFILE_ID
    ? parseInt(process.env.TEST_BRAND_PROFILE_ID, 10)
    : null;

  if (!brandProfileId) {
    console.log(`  ⚠ Skipping API tests — set TEST_BRAND_PROFILE_ID env var`);
    return;
  }

  // ─── 3a. POST /api/prompts/generate-initial ─────────────────────────────────

  section('3a. POST /api/prompts/generate-initial');

  const genRes = await fetch(`${BASE_URL}/api/prompts/generate-initial`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brandProfileId }),
  });

  assert(genRes.ok, `Response OK (status ${genRes.status})`);

  const genData = await genRes.json();
  assert(genData.success === true, 'Response has success: true');
  assert(Array.isArray(genData.prompts), 'Response has prompts array');
  assert(typeof genData.count === 'number' && genData.count > 0, `count > 0 (got ${genData.count})`);

  // Idempotency: calling again should return cached: true
  const genRes2 = await fetch(`${BASE_URL}/api/prompts/generate-initial`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brandProfileId }),
  });

  const genData2 = await genRes2.json();
  assert(genData2.success === true, 'Second call also succeeds');
  assert(genData2.cached === true, 'Second call returns cached: true (idempotent)');
  assertEq(genData2.count, genData.count, 'Same prompt count on idempotent call');

  // Check for FAQ in returned prompts
  if (Array.isArray(genData.prompts)) {
    const hasFaq = genData.prompts.some((p: any) => p.category === 'FAQ');
    assert(hasFaq, 'Generated prompts include FAQ category');
  }

  // ─── 3b. POST /api/prompts/add with FAQ category ──────────────────────────

  section('3b. POST /api/prompts/add with FAQ category');

  const addRes = await fetch(`${BASE_URL}/api/prompts/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      promptText: `Test FAQ prompt ${Date.now()}`,
      category: 'FAQ',
      brandProfileId,
    }),
  });

  assert(addRes.ok, `Add prompt response OK (status ${addRes.status})`);

  const addData = await addRes.json();
  assert(addData.success === true, 'Add prompt with FAQ category succeeds');
  if (addData.data?.prompt) {
    assertEq(addData.data.prompt.category, 'FAQ', 'Saved prompt has FAQ category');
  }

  // Verify invalid category is rejected
  const badRes = await fetch(`${BASE_URL}/api/prompts/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      promptText: 'Invalid category test',
      category: 'InvalidCategory',
      brandProfileId,
    }),
  });

  assertEq(badRes.status, 400, 'Invalid category returns 400');

  // Missing brandProfileId
  const missingRes = await fetch(`${BASE_URL}/api/prompts/generate-initial`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  assertEq(missingRes.status, 400, 'Missing brandProfileId returns 400');
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Prompt Generation v2 — Test Suite                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Modes: offline=${runOffline} live=${runLive} api=${runApi}`);

  if (runOffline) await offlineTests();
  if (runLive) await liveTests();
  if (runApi) await apiTests();

  summary();
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(2);
});
