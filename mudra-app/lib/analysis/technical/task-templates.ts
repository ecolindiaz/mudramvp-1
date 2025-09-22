import type { ScrapeSnapshot, TaskTemplate, EvidenceRef } from "@/lib/analysis/technical/types";

function domainOf(url: string): string {
	try { return new URL(url).host; } catch { return url; }
}

export const TASK_TEMPLATES: TaskTemplate[] = [
	{
		key: "add_robots_txt",
		category: "SEO",
		title: (s: ScrapeSnapshot) => `Add robots.txt for ${domainOf(s.url)}`,
		impact: "Medium",
		preconditions: (s: ScrapeSnapshot) => !Boolean(s.txtFiles?.summary?.hasRobotsTxt),
		generateInputs: (s: ScrapeSnapshot) => ({
			url: s.url,
			robotsUrl: s.txtFiles?.robots?.url ?? `${new URL(s.url).origin}/robots.txt`,
		}),
		verificationCheck: {
			key: "robots_txt_exists",
			description: "robots.txt accessible (HTTP 200) at /robots.txt",
			predicate: (s: ScrapeSnapshot) => Boolean(s.txtFiles?.summary?.hasRobotsTxt),
		},
		kbTopics: ["robots.txt", "search engine crawling basics"],
	},
	{
		key: "add_llms_txt",
		category: "GEO",
		title: (s: ScrapeSnapshot) => `Add llms.txt to guide AI crawlers for ${domainOf(s.url)}`,
		impact: "High",
		preconditions: (s: ScrapeSnapshot) => !Boolean(s.txtFiles?.summary?.hasLlmsTxt),
		generateInputs: (s: ScrapeSnapshot) => ({
			url: s.url,
			llmsUrl: s.txtFiles?.llms?.url ?? `${new URL(s.url).origin}/llms.txt`,
		}),
		verificationCheck: {
			key: "llms_txt_exists",
			description: "llms.txt accessible (HTTP 200) at /llms.txt",
			predicate: (s: ScrapeSnapshot) => Boolean(s.txtFiles?.summary?.hasLlmsTxt),
		},
		kbTopics: ["llms.txt", "AI crawler allowlisting"],
	},
	{
		key: "add_llms_full_txt",
		category: "GEO",
		title: (s: ScrapeSnapshot) => `Add llms-full.txt with detailed guidance for ${domainOf(s.url)}`,
		impact: "Low",
		preconditions: (s: ScrapeSnapshot) => !Boolean(s.txtFiles?.summary?.hasLlmsFullTxt),
		generateInputs: (s: ScrapeSnapshot) => ({
			url: s.url,
			llmsFullUrl: s.txtFiles?.llmsFull?.url ?? `${new URL(s.url).origin}/llms-full.txt`,
		}),
		verificationCheck: {
			key: "llms_full_txt_exists",
			description: "llms-full.txt accessible (HTTP 200) at /llms-full.txt",
			predicate: (s: ScrapeSnapshot) => Boolean(s.txtFiles?.summary?.hasLlmsFullTxt),
		},
		kbTopics: ["llms-full.txt", "llms.txt", "AI crawler allowlisting"],
	},
	{
		key: "add_meta_description",
		category: "SEO",
		title: (s: ScrapeSnapshot) => `Write a targeted meta description for ${domainOf(s.url)}`,
		impact: "Low",
		preconditions: (s: ScrapeSnapshot) => !s.metadata?.description,
		generateInputs: (s: ScrapeSnapshot) => ({
			title: s.metadata?.title,
			h1s: s.htmlStructure?.headings?.h1 ?? [],
			url: s.url,
		}),
		verificationCheck: {
			key: "meta_description_present",
			description: "Meta description present in HTML head",
			predicate: (s: ScrapeSnapshot) => Boolean(s.metadata?.description),
		},
		kbTopics: ["meta description", "SERP snippets"],
	},
	{
		key: "add_h1",
		category: "SEO",
		title: (s: ScrapeSnapshot) => `Add an H1 that matches search intent for ${domainOf(s.url)}`,
		impact: "Medium",
		preconditions: (s: ScrapeSnapshot) => (s.htmlStructure?.headings?.h1 ?? []).length === 0,
		generateInputs: (s: ScrapeSnapshot) => ({
			currentH2s: s.htmlStructure?.headings?.h2 ?? [],
			url: s.url,
		}),
		verificationCheck: {
			key: "h1_present",
			description: "At least one H1 exists on the page",
			predicate: (s: ScrapeSnapshot) => (s.htmlStructure?.headings?.h1 ?? []).length > 0,
		},
		kbTopics: ["headings", "information architecture"],
	},
	// New: Ensure H2 sections exist when H1 exists
	{
		key: "add_h2_sections",
		category: "SEO",
		title: (s: ScrapeSnapshot) => `Add H2 sections to organize content for ${domainOf(s.url)}`,
		impact: "Medium",
		preconditions: (s: ScrapeSnapshot) => (s.htmlStructure?.headings?.h1 ?? []).length > 0 && (s.htmlStructure?.headings?.h2 ?? []).length === 0,
		generateInputs: (s: ScrapeSnapshot) => ({
			h1s: s.htmlStructure?.headings?.h1 ?? [],
			currentH3s: s.htmlStructure?.headings?.h3 ?? [],
			url: s.url,
		}),
		verificationCheck: {
			key: "h2_present",
			description: "At least one H2 exists to section the content",
			predicate: (s: ScrapeSnapshot) => (s.htmlStructure?.headings?.h2 ?? []).length > 0,
		},
		kbTopics: ["H2 best practices", "headings", "information architecture", "semantic HTML"],
	},
	// New: Add H3 subsections when many H2s exist but no H3s
	{
		key: "add_h3_subsections",
		category: "SEO",
		title: (s: ScrapeSnapshot) => `Add H3 subsections under H2s for ${domainOf(s.url)}`,
		impact: "Low",
		preconditions: (s: ScrapeSnapshot) => (s.htmlStructure?.headings?.h2 ?? []).length >= 3 && (s.htmlStructure?.headings?.h3 ?? []).length === 0,
		generateInputs: (s: ScrapeSnapshot) => ({
			currentH2s: s.htmlStructure?.headings?.h2 ?? [],
			url: s.url,
		}),
		verificationCheck: {
			key: "h3_present",
			description: "H3 subsections exist beneath H2 sections where appropriate",
			predicate: (s: ScrapeSnapshot) => (s.htmlStructure?.headings?.h3 ?? []).length > 0,
		},
		kbTopics: ["H3 best practices", "headings", "information architecture", "semantic HTML"],
	},
	{
		key: "add_jsonld_basic",
		category: "SEO",
		title: (s: ScrapeSnapshot) => `Add basic JSON-LD (Organization/WebSite) for ${domainOf(s.url)}`,
		impact: "Medium",
		preconditions: (s: ScrapeSnapshot) => (s.schema?.summary?.jsonLdCount ?? 0) === 0,
		generateInputs: (s: ScrapeSnapshot) => ({
			url: s.url,
			domain: domainOf(s.url),
			h1: s.htmlStructure?.headings?.h1?.[0],
			description: s.metadata?.description,
		}),
		verificationCheck: {
			key: "jsonld_any_present",
			description: "At least one JSON-LD block present",
			predicate: (s: ScrapeSnapshot) => (s.schema?.summary?.jsonLdCount ?? 0) > 0,
		},
		kbTopics: ["JSON-LD", "Organization schema", "Website schema"],
	},
	{
		key: "add_faq_schema",
		category: "SEO",
		title: (s: ScrapeSnapshot) => `Add FAQPage schema (JSON-LD) for ${domainOf(s.url)}`,
		impact: "Medium",
		preconditions: (s: ScrapeSnapshot) => (s.schema?.summary?.faqSchemaCount ?? 0) === 0 && (s.faqs?.summary?.totalUnique ?? 0) > 0,
		generateInputs: (s: ScrapeSnapshot) => ({
			faqs: s.faqs?.merged?.slice(0, 10) ?? [],
			url: s.url,
		}),
		verificationCheck: {
			key: "faq_schema_present",
			description: "FAQPage schema present in JSON-LD",
			predicate: (s: ScrapeSnapshot) => (s.schema?.summary?.faqSchemaCount ?? 0) > 0,
		},
		kbTopics: ["JSON-LD", "FAQ schema"],
	},
	{
		key: "add_faq_content",
		category: "Content",
		title: (s: ScrapeSnapshot) => `Add at least 3 high-quality FAQs for ${domainOf(s.url)}`,
		impact: "Medium",
		preconditions: (s: ScrapeSnapshot) => (s.faqs?.summary?.totalUnique ?? 0) === 0,
		generateInputs: (s: ScrapeSnapshot) => ({ url: s.url }),
		verificationCheck: {
			key: "faq_content_present",
			description: "At least one FAQ detected on the page",
			predicate: (s: ScrapeSnapshot) => (s.faqs?.summary?.totalUnique ?? 0) > 0,
		},
		kbTopics: ["content quality", "FAQs"],
	},
	{
		key: "improve_heading_structure",
		category: "SEO",
		title: (s: ScrapeSnapshot) => `Fix heading hierarchy for ${domainOf(s.url)}`,
		impact: "Low",
		preconditions: (s: ScrapeSnapshot) => s.htmlStructure?.hasProperStructure === false,
		generateInputs: (s: ScrapeSnapshot) => ({
			headings: s.htmlStructure?.headings ?? {},
			url: s.url,
		}),
		verificationCheck: {
			key: "heading_structure_sane",
			description: "Heading structure appears sane (H1 present, basic hierarchy)",
			predicate: (s: ScrapeSnapshot) => Boolean(s.htmlStructure?.hasProperStructure),
		},
		kbTopics: ["headings", "information architecture"],
	},
	// New: Detect heading level skips (e.g., H3 without any H2)
	{
		key: "avoid_heading_level_skips",
		category: "SEO",
		title: (s: ScrapeSnapshot) => `Fix skipped heading levels on ${domainOf(s.url)}`,
		impact: "Low",
		preconditions: (s: ScrapeSnapshot) => {
			const h = s.htmlStructure?.headings ?? {} as any;
			const len = (k: string) => Array.isArray(h?.[k]) ? h[k].length : 0;
			return (len("h3") > 0 && len("h2") === 0) || (len("h4") > 0 && len("h3") === 0) || (len("h5") > 0 && len("h4") === 0) || (len("h6") > 0 && len("h5") === 0);
		},
		generateInputs: (s: ScrapeSnapshot) => ({
			headings: s.htmlStructure?.headings ?? {},
			url: s.url,
		}),
		verificationCheck: {
			key: "no_heading_level_skips",
			description: "No skipped heading levels (e.g., H3 appears only when H2 exists)",
			predicate: (s: ScrapeSnapshot) => {
				const h = s.htmlStructure?.headings ?? {} as any;
				const len = (k: string) => Array.isArray(h?.[k]) ? h[k].length : 0;
				const hasSkip = (len("h3") > 0 && len("h2") === 0) || (len("h4") > 0 && len("h3") === 0) || (len("h5") > 0 && len("h4") === 0) || (len("h6") > 0 && len("h5") === 0);
				return !hasSkip;
			},
		},
		kbTopics: ["SEO heading tags", "semantic HTML", "accessibility", "information architecture"],
	},
	{
		key: "add_favicon",
		category: "SEO",
		title: (s: ScrapeSnapshot) => `Add a favicon for ${domainOf(s.url)}`,
		impact: "Low",
		preconditions: (s: ScrapeSnapshot) => !s.metadata?.favicon,
		generateInputs: (s: ScrapeSnapshot) => ({ url: s.url }),
		verificationCheck: {
			key: "favicon_present",
			description: "Favicon present and referenced in <head>",
			predicate: (s: ScrapeSnapshot) => Boolean(s.metadata?.favicon),
		},
		kbTopics: ["favicon", "meta basics"],
	},
];

export function deriveEvidenceForTemplate(templateKey: string, s: ScrapeSnapshot): EvidenceRef[] {
	switch (templateKey) {
		case "add_robots_txt":
			return [
				{ path: "txtFiles.summary.hasRobotsTxt", value: s.txtFiles?.summary?.hasRobotsTxt },
				{ path: "txtFiles.robots.url", value: s.txtFiles?.robots?.url },
			];
		case "add_llms_txt":
			return [
				{ path: "txtFiles.summary.hasLlmsTxt", value: s.txtFiles?.summary?.hasLlmsTxt },
				{ path: "txtFiles.llms.url", value: s.txtFiles?.llms?.url },
			];
		case "add_llms_full_txt":
			return [
				{ path: "txtFiles.summary.hasLlmsFullTxt", value: s.txtFiles?.summary?.hasLlmsFullTxt },
				{ path: "txtFiles.llmsFull.url", value: s.txtFiles?.llmsFull?.url },
			];
		case "add_meta_description":
			return [
				{ path: "metadata.description", value: s.metadata?.description },
				{ path: "metadata.title", value: s.metadata?.title },
			];
		case "add_h1":
			return [
				{ path: "htmlStructure.headings.h1", value: s.htmlStructure?.headings?.h1 ?? [] },
				{ path: "htmlStructure.hasProperStructure", value: s.htmlStructure?.hasProperStructure },
			];
		case "add_jsonld_basic":
			return [
				{ path: "schema.summary.jsonLdCount", value: s.schema?.summary?.jsonLdCount },
				{ path: "metadata.title", value: s.metadata?.title },
				{ path: "metadata.description", value: s.metadata?.description },
			];
		case "add_faq_schema":
			return [
				{ path: "schema.summary.faqSchemaCount", value: s.schema?.summary?.faqSchemaCount },
				{ path: "faqs.summary.totalUnique", value: s.faqs?.summary?.totalUnique },
				{ path: "faqs.merged.length", value: Array.isArray(s.faqs?.merged) ? s.faqs.merged.length : 0 },
			];
		case "add_faq_content":
			return [
				{ path: "faqs.summary.totalUnique", value: s.faqs?.summary?.totalUnique },
			];
		case "improve_heading_structure":
			return [
				{ path: "htmlStructure.hasProperStructure", value: s.htmlStructure?.hasProperStructure },
				{ path: "htmlStructure.headings.h1", value: s.htmlStructure?.headings?.h1 ?? [] },
			];
		case "add_h2_sections":
			return [
				{ path: "htmlStructure.headings.h1", value: s.htmlStructure?.headings?.h1 ?? [] },
				{ path: "htmlStructure.headings.h2", value: s.htmlStructure?.headings?.h2 ?? [] },
			];
		case "add_h3_subsections":
			return [
				{ path: "htmlStructure.headings.h2", value: s.htmlStructure?.headings?.h2 ?? [] },
				{ path: "htmlStructure.headings.h3", value: s.htmlStructure?.headings?.h3 ?? [] },
			];
		case "avoid_heading_level_skips":
			return [
				{ path: "htmlStructure.headings.h2", value: s.htmlStructure?.headings?.h2 ?? [] },
				{ path: "htmlStructure.headings.h3", value: s.htmlStructure?.headings?.h3 ?? [] },
				{ path: "htmlStructure.headings.h4", value: s.htmlStructure?.headings?.h4 ?? [] },
				{ path: "htmlStructure.headings.h5", value: s.htmlStructure?.headings?.h5 ?? [] },
				{ path: "htmlStructure.headings.h6", value: s.htmlStructure?.headings?.h6 ?? [] },
			];
		case "add_favicon":
			return [
				{ path: "metadata.favicon", value: s.metadata?.favicon },
			];
		default:
			return [];
	}
}

export function baselineStepsForTemplate(templateKey: string, s: ScrapeSnapshot): string[] {
	const origin = (() => { try { return new URL(s.url).origin; } catch { return s.url; } })();
	switch (templateKey) {
		case "add_robots_txt":
				return [
					`Create ${origin}/robots.txt with basic allow rules.`,
					"Add two lines: 'User-agent: *' and 'Allow: /'.",
					"Upload to the site root (deploy).",
					`Verify: open ${origin}/robots.txt → HTTP 200 and both lines visible. Acceptance: directives match exactly.`,
				];
		case "add_llms_txt":
				return [
					`Create ${origin}/llms.txt with an allowlist for AI crawlers.`,
					"List 3–5 key URLs (home, features, pricing, docs) and an optional contact line.",
					"Upload to the site root (deploy).",
					`Verify: open ${origin}/llms.txt → HTTP 200; at least 3 URLs present. Acceptance: file readable without auth.`,
				];
		case "add_llms_full_txt":
				return [
					`Create ${origin}/llms-full.txt with crawl guidance.`,
					"Add priorities, revisit cadence, rate limits, and link sitemap.xml/key docs.",
					"Upload to the site root (deploy).",
					`Verify: open ${origin}/llms-full.txt → HTTP 200; guidance present. Acceptance: references sitemap or 3+ key sections.`,
				];
		case "add_meta_description":
			return [
				"Write a 140–160 character plain-language summary of the page's value.",
				"Add <meta name=\"description\" content=\"...\"> inside <head>.",
				"Avoid keyword stuffing; keep it readable.",
				`Verify: view-source → <meta name=\"description\"> present with your text. Acceptance: tag exists, length ~140–160 chars.`,
			];
		case "add_h1":
				return [
					"Write a clear H1 that matches page intent (one per page).",
					"Place it near the top; demote any extra H1s to H2/H3.",
					"Publish the change.",
					"Verify: DevTools shows exactly one <h1>. Acceptance: 1 visible H1.",
				];
		case "add_jsonld_basic":
				return [
					"Add Organization JSON-LD with name, url, logo.",
					"Add Website JSON-LD with url (and optional potentialAction).",
					"Embed in <head> via <script type=\"application/ld+json\"> and publish.",
					"Verify: Rich Results Test shows both with 0 errors. Acceptance: Organization and Website valid.",
				];
		case "add_faq_schema":
				return [
					"Pick 3–5 Q&As already on the page.",
					"Create FAQPage JSON‑LD (Question + acceptedAnswer) and add to <head>.",
					"Publish the change.",
					"Verify: Rich Results Test detects FAQPage with 0 errors. Acceptance: all pairs found.",
				];
		case "add_faq_content":
				return [
					"Draft 3–5 concise FAQs (1–3 sentence answers).",
					"Add a visible FAQ block on the page (not hidden tabs).",
					"Avoid duplicates; cover objections and basics; publish.",
					"Verify: DOM shows ≥3 unique Q&A. Acceptance: at least 3 visible Q&A.",
				];
		case "improve_heading_structure":
				return [
					"Keep one H1; demote extras to H2/H3.",
					"Use H2 for sections and H3 under H2 (no skips).",
					"Replace style-only headings with CSS; publish.",
					"Verify: DOM outline is H1 > H2 > H3. Acceptance: 1 H1, no skips.",
				];
		case "add_h2_sections":
				return [
					"List 2–4 main sections that support the H1.",
					"Add clear H2 headings for each section; keep wording natural.",
					"Publish the change.",
					"Verify: DOM shows ≥1 H2. Acceptance: at least one relevant H2.",
				];
		case "add_h3_subsections":
				return [
					"Under long H2 sections, add H3s for each subtopic.",
					"Place H3s only under an H2; keep labels short.",
					"Publish the change.",
					"Verify: H3s nest under the correct H2. Acceptance: ≥1 H3 under a long H2.",
				];
		case "avoid_heading_level_skips":
				return [
					"Find skips (e.g., H3 with no earlier H2).",
					"Add the missing parent level (e.g., add an H2 before H3).",
					"Replace style-only heading tags with CSS; publish.",
					"Verify: DOM outline shows no skips. Acceptance: each Hx has H(x-1).",
				];
		case "add_favicon":
				return [
					"Create a 32×32 or 48×48 favicon (PNG/ICO).",
					"Upload to /favicon.ico and reference in <head>.",
					"Publish the change.",
					"Verify: open site; favicon appears (no 404). Acceptance: icon visible.",
				];
		default:
			return ["Implement the change and verify it is live (state a simple verification and acceptance criteria)."];
	}
}


