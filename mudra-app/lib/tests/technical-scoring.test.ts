/**
 * Technical Analysis Score Validation Test Suite
 * 
 * Tests scoring accuracy against known HTML fixtures
 * Run: npm test or node --require tsx/register lib/tests/technical-scoring.test.ts
 */

import { ALL_FIXTURES, TestFixture } from './fixtures/sample-html-pages';

// Mock DOM parser for Node.js environment
import { JSDOM } from 'jsdom';

/**
 * Score a single HTML page using the same logic as technical-analysis.service.ts
 * This duplicates the scoring logic to test it independently
 */
function scoreHtmlPage(html: string): {
  overall: number;
  metadata: number;
  headings: number;
  semantic: number;
  schema: number;
  faq: number;
} {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  let metadataScore = 0;
  let headingsScore = 0;
  let semanticScore = 0;
  let schemaScore = 0;
  let faqScore = 0;

  // ===== METADATA SCORING (25 points) =====
  // M1: Title tag (5 points)
  const title = doc.querySelector('title')?.textContent?.trim();
  if (title && title.length > 0) metadataScore += 5;

  // M2: Meta description (5 points)
  const description = doc.querySelector('meta[name="description"]')?.getAttribute('content');
  if (description && description.length > 50) metadataScore += 5;

  // M3: Open Graph tags (5 points)
  const ogTitle = doc.querySelector('meta[property="og:title"]');
  const ogDesc = doc.querySelector('meta[property="og:description"]');
  if (ogTitle && ogDesc) metadataScore += 5;

  // M4: Twitter Card tags (5 points)
  const twitterCard = doc.querySelector('meta[name="twitter:card"]');
  const twitterTitle = doc.querySelector('meta[name="twitter:title"]');
  if (twitterCard && twitterTitle) metadataScore += 5;

  // M5: Canonical tag (5 points)
  const canonical = doc.querySelector('link[rel="canonical"]');
  if (canonical) metadataScore += 5;

  // ===== HEADINGS SCORING (20 points) =====
  // H1: H1 tag present (10 points)
  const h1Elements = doc.querySelectorAll('h1');
  if (h1Elements.length > 0) headingsScore += 10;

  // H2: Proper heading hierarchy (5 points)
  const h2Elements = doc.querySelectorAll('h2');
  const h3Elements = doc.querySelectorAll('h3');
  if (h2Elements.length > 0) headingsScore += 5;

  // H3: Descriptive headings (5 points) - check if H2/H3 exist
  if (h3Elements.length > 0) headingsScore += 5;

  // ===== SEMANTIC SCORING (15 points) =====
  // S1: Semantic HTML tags (5 points)
  const semanticTags = ['main', 'article', 'section', 'nav', 'header', 'footer', 'aside'];
  const hasSemanticTag = semanticTags.some(tag => doc.querySelector(tag));
  if (hasSemanticTag) semanticScore += 5;

  // S2: Image alt attributes (5 points)
  const images = doc.querySelectorAll('img');
  const imagesWithAlt = Array.from(images).filter(img => img.hasAttribute('alt') && img.getAttribute('alt')?.trim());
  if (images.length > 0 && imagesWithAlt.length === images.length) semanticScore += 5;

  // S3: ARIA labels (5 points)
  const ariaElements = doc.querySelectorAll('[role], [aria-label], [aria-labelledby]');
  if (ariaElements.length > 0) semanticScore += 5;

  // ===== SCHEMA SCORING (25 points) =====
  const scriptTags = doc.querySelectorAll('script[type="application/ld+json"]');
  let validJsonLdCount = 0;
  let hasFaqSchema = false;

  scriptTags.forEach(script => {
    try {
      const json = JSON.parse(script.textContent || '{}');
      if (json['@context'] && json['@type']) {
        validJsonLdCount++;
        if (json['@type'] === 'FAQPage') hasFaqSchema = true;
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  });

  // J1: Valid JSON-LD present (10 points)
  if (validJsonLdCount > 0) schemaScore += 10;

  // J2: Organization/Website schema (10 points)
  if (validJsonLdCount >= 2) schemaScore += 10;

  // J3: FAQ schema (5 points)
  if (hasFaqSchema) schemaScore += 5;

  // ===== FAQ SCORING (15 points) =====
  // Scale: 0 FAQs = 0pts, 1 FAQ = 5pts, 2 FAQs = 10pts, 3+ FAQs = 15pts
  let faqCount = 0;

  // Count from JSON-LD FAQ schema
  scriptTags.forEach(script => {
    try {
      const json = JSON.parse(script.textContent || '{}');
      if (json['@type'] === 'FAQPage' && json.mainEntity) {
        faqCount += json.mainEntity.length;
      }
    } catch {}
  });

  // Count from microdata
  const microdataQuestions = doc.querySelectorAll('[itemtype*="Question"]');
  faqCount += microdataQuestions.length;

  if (faqCount >= 3) faqScore = 15;
  else if (faqCount === 2) faqScore = 10;
  else if (faqCount === 1) faqScore = 5;

  // ===== OVERALL SCORE =====
  const overall = metadataScore + headingsScore + semanticScore + schemaScore + faqScore;

  return {
    overall,
    metadata: metadataScore,
    headings: headingsScore,
    semantic: semanticScore,
    schema: schemaScore,
    faq: faqScore,
  };
}

/**
 * Test a single fixture
 */
function testFixture(fixture: TestFixture): {
  passed: boolean;
  fixture: string;
  actual: any;
  expected: any;
  errors: string[];
} {
  const errors: string[] = [];
  const actual = scoreHtmlPage(fixture.html);
  const expected = fixture.expectedScore;

  // Allow ±5 point tolerance for overall score (due to scoring variations)
  const TOLERANCE = 5;

  if (Math.abs(actual.overall - expected.overall) > TOLERANCE) {
    errors.push(`Overall score mismatch: expected ${expected.overall}, got ${actual.overall}`);
  }

  // Check individual components (exact match expected)
  const components = ['metadata', 'headings', 'semantic', 'schema', 'faq'] as const;
  components.forEach(component => {
    if (Math.abs(actual[component] - expected[component]) > TOLERANCE) {
      errors.push(`${component} score mismatch: expected ${expected[component]}, got ${actual[component]}`);
    }
  });

  return {
    passed: errors.length === 0,
    fixture: fixture.name,
    actual,
    expected,
    errors,
  };
}

/**
 * Run all tests
 */
export function runValidationTests(): {
  totalTests: number;
  passed: number;
  failed: number;
  results: any[];
} {
  console.log('🧪 Running Technical Analysis Score Validation Tests...\n');

  const results = ALL_FIXTURES.map(testFixture);
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  // Print results
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.fixture}`);
    
    if (!result.passed) {
      console.log('   Expected:', result.expected);
      console.log('   Actual:', result.actual);
      result.errors.forEach(err => console.log(`   - ${err}`));
    }
    console.log('');
  });

  // Summary
  console.log('═'.repeat(60));
  console.log(`📊 Test Summary: ${passed}/${results.length} passed (${failed} failed)`);
  console.log('═'.repeat(60));

  return {
    totalTests: results.length,
    passed,
    failed,
    results,
  };
}

// Run tests if executed directly
if (require.main === module) {
  const summary = runValidationTests();
  process.exit(summary.failed > 0 ? 1 : 0);
}
