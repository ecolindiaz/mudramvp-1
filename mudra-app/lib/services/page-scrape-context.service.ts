/**
 * Shared Page Scrape Helper
 *
 * Extracts page content via Firecrawl for use by both the deploy agent
 * (issue-agent-executor) and the generate-script path.
 */

import { getFirecrawlClient } from "@/mastra/tools/firecrawl-client";

/**
 * Scrape page content as markdown using Firecrawl.
 * Returns markdown content (truncated to 6000 chars) or null on failure.
 */
export async function scrapePageContent(
	url: string
): Promise<string | null> {
	try {
		const firecrawl = getFirecrawlClient();
		const result = await firecrawl.scrapeUrl(url, {
			formats: ["markdown"],
			onlyMainContent: true,
			timeout: 15000,
		});
		if (result.success && result.markdown) {
			const content =
				result.markdown.length > 6000
					? result.markdown.slice(0, 6000) +
						"\n\n[...content truncated...]"
					: result.markdown;
			console.log(
				`[PageScrape] Scraped page content: ${content.length} chars from ${url}`
			);
			return content;
		}
		console.warn(
			`[PageScrape] Scrape returned no content for ${url}`
		);
		return null;
	} catch (err) {
		console.warn(
			`[PageScrape] Failed to scrape ${url}:`,
			err instanceof Error ? err.message : err
		);
		return null;
	}
}
