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

function buildSchemaObject(
	schemaType: string,
	targetUrl: string,
	brandName: string,
	description: string,
	pageLabel: string
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
			return {
				"@context": "https://schema.org",
				"@type": "FAQPage",
				mainEntity: [
					{
						"@type": "Question",
						name: `What is ${brandName}?`,
						acceptedAnswer: {
							"@type": "Answer",
							text: description,
						},
					},
					{
						"@type": "Question",
						name: `How does ${brandName} help with ${pageLabel.toLowerCase()}?`,
						acceptedAnswer: {
							"@type": "Answer",
							text: "Update this answer to match the visible FAQ content on the page.",
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

	const scriptBlocks = Array.from(schemaTypes)
		.filter((type) => KNOWN_SCHEMA_TYPES.has(type))
		.map((type) =>
			`<script type="application/ld+json">\n${JSON.stringify(
				buildSchemaObject(type, targetUrl, brandName, description, pageLabel),
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

	const faqHtml = `<section class="faq-section">
  <h2>Frequently Asked Questions</h2>
  <div class="faq-item">
    <h3>What is ${brandName}?</h3>
    <p>${description}</p>
  </div>
  <div class="faq-item">
    <h3>How does ${brandName} help with ${pageLabel.toLowerCase()}?</h3>
    <p>Replace this answer with your real on-page FAQ answer.</p>
  </div>
</section>`;

	const faqSchema = buildSchemaObject(
		"FAQPage",
		targetUrl,
		brandName,
		description,
		pageLabel
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
