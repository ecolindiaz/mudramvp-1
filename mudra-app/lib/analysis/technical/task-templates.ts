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
			];
		case "add_faq_schema":
			return [
				{ path: "schema.summary.faqSchemaCount", value: s.schema?.summary?.faqSchemaCount },
				{ path: "faqs.summary.totalUnique", value: s.faqs?.summary?.totalUnique },
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
				`Create a plain text file at ${origin}/robots.txt`,
				"Add line: User-agent: *",
				"Add line: Allow: /",
				"Deploy and ensure /robots.txt returns HTTP 200",
				"Open /robots.txt in a browser to confirm contents",
			];
		case "add_llms_txt":
			return [
				`Create ${origin}/llms.txt`,
				"List allowed AI crawlers and recommended sections to crawl",
				"Include links to key pages (home, features, pricing, docs)",
				"Deploy and ensure /llms.txt returns HTTP 200",
				"Verify file is readable without auth",
			];
		case "add_llms_full_txt":
			return [
				`Create ${origin}/llms-full.txt`,
				"Provide detailed guidance (section priorities, rate limits, update cadence)",
				"Reference sitemap if available",
				"Deploy and ensure /llms-full.txt returns HTTP 200",
				"Sanity-check content for accuracy and links",
			];
		case "add_meta_description":
			return [
				"Add <meta name=\"description\" content=\"...\"> inside <head>",
				"Keep to ~140–160 characters reflecting the core value prop",
				"Avoid keyword stuffing; use natural language",
				"Deploy and view page source to confirm the tag",
			];
		case "add_h1":
			return [
				"Add a single descriptive <h1> near the top of the page",
				"Align H1 with search intent and page title",
				"Ensure only one H1 exists (use H2/H3 for sub-sections)",
				"Deploy and verify H1 renders in the DOM",
			];
		case "add_jsonld_basic":
			return [
				"Create JSON-LD for Organization and WebSite",
				"Embed <script type=\"application/ld+json\"> in <head>",
				"Include name, url, and description; validate with Rich Results Test",
				"Deploy and confirm at least one JSON-LD block is present",
			];
		case "add_faq_schema":
			return [
				"Select 3–5 on-page Q&A pairs users actually ask",
				"Add FAQPage JSON-LD with Question/acceptedAnswer structure",
				"Validate with Structured Data Testing Tool",
				"Deploy and confirm FAQPage schema detected",
			];
		case "add_faq_content":
			return [
				"Draft 3–5 concise FAQs (1–3 sentence answers)",
				"Place them in a visible FAQ section on the page",
				"Avoid duplicate questions; cover primary objections",
				"Deploy and verify FAQs are extractable by the scraper",
			];
		case "improve_heading_structure":
			return [
				"Ensure exactly one H1 on the page",
				"Use H2 for sections and H3 for sub-sections (no level skipping)",
				"Do not use headings purely for styling; use CSS classes",
				"Deploy and verify heading hierarchy is logical",
			];
		case "add_h2_sections":
			return [
				"Identify 2–5 primary sections that support the H1",
				"Add descriptive <h2> headings for each primary section",
				"Keep <h2> concise, relevant, with natural keywords (no stuffing)",
				"Deploy and verify at least one H2 renders in the DOM",
			];
		case "add_h3_subsections":
			return [
				"Group related content under appropriate <h2> sections",
				"Add <h3> for logical subtopics beneath frequently long <h2> sections",
				"Avoid skipping levels (place H3 only under H2)",
				"Deploy and verify H3s appear under corresponding H2s",
			];
		case "avoid_heading_level_skips":
			return [
				"Audit headings for level ordering (H1 > H2 > H3 > H4...)",
				"Insert missing levels where needed (e.g., add H2 before H3)",
				"Refactor styling: use classes instead of incorrect heading tags",
				"Deploy and verify no heading level is skipped",
			];
		case "add_favicon":
			return [
				"Generate a favicon (32x32 or 48x48 PNG/ICO)",
				"Place at /favicon.ico and/or /favicons/*",
				"Add <link rel=\"icon\" href=\"/favicon.ico\"> in <head>",
				"Deploy and verify the favicon loads in the browser",
			];
		default:
			return ["Implement the change and verify it is live."];
	}
}


