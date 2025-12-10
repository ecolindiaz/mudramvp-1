/**
 * Citation Extractor for Conversation Radar Mode 1 (Cited Radar)
 * 
 * Extracts Reddit URLs from AI visibility analysis results.
 * Citations come from Perplexity's sonar-pro model responses,
 * stored in analysisRun.results.analyses[].promptTests[].citations[]
 * 
 * NOTE: Mode 1 only extracts Reddit URLs. LinkedIn URLs are ignored
 * because the LinkedIn Apify actor doesn't support URL scraping.
 */

import type { AnalysisRun } from '@prisma/client';

// Matches the structure in lib/services/direct-geo-analysis.service.ts
interface Citation {
  title?: string;
  url: string;
  snippet?: string;
  position?: number;
}

interface PromptTest {
  prompt: string;
  response: string;
  brandMentioned: boolean;
  brandPosition?: number;
  competitors: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  citations?: Citation[];
  searchQueries?: string[];
}

interface ProviderAnalysis {
  provider: string;
  promptTests: PromptTest[];
  brandVisibilityScore: number;
  averagePosition: number;
  mentionRate: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

interface DirectGEOResult {
  brandName: string;
  overallScore: number;
  analyses: ProviderAnalysis[];
  competitorComparison: any[];
  recommendations: string[];
  timestamp: string;
}

// Output structure for extracted citations
export interface ExtractedCitation {
  url: string;
  platform: 'reddit';  // Only Reddit for Mode 1
  promptText: string;
  promptId?: number;
  provider: string;
  citationTitle?: string;
  citationSnippet?: string;
}

/**
 * Extract Reddit citations from an AI visibility analysis run.
 * 
 * Citations come from Perplexity's sonar-pro model responses,
 * stored in analysisRun.results.analyses[].promptTests[].citations[]
 */
export function extractRedditCitationsFromAnalysis(
  analysisRun: AnalysisRun
): ExtractedCitation[] {
  const citations: ExtractedCitation[] = [];
  
  // Parse the stored JSON results
  const results = analysisRun.results as unknown as DirectGEOResult;
  
  if (!results?.analyses || !Array.isArray(results.analyses)) {
    console.warn('[Citation Extractor] No analyses found in results');
    return citations;
  }
  
  // Iterate through each provider's analysis
  for (const providerAnalysis of results.analyses) {
    const provider = providerAnalysis.provider;
    
    if (!providerAnalysis.promptTests || !Array.isArray(providerAnalysis.promptTests)) {
      continue;
    }
    
    // Iterate through each prompt test
    for (const promptTest of providerAnalysis.promptTests) {
      // Check if this prompt test has citations (typically from Perplexity)
      if (!promptTest.citations || !Array.isArray(promptTest.citations)) {
        continue;
      }
      
      // Extract Reddit URLs from citations
      for (const citation of promptTest.citations) {
        if (citation.url && isRedditUrl(citation.url)) {
          citations.push({
            url: normalizeRedditUrl(citation.url),
            platform: 'reddit',
            promptText: promptTest.prompt,
            provider,
            citationTitle: citation.title,
            citationSnippet: citation.snippet,
          });
        }
        // LinkedIn URLs are intentionally ignored here - can't scrape them
      }
    }
  }
  
  // Deduplicate by URL, but track multiple prompts/providers
  const uniqueCitations = deduplicateCitations(citations);
  
  console.log(`[Citation Extractor] Found ${uniqueCitations.length} unique Reddit citations from ${results.analyses.length} providers`);
  
  return uniqueCitations;
}

/**
 * Check if a URL is a Reddit URL
 */
export function isRedditUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('reddit.com') || 
           parsed.hostname.includes('redd.it');
  } catch {
    return false;
  }
}

/**
 * Check if a URL is a LinkedIn URL
 */
export function isLinkedInUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('linkedin.com');
  } catch {
    return false;
  }
}

/**
 * Normalize Reddit URL to consistent format
 */
export function normalizeRedditUrl(url: string): string {
  try {
    const parsed = new URL(url);
    
    // Handle redd.it short URLs
    if (parsed.hostname.includes('redd.it')) {
      return url; // Keep short URLs as-is, Apify handles them
    }
    
    // Keep only the path (removes ?utm_source, etc.)
    // Also normalize to www.reddit.com
    let pathname = parsed.pathname;
    
    // Remove trailing slash unless it's the root
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    
    return `https://www.reddit.com${pathname}`;
  } catch {
    return url;
  }
}

/**
 * Extract Reddit post ID from URL
 */
export function extractRedditPostId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    
    // Pattern: /r/subreddit/comments/POST_ID/...
    const match = pathname.match(/\/comments\/([a-z0-9]+)/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Deduplicate citations by URL, merging prompt/provider info
 */
function deduplicateCitations(citations: ExtractedCitation[]): ExtractedCitation[] {
  const seen = new Map<string, ExtractedCitation & { prompts: { promptText: string; provider: string }[] }>();
  
  for (const citation of citations) {
    const existing = seen.get(citation.url);
    
    if (!existing) {
      seen.set(citation.url, {
        ...citation,
        prompts: [{ promptText: citation.promptText, provider: citation.provider }],
      });
    } else {
      // Track additional prompts/providers that cited this URL
      existing.prompts.push({
        promptText: citation.promptText,
        provider: citation.provider,
      });
    }
  }
  
  return Array.from(seen.values());
}

/**
 * Get statistics about citations in an analysis run
 */
export function getCitationStats(analysisRun: AnalysisRun): {
  totalCitations: number;
  redditCitations: number;
  linkedInCitations: number;
  otherCitations: number;
  providers: string[];
} {
  const stats = {
    totalCitations: 0,
    redditCitations: 0,
    linkedInCitations: 0,
    otherCitations: 0,
    providers: [] as string[],
  };
  
  const results = analysisRun.results as unknown as DirectGEOResult;
  
  if (!results?.analyses) {
    return stats;
  }
  
  const providersSet = new Set<string>();
  
  for (const providerAnalysis of results.analyses) {
    providersSet.add(providerAnalysis.provider);
    
    for (const promptTest of providerAnalysis.promptTests || []) {
      for (const citation of promptTest.citations || []) {
        stats.totalCitations++;
        
        if (isRedditUrl(citation.url)) {
          stats.redditCitations++;
        } else if (isLinkedInUrl(citation.url)) {
          stats.linkedInCitations++;
        } else {
          stats.otherCitations++;
        }
      }
    }
  }
  
  stats.providers = Array.from(providersSet);
  
  return stats;
}

