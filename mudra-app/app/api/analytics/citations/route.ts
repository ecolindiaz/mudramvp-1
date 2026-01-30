import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis';

type CitationType = 'Blog' | 'Listicle' | 'Docs' | 'News' | 'Academic' | 'Wiki' | 'Forum' | 'Video' | 'Product' | 'Review' | 'Social' | 'Other'

interface PromptCitation {
  promptId: number | null
  promptText: string
  provider: string
}

type SourceType = 'citation' | 'search_result'

interface UrlWithPrompts {
  url: string
  prompts: PromptCitation[]
  totalPrompts: number // Total prompts before truncation
}

interface CitationData {
  domain: string
  count: number
  percentage: number
  urls: string[]
  totalUrls: number // Total URLs before truncation
  urlsWithPrompts: UrlWithPrompts[] // NEW: URLs with their specific prompts
  type: CitationType
  prompts: PromptCitation[] // Domain-level prompts (for backwards compat)
  totalPrompts: number // Total prompts before truncation
  sourceType: SourceType // Tracks whether this came from inline citations or web search results
  citationCount: number // Count of inline citations
  searchResultCount: number // Count of search result URLs
}

/**
 * Categorize a citation based on URL patterns
 * Order matters - more specific patterns should come first
 */
function categorizeCitationByUrl(url: string): CitationType {
  const urlLower = url.toLowerCase()

  // Extract domain for domain-specific matching
  let domain = ''
  try {
    domain = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    // If URL parsing fails, try regex extraction
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/)
    domain = match ? match[1].toLowerCase() : ''
  }

  // Wikipedia / Wiki sources
  if (
    domain.includes('wikipedia.org') ||
    domain.includes('wikimedia.org') ||
    domain.includes('wiktionary.org') ||
    domain.includes('wikihow.com') ||
    urlLower.includes('/wiki/')
  ) {
    return 'Wiki'
  }

  // Forum / Community / Q&A sites
  if (
    domain.includes('stackoverflow.com') ||
    domain.includes('stackexchange.com') ||
    domain.includes('reddit.com') ||
    domain.includes('quora.com') ||
    domain.includes('discourse.') ||
    domain.includes('community.') ||
    domain.includes('forum.') ||
    domain.includes('forums.') ||
    domain.includes('discuss.') ||
    domain.includes('support.') ||
    domain.includes('answers.') ||
    domain.includes('ask.') ||
    urlLower.includes('/forum') ||
    urlLower.includes('/community') ||
    urlLower.includes('/discussions') ||
    urlLower.includes('/questions/')
  ) {
    return 'Forum'
  }

  // Video platforms
  if (
    domain.includes('youtube.com') ||
    domain.includes('youtu.be') ||
    domain.includes('vimeo.com') ||
    domain.includes('dailymotion.com') ||
    domain.includes('twitch.tv') ||
    domain.includes('tiktok.com') ||
    urlLower.includes('/video') ||
    urlLower.includes('/watch')
  ) {
    return 'Video'
  }

  // Social Media
  if (
    domain.includes('twitter.com') ||
    domain.includes('x.com') ||
    domain.includes('linkedin.com') ||
    domain.includes('facebook.com') ||
    domain.includes('instagram.com') ||
    domain.includes('threads.net') ||
    domain.includes('mastodon.') ||
    domain.includes('bsky.app')
  ) {
    return 'Social'
  }

  // Review sites (before Listicle since some overlap)
  if (
    domain.includes('trustpilot.com') ||
    domain.includes('yelp.com') ||
    domain.includes('glassdoor.com') ||
    domain.includes('producthunt.com') ||
    domain.includes('alternativeto.net') ||
    urlLower.includes('/reviews') ||
    urlLower.includes('/review/')
  ) {
    return 'Review'
  }

  // Academic sources
  if (
    domain.endsWith('.edu') ||
    domain.includes('arxiv.org') ||
    domain.includes('scholar.google') ||
    domain.includes('researchgate.net') ||
    domain.includes('ncbi.nlm.nih.gov') ||
    domain.includes('pubmed.') ||
    domain.includes('ieee.org') ||
    domain.includes('acm.org') ||
    domain.includes('jstor.org') ||
    domain.includes('sciencedirect.com') ||
    domain.includes('springer.com') ||
    domain.includes('nature.com') ||
    domain.includes('plos.org') ||
    domain.includes('semanticscholar.org') ||
    domain.includes('academia.edu')
  ) {
    return 'Academic'
  }

  // Documentation (check after academic since some overlap with .edu)
  if (
    urlLower.includes('/docs') ||
    urlLower.includes('/documentation') ||
    urlLower.includes('/api/') ||
    urlLower.includes('/reference') ||
    urlLower.includes('/guide') ||
    urlLower.includes('/manual') ||
    urlLower.includes('/handbook') ||
    urlLower.includes('/tutorial') ||
    domain.startsWith('docs.') ||
    domain.startsWith('developer.') ||
    domain.startsWith('developers.') ||
    domain.startsWith('api.') ||
    domain.includes('readthedocs.') ||
    domain.includes('gitbook.io')
  ) {
    return 'Docs'
  }

  // News / Media outlets
  if (
    domain.includes('techcrunch.com') ||
    domain.includes('theverge.com') ||
    domain.includes('wired.com') ||
    domain.includes('arstechnica.com') ||
    domain.includes('reuters.com') ||
    domain.includes('bloomberg.com') ||
    domain.includes('forbes.com') ||
    domain.includes('businessinsider.com') ||
    domain.includes('cnn.com') ||
    domain.includes('bbc.com') ||
    domain.includes('bbc.co.uk') ||
    domain.includes('nytimes.com') ||
    domain.includes('wsj.com') ||
    domain.includes('theguardian.com') ||
    domain.includes('washingtonpost.com') ||
    domain.includes('cnbc.com') ||
    domain.includes('ft.com') ||
    domain.includes('venturebeat.com') ||
    domain.includes('zdnet.com') ||
    domain.includes('cnet.com') ||
    domain.includes('engadget.com') ||
    domain.includes('mashable.com') ||
    domain.includes('gizmodo.com') ||
    domain.includes('thenextweb.com') ||
    domain.includes('hackernews.') ||
    domain.startsWith('news.') ||
    urlLower.includes('/news/')
  ) {
    return 'News'
  }

  // Listicle / Comparison sites
  if (
    domain.includes('g2.com') ||
    domain.includes('capterra.com') ||
    domain.includes('trustradius.com') ||
    domain.includes('softwareadvice.com') ||
    domain.includes('getapp.com') ||
    domain.includes('sourceforge.net') ||
    urlLower.includes('/top-') ||
    urlLower.includes('/best-') ||
    urlLower.includes('-alternatives') ||
    urlLower.includes('-vs-') ||
    urlLower.includes('/compare') ||
    urlLower.includes('/comparison') ||
    urlLower.includes('/alternatives')
  ) {
    return 'Listicle'
  }

  // Blog patterns
  if (
    domain.includes('medium.com') ||
    domain.includes('substack.com') ||
    domain.includes('dev.to') ||
    domain.includes('hashnode.dev') ||
    domain.includes('blogger.com') ||
    domain.includes('wordpress.com') ||
    domain.includes('ghost.io') ||
    domain.startsWith('blog.') ||
    domain.startsWith('blogs.') ||
    urlLower.includes('/blog') ||
    urlLower.includes('/article') ||
    urlLower.includes('/post/') ||
    urlLower.includes('/posts/')
  ) {
    return 'Blog'
  }

  // Product / Official company pages (broader catch for company sites)
  // This includes official product pages, landing pages, and company homepages
  if (
    urlLower.includes('/product') ||
    urlLower.includes('/pricing') ||
    urlLower.includes('/features') ||
    urlLower.includes('/solutions') ||
    urlLower.includes('/platform') ||
    urlLower.includes('/about') ||
    urlLower.includes('/company') ||
    // Check if it's a root domain or simple path (likely a product/company page)
    /^https?:\/\/[^\/]+\/?$/.test(url) ||
    /^https?:\/\/[^\/]+\/[^\/]+\/?$/.test(url)
  ) {
    return 'Product'
  }

  return 'Other'
}

/**
 * GET /api/analytics/citations
 *
 * Aggregates citation data from all GEO analysis results for a brand profile.
 * Extracts and counts domains cited across all AI provider responses.
 *
 * Data sources captured:
 * - test.citations: Inline URL citations from AI response text (all providers)
 * - test.sources: ALL URLs from web search results (OpenAI Responses API)
 *
 * This ensures we capture both explicitly cited URLs AND all sources the AI
 * models found during their web searches, giving a complete picture of what
 * sources AI models are pulling data from.
 *
 * Query params:
 * - brandProfileId: The brand profile ID to fetch citations for
 * - limit: Maximum number of top citations to return (optional, returns ALL if not specified)
 * - days: Number of days to look back (default: 30)
 * - model: Optional filter for specific AI model (chatgpt, claude, perplexity, gemini, google-aio)
 */
export async function GET(request: NextRequest) {
  // Rate limit
  const rateLimited = await applyRateLimitAsync(request, 'standard');
  if (rateLimited) return rateLimited;

  try {
    const searchParams = request.nextUrl.searchParams
    const brandProfileIdParam = searchParams.get('brandProfileId')
    const limitParam = searchParams.get('limit')
    const daysParam = searchParams.get('days')
    const modelFilter = searchParams.get('model') // Optional: filter by specific AI model

    // Helper to normalize model names for comparison
    const normalizeModelName = (name: string): string => {
      const lower = name.toLowerCase().trim()
      if (lower.includes('chatgpt') || lower.includes('openai') || lower.includes('gpt')) return 'chatgpt'
      if (lower.includes('claude') || lower.includes('anthropic')) return 'claude'
      if (lower.includes('perplexity')) return 'perplexity'
      if (lower.includes('gemini')) return 'gemini'
      if (lower.includes('google') && lower.includes('aio')) return 'google-aio'
      return lower
    }

    if (!brandProfileIdParam) {
      return NextResponse.json(
        { success: false, error: { message: 'brandProfileId is required' } },
        { status: 400 }
      )
    }

    const brandProfileId = parseInt(brandProfileIdParam, 10)

    // Verify user has access to this brand profile
    const authResult = await requireAuthWithBrandAccess(brandProfileId);
    if (!authResult.success) {
      return authResult.response;
    }
    const limit = limitParam ? parseInt(limitParam, 10) : null // null means no limit (return all)
    const days = daysParam ? parseInt(daysParam, 10) : 30

    // Calculate date range
    const since = new Date()
    since.setDate(since.getDate() - days)

    // Fetch all GEO analysis results within the date range
    const geoResults = await prisma.geoAnalysisResult.findMany({
      where: {
        brandProfileId,
        createdAt: {
          gte: since
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        analyses: true,
        createdAt: true
      }
    })

    // Fetch all Prompts for this brand to map promptText -> promptId
    const prompts = await prisma.prompt.findMany({
      where: { brandProfileId },
      select: { id: true, text: true }
    })
    const promptTextToId = new Map<string, number>()
    for (const p of prompts) {
      // Use lowercase trimmed text as key for fuzzy matching
      promptTextToId.set(p.text.toLowerCase().trim(), p.id)
    }

    if (geoResults.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          citations: [],
          totalCitations: 0,
          totalAnalyses: 0,
          periodDays: days
        }
      })
    }

    // Aggregate citations from all analyses
    const citationMap = new Map<string, {
      count: number
      urls: Set<string>
      urlPrompts: Map<string, Map<string, PromptCitation>> // NEW: url -> (promptKey -> prompt)
      typeCounts: Map<CitationType, number>
      prompts: Map<string, PromptCitation> // key: "promptText|provider" to dedupe (domain-level)
      citationCount: number // Count of inline citations
      searchResultCount: number // Count of search result URLs
    }>()
    let totalCitationCount = 0

    for (const result of geoResults) {
      const analysesRaw = result.analyses;
      const analyses: any[] = typeof analysesRaw === 'string'
        ? JSON.parse(analysesRaw)
        : (Array.isArray(analysesRaw) ? analysesRaw : []);

      for (const analysis of analyses) {
        if (!analysis || typeof analysis !== 'object') continue;

        const analysisObj = analysis as any;

        // Skip this provider if model filter is specified and doesn't match
        if (modelFilter && modelFilter !== 'all') {
          const provider = analysisObj.provider || ''
          const normalizedProvider = normalizeModelName(provider)
          const targetModel = normalizeModelName(modelFilter)
          if (normalizedProvider !== targetModel) continue
        }

        const promptTests = Array.isArray(analysisObj.promptTests) ? analysisObj.promptTests : []

        for (const test of promptTests) {
          // Collect all citation URLs from both 'citations' and 'sources' arrays
          // - citations: inline URL citations from the AI response text
          // - sources: ALL URLs retrieved during web search (OpenAI Responses API)
          const citations = Array.isArray(test.citations) ? test.citations : []
          const sources = Array.isArray(test.sources) ? test.sources : []

          // Get prompt text and provider for this test
          const promptText = test.prompt || test.query || ''
          const provider = analysisObj.provider || 'Unknown'

          // Track URLs we've already processed to avoid double-counting
          const processedUrls = new Set<string>()

          // Helper to extract URL from citation/source object
          const extractUrl = (item: any): string => {
            if (typeof item === 'string') return item
            if (item?.url) return item.url
            if (item?.link) return item.link
            return ''
          }

          // Helper to process a URL and add to citationMap
          const processUrl = (rawUrl: string, sourceType: SourceType) => {
            if (!rawUrl || processedUrls.has(rawUrl)) return
            processedUrls.add(rawUrl)

            try {
              const urlObj = new URL(rawUrl)
              const domain = urlObj.hostname.replace(/^www\./, '')

              if (domain) {
                const existing = citationMap.get(domain) || {
                  count: 0,
                  urls: new Set<string>(),
                  urlPrompts: new Map<string, Map<string, PromptCitation>>(),
                  typeCounts: new Map<CitationType, number>(),
                  prompts: new Map<string, PromptCitation>(),
                  citationCount: 0,
                  searchResultCount: 0
                }
                existing.count++
                existing.urls.add(rawUrl)

                // Track source type counts
                if (sourceType === 'citation') {
                  existing.citationCount++
                } else {
                  existing.searchResultCount++
                }

                // Track citation type for this URL
                const citationType = categorizeCitationByUrl(rawUrl)
                existing.typeCounts.set(citationType, (existing.typeCounts.get(citationType) || 0) + 1)

                // Track which prompt cited this domain (dedupe by prompt+provider)
                if (promptText) {
                  const promptKey = `${promptText}|${provider}`
                  const promptId = promptTextToId.get(promptText.toLowerCase().trim()) || null
                  const promptData: PromptCitation = { promptId, promptText, provider }

                  // Add to domain-level prompts (for backwards compat)
                  if (!existing.prompts.has(promptKey)) {
                    existing.prompts.set(promptKey, promptData)
                  }

                  // NEW: Add to URL-specific prompts
                  if (!existing.urlPrompts.has(rawUrl)) {
                    existing.urlPrompts.set(rawUrl, new Map<string, PromptCitation>())
                  }
                  const urlPromptsMap = existing.urlPrompts.get(rawUrl)!
                  if (!urlPromptsMap.has(promptKey)) {
                    urlPromptsMap.set(promptKey, promptData)
                  }
                }

                citationMap.set(domain, existing)
                totalCitationCount++
              }
            } catch (error) {
              // Invalid URL, skip
              console.warn('Invalid citation URL:', rawUrl)
            }
          }

          // Process inline citations first (these are what the AI explicitly cited)
          for (const citation of citations) {
            processUrl(extractUrl(citation), 'citation')
          }

          // Process sources (all URLs from web search - OpenAI's full search results)
          for (const source of sources) {
            processUrl(extractUrl(source), 'search_result')
          }
        }
      }
    }

    // Convert to array and calculate percentages
    const citationsResult: CitationData[] = Array.from(citationMap.entries())
      .map(([domain, data]) => {
        // Determine the dominant citation type for this domain
        let dominantType: CitationType = 'Other'
        let maxTypeCount = 0
        for (const [type, count] of data.typeCounts) {
          if (count > maxTypeCount) {
            maxTypeCount = count
            dominantType = type
          }
        }

        // Determine the dominant source type (citation vs search_result)
        const sourceType: SourceType = data.citationCount >= data.searchResultCount
          ? 'citation'
          : 'search_result'

        // Build urlsWithPrompts array - each URL with its specific citing prompts
        const allUrls = Array.from(data.urls)
        const urlsArray = allUrls.slice(0, 10)
        const urlsWithPrompts: UrlWithPrompts[] = urlsArray.map(url => {
          const urlPromptsMap = data.urlPrompts.get(url)
          const allUrlPrompts = urlPromptsMap ? Array.from(urlPromptsMap.values()) : []
          return {
            url,
            prompts: allUrlPrompts.slice(0, 10),
            totalPrompts: allUrlPrompts.length
          }
        })

        const allDomainPrompts = Array.from(data.prompts.values())

        return {
          domain,
          count: data.count,
          percentage: totalCitationCount > 0
            ? Math.round((data.count / totalCitationCount) * 100)
            : 0,
          urls: urlsArray,
          totalUrls: allUrls.length, // Total before truncation
          urlsWithPrompts, // NEW: URLs with their specific prompts
          type: dominantType,
          prompts: allDomainPrompts.slice(0, 10), // Domain-level prompts (backwards compat)
          totalPrompts: allDomainPrompts.length, // Total before truncation
          sourceType,
          citationCount: data.citationCount,
          searchResultCount: data.searchResultCount
        }
      })
      .sort((a, b) => b.count - a.count)

    // Only slice if limit is specified
    const finalCitations = limit !== null ? citationsResult.slice(0, limit) : citationsResult

    return NextResponse.json({
      success: true,
      data: {
        citations: finalCitations,
        totalCitations: totalCitationCount,
        totalAnalyses: geoResults.length,
        periodDays: days,
        lastUpdated: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error fetching citation analytics:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Failed to fetch citation analytics',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: 500 }
    )
  }
}
