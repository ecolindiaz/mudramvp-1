/**
 * Test script for position extraction critical fixes
 *
 * Tests:
 * 1. Brand position validation (>= 1)
 * 2. Competitor name matching (strict, not fuzzy)
 * 3. Table header detection (comprehensive)
 * 4. Bullet list section header detection (robust)
 * 5. Average position calculation consistency
 *
 * Run with: npx tsx mudra-app/scripts/test-position-validation.ts
 */

// ============================================================================
// HELPER FUNCTIONS (copied from direct-geo-analysis.service.ts for testing)
// ============================================================================

function validateBrandPosition(position: number | null | undefined): number | undefined {
  if (position === null || position === undefined) {
    return undefined;
  }
  if (position >= 1) {
    return position;
  }
  console.warn(`[Position Validation] Invalid position ${position} detected, treating as no ranking`);
  return undefined;
}

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

function matchCompetitorNames(name1: string, name2: string): boolean {
  const norm1 = normalizeCompanyName(name1);
  const norm2 = normalizeCompanyName(name2);

  if (norm1 === norm2) {
    return true;
  }

  if (norm1.length <= 3 && norm2.length > 3) {
    const initials = norm2.split(' ').map(w => w[0]).join('');
    if (initials === norm1) return true;
  }
  if (norm2.length <= 3 && norm1.length > 3) {
    const initials = norm1.split(' ').map(w => w[0]).join('');
    if (initials === norm2) return true;
  }

  // Suffix-aware matching: "Akash" matches "Akash Network", "Scale" matches "Scale AI"
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

function isTableHeader(company: string): boolean {
  const companyLower = company.toLowerCase();
  const tableHeaderKeywords = [
    'name', 'company', 'organization', 'entity', 'platform', 'tool', 'service',
    'product', 'solution', 'provider', 'vendor', 'brand', 'rank', 'ranking',
    'accelerator', 'incubator', 'fund', 'investor', 'vc',
    'funding', 'investment', 'amount', 'valuation', 'equity', 'stake',
    'focus', 'industry', 'sector', 'vertical', 'category', 'type',
    'location', 'region', 'country', 'headquarters', 'hq',
    'founded', 'year', 'date', 'stage', 'status',
    'description', 'notes', 'details', 'summary', 'overview',
    'website', 'url', 'link', 'contact', 'email',
    'score', 'rating', 'stars', 'reviews', 'users', 'customers',
    'revenue', 'arr', 'mrr', 'growth', 'size', 'employees',
  ];

  if (company === '' ||
      tableHeaderKeywords.some(kw => companyLower === kw || companyLower.includes(kw + ' ') || companyLower.startsWith(kw))) {
    return true;
  }
  return false;
}

function isSectionHeader(line: string): boolean {
  const trimmedLine = line.trim();
  const isMarkdownHeader = /^#{1,3}\s+/.test(trimmedLine);
  const isBoldHeader = /^\*\*[^*]+\*\*:?\s*$/.test(trimmedLine);
  const isStandaloneHeader = /^[A-Z][A-Za-z\s]{2,30}:$/.test(trimmedLine) && !trimmedLine.includes(' - ');
  return isMarkdownHeader || isBoldHeader || isStandaloneHeader;
}

// ============================================================================
// TEST CASES
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function runTest(name: string, testFn: () => boolean, details: string = '') {
  try {
    const passed = testFn();
    results.push({ name, passed, details: passed ? 'OK' : details });
  } catch (e: any) {
    results.push({ name, passed: false, details: `Error: ${e.message}` });
  }
}

console.log("=".repeat(70));
console.log("POSITION EXTRACTION CRITICAL FIXES TEST SUITE");
console.log("=".repeat(70));
console.log("");

// ============================================================================
// TEST 1: Brand Position Validation
// ============================================================================
console.log("\n--- TEST 1: Brand Position Validation ---");

runTest("Position 0 → undefined", () => validateBrandPosition(0) === undefined);
runTest("Position -1 → undefined", () => validateBrandPosition(-1) === undefined);
runTest("Position 1 → 1", () => validateBrandPosition(1) === 1);
runTest("Position 5 → 5", () => validateBrandPosition(5) === 5);
runTest("Position null → undefined", () => validateBrandPosition(null) === undefined);
runTest("Position undefined → undefined", () => validateBrandPosition(undefined) === undefined);

// ============================================================================
// TEST 2: Competitor Name Matching (Strict)
// ============================================================================
console.log("\n--- TEST 2: Competitor Name Matching (Strict) ---");

// Should match
runTest("Exact match: 'Y Combinator' === 'Y Combinator'",
  () => matchCompetitorNames('Y Combinator', 'Y Combinator'));
runTest("Case insensitive: 'techstars' === 'Techstars'",
  () => matchCompetitorNames('techstars', 'Techstars'));
runTest("With suffix: 'Stripe Inc' === 'Stripe'",
  () => matchCompetitorNames('Stripe Inc', 'Stripe'));
runTest("Acronym match: 'YC' === 'Y Combinator' (initials)",
  () => matchCompetitorNames('YC', 'Y Combinator'));

// Should NOT match (these were false positives before)
runTest("NO match: 'Y Combinator' !== 'Y Combinator Studio'",
  () => !matchCompetitorNames('Y Combinator', 'Y Combinator Studio'),
  "Should NOT match different companies");
runTest("NO match: 'Stripe' !== 'Stripe Atlas'",
  () => !matchCompetitorNames('Stripe', 'Stripe Atlas'),
  "Should NOT match different products");
runTest("NO match: 'Tech' !== 'Techstars'",
  () => !matchCompetitorNames('Tech', 'Techstars'),
  "Should NOT match partial names");

// ============================================================================
// TEST 3: Table Header Detection
// ============================================================================
console.log("\n--- TEST 3: Table Header Detection ---");

// Should be detected as headers
runTest("Header: 'Company'", () => isTableHeader('Company'));
runTest("Header: 'Name'", () => isTableHeader('Name'));
runTest("Header: 'Funding'", () => isTableHeader('Funding'));
runTest("Header: 'Platform'", () => isTableHeader('Platform'));
runTest("Header: 'Revenue'", () => isTableHeader('Revenue'));
runTest("Header: 'Description'", () => isTableHeader('Description'));
runTest("Header: empty string", () => isTableHeader(''));

// Should NOT be detected as headers (real company names)
runTest("NOT header: 'Y Combinator'", () => !isTableHeader('Y Combinator'));
runTest("NOT header: 'Techstars'", () => !isTableHeader('Techstars'));
runTest("NOT header: '500 Global'", () => !isTableHeader('500 Global'));
runTest("NOT header: 'Sequoia'", () => !isTableHeader('Sequoia'));

// ============================================================================
// TEST 4: Section Header Detection for Bullet Lists
// ============================================================================
console.log("\n--- TEST 4: Section Header Detection ---");

// Should be detected as section headers (reset bullet count)
runTest("Header: '## Top Accelerators'", () => isSectionHeader('## Top Accelerators'));
runTest("Header: '### Best Options'", () => isSectionHeader('### Best Options'));
runTest("Header: '**Recommendations**'", () => isSectionHeader('**Recommendations**'));
runTest("Header: 'Top Choices:'", () => isSectionHeader('Top Choices:'));

// Should NOT be detected as headers (don't reset bullet count)
runTest("NOT header: 'Company: Description here'",
  () => !isSectionHeader('Company: Description here'),
  "Description lines should not reset");
runTest("NOT header: 'Y Combinator: The leading accelerator - founded 2005'",
  () => !isSectionHeader('Y Combinator: The leading accelerator - founded 2005'),
  "Company descriptions should not reset");
runTest("NOT header: '- Y Combinator'",
  () => !isSectionHeader('- Y Combinator'),
  "Bullet items should not reset");
runTest("NOT header: 'This is a sentence.'",
  () => !isSectionHeader('This is a sentence.'),
  "Regular sentences should not reset");

// ============================================================================
// TEST 5: Average Position Calculation Consistency
// ============================================================================
console.log("\n--- TEST 5: Average Position Calculation ---");

interface MockTest {
  brandMentioned: boolean;
  brandPosition?: number | null;
}

function calculateAveragePosition(tests: MockTest[]): number {
  const mentionedTests = tests.filter(t => t.brandMentioned);
  const rankedTests = mentionedTests.filter(t =>
    t.brandPosition !== undefined &&
    t.brandPosition !== null &&
    t.brandPosition > 0
  );
  return rankedTests.length > 0
    ? Math.round((rankedTests.reduce((sum, t) => sum + (t.brandPosition || 0), 0) / rankedTests.length) * 10) / 10
    : 0;
}

runTest("Empty array → 0",
  () => calculateAveragePosition([]) === 0);

runTest("No mentions → 0",
  () => calculateAveragePosition([
    { brandMentioned: false, brandPosition: 1 }
  ]) === 0);

runTest("Position 0 excluded from average",
  () => calculateAveragePosition([
    { brandMentioned: true, brandPosition: 0 },
    { brandMentioned: true, brandPosition: 2 }
  ]) === 2, // Only position 2 counts, position 0 excluded
  "Position 0 should be excluded");

runTest("Position null excluded from average",
  () => calculateAveragePosition([
    { brandMentioned: true, brandPosition: null },
    { brandMentioned: true, brandPosition: 3 }
  ]) === 3,
  "Position null should be excluded");

runTest("Mixed valid positions → correct average",
  () => calculateAveragePosition([
    { brandMentioned: true, brandPosition: 1 },
    { brandMentioned: true, brandPosition: 3 },
    { brandMentioned: true, brandPosition: 5 }
  ]) === 3, // (1+3+5)/3 = 3
  "Should average valid positions correctly");

runTest("Rounds to 1 decimal",
  () => calculateAveragePosition([
    { brandMentioned: true, brandPosition: 1 },
    { brandMentioned: true, brandPosition: 2 },
    { brandMentioned: true, brandPosition: 3 }
  ]) === 2, // (1+2+3)/3 = 2.0
  "Should round to 1 decimal place");

// ============================================================================
// TEST 6: Suffix-Aware Competitor Name Matching (Dedup)
// ============================================================================
console.log("\n--- TEST 6: Suffix-Aware Competitor Name Matching ---");

// Should match (suffix dedup)
runTest("Suffix match: 'Akash' === 'Akash Network'",
  () => matchCompetitorNames('Akash', 'Akash Network'));
runTest("Suffix match: 'Render' === 'Render Network'",
  () => matchCompetitorNames('Render', 'Render Network'));
runTest("Suffix match: 'Scale' === 'Scale AI'",
  () => matchCompetitorNames('Scale', 'Scale AI'));

// Should NOT match (not a known suffix, or wrong word count)
runTest("NO suffix match: 'Stripe' !== 'Stripe Atlas'",
  () => !matchCompetitorNames('Stripe', 'Stripe Atlas'),
  "'Atlas' is not a known company suffix");
runTest("NO suffix match: 'Y Combinator' !== 'Y Combinator Studio'",
  () => !matchCompetitorNames('Y Combinator', 'Y Combinator Studio'),
  "'Y Combinator' is 2 words, not 1");

// ============================================================================
// TEST 7: Parenthetical Stripping in Normalization
// ============================================================================
console.log("\n--- TEST 7: Parenthetical Stripping ---");

runTest("Parenthetical stripped: 'io.net (GPU DePIN)' → 'io.net'",
  () => normalizeCompanyName('io.net (GPU DePIN)') === 'io.net');
runTest("No parens: 'Akash Network' unchanged",
  () => normalizeCompanyName('Akash Network') === 'akash network');

// ============================================================================
// TEST 8: Category Heading Filter (filterValidCompetitors)
// ============================================================================
console.log("\n--- TEST 8: Category Heading Filter ---");

// Minimal filterValidCompetitors for testing (mirrors the service logic)
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
    if (comp.length < 2 || comp.length > 40) return false;

    const words = compLower.split(/\s+/);

    // Slash filter
    if (comp.includes('/')) {
      const slashExceptions = ['fly.io', 'bolt.new', 'ci/cd', 'gitlab ci/cd', 'next.js'];
      if (!slashExceptions.some(ex => compLower.includes(ex))) return false;
    }

    // Plural category noun ending filter
    const pluralCategoryNouns = [
      'marketplaces', 'networks', 'services', 'providers', 'platforms',
      'solutions', 'tools', 'systems', 'agencies', 'organizations',
      'ecosystems', 'protocols', 'frameworks', 'offerings', 'alternatives', 'options',
    ];
    const lastWord = words[words.length - 1];
    if (pluralCategoryNouns.includes(lastWord)) {
      if (words.length >= 3) return false;
      if (words.length === 2) {
        const genericFirstWords = [
          'ai', 'cloud', 'data', 'web', 'digital', 'enterprise', 'commercial',
          'decentralized', 'centralized', 'distributed', 'gpu', 'compute',
          'edge', 'serverless', 'managed', 'global', 'auto', 'instant',
          'online', 'virtual', 'professional', 'technical', 'coding',
          'career', 'job', 'industry', 'software', 'tech', 'open',
          'annotation', 'labeling', 'training',
        ];
        if (genericFirstWords.includes(words[0])) return false;
      }
    }

    // 3+ word generic combo filter
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

    return true;
  });
}

// Category headings should be filtered out
runTest("Filter: 'AI model/data marketplaces' → empty",
  () => filterValidCompetitors(['AI model/data marketplaces'], 'TestBrand').length === 0,
  "Category heading with slash should be filtered");
runTest("Filter: 'Decentralized GPU compute networks' → empty",
  () => filterValidCompetitors(['Decentralized GPU compute networks'], 'TestBrand').length === 0,
  "4-word phrase ending in plural category noun should be filtered");
runTest("Filter: 'GPU/CPU compute' → empty",
  () => filterValidCompetitors(['GPU/CPU compute'], 'TestBrand').length === 0,
  "Slash-containing name should be filtered");
runTest("Filter: 'annotation/labeling services' → empty",
  () => filterValidCompetitors(['annotation/labeling services'], 'TestBrand').length === 0,
  "Slash-containing category should be filtered");
runTest("Filter: 'Cloud providers' → empty",
  () => filterValidCompetitors(['Cloud providers'], 'TestBrand').length === 0,
  "2-word generic + plural noun should be filtered");

// Valid company names should pass through
runTest("Pass: 'Scale AI' survives filter",
  () => filterValidCompetitors(['Scale AI'], 'TestBrand').length === 1,
  "Scale AI is a real company (singular 'AI' not in plural list)");
runTest("Pass: 'Render Network' survives filter",
  () => filterValidCompetitors(['Render Network'], 'TestBrand').length === 1,
  "Render Network: singular 'network' not in plural noun list");
runTest("Pass: 'Appen' survives filter",
  () => filterValidCompetitors(['Appen'], 'TestBrand').length === 1,
  "Single-word company name should pass");
runTest("Pass: all 3 together",
  () => filterValidCompetitors(['Scale AI', 'Render Network', 'Appen'], 'TestBrand').length === 3,
  "All 3 valid companies should pass");

// ============================================================================
// SUMMARY
// ============================================================================
console.log("\n" + "=".repeat(70));
console.log("TEST SUMMARY");
console.log("=".repeat(70));

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;

console.log(`Total: ${results.length}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  console.log("\n❌ FAILED TESTS:");
  results.filter(r => !r.passed).forEach(r => {
    console.log(`  - ${r.name}: ${r.details}`);
  });
}

console.log("");

if (failed === 0) {
  console.log("✅ ALL TESTS PASSED!");
  console.log("");
  console.log("Critical fixes verified:");
  console.log("  1. Position validation: 0 and negative positions rejected");
  console.log("  2. Competitor matching: Strict matching, no false positives");
  console.log("  3. Table headers: Comprehensive detection prevents extraction errors");
  console.log("  4. Section headers: Robust detection prevents false bullet resets");
  console.log("  5. Average calculation: Consistent filtering across services");
  console.log("  6. Suffix-aware dedup: Akash/Akash Network, Scale/Scale AI merged correctly");
  console.log("  7. Parenthetical stripping: io.net (GPU DePIN) → io.net");
  console.log("  8. Category heading filter: Slashes, plural nouns, generic combos filtered");
  process.exit(0);
} else {
  console.log("❌ SOME TESTS FAILED - Please review the implementation");
  process.exit(1);
}
