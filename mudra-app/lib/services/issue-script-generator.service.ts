/**
 * Issue Script Generator Service
 *
 * Generates copy/paste-ready code snippets for issues so users can manually
 * inject fixes in platforms like Webflow/Framer without running the agent.
 */

type ScriptAgentType = "schema_markup" | "meta_optimization" | "faq_sections";

export interface ScriptGeneratorIssue {
	id: number;
	title: string;
	description: string | null;
	agentType: string | null;
	checkCode: string | null;
	affectedUrl: string | null;
}

export interface ScriptGeneratorBrandProfile {
	companyName: string | null;
	companyWebsite: string | null;
	companyDescription: string | null;
}

export interface ScriptGenerationResult {
	generatedOutput: string;
	outputType: "code" | "guidance";
}

const SUPPORTED_AGENT_TYPES = new Set<ScriptAgentType>([
	"schema_markup",
	"meta_optimization",
	"faq_sections",
]);

const KNOWN_SCHEMA_TYPES = new Set<string>([
	"Organization",
	"WebSite",
	"Product",
	"Service",
	"Article",
	"BlogPosting",
	"FAQPage",
	"BreadcrumbList",
	"HowTo",
	"SoftwareApplication",
	"CollectionPage",
	"WebApplication",
	"OfferCatalog",
	"VideoObject",
	"ItemList",
	"Review",
	"Person",
]);

function toTitleCase(value: string): string {
	return value
		.replace(/[-_]+/g, " ")
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
}

function getTargetUrl(
	issue: ScriptGeneratorIssue,
	brandProfile: ScriptGeneratorBrandProfile
): string {
	const raw = issue.affectedUrl || brandProfile.companyWebsite || "https://example.com/";
	try {
		return new URL(raw).toString();
	} catch {
		return raw.startsWith("http") ? raw : `https://${raw}`;
	}
}

function getSiteRoot(url: string): string {
	try {
		const parsed = new URL(url);
		return `${parsed.protocol}//${parsed.host}`;
	} catch {
		return "https://example.com";
	}
}

function getPageLabel(url: string): string {
	try {
		const parsed = new URL(url);
		const pathname = parsed.pathname.replace(/\/+$/, "");
		if (!pathname || pathname === "/") return "Homepage";
		const segments = pathname.split("/").filter(Boolean);
		return toTitleCase(segments[segments.length - 1] || "Page");
	} catch {
		return "Page";
	}
}

function getBrandName(
	brandProfile: ScriptGeneratorBrandProfile,
	targetUrl: string
): string {
	if (brandProfile.companyName?.trim()) return brandProfile.companyName.trim();
	try {
		const host = new URL(targetUrl).hostname.replace(/^www\./, "");
		const root = host.split(".")[0] || "Brand";
		return toTitleCase(root);
	} catch {
		return "Brand";
	}
}

function getDescription(
	brandProfile: ScriptGeneratorBrandProfile,
	pageLabel: string
): string {
	if (brandProfile.companyDescription?.trim()) return brandProfile.companyDescription.trim();
	return `${pageLabel} information and resources.`;
}

function splitSchemaCandidates(raw: string): string[] {
	return raw
		.split(/\+|,|\band\b/gi)
		.map((part) =>
			part
				.replace(/\b(schema|schemas|json-ld|markup|types?)\b/gi, "")
				.replace(/[().]/g, " ")
				.trim()
		)
		.filter(Boolean);
}

function parseSchemasFromText(text: string | null | undefined): string[] {
	if (!text) return [];
	const found = new Set<string>();
	const patterns = [
		/Recommended schemas?:\s*([^\n]+)/gi,
		/Recommended for this page:\s*([^\n]+)/gi,
		/Add:\s*([^\n]+)/gi,
		/Recommended:\s*([^\n]+)/gi,
	];

	for (const pattern of patterns) {
		const matches = text.matchAll(pattern);
		for (const match of matches) {
			const candidates = splitSchemaCandidates(match[1] || "");
			for (const candidate of candidates) {
				if (KNOWN_SCHEMA_TYPES.has(candidate)) found.add(candidate);
			}
		}
	}

	const explicitTitleMatch = text.match(/^Add\s+(.+)\s+Schema/i);
	if (explicitTitleMatch) {
		const candidates = splitSchemaCandidates(explicitTitleMatch[1] || "");
		for (const candidate of candidates) {
			if (KNOWN_SCHEMA_TYPES.has(candidate)) found.add(candidate);
		}
	}

	return Array.from(found);
}

function buildBreadcrumbList(pageUrl: string) {
	const siteRoot = getSiteRoot(pageUrl);
	try {
		const parsed = new URL(pageUrl);
		const segments = parsed.pathname.split("/").filter(Boolean);
		const items = [
			{
				"@type": "ListItem",
				position: 1,
				name: "Home",
				item: siteRoot,
			},
		];

		let acc = "";
		for (let i = 0; i < segments.length; i++) {
			acc += `/${segments[i]}`;
			items.push({
				"@type": "ListItem",
				position: i + 2,
				name: toTitleCase(decodeURIComponent(segments[i])),
				item: `${siteRoot}${acc}`,
			});
		}
		return items;
	} catch {
		return [
			{
				"@type": "ListItem",
				position: 1,
				name: "Home",
				item: siteRoot,
			},
		];
	}
}

/**
 * Parse extracted FAQ data from an issue description.
 * The scorer embeds `<!-- FAQ_DATA: [...] -->` when real FAQ content was extracted.
 */
function parseFaqDataFromDescription(desc: string | null | undefined): Array<{ question: string; answer: string }> {
	if (!desc) return [];
	const match = desc.match(/<!-- FAQ_DATA: (\[[\s\S]*?\]) -->/);
	if (!match) return [];
	try {
		const parsed = JSON.parse(match[1]);
		if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].question) {
			return parsed;
		}
	} catch { /* invalid JSON, ignore */ }
	return [];
}

/**
 * Extract the page type from an issue description.
 * The scorer embeds `<!-- PAGE_TYPE: ... -->` in FAQ_count issues.
 */
function parsePageTypeFromDescription(desc: string | null | undefined): string | null {
	if (!desc) return null;
	const match = desc.match(/<!-- PAGE_TYPE: (\S+) -->/);
	return match ? match[1] : null;
}

/**
 * Page-type-specific FAQ placeholder questions and answers.
 * Used when no real FAQ data is available in the issue description.
 */
const FAQ_PLACEHOLDERS: Record<string, Array<{ question: string; answer: string }>> = {
	home: [
		{ question: "What does [Company] do?", answer: "[Replace with your company's core value proposition from the homepage hero section.]" },
		{ question: "Who is [Product] built for?", answer: "[Replace with your target audience — reference the personas or industries mentioned on this page.]" },
		{ question: "How do I get started?", answer: "[Replace with your onboarding steps or CTA — reference the signup/demo flow on this page.]" },
	],
	pricing: [
		{ question: "How much does [Product] cost?", answer: "[Replace with your actual plan names and prices visible on this page.]" },
		{ question: "Is there a free trial or free plan?", answer: "[Replace with your free tier or trial details from this page.]" },
		{ question: "What's included in each plan?", answer: "[Replace with the key feature differences between your plans as shown on this page.]" },
	],
	features: [
		{ question: "What are the key features of [Product]?", answer: "[Replace with the top 3–4 features listed on this page.]" },
		{ question: "Does [Product] integrate with other tools?", answer: "[Replace with integration details if listed on this page.]" },
		{ question: "How does [Feature] work?", answer: "[Replace with the explanation of a specific feature from this page.]" },
	],
	product: [
		{ question: "What is [Product]?", answer: "[Replace with the product description from the headline and overview section.]" },
		{ question: "How does [Product] help with [Use Case]?", answer: "[Replace with the specific use case or benefit described on this page.]" },
		{ question: "What do I need to get started?", answer: "[Replace with requirements or next steps mentioned on this page.]" },
	],
	solutions: [
		{ question: "How does [Company] solve [Problem]?", answer: "[Replace with the solution overview from this page.]" },
		{ question: "What results can I expect?", answer: "[Replace with specific outcomes or metrics mentioned on this page.]" },
		{ question: "Who uses [Product] for this?", answer: "[Replace with customer types or industries mentioned on this page.]" },
	],
	blog: [
		{ question: "What is [Topic]?", answer: "[Replace with the article's definition or key concept.]" },
		{ question: "Why does [Topic] matter?", answer: "[Replace with the key insight or motivation from this article.]" },
		{ question: "What are the key takeaways?", answer: "[Replace with the main points or conclusions from this article.]" },
	],
	"use-cases": [
		{ question: "How does [Product] help with [Use Case]?", answer: "[Replace with the use case description from this page.]" },
		{ question: "What results have customers achieved?", answer: "[Replace with specific metrics or outcomes mentioned on this page.]" },
		{ question: "How do I get started with [Use Case]?", answer: "[Replace with the next steps or CTA from this page.]" },
	],
	customers: [
		{ question: "Who uses [Product]?", answer: "[Replace with the customer names, industries, or segments shown on this page.]" },
		{ question: "What results have customers achieved?", answer: "[Replace with specific metrics or outcomes mentioned on this page.]" },
		{ question: "Are there case studies available?", answer: "[Replace with case study references if mentioned on this page.]" },
	],
};

function buildSchemaObject(
	schemaType: string,
	targetUrl: string,
	brandName: string,
	description: string,
	pageLabel: string,
	faqItems?: Array<{ question: string; answer: string }>
): Record<string, unknown> {
	const siteRoot = getSiteRoot(targetUrl);

	switch (schemaType) {
		case "Organization":
			return {
				"@context": "https://schema.org",
				"@type": "Organization",
				name: brandName,
				url: siteRoot,
				description,
			};
		case "WebSite":
			return {
				"@context": "https://schema.org",
				"@type": "WebSite",
				name: brandName,
				url: siteRoot,
			};
		case "BreadcrumbList":
			return {
				"@context": "https://schema.org",
				"@type": "BreadcrumbList",
				itemListElement: buildBreadcrumbList(targetUrl),
			};
		case "FAQPage":
			if (faqItems && faqItems.length > 0) {
				return {
					"@context": "https://schema.org",
					"@type": "FAQPage",
					mainEntity: faqItems.map(faq => ({
						"@type": "Question",
						name: faq.question,
						acceptedAnswer: {
							"@type": "Answer",
							text: faq.answer,
						},
					})),
				};
			}
			// No real FAQ data available — generate a placeholder with clear instructions
			return {
				"@context": "https://schema.org",
				"@type": "FAQPage",
				"_comment": "Replace the questions and answers below with your actual FAQ content from the page.",
				mainEntity: [
					{
						"@type": "Question",
						name: "Replace with your first FAQ question",
						acceptedAnswer: {
							"@type": "Answer",
							text: "Replace with the answer visible on the page.",
						},
					},
				],
			};
		case "Product":
			return {
				"@context": "https://schema.org",
				"@type": "Product",
				name: `${brandName} ${pageLabel}`,
				description,
				image: `${siteRoot}/og-image.png`,
			};
		case "Service":
			return {
				"@context": "https://schema.org",
				"@type": "Service",
				name: `${brandName} ${pageLabel}`,
				description,
				provider: {
					"@type": "Organization",
					name: brandName,
					url: siteRoot,
				},
				url: targetUrl,
			};
		case "BlogPosting":
		case "Article":
			return {
				"@context": "https://schema.org",
				"@type": schemaType,
				headline: `${brandName} - ${pageLabel}`,
				description,
				mainEntityOfPage: targetUrl,
				author: {
					"@type": "Organization",
					name: brandName,
				},
			};
		case "OfferCatalog":
			return {
				"@context": "https://schema.org",
				"@type": "OfferCatalog",
				name: `${brandName} Plans`,
				itemListElement: [
					{
						"@type": "Offer",
						name: "Starter Plan",
					},
				],
			};
		case "ItemList":
			return {
				"@context": "https://schema.org",
				"@type": "ItemList",
				itemListElement: [
					{
						"@type": "ListItem",
						position: 1,
						name: `${brandName} ${pageLabel}`,
						url: targetUrl,
					},
				],
			};
		case "Review":
			return {
				"@context": "https://schema.org",
				"@type": "Review",
				author: {
					"@type": "Person",
					name: "Customer Name",
				},
				itemReviewed: {
					"@type": "Thing",
					name: `${brandName} ${pageLabel}`,
				},
				reviewRating: {
					"@type": "Rating",
					ratingValue: "5",
				},
			};
		case "VideoObject":
			return {
				"@context": "https://schema.org",
				"@type": "VideoObject",
				name: `${brandName} ${pageLabel} Video`,
				thumbnailUrl: `${siteRoot}/video-thumbnail.jpg`,
				uploadDate: "2026-01-01",
			};
		case "HowTo":
			return {
				"@context": "https://schema.org",
				"@type": "HowTo",
				name: `${pageLabel} Guide`,
				step: [
					{ "@type": "HowToStep", text: "Step 1" },
					{ "@type": "HowToStep", text: "Step 2" },
				],
			};
		case "Person":
			return {
				"@context": "https://schema.org",
				"@type": "Person",
				name: `${brandName} Author`,
				url: siteRoot,
			};
		case "SoftwareApplication":
		case "WebApplication":
			return {
				"@context": "https://schema.org",
				"@type": schemaType,
				name: `${brandName} ${pageLabel}`,
				description,
				url: targetUrl,
			};
		case "CollectionPage":
			return {
				"@context": "https://schema.org",
				"@type": "CollectionPage",
				name: `${brandName} ${pageLabel}`,
				url: targetUrl,
				description,
			};
		default:
			return {
				"@context": "https://schema.org",
				"@type": schemaType,
				name: `${brandName} ${pageLabel}`,
				url: targetUrl,
			};
	}
}

function buildSchemaScript(
	issue: ScriptGeneratorIssue,
	brandProfile: ScriptGeneratorBrandProfile
): ScriptGenerationResult {
	const targetUrl = getTargetUrl(issue, brandProfile);
	const pageLabel = getPageLabel(targetUrl);
	const brandName = getBrandName(brandProfile, targetUrl);
	const description = getDescription(brandProfile, pageLabel);

	const schemaTypes = new Set<string>([
		...parseSchemasFromText(issue.title),
		...parseSchemasFromText(issue.description),
	]);

	if (issue.checkCode === "FAQ_schema_gap") {
		schemaTypes.add("FAQPage");
	}
	if ((issue.checkCode === "J1_present" || issue.checkCode === "J4_coverage") && schemaTypes.size === 0) {
		const isHome = (() => {
			try {
				const parsed = new URL(targetUrl);
				return parsed.pathname === "/" || parsed.pathname === "";
			} catch {
				return false;
			}
		})();
		schemaTypes.add("Organization");
		schemaTypes.add(isHome ? "WebSite" : "BreadcrumbList");
	}

	// Final fallback when issue text does not contain schema names.
	if (schemaTypes.size === 0) {
		schemaTypes.add("Organization");
	}

	// Parse real FAQ data from the issue description (embedded by the scorer)
	const faqItems = parseFaqDataFromDescription(issue.description);

	const scriptBlocks = Array.from(schemaTypes)
		.filter((type) => KNOWN_SCHEMA_TYPES.has(type))
		.map((type) =>
			`<script type="application/ld+json">\n${JSON.stringify(
				buildSchemaObject(type, targetUrl, brandName, description, pageLabel, type === "FAQPage" ? faqItems : undefined),
				null,
				2
			)}\n</script>`
		);

	const header = [
		`<!-- Issue #${issue.id}: ${issue.title} -->`,
		"<!-- Paste this into the page <head> (Webflow/Framer custom code is fine). -->",
		`<!-- Target page: ${targetUrl} -->`,
	];

	return {
		generatedOutput: `${header.join("\n")}\n\n${scriptBlocks.join("\n\n")}`,
		outputType: "code",
	};
}

export function isScriptGenerationSupported(
	agentType: string | null | undefined
): boolean {
	if (!agentType) return false;
	return SUPPORTED_AGENT_TYPES.has(agentType as ScriptAgentType);
}

export function generateScriptForIssue(
	issue: ScriptGeneratorIssue,
	brandProfile: ScriptGeneratorBrandProfile
): ScriptGenerationResult {
	if (!isScriptGenerationSupported(issue.agentType)) {
		return {
			generatedOutput:
				"No direct injection snippet is available for this issue type. Use Fix to run the full agent workflow.",
			outputType: "guidance",
		};
	}

	if (issue.agentType === "meta_optimization") {
		return buildMetaScript(issue, brandProfile);
	}
	if (issue.agentType === "faq_sections") {
		return buildFaqScript(issue, brandProfile);
	}
	return buildSchemaScript(issue, brandProfile);
}

function buildMetaScript(
	issue: ScriptGeneratorIssue,
	brandProfile: ScriptGeneratorBrandProfile
): ScriptGenerationResult {
	const targetUrl = getTargetUrl(issue, brandProfile);
	const pageLabel = getPageLabel(targetUrl);
	const brandName = getBrandName(brandProfile, targetUrl);
	const description = getDescription(brandProfile, pageLabel);

	const tags: string[] = [];
	const check = issue.checkCode || "";

	if (check === "M1_title" || !check) {
		tags.push(`<title>${pageLabel} | ${brandName}</title>`);
	}
	if (check === "M2_description" || !check) {
		tags.push(`<meta name="description" content="${description}">`);
	}
	if (check === "M3_canonical" || !check) {
		tags.push(`<link rel="canonical" href="${targetUrl}">`);
	}
	if (check === "M4_opengraph" || !check) {
		tags.push(`<meta property="og:title" content="${pageLabel} | ${brandName}">`);
		tags.push(`<meta property="og:description" content="${description}">`);
		tags.push(`<meta property="og:url" content="${targetUrl}">`);
		tags.push(`<meta property="og:type" content="website">`);
	}
	if (check === "M5_twitter" || !check) {
		tags.push(`<meta name="twitter:card" content="summary_large_image">`);
		tags.push(`<meta name="twitter:title" content="${pageLabel} | ${brandName}">`);
		tags.push(`<meta name="twitter:description" content="${description}">`);
	}

	if (tags.length === 0) {
		tags.push(`<meta name="description" content="${description}">`);
	}

	return {
		generatedOutput: `<!-- Issue #${issue.id}: ${issue.title} -->\n<!-- Paste into <head> -->\n${tags.join("\n")}`,
		outputType: "code",
	};
}

function buildFaqScript(
	issue: ScriptGeneratorIssue,
	brandProfile: ScriptGeneratorBrandProfile
): ScriptGenerationResult {
	const targetUrl = getTargetUrl(issue, brandProfile);
	const pageLabel = getPageLabel(targetUrl);
	const brandName = getBrandName(brandProfile, targetUrl);
	const description = getDescription(brandProfile, pageLabel);

	// Use real FAQ data if available from the issue description
	const faqItems = parseFaqDataFromDescription(issue.description);

	let faqHtml: string;
	if (faqItems.length > 0) {
		const itemsHtml = faqItems.map(faq =>
			`  <div class="faq-item">\n    <h3>${escapeHtml(faq.question)}</h3>\n    <p>${escapeHtml(faq.answer)}</p>\n  </div>`
		).join("\n");
		faqHtml = `<section class="faq-section">\n  <h2>Frequently Asked Questions</h2>\n${itemsHtml}\n</section>`;
	} else {
		// Use page-type-specific placeholders when available
		const pageType = parsePageTypeFromDescription(issue.description);
		const placeholders = pageType ? FAQ_PLACEHOLDERS[pageType] : null;

		if (placeholders) {
			const itemsHtml = placeholders.map(faq =>
				`  <div class="faq-item">\n    <h3>${escapeHtml(faq.question)}</h3>\n    <p>${escapeHtml(faq.answer)}</p>\n  </div>`
			).join("\n");
			faqHtml = `<section class="faq-section">\n  <h2>Frequently Asked Questions</h2>\n  <!-- Replace the placeholder questions below with your actual FAQ content -->\n${itemsHtml}\n</section>`;
		} else {
			faqHtml = `<section class="faq-section">
  <h2>Frequently Asked Questions</h2>
  <!-- Replace these with your actual FAQ content -->
  <div class="faq-item">
    <h3>Your first question here?</h3>
    <p>Your answer here.</p>
  </div>
  <div class="faq-item">
    <h3>Your second question here?</h3>
    <p>Your answer here.</p>
  </div>
</section>`;
		}
	}

	const faqSchema = buildSchemaObject(
		"FAQPage",
		targetUrl,
		brandName,
		description,
		pageLabel,
		faqItems.length > 0 ? faqItems : undefined
	);

	return {
		generatedOutput: `<!-- Issue #${issue.id}: ${issue.title} -->
<!-- 1) Add this FAQ section where content should appear -->
${faqHtml}

<!-- 2) Add this JSON-LD in <head> -->
<script type="application/ld+json">
${JSON.stringify(faqSchema, null, 2)}
</script>`,
		outputType: "code",
	};
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
