import { describe, it, expect } from "vitest";
import {
	scoreMetadata,
	scoreHeadings,
	scoreSemantic,
	scoreSchema,
	scoreFaq,
	computePageScore,
	computeSiteScore,
	DIMENSION_WEIGHTS,
} from "../five-dimension-scorer";
import { htmlToExtraction } from "../dom-extractor";
import type { DOMExtraction } from "../types";

// ============================================================================
// TEST HTML SAMPLES
// ============================================================================

const PERFECT_SCORE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Perfect Page | Brand Name</title>
  <meta name="description" content="This is a perfect page description for testing.">
  <link rel="canonical" href="https://example.com/perfect">
  <meta property="og:title" content="Perfect Page">
  <meta property="og:description" content="Perfect description">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Perfect Page">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Perfect Page"
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is this?",
        "acceptedAnswer": { "@type": "Answer", "text": "This is a test." }
      },
      {
        "@type": "Question",
        "name": "Why is it perfect?",
        "acceptedAnswer": { "@type": "Answer", "text": "Because it has everything." }
      },
      {
        "@type": "Question",
        "name": "How does it work?",
        "acceptedAnswer": { "@type": "Answer", "text": "It just does." }
      }
    ]
  }
  </script>
</head>
<body>
  <header><nav><a href="/">Home</a></nav></header>
  <main>
    <article>
      <h1>Perfect Page Title</h1>
      <section>
        <h2>First Section</h2>
        <p>Content here.</p>
        <h3>Subsection</h3>
        <p>More content.</p>
      </section>
      <section>
        <h2>Second Section</h2>
        <p>Additional content.</p>
      </section>
    </article>
  </main>
  <aside><p>Sidebar</p></aside>
  <footer><p>Copyright</p></footer>
</body>
</html>
`;

const ZERO_SCORE_HTML = `
<!DOCTYPE html>
<html>
<head></head>
<body>
  <div>Just a div with no structure</div>
</body>
</html>
`;

const PARTIAL_SCORE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Partial Page</title>
  <meta name="description" content="Some description">
</head>
<body>
  <main>
    <h1>One H1</h1>
    <h2>One H2</h2>
    <h2>Another H2</h2>
    <p>Some content</p>
  </main>
</body>
</html>
`;

const MULTIPLE_H1_HTML = `
<!DOCTYPE html>
<html>
<head><title>Multiple H1</title></head>
<body>
  <h1>First H1</h1>
  <h1>Second H1</h1>
  <h2>H2</h2>
</body>
</html>
`;

const SKIPPED_HEADINGS_HTML = `
<!DOCTYPE html>
<html>
<head><title>Skipped Headings</title></head>
<body>
  <h1>Main Title</h1>
  <h4>Skipped to H4</h4>
  <h2>Back to H2</h2>
</body>
</html>
`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getExtraction(html: string, url = "https://example.com"): DOMExtraction {
	return htmlToExtraction(html, url);
}

// ============================================================================
// METADATA SCORING TESTS (25 points)
// ============================================================================

describe("scoreMetadata", () => {
	it("scores M1 (title) - 7 points when present", () => {
		const extraction = getExtraction(PERFECT_SCORE_HTML);
		const result = scoreMetadata(extraction);
		expect(result.checks.M1_title.passed).toBe(true);
		expect(result.checks.M1_title.points).toBe(7);
	});

	it("scores M1 (title) - 0 points when missing", () => {
		const extraction = getExtraction(ZERO_SCORE_HTML);
		const result = scoreMetadata(extraction);
		expect(result.checks.M1_title.passed).toBe(false);
		expect(result.checks.M1_title.points).toBe(0);
	});

	it("scores M2 (description) - 7 points when present", () => {
		const extraction = getExtraction(PERFECT_SCORE_HTML);
		const result = scoreMetadata(extraction);
		expect(result.checks.M2_description.passed).toBe(true);
		expect(result.checks.M2_description.points).toBe(7);
	});

	it("scores M3 (canonical) - 6 points when present", () => {
		const extraction = getExtraction(PERFECT_SCORE_HTML);
		const result = scoreMetadata(extraction);
		expect(result.checks.M3_canonical.passed).toBe(true);
		expect(result.checks.M3_canonical.points).toBe(6);
	});

	it("scores M4 (opengraph) - 3 points when present", () => {
		const extraction = getExtraction(PERFECT_SCORE_HTML);
		const result = scoreMetadata(extraction);
		expect(result.checks.M4_opengraph.passed).toBe(true);
		expect(result.checks.M4_opengraph.points).toBe(3);
	});

	it("scores M5 (twitter) - 2 points when present", () => {
		const extraction = getExtraction(PERFECT_SCORE_HTML);
		const result = scoreMetadata(extraction);
		expect(result.checks.M5_twitter.passed).toBe(true);
		expect(result.checks.M5_twitter.points).toBe(2);
	});

	it("returns max score of 25 for perfect metadata", () => {
		const extraction = getExtraction(PERFECT_SCORE_HTML);
		const result = scoreMetadata(extraction);
		expect(result.score).toBe(25);
		expect(result.max_score).toBe(DIMENSION_WEIGHTS.metadata);
	});

	it("returns 0 for missing metadata", () => {
		const extraction = getExtraction(ZERO_SCORE_HTML);
		const result = scoreMetadata(extraction);
		expect(result.score).toBe(0);
	});

	it("returns partial score for partial metadata", () => {
		const extraction = getExtraction(PARTIAL_SCORE_HTML);
		const result = scoreMetadata(extraction);
		expect(result.score).toBe(14); // title (7) + description (7)
	});
});

// ============================================================================
// HEADINGS SCORING TESTS (20 points)
// ============================================================================

describe("scoreHeadings", () => {
	it("scores H1 (single H1) - 8 points when exactly one H1", () => {
		const extraction = getExtraction(PERFECT_SCORE_HTML);
		const result = scoreHeadings(extraction);
		expect(result.checks.H1_single.passed).toBe(true);
		expect(result.checks.H1_single.points).toBe(8);
	});

	it("scores H1 - 0 points when no H1", () => {
		const extraction = getExtraction(ZERO_SCORE_HTML);
		const result = scoreHeadings(extraction);
		expect(result.checks.H1_single.passed).toBe(false);
		expect(result.checks.H1_single.points).toBe(0);
	});

	it("scores H1 - 0 points when multiple H1s", () => {
		const extraction = getExtraction(MULTIPLE_H1_HTML);
		const result = scoreHeadings(extraction);
		expect(result.checks.H1_single.passed).toBe(false);
		expect(result.checks.H1_single.points).toBe(0);
	});

	it("scores H2 (coverage) - 6 points when >= 3 headings", () => {
		const extraction = getExtraction(PERFECT_SCORE_HTML);
		const result = scoreHeadings(extraction);
		expect(result.checks.H2_coverage.passed).toBe(true);
		expect(result.checks.H2_coverage.points).toBe(6);
	});

	it("scores H2 (coverage) - 0 points when < 3 headings", () => {
		const html = `<html><body><h1>Only H1</h1></body></html>`;
		const extraction = getExtraction(html);
		const result = scoreHeadings(extraction);
		expect(result.checks.H2_coverage.passed).toBe(false);
		expect(result.checks.H2_coverage.points).toBe(0);
	});

	it("scores H3 (no skips) - 6 points when no skipped levels", () => {
		const extraction = getExtraction(PERFECT_SCORE_HTML);
		const result = scoreHeadings(extraction);
		expect(result.checks.H3_no_skips.passed).toBe(true);
		expect(result.checks.H3_no_skips.points).toBe(6);
	});

	it("scores H3 (no skips) - 0 points when levels are skipped", () => {
		const extraction = getExtraction(SKIPPED_HEADINGS_HTML);
		const result = scoreHeadings(extraction);
		expect(result.checks.H3_no_skips.passed).toBe(false);
		expect(result.checks.H3_no_skips.points).toBe(0);
	});

	it("returns max score of 20 for perfect headings", () => {
		const extraction = getExtraction(PERFECT_SCORE_HTML);
		const result = scoreHeadings(extraction);
		expect(result.score).toBe(20);
		expect(result.max_score).toBe(DIMENSION_WEIGHTS.headings);
	});
});

// ============================================================================
// SEMANTIC HTML SCORING TESTS (15 points)
// ============================================================================

describe("scoreSemantic", () => {
	it("scores S1 (main content) - 5 points when <main> or <article> present", () => {
		const extraction = getExtraction(PERFECT_SCORE_HTML);
		const result = scoreSemantic(extraction);
		expect(result.checks.S1_main_content.passed).toBe(true);
		expect(result.checks.S1_main_content.points).toBe(5);
	});

	it("scores S1 - 0 points when no main content element", () => {
		const extraction = getExtraction(ZERO_SCORE_HTML);
		const result = scoreSemantic(extraction);
		expect(result.checks.S1_main_content.passed).toBe(false);
		expect(result.checks.S1_main_content.points).toBe(0);
	});

	it("scores S2 (page structure) - 5 points when <header> AND <footer> present", () => {
		const extraction = getExtraction(PERFECT_SCORE_HTML);
		const result = scoreSemantic(extraction);
		expect(result.checks.S2_page_structure.passed).toBe(true);
		expect(result.checks.S2_page_structure.points).toBe(5);
	});

	it("scores S2 - 0 points when missing header or footer", () => {
		const extraction = getExtraction(PARTIAL_SCORE_HTML);
		const result = scoreSemantic(extraction);
		expect(result.checks.S2_page_structure.passed).toBe(false);
		expect(result.checks.S2_page_structure.points).toBe(0);
	});

	it("scores S3 (sections) - 5 points when >= 3 semantic elements", () => {
		const extraction = getExtraction(PERFECT_SCORE_HTML);
		const result = scoreSemantic(extraction);
		expect(result.checks.S3_sections.passed).toBe(true);
		expect(result.checks.S3_sections.points).toBe(5);
	});

	it("returns max score of 15 for perfect semantic HTML", () => {
		const extraction = getExtraction(PERFECT_SCORE_HTML);
		const result = scoreSemantic(extraction);
		expect(result.score).toBe(15);
		expect(result.max_score).toBe(DIMENSION_WEIGHTS.semantic);
	});
});

// ============================================================================
// SCHEMA / JSON-LD SCORING TESTS (25 points)
// ============================================================================

describe("scoreSchema", () => {
	it("scores J1 (present) - 8 points when JSON-LD present", () => {
		const extraction = getExtraction(PERFECT_SCORE_HTML);
		const result = scoreSchema(extraction);
		expect(result.checks.J1_present.passed).toBe(true);
		expect(result.checks.J1_present.points).toBe(8);
	});

	it("scores J1 - 0 points when no JSON-LD", () => {
		const extraction = getExtraction(ZERO_SCORE_HTML);
		const result = scoreSchema(extraction);
		expect(result.checks.J1_present.passed).toBe(false);
		expect(result.checks.J1_present.points).toBe(0);
	});

	it("scores J2 (valid) - 7 points when valid structure", () => {
		const extraction = getExtraction(PERFECT_SCORE_HTML);
		const result = scoreSchema(extraction);
		expect(result.checks.J2_valid.passed).toBe(true);
		expect(result.checks.J2_valid.points).toBe(7);
	});

	it("scores J2 - 0 points when invalid JSON-LD", () => {
		const invalidJsonLdHtml = `
			<html><head>
			<script type="application/ld+json">{ invalid json }</script>
			</head><body></body></html>
		`;
		const extraction = getExtraction(invalidJsonLdHtml);
		const result = scoreSchema(extraction);
		expect(result.checks.J2_valid.passed).toBe(false);
	});

	it("scores J3 (relevant) - 10 points when AEO-relevant type", () => {
		const extraction = getExtraction(PERFECT_SCORE_HTML);
		const result = scoreSchema(extraction);
		expect(result.checks.J3_relevant.passed).toBe(true);
		expect(result.checks.J3_relevant.points).toBe(10);
	});

	it("scores J3 - 0 points when non-relevant schema type", () => {
		const nonRelevantSchema = `
			<html><head>
			<script type="application/ld+json">
			{"@context": "https://schema.org", "@type": "Event", "name": "Event"}
			</script>
			</head><body></body></html>
		`;
		const extraction = getExtraction(nonRelevantSchema);
		const result = scoreSchema(extraction);
		expect(result.checks.J3_relevant.passed).toBe(false);
	});

	it("returns max score of 25 for perfect schema", () => {
		const extraction = getExtraction(PERFECT_SCORE_HTML);
		const result = scoreSchema(extraction);
		expect(result.score).toBe(25);
		expect(result.max_score).toBe(DIMENSION_WEIGHTS.schema);
	});
});

// ============================================================================
// FAQ SCORING TESTS (15 points)
// ============================================================================

describe("scoreFaq", () => {
	it("scores 0 points for 0 FAQs", () => {
		const extraction = getExtraction(ZERO_SCORE_HTML);
		const result = scoreFaq(extraction);
		expect(result.score).toBe(0);
	});

	it("scores 5 points for 1 FAQ", () => {
		const oneFaqHtml = `
			<html><head>
			<script type="application/ld+json">
			{
				"@context": "https://schema.org",
				"@type": "FAQPage",
				"mainEntity": [{
					"@type": "Question",
					"name": "Q1?",
					"acceptedAnswer": {"@type": "Answer", "text": "A1"}
				}]
			}
			</script>
			</head><body></body></html>
		`;
		const extraction = getExtraction(oneFaqHtml);
		const result = scoreFaq(extraction);
		expect(result.score).toBe(5);
	});

	it("scores 10 points for 2 FAQs", () => {
		const twoFaqHtml = `
			<html><head>
			<script type="application/ld+json">
			{
				"@context": "https://schema.org",
				"@type": "FAQPage",
				"mainEntity": [
					{"@type": "Question", "name": "Q1?", "acceptedAnswer": {"@type": "Answer", "text": "A1"}},
					{"@type": "Question", "name": "Q2?", "acceptedAnswer": {"@type": "Answer", "text": "A2"}}
				]
			}
			</script>
			</head><body></body></html>
		`;
		const extraction = getExtraction(twoFaqHtml);
		const result = scoreFaq(extraction);
		expect(result.score).toBe(10);
	});

	it("scores 15 points (capped) for 3+ FAQs", () => {
		const extraction = getExtraction(PERFECT_SCORE_HTML);
		const result = scoreFaq(extraction);
		expect(result.score).toBe(15);
		expect(result.max_score).toBe(DIMENSION_WEIGHTS.faq);
	});

	it("caps score at 15 even for many FAQs", () => {
		const manyFaqHtml = `
			<html><head>
			<script type="application/ld+json">
			{
				"@context": "https://schema.org",
				"@type": "FAQPage",
				"mainEntity": [
					{"@type": "Question", "name": "Q1?", "acceptedAnswer": {"@type": "Answer", "text": "A1"}},
					{"@type": "Question", "name": "Q2?", "acceptedAnswer": {"@type": "Answer", "text": "A2"}},
					{"@type": "Question", "name": "Q3?", "acceptedAnswer": {"@type": "Answer", "text": "A3"}},
					{"@type": "Question", "name": "Q4?", "acceptedAnswer": {"@type": "Answer", "text": "A4"}},
					{"@type": "Question", "name": "Q5?", "acceptedAnswer": {"@type": "Answer", "text": "A5"}}
				]
			}
			</script>
			</head><body></body></html>
		`;
		const extraction = getExtraction(manyFaqHtml);
		const result = scoreFaq(extraction);
		expect(result.score).toBe(15);
	});

	it("detects schema gap when FAQ content exists without schema", () => {
		const faqContentNoSchema = `
			<html><body>
			<details><summary>Question?</summary>Answer here.</details>
			</body></html>
		`;
		const extraction = getExtraction(faqContentNoSchema);
		const result = scoreFaq(extraction);
		expect(result.checks.FAQ_schema_gap).toBeDefined();
		expect(result.checks.FAQ_schema_gap?.passed).toBe(false);
	});
});

// ============================================================================
// TOTAL SCORE COMPUTATION TESTS
// ============================================================================

describe("computePageScore", () => {
	it("calculates total score correctly (perfect = 100)", () => {
		const extraction = getExtraction(PERFECT_SCORE_HTML);
		const result = computePageScore(extraction);
		expect(result.scores.total).toBe(100);
		expect(result.scores.metadata).toBe(25);
		expect(result.scores.headings).toBe(20);
		expect(result.scores.semantic).toBe(15);
		expect(result.scores.schema).toBe(25);
		expect(result.scores.faq).toBe(15);
	});

	it("calculates total score correctly (minimal HTML)", () => {
		const extraction = getExtraction(ZERO_SCORE_HTML);
		const result = computePageScore(extraction);
		// Minimal HTML still gets 6 points from H3_no_skips (no headings = no skipped levels)
		expect(result.scores.total).toBe(6);
	});

	it("returns correct status based on score", () => {
		// Perfect (100) = excellent
		const perfect = computePageScore(getExtraction(PERFECT_SCORE_HTML));
		expect(perfect.status).toBe("excellent");

		// Zero (0) = poor
		const zero = computePageScore(getExtraction(ZERO_SCORE_HTML));
		expect(zero.status).toBe("poor");
	});

	it("includes page_url and page_type", () => {
		const extraction = getExtraction(PERFECT_SCORE_HTML, "https://example.com/blog/post");
		const result = computePageScore(extraction);
		expect(result.page_url).toBe("https://example.com/blog/post");
		expect(result.page_type).toBe("blog");
	});

	it("includes dimension details", () => {
		const extraction = getExtraction(PERFECT_SCORE_HTML);
		const result = computePageScore(extraction);

		expect(result.dimension_details.metadata).toBeDefined();
		expect(result.dimension_details.headings).toBeDefined();
		expect(result.dimension_details.semantic).toBeDefined();
		expect(result.dimension_details.schema).toBeDefined();
		expect(result.dimension_details.faq).toBeDefined();
	});
});

// ============================================================================
// ISSUES GENERATION TESTS
// ============================================================================

describe("Issues Generation", () => {
	it("generates issues for missing metadata", () => {
		const extraction = getExtraction(ZERO_SCORE_HTML);
		const result = computePageScore(extraction);

		expect(result.issues.some((i) => i.check === "M1_title")).toBe(true);
		expect(result.issues.some((i) => i.check === "M2_description")).toBe(true);
		expect(result.issues.some((i) => i.check === "M3_canonical")).toBe(true);
	});

	it("generates issues for heading problems", () => {
		const extraction = getExtraction(MULTIPLE_H1_HTML);
		const result = computePageScore(extraction);
		expect(result.issues.some((i) => i.check === "H1_single")).toBe(true);
	});

	it("generates issues for missing schema", () => {
		const extraction = getExtraction(ZERO_SCORE_HTML);
		const result = computePageScore(extraction);
		expect(result.issues.some((i) => i.check === "J1_present")).toBe(true);
	});

	it("includes correct severity levels", () => {
		const extraction = getExtraction(ZERO_SCORE_HTML);
		const result = computePageScore(extraction);

		const titleIssue = result.issues.find((i) => i.check === "M1_title");
		expect(titleIssue?.severity).toBe("high");

		const ogIssue = result.issues.find((i) => i.check === "M4_opengraph");
		expect(ogIssue?.severity).toBe("low");
	});

	it("includes page_url in issues", () => {
		const extraction = getExtraction(ZERO_SCORE_HTML, "https://example.com/test");
		const result = computePageScore(extraction);

		result.issues.forEach((issue) => {
			expect(issue.page_url).toBe("https://example.com/test");
		});
	});

	it("generates no issues for perfect page", () => {
		const extraction = getExtraction(PERFECT_SCORE_HTML);
		const result = computePageScore(extraction);
		expect(result.issues.length).toBe(0);
	});
});

// ============================================================================
// INTERVENTIONS GENERATION TESTS
// ============================================================================

describe("Interventions Generation", () => {
	it("generates interventions for missing elements", () => {
		const extraction = getExtraction(ZERO_SCORE_HTML);
		const result = computePageScore(extraction);

		expect(result.interventions.some((i) => i.action === "inject_title_tag")).toBe(true);
		expect(result.interventions.some((i) => i.action === "inject_meta_description")).toBe(true);
		expect(result.interventions.some((i) => i.action === "inject_jsonld_schema")).toBe(true);
	});

	it("includes priority levels", () => {
		const extraction = getExtraction(ZERO_SCORE_HTML);
		const result = computePageScore(extraction);

		const titleIntervention = result.interventions.find((i) => i.check === "M1_title");
		expect(titleIntervention?.priority).toBe("high");
	});

	it("includes estimated impact", () => {
		const extraction = getExtraction(ZERO_SCORE_HTML);
		const result = computePageScore(extraction);

		const titleIntervention = result.interventions.find((i) => i.check === "M1_title");
		expect(titleIntervention?.estimated_impact).toBe("+7 points");
	});

	it("includes target location", () => {
		const extraction = getExtraction(ZERO_SCORE_HTML);
		const result = computePageScore(extraction);

		const titleIntervention = result.interventions.find((i) => i.check === "M1_title");
		expect(titleIntervention?.target).toBe("head");
	});

	it("includes code hints where applicable", () => {
		const extraction = getExtraction(ZERO_SCORE_HTML);
		const result = computePageScore(extraction);

		const titleIntervention = result.interventions.find((i) => i.check === "M1_title");
		expect(titleIntervention?.code_hint).toBeDefined();
	});

	it("generates FAQ schema gap intervention", () => {
		const faqContentNoSchema = `
			<html><body>
			<details><summary>Question?</summary>Answer here.</details>
			</body></html>
		`;
		const extraction = getExtraction(faqContentNoSchema);
		const result = computePageScore(extraction);

		expect(result.interventions.some((i) => i.check === "FAQ_schema_gap")).toBe(true);
	});

	it("generates no interventions for perfect page", () => {
		const extraction = getExtraction(PERFECT_SCORE_HTML);
		const result = computePageScore(extraction);
		expect(result.interventions.length).toBe(0);
	});
});

// ============================================================================
// SITE-WIDE SCORE TESTS
// ============================================================================

describe("computeSiteScore", () => {
	it("calculates average of page scores", () => {
		const page1 = computePageScore(getExtraction(PERFECT_SCORE_HTML));
		const page2 = computePageScore(getExtraction(ZERO_SCORE_HTML));

		const siteScore = computeSiteScore([page1, page2]);
		expect(siteScore).toBe(53); // (100 + 6) / 2 = 53 (minimal HTML gets 6 pts from H3_no_skips)
	});

	it("returns 0 for empty page list", () => {
		const siteScore = computeSiteScore([]);
		expect(siteScore).toBe(0);
	});

	it("handles single page correctly", () => {
		const page = computePageScore(getExtraction(PERFECT_SCORE_HTML));
		const siteScore = computeSiteScore([page]);
		expect(siteScore).toBe(100);
	});

	it("rounds to nearest integer", () => {
		const page1 = computePageScore(getExtraction(PERFECT_SCORE_HTML)); // 100
		const page2 = computePageScore(getExtraction(PARTIAL_SCORE_HTML));

		const siteScore = computeSiteScore([page1, page2]);
		expect(Number.isInteger(siteScore)).toBe(true);
	});
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe("Edge Cases", () => {
	it("handles HTML with only whitespace", () => {
		const extraction = getExtraction("   \n\t   ");
		const result = computePageScore(extraction);
		// Whitespace HTML still gets 6 points from H3_no_skips (no headings = no skipped levels)
		expect(result.scores.total).toBe(6);
	});

	it("handles very large HTML without crashing", () => {
		const largeHtml = `
			<!DOCTYPE html>
			<html><head><title>Large Page</title></head>
			<body>
			${Array(1000).fill("<p>Paragraph content here.</p>").join("")}
			</body></html>
		`;
		const extraction = getExtraction(largeHtml);
		const result = computePageScore(extraction);
		expect(result).toBeDefined();
	});

	it("handles special characters in content", () => {
		const specialCharsHtml = `
			<!DOCTYPE html>
			<html><head><title>Test &amp; Special &lt;chars&gt;</title></head>
			<body><h1>Test & Special <chars></h1></body></html>
		`;
		const extraction = getExtraction(specialCharsHtml);
		const result = computePageScore(extraction);
		expect(result.scores.metadata).toBeGreaterThan(0);
	});

	it("handles unicode content", () => {
		const unicodeHtml = `
			<!DOCTYPE html>
			<html><head><title>日本語タイトル</title></head>
			<body><h1>Привет мир 你好世界</h1></body></html>
		`;
		const extraction = getExtraction(unicodeHtml);
		const result = computePageScore(extraction);
		expect(result.scores.metadata).toBeGreaterThan(0);
		expect(result.scores.headings).toBeGreaterThan(0);
	});
});
