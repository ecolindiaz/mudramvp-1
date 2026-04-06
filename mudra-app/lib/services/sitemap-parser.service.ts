/**
 * Sitemap Parser Service
 * 
 * Discovers and parses sitemap.xml files to extract all page URLs.
 * Supports:
 * - Standard sitemap.xml
 * - Sitemap index files (sitemapindex)
 * - Nested sitemaps
 * - Page type classification
 */

import { prisma } from '@/lib/prisma';
import { normalizeUrl } from '@/lib/utils/normalize-url';
import type { 
  SitemapEntry, 
  SitemapDiscoveryResult, 
  PageType 
} from '@/lib/types/site-scraping.types';

// Timeout for sitemap fetches
const FETCH_TIMEOUT = 30000;

/**
 * Fetch URL with timeout
 */
async function fetchWithTimeout(
  url: string,
  timeoutMs: number = FETCH_TIMEOUT
): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'MudraBot/1.0 (+https://mudra.ai)',
        'Accept': 'application/xml, text/xml, */*',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn(`[SitemapParser] Failed to fetch ${url}: ${response.status}`);
      return null;
    }
    
    return await response.text();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      console.warn(`[SitemapParser] Error fetching ${url}: ${error.message}`);
    }
    return null;
  }
}

/**
 * Parse a simple XML tag value
 */
function extractXmlTagValue(xml: string, tagName: string): string | undefined {
  const regex = new RegExp(`<${tagName}>([^<]*)</${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : undefined;
}

/**
 * Extract all occurrences of a tag from XML
 */
function extractAllXmlTagValues(xml: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}>([^<]*)</${tagName}>`, 'gi');
  const values: string[] = [];
  let match;
  
  while ((match = regex.exec(xml)) !== null) {
    if (match[1]?.trim()) {
      values.push(match[1].trim());
    }
  }
  
  return values;
}

/**
 * Parse sitemap entries from XML content
 */
function parseSitemapXml(xml: string): SitemapEntry[] {
  const entries: SitemapEntry[] = [];

  // Match <url> blocks
  const urlBlockRegex = /<url>([\s\S]*?)<\/url>/gi;
  let match;

  while ((match = urlBlockRegex.exec(xml)) !== null) {
    const urlBlock = match[1];

    const loc = extractXmlTagValue(urlBlock, 'loc');
    if (!loc) continue;

    const lastmod = extractXmlTagValue(urlBlock, 'lastmod');
    const changefreq = extractXmlTagValue(urlBlock, 'changefreq');
    const priorityStr = extractXmlTagValue(urlBlock, 'priority');

    // Extract xhtml:link hreflang alternates
    const alternates: Array<{ hreflang: string; href: string }> = [];
    const altRegex = /<xhtml:link[^>]+rel=["']alternate["'][^>]*>/gi;
    let altMatch;
    while ((altMatch = altRegex.exec(urlBlock)) !== null) {
      const tag = altMatch[0];
      const hreflangMatch = tag.match(/hreflang=["']([^"']+)["']/i);
      const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
      if (hreflangMatch && hrefMatch) {
        alternates.push({ hreflang: hreflangMatch[1], href: hrefMatch[1] });
      }
    }

    entries.push({
      loc,
      lastmod,
      changefreq,
      priority: priorityStr ? parseFloat(priorityStr) : undefined,
      ...(alternates.length > 0 && { alternates }),
    });
  }

  return entries;
}

/**
 * Parse sitemap index to get child sitemap URLs
 */
function parseSitemapIndex(xml: string): string[] {
  const sitemapUrls: string[] = [];
  
  // Match <sitemap> blocks
  const sitemapBlockRegex = /<sitemap>([\s\S]*?)<\/sitemap>/gi;
  let match;
  
  while ((match = sitemapBlockRegex.exec(xml)) !== null) {
    const sitemapBlock = match[1];
    const loc = extractXmlTagValue(sitemapBlock, 'loc');
    if (loc) {
      sitemapUrls.push(loc);
    }
  }
  
  return sitemapUrls;
}

/**
 * Check if XML is a sitemap index
 */
function isSitemapIndex(xml: string): boolean {
  return xml.includes('<sitemapindex') || xml.includes('<sitemap>');
}

/**
 * Classify page type based on URL patterns
 */
export function classifyPageType(url: string): PageType {
  const pathname = new URL(url).pathname.toLowerCase();
  
  // Exact path matches
  if (pathname === '/' || pathname === '') return 'main';
  
  // Path segment patterns
  const patterns: Array<{ type: PageType; patterns: RegExp[] }> = [
    { type: 'blog', patterns: [/\/blog\/?/, /\/posts?\/?/, /\/articles?\/?/, /\/news\/?/] },
    { type: 'pricing', patterns: [/\/pricing\/?/, /\/plans?\/?/, /\/packages?\/?/] },
    { type: 'features', patterns: [/\/features?\/?/, /\/capabilities\/?/] },
    { type: 'product', patterns: [/\/products?\/?/, /\/solutions?\/?product/] },
    { type: 'service', patterns: [/\/services?\/?/] },
    { type: 'solutions', patterns: [/\/solutions?\/?/, /\/use-?cases?\/?/] },
    { type: 'use-cases', patterns: [/\/use-?cases?\/?/, /\/customers?\/?/, /\/case-?studies?\/?/] },
    { type: 'docs', patterns: [/\/docs?\/?/, /\/documentation\/?/, /\/guide\/?/, /\/help\/?/, /\/support\/?/] },
    { type: 'about', patterns: [/\/about\/?/, /\/company\/?/, /\/team\/?/, /\/careers?\/?/] },
    { type: 'contact', patterns: [/\/contact\/?/, /\/get-?in-?touch\/?/] },
  ];
  
  for (const { type, patterns: regexPatterns } of patterns) {
    for (const pattern of regexPatterns) {
      if (pattern.test(pathname)) {
        return type;
      }
    }
  }
  
  return 'other';
}

/**
 * Fetch and parse a sitemap (handles both regular sitemaps and sitemap indexes)
 */
async function fetchAndParseSitemap(
  url: string,
  depth: number = 0,
  maxDepth: number = 3
): Promise<SitemapEntry[]> {
  if (depth > maxDepth) {
    console.warn(`[SitemapParser] Max depth ${maxDepth} reached for ${url}`);
    return [];
  }
  
  console.log(`[SitemapParser] Fetching sitemap: ${url} (depth: ${depth})`);
  
  const xml = await fetchWithTimeout(url);
  if (!xml) return [];
  
  // Check if this is a sitemap index
  if (isSitemapIndex(xml)) {
    console.log(`[SitemapParser] Found sitemap index at ${url}`);
    const childUrls = parseSitemapIndex(xml);
    console.log(`[SitemapParser] Found ${childUrls.length} child sitemaps`);
    
    // Fetch all child sitemaps in parallel (with some concurrency limit)
    const results = await Promise.all(
      childUrls.map(childUrl => fetchAndParseSitemap(childUrl, depth + 1, maxDepth))
    );
    
    return results.flat();
  }
  
  // Regular sitemap
  const entries = parseSitemapXml(xml);
  console.log(`[SitemapParser] Parsed ${entries.length} URLs from ${url}`);
  
  return entries;
}

/**
 * Discover all pages from a domain's sitemap
 */
export async function discoverSitemap(
  domain: string,
  sitemapUrl?: string
): Promise<SitemapDiscoveryResult> {
  // Normalize domain
  let origin: string;
  try {
    if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
      domain = 'https://' + domain;
    }
    origin = new URL(domain).origin;
  } catch {
    origin = domain;
  }
  
  // Default sitemap URL if not provided
  const primarySitemapUrl = sitemapUrl || `${origin}/sitemap.xml`;
  
  console.log(`[SitemapParser] Discovering sitemap for ${origin}`);
  
  // Fetch and parse sitemap
  let entries = await fetchAndParseSitemap(primarySitemapUrl);
  
  // If no entries found, try common sitemap locations
  if (entries.length === 0) {
    const alternativeUrls = [
      `${origin}/sitemap_index.xml`,
      `${origin}/sitemap-index.xml`,
      `${origin}/sitemaps.xml`,
      `${origin}/sitemap1.xml`,
    ];
    
    for (const altUrl of alternativeUrls) {
      console.log(`[SitemapParser] Trying alternative: ${altUrl}`);
      entries = await fetchAndParseSitemap(altUrl);
      if (entries.length > 0) break;
    }
  }
  
  // Deduplicate by URL
  const uniqueUrls = new Map<string, SitemapEntry>();
  for (const entry of entries) {
    if (!uniqueUrls.has(entry.loc)) {
      uniqueUrls.set(entry.loc, entry);
    }
  }
  entries = Array.from(uniqueUrls.values());
  
  // Classify page types and count
  const pageTypes: Record<PageType, number> = {
    'main': 0,
    'features': 0,
    'product': 0,
    'service': 0,
    'solutions': 0,
    'blog': 0,
    'pricing': 0,
    'use-cases': 0,
    'docs': 0,
    'about': 0,
    'contact': 0,
    'other': 0,
  };
  
  for (const entry of entries) {
    const type = classifyPageType(entry.loc);
    pageTypes[type]++;
  }
  
  const result: SitemapDiscoveryResult = {
    domain: origin,
    sitemapUrl: primarySitemapUrl,
    entries,
    totalPages: entries.length,
    pageTypes,
    discoveredAt: new Date(),
  };
  
  console.log(`[SitemapParser] Discovered ${entries.length} total pages`);
  console.log(`[SitemapParser] Page types:`, pageTypes);
  
  return result;
}

/**
 * Save discovered sitemap pages to database
 */
export async function saveSitemapPages(
  brandProfileId: number,
  discovery: SitemapDiscoveryResult
): Promise<number> {
  console.log(`[SitemapParser] Saving ${discovery.entries.length} pages for brand ${brandProfileId}`);

  // Normalize domain once (strip www.) for consistent storage
  const normalizedDomain = discovery.domain.replace(/^(https?:\/\/)www\./i, '$1');

  let savedCount = 0;

  // Use batched upserts for efficiency
  const batchSize = 50;
  for (let i = 0; i < discovery.entries.length; i += batchSize) {
    const batch = discovery.entries.slice(i, i + batchSize);

    await Promise.all(batch.map(async (entry) => {
      const normalizedLoc = normalizeUrl(entry.loc);
      try {
        await prisma.sitemapPage.upsert({
          where: {
            brand_profile_id_domain_page_url: {
              brand_profile_id: brandProfileId,
              domain: normalizedDomain,
              page_url: normalizedLoc,
            },
          },
          create: {
            brand_profile_id: brandProfileId,
            domain: normalizedDomain,
            page_url: normalizedLoc,
            page_type: classifyPageType(entry.loc),
            last_modified: entry.lastmod ? new Date(entry.lastmod) : null,
            change_frequency: entry.changefreq,
            priority: entry.priority,
            scrape_status: 'pending',
          },
          update: {
            page_type: classifyPageType(entry.loc),
            last_modified: entry.lastmod ? new Date(entry.lastmod) : null,
            change_frequency: entry.changefreq,
            priority: entry.priority,
            updated_at: new Date(),
          },
        });
        savedCount++;
      } catch (error) {
        console.warn(`[SitemapParser] Failed to save page ${normalizedLoc}:`, error);
      }
    }));
  }
  
  console.log(`[SitemapParser] Saved ${savedCount} pages to database`);
  return savedCount;
}

/**
 * Get all pending pages for scraping
 */
export async function getPendingPages(
  brandProfileId: number,
  domain: string,
  limit?: number
): Promise<Array<{ id: string; pageUrl: string; pageType: string | null }>> {
  const pages = await prisma.sitemapPage.findMany({
    where: {
      brand_profile_id: brandProfileId,
      domain,
      scrape_status: 'pending',
    },
    select: {
      id: true,
      page_url: true,
      page_type: true,
    },
    orderBy: [
      { priority: 'desc' },
      { page_type: 'asc' },
    ],
    take: limit,
  });
  
  // Map to camelCase for the return type
  return pages.map(p => ({
    id: p.id,
    pageUrl: p.page_url,
    pageType: p.page_type,
  }));
}

/**
 * Update page scrape status
 */
export async function updatePageScrapeStatus(
  pageId: string,
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped',
  error?: string
): Promise<void> {
  await prisma.sitemapPage.update({
    where: { id: pageId },
    data: {
      scrape_status: status,
      scrape_error: error,
      last_scraped_at: status === 'completed' ? new Date() : undefined,
      updated_at: new Date(),
    },
  });
}

/**
 * Get sitemap statistics for a brand
 */
export async function getSitemapStats(
  brandProfileId: number,
  domain: string
): Promise<{
  totalPages: number;
  pending: number;
  completed: number;
  failed: number;
  byPageType: Record<string, number>;
}> {
  const pages = await prisma.sitemapPage.groupBy({
    by: ['scrape_status', 'page_type'],
    where: { brand_profile_id: brandProfileId, domain },
    _count: true,
  });
  
  const stats = {
    totalPages: 0,
    pending: 0,
    completed: 0,
    failed: 0,
    byPageType: {} as Record<string, number>,
  };
  
  for (const group of pages) {
    const count = group._count;
    stats.totalPages += count;
    
    // Status counts
    if (group.scrape_status === 'pending') stats.pending += count;
    if (group.scrape_status === 'completed') stats.completed += count;
    if (group.scrape_status === 'failed') stats.failed += count;
    
    // Page type counts
    const type = group.page_type || 'other';
    stats.byPageType[type] = (stats.byPageType[type] || 0) + count;
  }
  
  return stats;
}

/**
 * Main function to discover and save sitemap
 */
export async function discoverAndSaveSitemap(
  brandProfileId: number,
  domain: string,
  sitemapUrl?: string
): Promise<SitemapDiscoveryResult> {
  // Discover sitemap
  const discovery = await discoverSitemap(domain, sitemapUrl);
  
  // Save to database
  if (discovery.entries.length > 0) {
    await saveSitemapPages(brandProfileId, discovery);
  }
  
  return discovery;
}
