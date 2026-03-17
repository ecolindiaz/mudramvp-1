/**
 * Discovery Prompts Module
 *
 * Contains prompts and schemas for AI-powered page categorization
 * using OpenAI's structured output feature.
 */

import type { PageType } from "@/lib/analysis/technical/types";

// ============================================================================
// OPENAI ANALYSIS PROMPT
// ============================================================================

export const DISCOVERY_ANALYSIS_PROMPT = `You are an expert at analyzing company websites to identify the most important marketing pages for SEO/AEO (Answer Engine Optimization) technical analysis.

## YOUR TASK
Analyze the provided list of URLs and select up to 50 marketing/product pages + up to 15 high-value blog posts.

NOTE: Some pages may already be pre-selected from the site's navigation. Those are listed separately and excluded from the candidate list. Focus your selection on deeper pages that the navigation doesn't surface.

## CRITICAL REQUIREMENTS - MUST INCLUDE (if they exist):

### Core Pages (ALWAYS include if present):
1. **Homepage** - The root "/" page
2. **Pricing** - Plans, pricing, cost information
3. **About** - Company info, team, mission, story

### Product Pages (include ALL that exist):
- Main product pages (platform overviews)
- Individual product offerings (e.g., /cloud, /sandbox, /agent, /sdk)
- Product feature pages

### Feature Pages:
- Core capabilities
- Integrations
- Security features
- Performance features

### Solutions Pages:
- Use cases
- Industry solutions
- Customer segments (enterprise, startups, developers)

### Contact & Sales:
- Contact page
- Sales/demo request pages
- Trial signup pages

### Social Proof:
- Customers page
- Case studies
- Testimonials

### Blog (select 3-5 HIGH-VALUE posts):
- Major product announcements
- Customer case studies
- Technical deep-dives
- Funding/milestone announcements
- NOT: minor updates, changelog items, tutorials

## MUST EXCLUDE:
- **Non-marketing subdomains**: app.*, security.*, portal.*, dashboard.*, admin.*, console.*, staging.*, dev.*, cdn.* — these are web applications, not marketing pages
- Documentation (/docs, /reference, /api-reference, /guides with technical content)
- Legal pages (/terms, /privacy, /legal)
- Authentication (/login, /signup, /register)
- Careers/Jobs pages
- Changelog/Release notes
- Status pages
- Help/Support articles
- Locale duplicates (prefer /pricing over /fr/pricing)
- Only include pages from the BASE domain (e.g., example.com or www.example.com)

## PAGE TYPE DEFINITIONS:
- **home**: Root landing page only
- **pricing**: Plans, pricing, cost pages
- **product**: Core product offerings, platform pages, individual products
- **features**: Capabilities, security, performance features
- **solutions**: Industry solutions, customer segments
- **use-cases**: Specific use-case detail pages (e.g., /use-cases/account-research)
- **integrations**: Integration directories and individual integration pages
- **customers**: Customer logos, case studies, testimonials, success stories
- **resources**: Resource hubs, whitepapers, ebooks, webinars
- **about**: Company story, team, mission, values
- **careers**: Job listings, career pages, openings
- **contact**: Contact forms, sales pages
- **demo**: Demo request, book-a-demo pages
- **changelog**: Changelog, release notes
- **blog**: Articles, announcements (high-value only)
- **legal**: Terms of service, privacy policy, cookie policy
- **login**: Login, sign-in pages
- **signup**: Registration, sign-up, get-started pages
- **other**: Important pages that don't fit above (e.g., trust center, compliance)

## OUTPUT FORMAT:
For each selected page, provide:
- **url**: Full URL
- **pageType**: One of the types above
- **title**: Descriptive title for the page
- **reason**: One sentence explaining why this page is important
- **importance**: 1-10 score (10 = critical, like homepage/pricing)

## IMPORTANT:
- Be thorough - don't miss obvious product pages
- Look for patterns in URL structure to understand site organization
- Prefer top-level pages over deeply nested ones
- Quality over quantity for blog posts`;

// ============================================================================
// OPENAI JSON SCHEMA FOR STRUCTURED OUTPUT
// ============================================================================

export const PAGE_ANALYSIS_SCHEMA = {
	name: "page_analysis",
	strict: true,
	schema: {
		type: "object",
		properties: {
			pages: {
				type: "array",
				items: {
					type: "object",
					properties: {
						url: { type: "string" },
						pageType: {
							type: "string",
							enum: [
								"home",
								"pricing",
								"product",
								"features",
								"solutions",
								"use-cases",
								"integrations",
								"customers",
								"resources",
								"about",
								"careers",
								"contact",
								"demo",
								"changelog",
								"blog",
								"legal",
								"login",
								"signup",
								"other",
							],
						},
						title: { type: "string" },
						reason: { type: "string" },
						importance: { type: "number" },
					},
					required: ["url", "pageType", "title", "reason", "importance"],
					additionalProperties: false,
				},
			},
		},
		required: ["pages"],
		additionalProperties: false,
	},
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Builds a numbered URL list for AI analysis
 */
export function buildUrlListForAnalysis(urls: string[]): string {
	return urls.map((url, i) => `${i + 1}. ${url}`).join("\n");
}

/**
 * Builds the user message for OpenAI analysis.
 * When navUrls are provided, they are excluded from the candidate list
 * and listed separately as already-selected pages.
 */
export function buildAnalysisUserMessage(
	normalizedUrl: string,
	urls: string[],
	navUrls?: string[]
): string {
	// Filter out nav URLs from candidate list so AI doesn't waste slots
	const navSet = new Set((navUrls ?? []).map(u => u.replace(/\/+$/, '').toLowerCase()));
	const candidateUrls = navSet.size > 0
		? urls.filter(u => !navSet.has(u.replace(/\/+$/, '').toLowerCase()))
		: urls;

	const urlListText = buildUrlListForAnalysis(candidateUrls);
	let message = `Analyze these ${candidateUrls.length} URLs from ${normalizedUrl} and select up to 50 marketing/product pages + up to 15 high-value blog posts:\n\n${urlListText}`;

	if (navUrls && navUrls.length > 0) {
		const navListText = navUrls.map((url, i) => `${i + 1}. ${url}`).join('\n');
		message += `\n\nALREADY SELECTED (from site navigation — ${navUrls.length} pages, do NOT re-select these):\n${navListText}`;
	}

	return message;
}

/**
 * Maps 'customers' page type to 'solutions' for type compatibility
 * (customers is treated as a solutions sub-type in our type system)
 */
export function normalizePageType(
	pageType: string
): PageType {
	return pageType as PageType;
}
