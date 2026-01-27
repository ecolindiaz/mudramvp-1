import { describe, it, expect } from "vitest";
import { htmlToExtraction, detectPageType, extractors } from "../dom-extractor";

// ============================================================================
// TEST HTML SAMPLES
// ============================================================================

const MINIMAL_HTML = `<!DOCTYPE html><html><head></head><body></body></html>`;

const FULL_FEATURED_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Complete Guide to SEO in 2025 | Example Blog</title>
  <meta name="description" content="Learn everything about SEO with our comprehensive 2025 guide.">
  <link rel="canonical" href="https://example.com/blog/seo-guide">
  <meta property="og:title" content="Complete Guide to SEO in 2025">
  <meta property="og:description" content="Learn everything about SEO">
  <meta property="og:image" content="https://example.com/seo-guide.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Complete Guide to SEO in 2025">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Complete Guide to SEO in 2025",
    "datePublished": "2025-01-15"
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is SEO?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "SEO stands for Search Engine Optimization."
        }
      }
    ]
  }
  </script>
</head>
<body>
  <header>
    <nav>
      <a href="/">Home</a>
      <a href="/blog">Blog</a>
    </nav>
  </header>
  <main>
    <article>
      <h1>Complete Guide to SEO in 2025</h1>
      <section>
        <h2>What is SEO?</h2>
        <p>SEO stands for Search Engine Optimization. It's the practice of optimizing websites.</p>
        <h3>Technical SEO</h3>
        <p>Technical SEO involves optimizing your site's infrastructure.</p>
      </section>
      <section>
        <h2>Why SEO Matters</h2>
        <p>SEO helps your content reach more people organically.</p>
      </section>
      <details>
        <summary>How long does SEO take?</summary>
        <p>SEO typically takes 3-6 months to show results.</p>
      </details>
    </article>
  </main>
  <aside>
    <p>Related articles</p>
  </aside>
  <footer>
    <p>Copyright 2025</p>
  </footer>
</body>
</html>
`;

const MALFORMED_HTML = `
<html>
<head>
  <title>  Untrimmed Title  </title>
  <script type="application/ld+json">
  { invalid json here }
  </script>
</head>
<body>
  <h1>First H1</h1>
  <h1>Second H1</h1>
  <h4>Skipped to H4</h4>
  <div><div><div>Nested divs</div></div></div>
</body>
</html>
`;

const FAQ_PATTERN_HTML = `
<!DOCTYPE html>
<html>
<head><title>FAQ Page</title></head>
<body>
  <main>
    <h1>FAQ</h1>
    <p>Q: What is Mudra?</p>
    <p>A: Mudra is an AI visibility platform for B2B SaaS companies.</p>
    <p>Q: How does it work?</p>
    <p>A: Mudra optimizes your website structure for AI search engines.</p>
  </main>
</body>
</html>
`;

// ============================================================================
// PAGE TYPE DETECTION TESTS
// ============================================================================

describe("detectPageType", () => {
	it("detects home page from root URL", () => {
		expect(detectPageType("https://example.com/")).toBe("home");
		expect(detectPageType("https://example.com")).toBe("home");
	});

	it("detects pricing page", () => {
		expect(detectPageType("https://example.com/pricing")).toBe("pricing");
		expect(detectPageType("https://example.com/pricing/enterprise")).toBe("pricing");
	});

	it("detects features page", () => {
		expect(detectPageType("https://example.com/features")).toBe("features");
		expect(detectPageType("https://example.com/features/ai-analysis")).toBe("features");
	});

	it("detects product page", () => {
		expect(detectPageType("https://example.com/product")).toBe("product");
		expect(detectPageType("https://example.com/products/analytics")).toBe("product");
	});

	it("detects solutions page", () => {
		expect(detectPageType("https://example.com/solutions")).toBe("solutions");
		expect(detectPageType("https://example.com/solution/enterprise")).toBe("solutions");
	});

	it("detects blog pages", () => {
		expect(detectPageType("https://example.com/blog")).toBe("blog");
		expect(detectPageType("https://example.com/blog/seo-guide")).toBe("blog");
		expect(detectPageType("https://example.com/posts/article")).toBe("blog");
		expect(detectPageType("https://example.com/article/news")).toBe("blog");
	});

	it("detects about page", () => {
		expect(detectPageType("https://example.com/about")).toBe("about");
		expect(detectPageType("https://example.com/about-us")).toBe("about");
	});

	it("detects contact page", () => {
		expect(detectPageType("https://example.com/contact")).toBe("contact");
		expect(detectPageType("https://example.com/contact-us")).toBe("contact");
	});

	it("detects documentation page", () => {
		expect(detectPageType("https://example.com/docs")).toBe("documentation");
		expect(detectPageType("https://example.com/documentation")).toBe("documentation");
		expect(detectPageType("https://example.com/help/getting-started")).toBe("documentation");
	});

	it("returns other for unknown page types", () => {
		expect(detectPageType("https://example.com/careers")).toBe("other");
		expect(detectPageType("https://example.com/team")).toBe("other");
	});

	it("handles invalid URLs gracefully", () => {
		expect(detectPageType("not-a-url")).toBe("other");
		expect(detectPageType("")).toBe("other");
	});
});

// ============================================================================
// METADATA EXTRACTION TESTS
// ============================================================================

describe("Metadata Extraction", () => {
	it("extracts title correctly", () => {
		const result = htmlToExtraction(FULL_FEATURED_HTML, "https://example.com/blog/seo-guide");
		expect(result.extraction.metadata.title.present).toBe(true);
		expect(result.extraction.metadata.title.content).toBe("Complete Guide to SEO in 2025 | Example Blog");
		expect(result.extraction.metadata.title.length).toBe(44);
	});

	it("extracts meta description correctly", () => {
		const result = htmlToExtraction(FULL_FEATURED_HTML, "https://example.com/blog/seo-guide");
		expect(result.extraction.metadata.meta_description.present).toBe(true);
		expect(result.extraction.metadata.meta_description.content).toBe(
			"Learn everything about SEO with our comprehensive 2025 guide."
		);
	});

	it("extracts canonical URL correctly", () => {
		const result = htmlToExtraction(FULL_FEATURED_HTML, "https://example.com/blog/seo-guide");
		expect(result.extraction.metadata.canonical.present).toBe(true);
		expect(result.extraction.metadata.canonical.href).toBe("https://example.com/blog/seo-guide");
	});

	it("extracts Open Graph tags correctly", () => {
		const result = htmlToExtraction(FULL_FEATURED_HTML, "https://example.com/blog/seo-guide");
		expect(result.extraction.metadata.open_graph.present).toBe(true);
		expect(result.extraction.metadata.open_graph.count).toBe(3);
		expect(result.extraction.metadata.open_graph.tags.some((t) => t.property === "og:title")).toBe(true);
	});

	it("extracts Twitter Cards correctly", () => {
		const result = htmlToExtraction(FULL_FEATURED_HTML, "https://example.com/blog/seo-guide");
		expect(result.extraction.metadata.twitter_cards.present).toBe(true);
		expect(result.extraction.metadata.twitter_cards.count).toBe(2);
		expect(result.extraction.metadata.twitter_cards.tags.some((t) => t.name === "twitter:card")).toBe(true);
	});

	it("handles missing metadata gracefully", () => {
		const result = htmlToExtraction(MINIMAL_HTML, "https://example.com");
		expect(result.extraction.metadata.title.present).toBe(false);
		expect(result.extraction.metadata.meta_description.present).toBe(false);
		expect(result.extraction.metadata.canonical.present).toBe(false);
		expect(result.extraction.metadata.open_graph.present).toBe(false);
		expect(result.extraction.metadata.twitter_cards.present).toBe(false);
	});

	it("trims whitespace from title", () => {
		const result = htmlToExtraction(MALFORMED_HTML, "https://example.com");
		expect(result.extraction.metadata.title.content).toBe("Untrimmed Title");
	});
});

// ============================================================================
// HEADINGS EXTRACTION TESTS
// ============================================================================

describe("Headings Extraction", () => {
	it("extracts heading hierarchy correctly", () => {
		const result = htmlToExtraction(FULL_FEATURED_HTML, "https://example.com/blog/seo-guide");
		const { headings } = result.extraction;

		expect(headings.counts.h1).toBe(1);
		expect(headings.counts.h2).toBe(2);
		expect(headings.counts.h3).toBe(1);
		expect(headings.counts.total).toBe(4);
	});

	it("detects unique H1 correctly", () => {
		const result = htmlToExtraction(FULL_FEATURED_HTML, "https://example.com/blog/seo-guide");
		expect(result.extraction.headings.analysis.h1_is_unique).toBe(true);
	});

	it("detects multiple H1 tags", () => {
		const result = htmlToExtraction(MALFORMED_HTML, "https://example.com");
		expect(result.extraction.headings.counts.h1).toBe(2);
		expect(result.extraction.headings.analysis.h1_is_unique).toBe(false);
		expect(result.extraction.headings.analysis.violations).toContain("multiple_h1_tags");
	});

	it("detects skipped heading levels", () => {
		const result = htmlToExtraction(MALFORMED_HTML, "https://example.com");
		expect(result.extraction.headings.analysis.skipped_levels.length).toBeGreaterThan(0);
		expect(result.extraction.headings.analysis.violations).toContain("skipped_heading_levels");
	});

	it("records heading text and length", () => {
		const result = htmlToExtraction(FULL_FEATURED_HTML, "https://example.com/blog/seo-guide");
		const h1 = result.extraction.headings.hierarchy.find((h) => h.level === 1);
		expect(h1).toBeDefined();
		expect(h1?.text).toBe("Complete Guide to SEO in 2025");
		expect(h1?.text_length).toBe(29);
	});

	it("handles empty HTML gracefully", () => {
		const result = htmlToExtraction(MINIMAL_HTML, "https://example.com");
		expect(result.extraction.headings.counts.total).toBe(0);
		expect(result.extraction.headings.analysis.has_h1).toBe(false);
		expect(result.extraction.headings.analysis.violations).toContain("missing_h1");
	});
});

// ============================================================================
// SEMANTIC HTML EXTRACTION TESTS
// ============================================================================

describe("Semantic HTML Extraction", () => {
	it("extracts all semantic elements", () => {
		const result = htmlToExtraction(FULL_FEATURED_HTML, "https://example.com/blog/seo-guide");
		const { semantic_html } = result.extraction;

		expect(semantic_html.elements.main.count).toBe(1);
		expect(semantic_html.elements.article.count).toBe(1);
		expect(semantic_html.elements.section.count).toBe(2);
		expect(semantic_html.elements.nav.count).toBe(1);
		expect(semantic_html.elements.aside.count).toBe(1);
		expect(semantic_html.elements.header.count).toBe(1);
		expect(semantic_html.elements.footer.count).toBe(1);
	});

	it("calculates semantic element count correctly", () => {
		const result = htmlToExtraction(FULL_FEATURED_HTML, "https://example.com/blog/seo-guide");
		expect(result.extraction.semantic_html.semantic_element_count).toBe(8);
	});

	it("identifies div-heavy pages", () => {
		const divHeavyHtml = `
			<!DOCTYPE html>
			<html><body>
			${Array(60).fill("<div>content</div>").join("")}
			</body></html>
		`;
		const result = htmlToExtraction(divHeavyHtml, "https://example.com");
		expect(result.extraction.semantic_html.analysis.is_div_heavy).toBe(true);
	});

	it("analyzes semantic quality", () => {
		const result = htmlToExtraction(FULL_FEATURED_HTML, "https://example.com/blog/seo-guide");
		expect(["excellent", "good", "fair", "poor"]).toContain(
			result.extraction.semantic_html.analysis.semantic_quality
		);
	});

	it("handles minimal HTML without semantic elements", () => {
		const result = htmlToExtraction(MINIMAL_HTML, "https://example.com");
		expect(result.extraction.semantic_html.semantic_element_count).toBe(0);
		expect(result.extraction.semantic_html.analysis.has_main).toBe(false);
		expect(result.extraction.semantic_html.analysis.has_article).toBe(false);
	});
});

// ============================================================================
// SCHEMA / JSON-LD EXTRACTION TESTS
// ============================================================================

describe("Schema Extraction", () => {
	it("extracts valid JSON-LD blocks", () => {
		const result = htmlToExtraction(FULL_FEATURED_HTML, "https://example.com/blog/seo-guide");
		expect(result.extraction.schema.jsonld_blocks.length).toBe(2);
		expect(result.extraction.schema.has_schema).toBe(true);
	});

	it("identifies schema types correctly", () => {
		const result = htmlToExtraction(FULL_FEATURED_HTML, "https://example.com/blog/seo-guide");
		expect(result.extraction.schema.schema_types).toContain("Article");
		expect(result.extraction.schema.schema_types).toContain("FAQPage");
	});

	it("marks valid blocks with @context and @type", () => {
		const result = htmlToExtraction(FULL_FEATURED_HTML, "https://example.com/blog/seo-guide");
		const validBlocks = result.extraction.schema.jsonld_blocks.filter((b) => b.valid);
		expect(validBlocks.length).toBe(2);
	});

	it("handles malformed JSON-LD gracefully", () => {
		const result = htmlToExtraction(MALFORMED_HTML, "https://example.com");
		expect(result.extraction.schema.jsonld_blocks.length).toBe(1);
		expect(result.extraction.schema.jsonld_blocks[0].valid).toBe(false);
		expect(result.extraction.schema.jsonld_blocks[0].type).toBe("Invalid");
	});

	it("analyzes schema types for AEO relevance", () => {
		const result = htmlToExtraction(FULL_FEATURED_HTML, "https://example.com/blog/seo-guide");
		const { analysis } = result.extraction.schema;
		expect(analysis.has_article_schema).toBe(true);
		expect(analysis.has_faq_schema).toBe(true);
		expect(analysis.has_product_schema).toBe(false);
	});

	it("handles empty HTML without schemas", () => {
		const result = htmlToExtraction(MINIMAL_HTML, "https://example.com");
		expect(result.extraction.schema.has_schema).toBe(false);
		expect(result.extraction.schema.schema_count).toBe(0);
	});
});

// ============================================================================
// FAQ EXTRACTION TESTS
// ============================================================================

describe("FAQ Extraction", () => {
	it("extracts FAQs from JSON-LD FAQPage schema", () => {
		const result = htmlToExtraction(FULL_FEATURED_HTML, "https://example.com/blog/seo-guide");
		const jsonldFaqs = result.extraction.faqs.sources.jsonld_faq_schema.faqs;
		expect(jsonldFaqs.length).toBe(1);
		expect(jsonldFaqs[0].question).toBe("What is SEO?");
		expect(jsonldFaqs[0].source).toBe("jsonld");
	});

	it("extracts FAQs from details/summary elements", () => {
		const result = htmlToExtraction(FULL_FEATURED_HTML, "https://example.com/blog/seo-guide");
		const detailsFaqs = result.extraction.faqs.sources.details_summary_elements.faqs;
		expect(detailsFaqs.length).toBe(1);
		expect(detailsFaqs[0].question).toBe("How long does SEO take?");
		expect(detailsFaqs[0].source).toBe("details_summary");
	});

	it("extracts FAQs from Q:/A: patterns", () => {
		const result = htmlToExtraction(FAQ_PATTERN_HTML, "https://example.com/faq");
		const patternFaqs = result.extraction.faqs.sources.pattern_matching.faqs;
		expect(patternFaqs.length).toBeGreaterThan(0);
		expect(patternFaqs[0].source).toBe("pattern");
	});

	it("deduplicates FAQs across sources", () => {
		const result = htmlToExtraction(FULL_FEATURED_HTML, "https://example.com/blog/seo-guide");
		const combined = result.extraction.faqs.combined_faqs;
		const questions = combined.map((f) => f.question);
		const uniqueQuestions = new Set(questions);
		expect(questions.length).toBe(uniqueQuestions.size);
	});

	it("detects schema gap (content without schema)", () => {
		const htmlWithContentNoSchema = `
			<!DOCTYPE html>
			<html><head><title>FAQ</title></head>
			<body>
				<details><summary>Question 1?</summary>Answer 1</details>
			</body>
			</html>
		`;
		const result = htmlToExtraction(htmlWithContentNoSchema, "https://example.com/faq");
		expect(result.extraction.faqs.analysis.schema_gap).toBe(true);
		expect(result.extraction.faqs.has_faq_content).toBe(true);
		expect(result.extraction.faqs.has_faq_schema).toBe(false);
	});

	it("handles pages with no FAQs", () => {
		const result = htmlToExtraction(MINIMAL_HTML, "https://example.com");
		expect(result.extraction.faqs.total_faq_count).toBe(0);
		expect(result.extraction.faqs.has_faq_content).toBe(false);
	});
});

// ============================================================================
// CONTENT SNAPSHOT TESTS
// ============================================================================

describe("Content Snapshot Extraction", () => {
	it("counts words correctly", () => {
		const result = htmlToExtraction(FULL_FEATURED_HTML, "https://example.com/blog/seo-guide");
		expect(result.extraction.content_snapshot.word_count).toBeGreaterThan(0);
	});

	it("counts paragraphs correctly", () => {
		const result = htmlToExtraction(FULL_FEATURED_HTML, "https://example.com/blog/seo-guide");
		expect(result.extraction.content_snapshot.paragraph_count).toBeGreaterThan(0);
	});

	it("distinguishes internal and external links", () => {
		const htmlWithLinks = `
			<!DOCTYPE html>
			<html><body>
				<a href="/">Home</a>
				<a href="/about">About</a>
				<a href="https://example.com/contact">Contact</a>
				<a href="https://external.com">External</a>
			</body></html>
		`;
		const result = htmlToExtraction(htmlWithLinks, "https://example.com");
		expect(result.extraction.content_snapshot.link_count.internal).toBe(3);
		expect(result.extraction.content_snapshot.link_count.external).toBe(1);
	});

	it("counts images", () => {
		const htmlWithImages = `
			<!DOCTYPE html>
			<html><body>
				<img src="1.jpg">
				<img src="2.jpg">
			</body></html>
		`;
		const result = htmlToExtraction(htmlWithImages, "https://example.com");
		expect(result.extraction.content_snapshot.image_count).toBe(2);
	});
});

// ============================================================================
// MAIN EXTRACTION FUNCTION TESTS
// ============================================================================

describe("htmlToExtraction", () => {
	it("returns correct page URL", () => {
		const result = htmlToExtraction(FULL_FEATURED_HTML, "https://example.com/blog/seo-guide");
		expect(result.page_url).toBe("https://example.com/blog/seo-guide");
	});

	it("detects page type correctly", () => {
		const result = htmlToExtraction(FULL_FEATURED_HTML, "https://example.com/blog/seo-guide");
		expect(result.page_type).toBe("blog");
	});

	it("generates crawled_at timestamp", () => {
		const result = htmlToExtraction(FULL_FEATURED_HTML, "https://example.com/blog/seo-guide");
		expect(result.crawled_at).toBeDefined();
		expect(new Date(result.crawled_at).getTime()).toBeLessThanOrEqual(Date.now());
	});

	it("calculates HTML hash", () => {
		const result = htmlToExtraction(FULL_FEATURED_HTML, "https://example.com/blog/seo-guide");
		expect(result.raw_html_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
	});

	it("calculates HTML size in bytes", () => {
		const result = htmlToExtraction(FULL_FEATURED_HTML, "https://example.com/blog/seo-guide");
		expect(result.html_size_bytes).toBeGreaterThan(0);
	});

	it("produces deterministic output for same input", () => {
		const html = "<html><body><h1>Test</h1></body></html>";
		const result1 = htmlToExtraction(html, "https://example.com");
		const result2 = htmlToExtraction(html, "https://example.com");

		// Hash should be the same
		expect(result1.raw_html_hash).toBe(result2.raw_html_hash);
		// Extraction data should be the same (excluding timestamp)
		expect(result1.extraction).toEqual(result2.extraction);
	});
});
