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
Analyze the provided list of URLs and select the 20-25 MOST IMPORTANT marketing pages.

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
- **features**: Capabilities, integrations, security, performance features
- **solutions**: Use cases, industries, customer segments
- **about**: Company story, team, mission, values
- **contact**: Contact forms, sales, demo requests
- **customers**: Customer logos, case studies, testimonials
- **blog**: Articles, announcements (high-value only)
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
								"about",
								"contact",
								"customers",
								"blog",
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
 * Builds the user message for OpenAI analysis
 */
export function buildAnalysisUserMessage(
	normalizedUrl: string,
	urls: string[]
): string {
	const urlListText = buildUrlListForAnalysis(urls);
	return `Analyze these ${urls.length} URLs from ${normalizedUrl} and select the 20-25 most important marketing pages:\n\n${urlListText}`;
}

/**
 * Maps 'customers' page type to 'solutions' for type compatibility
 * (customers is treated as a solutions sub-type in our type system)
 */
export function normalizePageType(
	pageType: string
): PageType {
	if (pageType === "customers") {
		return "solutions";
	}
	return pageType as PageType;
}
