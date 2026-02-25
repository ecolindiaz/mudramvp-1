/**
 * Policy File Detection Service
 * 
 * Checks for existence and content of policy files at domain root:
 * - /robots.txt - Crawl directives and sitemap references
 * - /sitemap.xml - Page URL listing
 * - /llms.txt - LLM crawling permissions
 * - /llms-full.txt - Extended LLM crawling permissions
 */

import { prisma } from '@/lib/prisma';
import type { PolicyFileResult, CrawlDirective } from '@/lib/types/site-scraping.types';

// Timeout for HTTP requests (10 seconds)
const FETCH_TIMEOUT = 10000;

/**
 * Fetch a URL with timeout handling
 */
async function fetchWithTimeout(
  url: string,
  timeoutMs: number = FETCH_TIMEOUT
): Promise<{ ok: boolean; status: number; text?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'MudraBot/1.0 (+https://mudra.ai)',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const text = await response.text();
      return { ok: true, status: response.status, text };
    }
    
    return { ok: false, status: response.status };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[PolicyDetection] Timeout fetching ${url}`);
    }
    return { ok: false, status: 0 };
  }
}

/**
 * Check if response body looks like HTML (soft 404 detection)
 */
function isHtmlResponse(text: string): boolean {
  const trimmed = text.trimStart().toLowerCase();
  return (
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    (trimmed.startsWith('<?xml') && trimmed.includes('<html'))
  );
}

/**
 * Validate that response body is plausible llms.txt content (plain text/markdown, not HTML)
 */
function isValidLlmsTxt(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  if (isHtmlResponse(text)) return false;
  return true;
}

/**
 * Validate that response body is plausible robots.txt content (not HTML)
 */
function isValidRobotsTxt(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  if (isHtmlResponse(text)) return false;
  return true;
}

/**
 * Validate that response body is plausible sitemap XML content
 */
function isValidSitemapXml(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  const trimmed = text.trimStart().toLowerCase();
  return trimmed.startsWith('<?xml') || trimmed.startsWith('<urlset') || trimmed.startsWith('<sitemapindex');
}

/**
 * Extract sitemap URLs from robots.txt content
 */
function extractSitemapUrls(robotsTxt: string): string[] {
  const sitemapUrls: string[] = [];
  const lines = robotsTxt.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().startsWith('sitemap:')) {
      const url = trimmed.substring(8).trim();
      if (url) {
        sitemapUrls.push(url);
      }
    }
  }
  
  return sitemapUrls;
}

/**
 * Parse crawl directives from robots.txt
 */
function parseCrawlDirectives(robotsTxt: string): CrawlDirective[] {
  const directives: CrawlDirective[] = [];
  const lines = robotsTxt.split('\n');
  
  let currentAgent: string | null = null;
  let currentAllow: string[] = [];
  let currentDisallow: string[] = [];
  
  const saveCurrentDirective = () => {
    if (currentAgent) {
      directives.push({
        userAgent: currentAgent,
        allow: [...currentAllow],
        disallow: [...currentDisallow],
      });
    }
    currentAgent = null;
    currentAllow = [];
    currentDisallow = [];
  };
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;
    
    const directive = trimmed.substring(0, colonIndex).toLowerCase().trim();
    const value = trimmed.substring(colonIndex + 1).trim();
    
    switch (directive) {
      case 'user-agent':
        saveCurrentDirective();
        currentAgent = value;
        break;
      case 'allow':
        if (value) currentAllow.push(value);
        break;
      case 'disallow':
        if (value) currentDisallow.push(value);
        break;
    }
  }
  
  // Save the last directive
  saveCurrentDirective();
  
  return directives;
}

/**
 * Normalize a domain URL to get the origin
 */
function normalizeToOrigin(url: string): string {
  try {
    // Handle case where url might not have protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return url;
  }
}

/**
 * Check all policy files for a domain
 */
export async function checkPolicyFiles(domain: string): Promise<PolicyFileResult> {
  const origin = normalizeToOrigin(domain);
  console.log(`[PolicyDetection] Checking policy files for ${origin}`);
  
  // Check all files in parallel
  const [robotsResult, sitemapResult, llmsResult, llmsFullResult] = await Promise.all([
    fetchWithTimeout(`${origin}/robots.txt`),
    fetchWithTimeout(`${origin}/sitemap.xml`),
    fetchWithTimeout(`${origin}/llms.txt`),
    fetchWithTimeout(`${origin}/llms-full.txt`),
  ]);
  
  // Validate content to detect soft 404s (sites returning HTML for unknown paths)
  const robotsValid = robotsResult.ok && robotsResult.text ? isValidRobotsTxt(robotsResult.text) : false;
  const sitemapValid = sitemapResult.ok && sitemapResult.text ? isValidSitemapXml(sitemapResult.text) : false;
  const llmsValid = llmsResult.ok && llmsResult.text ? isValidLlmsTxt(llmsResult.text) : false;
  const llmsFullValid = llmsFullResult.ok && llmsFullResult.text ? isValidLlmsTxt(llmsFullResult.text) : false;

  // Parse robots.txt for sitemap URLs and crawl directives
  let sitemapUrls: string[] = [];
  let crawlDirectives: CrawlDirective[] = [];

  if (robotsValid && robotsResult.text) {
    sitemapUrls = extractSitemapUrls(robotsResult.text);
    crawlDirectives = parseCrawlDirectives(robotsResult.text);
    console.log(`[PolicyDetection] Found ${sitemapUrls.length} sitemap URLs in robots.txt`);
    console.log(`[PolicyDetection] Found ${crawlDirectives.length} crawl directive groups`);
  }

  // If no sitemap in robots.txt but sitemap.xml exists, use default URL
  let primarySitemapUrl = sitemapUrls[0] || `${origin}/sitemap.xml`;

  const result: PolicyFileResult = {
    domain: origin,
    robots: {
      exists: robotsValid,
      url: `${origin}/robots.txt`,
      content: robotsValid ? robotsResult.text : undefined,
      sitemapUrls,
      crawlDirectives,
    },
    sitemap: {
      exists: sitemapValid,
      url: primarySitemapUrl,
      pageCount: undefined, // Will be populated during sitemap parsing
    },
    llmsTxt: {
      exists: llmsValid,
      url: `${origin}/llms.txt`,
      content: llmsValid ? llmsResult.text : undefined,
    },
    llmsFullTxt: {
      exists: llmsFullValid,
      url: `${origin}/llms-full.txt`,
      content: llmsFullValid ? llmsFullResult.text : undefined,
    },
    checkedAt: new Date(),
  };
  
  console.log(`[PolicyDetection] Results: robots=${result.robots.exists}, sitemap=${result.sitemap.exists}, llms.txt=${result.llmsTxt.exists}, llms-full.txt=${result.llmsFullTxt.exists}`);
  
  return result;
}

/**
 * Save policy file detection results to database
 */
export async function savePolicyFileResult(
  brandProfileId: number,
  result: PolicyFileResult
): Promise<void> {
  console.log(`[PolicyDetection] Saving results for brand ${brandProfileId}`);
  
  await prisma.policyFile.upsert({
    where: {
      // Use a compound lookup - find by brandProfileId and domain
      id: await prisma.policyFile.findFirst({
        where: { brand_profile_id: brandProfileId, domain: result.domain },
        select: { id: true },
      }).then(r => r?.id ?? 'new-record'),
    },
    create: {
      brand_profile_id: brandProfileId,
      domain: result.domain,
      robots_txt_exists: result.robots.exists,
      robots_txt_content: result.robots.content,
      sitemap_xml_exists: result.sitemap.exists,
      sitemap_xml_url: result.sitemap.url,
      llms_txt_exists: result.llmsTxt.exists,
      llms_txt_content: result.llmsTxt.content,
      llms_full_txt_exists: result.llmsFullTxt.exists,
      llms_full_txt_content: result.llmsFullTxt.content,
      checked_at: result.checkedAt,
    },
    update: {
      robots_txt_exists: result.robots.exists,
      robots_txt_content: result.robots.content,
      sitemap_xml_exists: result.sitemap.exists,
      sitemap_xml_url: result.sitemap.url,
      llms_txt_exists: result.llmsTxt.exists,
      llms_txt_content: result.llmsTxt.content,
      llms_full_txt_exists: result.llmsFullTxt.exists,
      llms_full_txt_content: result.llmsFullTxt.content,
      checked_at: result.checkedAt,
      updated_at: new Date(),
    },
  });
}

/**
 * Get cached policy file result from database
 */
export async function getCachedPolicyFiles(
  brandProfileId: number,
  domain: string
): Promise<PolicyFileResult | null> {
  const record = await prisma.policyFile.findFirst({
    where: { brand_profile_id: brandProfileId, domain: normalizeToOrigin(domain) },
  });
  
  if (!record) return null;
  
  return {
    domain: record.domain,
    robots: {
      exists: record.robots_txt_exists,
      url: `${record.domain}/robots.txt`,
      content: record.robots_txt_content ?? undefined,
      sitemapUrls: record.sitemap_xml_url ? [record.sitemap_xml_url] : [],
      crawlDirectives: record.robots_txt_content 
        ? parseCrawlDirectives(record.robots_txt_content) 
        : [],
    },
    sitemap: {
      exists: record.sitemap_xml_exists,
      url: record.sitemap_xml_url ?? `${record.domain}/sitemap.xml`,
    },
    llmsTxt: {
      exists: record.llms_txt_exists,
      url: `${record.domain}/llms.txt`,
      content: record.llms_txt_content ?? undefined,
    },
    llmsFullTxt: {
      exists: record.llms_full_txt_exists,
      url: `${record.domain}/llms-full.txt`,
      content: record.llms_full_txt_content ?? undefined,
    },
    checkedAt: record.checked_at,
  };
}

/**
 * Check if policy files need refresh (older than 24 hours)
 */
export async function needsPolicyRefresh(
  brandProfileId: number,
  domain: string,
  maxAgeHours: number = 24
): Promise<boolean> {
  const record = await prisma.policyFile.findFirst({
    where: { brand_profile_id: brandProfileId, domain: normalizeToOrigin(domain) },
    select: { checked_at: true },
  });
  
  if (!record) return true;
  
  const ageMs = Date.now() - record.checked_at.getTime();
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  
  return ageMs > maxAgeMs;
}

/**
 * Main function to detect and cache policy files
 */
export async function detectPolicyFiles(
  brandProfileId: number,
  domain: string,
  forceRefresh: boolean = false
): Promise<PolicyFileResult> {
  // Check if we need to refresh
  if (!forceRefresh && !(await needsPolicyRefresh(brandProfileId, domain))) {
    const cached = await getCachedPolicyFiles(brandProfileId, domain);
    if (cached) {
      console.log(`[PolicyDetection] Using cached results for ${domain}`);
      return cached;
    }
  }
  
  // Perform fresh check
  const result = await checkPolicyFiles(domain);
  
  // Save to database
  await savePolicyFileResult(brandProfileId, result);
  
  return result;
}
