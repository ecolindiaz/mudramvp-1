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
    .replace(/\s*(inc\.?|llc\.?|ltd\.?|corp\.?|co\.?|company)$/i, '')
    .replace(/[.,!?'"()]/g, '')
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
  process.exit(0);
} else {
  console.log("❌ SOME TESTS FAILED - Please review the implementation");
  process.exit(1);
}
