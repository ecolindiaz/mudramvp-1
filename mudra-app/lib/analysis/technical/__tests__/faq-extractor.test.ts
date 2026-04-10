/**
 * FAQ Extractor Eval Suite
 *
 * Tests the FAQ extraction pipeline for:
 *   1. Unit evals    — fixed HTML inputs → expected FAQ extraction outputs
 *   2. Regression    — same HTML run N times → identical stable results (no flapping)
 *   3. Integration   — page-level scoring via htmlToExtraction + scoreFaq
 *   4. Edge cases    — answers near the threshold, whitespace variants, FAQ formats
 *
 * Run: npm test -- lib/analysis/technical/__tests__/faq-extractor.test.ts
 */

import { describe, it, expect, vi } from "vitest";

// Mock Prisma and AI logging to prevent native-binary initialisation errors
// in unit-test environments where the Prisma query engine binary is not built.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/services/ai-model-logging.service", () => ({
  logAIModelCall: vi.fn(),
  estimateAICost: vi.fn(),
}));

import { extractors, htmlToExtraction } from "../dom-extractor";
import { computePageScore } from "../four-dimension-scorer";

const { extractFAQs } = extractors;

// ─── Helpers ────────────────────────────────────────────────────────────────

function wrap(body: string): string {
  return `<!DOCTYPE html><html><head><title>Test</title></head><body>${body}</body></html>`;
}

function load(body: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cheerio = require("cheerio");
  return cheerio.load(wrap(body));
}

// ─── 1. UNIT EVALS ──────────────────────────────────────────────────────────

describe("extractFAQs — JSON-LD source", () => {
  it("extracts FAQs from a valid FAQPage JSON-LD block", () => {
    const html = wrap(`
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "What is your return policy?",
            "acceptedAnswer": { "@type": "Answer", "text": "We offer 30-day returns on all items." }
          },
          {
            "@type": "Question",
            "name": "Do you ship internationally?",
            "acceptedAnswer": { "@type": "Answer", "text": "Yes, we ship to over 50 countries worldwide." }
          }
        ]
      }
      </script>
    `);
    const $ = load(html);
    const result = extractFAQs($);

    expect(result.total_faq_count).toBe(2);
    expect(result.has_faq_schema).toBe(true);
    expect(result.combined_faqs[0].question).toBe("What is your return policy?");
    expect(result.combined_faqs[0].source).toBe("jsonld");
  });

  it("ignores JSON-LD blocks that are not FAQPage type", () => {
    const html = wrap(`
      <script type="application/ld+json">
      { "@type": "Organization", "name": "Acme Corp" }
      </script>
    `);
    const $ = load(html);
    const result = extractFAQs($);
    expect(result.total_faq_count).toBe(0);
    expect(result.has_faq_schema).toBe(false);
  });
});

describe("extractFAQs — details/summary source", () => {
  it("extracts FAQs from <details><summary> inside a .faq container", () => {
    const html = wrap(`
      <section class="faq">
        <details>
          <summary>What payment methods do you accept?</summary>
          <p>We accept Visa, Mastercard, PayPal, and bank transfers.</p>
        </details>
        <details>
          <summary>Can I cancel my subscription anytime?</summary>
          <p>Yes, you can cancel at any time with no cancellation fees.</p>
        </details>
      </section>
    `);
    const $ = load(html);
    const result = extractFAQs($);

    expect(result.total_faq_count).toBeGreaterThanOrEqual(2);
    expect(result.sources.details_summary_elements.present).toBe(true);
  });

  it("ignores solitary <details> outside an FAQ container", () => {
    const html = wrap(`
      <details>
        <summary>Terms of Service</summary>
        <p>These are the terms.</p>
      </details>
    `);
    const $ = load(html);
    const result = extractFAQs($);
    // A single <details> is not enough — must have 2+ siblings
    expect(result.total_faq_count).toBe(0);
  });
});

describe("extractFAQs — heading-based source", () => {
  it("extracts FAQs under a 'Frequently Asked Questions' h2 heading", () => {
    const html = wrap(`
      <section>
        <h2>Frequently Asked Questions</h2>
        <div>
          <h3>How does billing work?</h3>
          <p>You are billed monthly at the start of each billing cycle automatically.</p>
          <h3>Is there a free trial?</h3>
          <p>Yes, we offer a 14-day free trial with no credit card required.</p>
        </div>
      </section>
    `);
    const $ = load(html);
    const result = extractFAQs($);

    expect(result.total_faq_count).toBeGreaterThanOrEqual(2);
  });

  it("does NOT extract generic marketing headings outside FAQ sections", () => {
    const html = wrap(`
      <section class="hero">
        <h2>How does it work?</h2>
        <p>Our platform connects you with the best freelancers in seconds.</p>
      </section>
    `);
    const $ = load(html);
    const result = extractFAQs($);
    expect(result.total_faq_count).toBe(0);
  });
});

describe("extractFAQs — Q:/A: pattern source", () => {
  it("extracts Q:/A: formatted FAQs from body text", () => {
    const html = wrap(`
      <div>
        Q: What is the minimum contract length?
        A: There is no minimum commitment — cancel any time you want.

        Q: Do you offer volume discounts?
        A: Yes, we offer tiered pricing for teams of 10 or more users.
      </div>
    `);
    const $ = load(html);
    const result = extractFAQs($);
    expect(result.total_faq_count).toBeGreaterThanOrEqual(2);
  });
});

// ─── 2. REGRESSION EVALS ────────────────────────────────────────────────────

describe("FAQ extraction stability (regression / no flapping)", () => {
  const STABLE_HTML = wrap(`
    <section class="faq">
      <details>
        <summary>Is setup required?</summary>
        <p>No setup required. Just sign up and start using the platform immediately.</p>
      </details>
      <details>
        <summary>What languages are supported?</summary>
        <p>We currently support English, Spanish, French, German, and Portuguese.</p>
      </details>
      <details>
        <summary>How secure is my data?</summary>
        <p>All data is encrypted at rest and in transit using AES-256 and TLS 1.3.</p>
      </details>
    </section>
  `);

  it("produces identical FAQ count across 10 repeated runs (no flapping)", () => {
    const counts = Array.from({ length: 10 }, () => {
      const $ = load(STABLE_HTML);
      return extractFAQs($).total_faq_count;
    });

    const unique = new Set(counts);
    expect(unique.size).toBe(1);
    expect(counts[0]).toBe(3);
  });

  it("produces identical answer_length values across repeated runs", () => {
    const lengths = Array.from({ length: 10 }, () => {
      const $ = load(STABLE_HTML);
      return extractFAQs($).combined_faqs.map(f => f.answer_length);
    });

    // All runs should produce the exact same lengths
    for (let i = 1; i < lengths.length; i++) {
      expect(lengths[i]).toEqual(lengths[0]);
    }
  });

  it("is stable for a whitespace-variant of the same HTML", () => {
    // Simulate crawler returning the same page with varying internal whitespace
    const htmlCompact = wrap(`<section class="faq"><details><summary>Is setup required?</summary><p>No setup required. Just sign up and start using the platform immediately.</p></details><details><summary>What languages are supported?</summary><p>We currently support English, Spanish, French, German, and Portuguese.</p></details></section>`);
    const htmlVerbose = wrap(`
      <section class="faq">
        <details>
          <summary>  Is setup required?  </summary>
          <p>
            No setup required.   Just sign up and start using the platform immediately.
          </p>
        </details>
        <details>
          <summary>  What languages are supported?  </summary>
          <p>
            We currently support English,   Spanish, French,   German, and Portuguese.
          </p>
        </details>
      </section>
    `);

    const compact$ = load(htmlCompact);
    const verbose$ = load(htmlVerbose);

    const compactResult = extractFAQs(compact$);
    const verboseResult = extractFAQs(verbose$);

    expect(compactResult.total_faq_count).toBe(verboseResult.total_faq_count);

    // answer_length should be equal after normalization
    for (let i = 0; i < compactResult.combined_faqs.length; i++) {
      expect(compactResult.combined_faqs[i].answer_length).toBe(
        verboseResult.combined_faqs[i].answer_length
      );
    }
  });
});

// ─── 3. INTEGRATION EVALS ────────────────────────────────────────────────────

describe("FAQ scoring integration — htmlToExtraction + scoreFaq", () => {
  it("blog page with 3 FAQs scores 15 points", () => {
    const html = wrap(`
      <section class="faq-section">
        <details>
          <summary>What is FATCA compliance?</summary>
          <p>FATCA requires foreign financial institutions to report on US account holders to the IRS.</p>
        </details>
        <details>
          <summary>Who does CRS apply to?</summary>
          <p>CRS applies to financial institutions in over 100 participating jurisdictions globally.</p>
        </details>
        <details>
          <summary>When was FATCA enacted?</summary>
          <p>FATCA was enacted in 2010 as part of the HIRE Act by the US Congress.</p>
        </details>
      </section>
    `);

    const extraction = htmlToExtraction(html, "https://example.com/blog/fatca-and-crs");
    const score = computePageScore(extraction);
    const faqDimension = score.dimension_details.faq;

    expect(faqDimension).toBeDefined();
    expect(faqDimension.score).toBe(15);
  });

  it("home page FAQ scoring IS applicable (max_score=20) and scores detected FAQs", () => {
    // Home is in FAQ_RELEVANT_PAGE_TYPES — FAQ scoring is applicable to home pages.
    const html = wrap(`
      <section class="faq-section">
        <details><summary>What is this product for exactly?</summary><p>A great product for any team.</p></details>
        <details><summary>How much does it cost per month?</summary><p>Plans start at just $9 per month.</p></details>
      </section>
    `);

    const extraction = htmlToExtraction(html, "https://example.com/");
    const score = computePageScore(extraction);
    const faqDimension = score.dimension_details.faq;

    expect(faqDimension).toBeDefined();
    expect(faqDimension.max_score).toBe(20); // FAQ scoring applies to home pages
    expect(faqDimension.score).toBeGreaterThan(0);
  });

  it("blog page without FAQs scores 0", () => {
    const html = wrap(`
      <article>
        <h1>Understanding FATCA</h1>
        <p>FATCA is a US tax law that requires reporting of foreign financial assets.</p>
      </article>
    `);

    const extraction = htmlToExtraction(html, "https://example.com/blog/understanding-fatca");
    const score = computePageScore(extraction);
    const faqDimension = score.dimension_details.faq;

    expect(faqDimension).toBeDefined();
    expect(faqDimension.score).toBe(0);
  });

  it("blog page with JSON-LD schema gets schema_gap=false", () => {
    const html = wrap(`
      <script type="application/ld+json">
      {
        "@type": "FAQPage",
        "mainEntity": [
          { "@type": "Question", "name": "Q1?", "acceptedAnswer": { "@type": "Answer", "text": "Answer one here." } },
          { "@type": "Question", "name": "Q2?", "acceptedAnswer": { "@type": "Answer", "text": "Answer two here." } }
        ]
      }
      </script>
    `);

    const extraction = htmlToExtraction(html, "https://example.com/blog/faq");
    expect(extraction.extraction.faqs.analysis.schema_gap).toBe(false);
    expect(extraction.extraction.faqs.has_faq_schema).toBe(true);
  });
});

// ─── 4. EDGE CASE EVALS ──────────────────────────────────────────────────────

describe("FAQ edge cases — threshold boundary and format diversity", () => {
  it("answer of 9 chars does NOT pass the threshold (too short)", () => {
    // Two items, but answers are only 9 chars — below the 10-char threshold
    const html = wrap(`
      <section class="faq">
        <details>
          <summary>Question one?</summary>
          <p>Short ok</p>
        </details>
        <details>
          <summary>Question two?</summary>
          <p>Short ok</p>
        </details>
      </section>
    `);
    const $ = load(html);
    const result = extractFAQs($);
    // "Short ok" is 8 chars — should NOT produce confirmed FAQs
    expect(result.total_faq_count).toBe(0);
  });

  it("answer of exactly 10 chars passes the threshold", () => {
    // "1234567890" is exactly 10 chars
    const html = wrap(`
      <section class="faq">
        <details>
          <summary>Question one about this topic?</summary>
          <p>1234567890</p>
        </details>
        <details>
          <summary>Question two about something?</summary>
          <p>1234567890</p>
        </details>
      </section>
    `);
    const $ = load(html);
    const result = extractFAQs($);
    expect(result.total_faq_count).toBe(2);
  });

  it("answer with heavy internal whitespace matches the same normalized length", () => {
    const htmlClean = wrap(`
      <section class="faq">
        <details>
          <summary>First question text here?</summary>
          <p>Yes we accept all major credit cards.</p>
        </details>
        <details>
          <summary>Second question text here?</summary>
          <p>No you do not need to provide any ID.</p>
        </details>
      </section>
    `);
    const htmlSpaced = wrap(`
      <section class="faq">
        <details>
          <summary>First question text here?</summary>
          <p>Yes  we  accept  all  major  credit  cards.</p>
        </details>
        <details>
          <summary>Second question text here?</summary>
          <p>No  you  do  not  need  to  provide  any  ID.</p>
        </details>
      </section>
    `);
    const clean$ = load(htmlClean);
    const spaced$ = load(htmlSpaced);
    const cleanResult = extractFAQs(clean$);
    const spacedResult = extractFAQs(spaced$);

    expect(cleanResult.total_faq_count).toBe(spacedResult.total_faq_count);
    expect(cleanResult.combined_faqs[0].answer_length).toBe(
      spacedResult.combined_faqs[0].answer_length
    );
  });

  it("correctly handles accordion-style FAQs (button + div pattern) inside #faq", () => {
    const html = wrap(`
      <section id="faq">
        <div>
          <button><span>What is your refund policy?</span></button>
          <div><p>We offer a full refund within 30 days of purchase, no questions asked.</p></div>
        </div>
        <div>
          <button><span>How long does shipping take?</span></button>
          <div><p>Standard shipping takes 5 to 7 business days within the continental US.</p></div>
        </div>
      </section>
    `);
    const $ = load(html);
    const result = extractFAQs($);
    expect(result.total_faq_count).toBeGreaterThanOrEqual(2);
  });

  it("extracts FAQs from <dl><dt><dd> definition list format", () => {
    const html = wrap(`
      <section>
        <h2>Frequently Asked Questions</h2>
        <div>
          <dl>
            <dt>What is included in the plan?</dt>
            <dd>All plans include unlimited projects, priority support, and API access.</dd>
            <dt>Can I upgrade or downgrade anytime?</dt>
            <dd>Yes, you can change your plan at the start of the next billing cycle.</dd>
          </dl>
        </div>
      </section>
    `);
    const $ = load(html);
    const result = extractFAQs($);
    expect(result.total_faq_count).toBeGreaterThanOrEqual(2);
  });

  it("does not double-count FAQs present in both JSON-LD and DOM", () => {
    const html = wrap(`
      <script type="application/ld+json">
      {
        "@type": "FAQPage",
        "mainEntity": [
          { "@type": "Question", "name": "What is your policy?", "acceptedAnswer": { "@type": "Answer", "text": "Our policy allows 30-day returns." } }
        ]
      }
      </script>
      <section class="faq">
        <details>
          <summary>What is your policy?</summary>
          <p>Our policy allows 30-day returns.</p>
        </details>
      </section>
    `);
    const $ = load(html);
    const result = extractFAQs($);
    // Deduplication should prevent double-counting
    expect(result.total_faq_count).toBe(1);
  });

  it("blog page with same template HTML produces identical scores on repeated runs", () => {
    // Simulates the wallbit.io blog post scenario: same template, run twice
    const blogHtml = wrap(`
      <article>
        <h1>FATCA and CRS 2.0</h1>
        <p>An in-depth look at compliance requirements for financial institutions.</p>
        <section class="faq-section">
          <h2>FAQ</h2>
          <div>
            <details>
              <summary>What changed in CRS 2.0?</summary>
              <p>CRS 2.0 introduces enhanced due diligence and mandatory disclosure rules.</p>
            </details>
            <details>
              <summary>Which countries are affected?</summary>
              <p>Over 100 jurisdictions have committed to the CRS automatic exchange framework.</p>
            </details>
            <details>
              <summary>When does compliance take effect?</summary>
              <p>Most jurisdictions require compliance starting from the 2024 reporting year.</p>
            </details>
          </div>
        </section>
      </article>
    `);

    const run1$ = load(blogHtml);
    const run2$ = load(blogHtml);
    const run1 = extractFAQs(run1$);
    const run2 = extractFAQs(run2$);

    expect(run1.total_faq_count).toBe(run2.total_faq_count);
    expect(run1.combined_faqs.map(f => f.answer_length)).toEqual(
      run2.combined_faqs.map(f => f.answer_length)
    );
  });

  it("non-marketing page types (legal, contact, login) return max_score=0 for FAQ", () => {
    // Pages not in FAQ_RELEVANT_PAGE_TYPES get max_score=0 (not applicable)
    const nonMarketingUrls = [
      "https://example.com/legal/terms",
      "https://example.com/contact",
      "https://example.com/login",
    ];
    for (const url of nonMarketingUrls) {
      const html = wrap(`
        <section id="faq">
          <details><summary>Q?</summary><p>Answer here for testing.</p></details>
          <details><summary>Q2?</summary><p>Another answer here please.</p></details>
        </section>
      `);
      const extraction = htmlToExtraction(html, url);
      const score = computePageScore(extraction);
      const faqDimension = score.dimension_details.faq;
      expect(faqDimension.max_score, `${url} should have max_score=0`).toBe(0);
    }
  });

  it("locale-prefixed home URLs (/en/, /fr-be/) are detected as home page type", () => {
    const localeHomeUrls = [
      "https://example.com/en/",
      "https://example.com/en",
      "https://example.com/fr-be/",
    ];
    for (const url of localeHomeUrls) {
      const extraction = htmlToExtraction(wrap("<h1>Home</h1>"), url);
      expect(extraction.page_type, `${url} should be page_type=home`).toBe("home");
    }
  });
});
