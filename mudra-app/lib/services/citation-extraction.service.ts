/**
 * Citation Extraction Service
 * 
 * Extracts and aggregates citation data from AI model responses.
 * Provides citation frequency, domain tracking, and source categorization.
 */

import { prisma } from '@/lib/prisma'

export type CitationType = 'Blog' | 'Listicle' | 'Docs' | 'News' | 'Academic' | 'Wiki' | 'Forum' | 'Video' | 'Product' | 'Review' | 'Social' | 'Other'

export interface ExtractedCitation {
  url: string
  domain: string
  title?: string
  citationType: CitationType
  provider: string
  promptId?: number
  responseId?: string
  timestamp: Date
}

export interface CitationSource {
  domain: string
  frequency: number
  citationFrequencyPercent: number
  citationType: CitationType
  urls: Array<{
    url: string
    title?: string
    citationType: string
    brandMentioned: boolean
  }>
  chatsWithCitation: number
}

export interface CitationAnalysis {
  totalResponses: number
  totalCitations: number
  sources: CitationSource[]
  topDomains: string[]
}

/**
 * Extract domain from a URL
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace('www.', '')
  } catch {
    // If URL parsing fails, try to extract domain with regex
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/)
    return match ? match[1] : url
  }
}

/**
 * Normalize URL for deduplication
 * Removes trailing slashes, www prefix, common tracking params, and normalizes case
 * Preserves port numbers and fragments for accuracy
 */
export function normalizeUrlForDedup(url: string): string {
  try {
    const parsed = new URL(url)

    // Normalize hostname (lowercase, remove www)
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '')

    // Preserve port if non-standard
    const port = parsed.port ? `:${parsed.port}` : ''

    // Normalize pathname (remove trailing slash unless it's just "/")
    let pathname = parsed.pathname
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1)
    }

    // Remove common tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'ref', 'source', 'fbclid', 'gclid', 'trackingId', 'tracking_id',
      'mc_cid', 'mc_eid', 'mkt_tok', '_ga', '_gl', 'oly_enc_id', 'oly_anon_id'
    ]
    const params = new URLSearchParams(parsed.search)
    trackingParams.forEach(p => params.delete(p))

    // Reconstruct URL without tracking params (exclude fragment for deduplication - same page)
    const cleanSearch = params.toString() ? `?${params.toString()}` : ''

    return `${parsed.protocol}//${hostname}${port}${pathname}${cleanSearch}`
  } catch {
    // Fallback: just lowercase and remove trailing slash
    return url.toLowerCase().replace(/\/+$/, '')
  }
}

/**
 * Categorize citation type based on URL and title patterns
 * Order matters - more specific patterns should come first
 */
export function categorizeCitation(url: string, title?: string): CitationType {
  const urlLower = url.toLowerCase()
  const titleLower = (title || '').toLowerCase()
  const combined = `${urlLower} ${titleLower}`

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
    domain.includes('academia.edu') ||
    combined.includes('research paper') ||
    combined.includes('academic paper')
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
    domain.includes('gitbook.io') ||
    combined.includes('documentation') ||
    combined.includes('api reference')
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
    urlLower.includes('/alternatives') ||
    combined.includes('top ') ||
    combined.includes('best ') ||
    /\d+\s*(best|top|ways|tips|tools)/.test(combined)
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
 * Extract citations from a single AI response
 *
 * Data sources captured (matching /api/analytics/citations logic):
 * - citations: Inline URL citations from AI response text (all providers)
 * - sources: ALL URLs from web search results (OpenAI Responses API)
 * - URLs embedded in response text
 */
export function extractCitationsFromResponse(
  response: string,
  citations: any[] = [],
  provider: string,
  timestamp: Date = new Date(),
  sources: any[] = []
): ExtractedCitation[] {
  const extractedCitations: ExtractedCitation[] = []
  // Use normalized URLs for deduplication to catch variations (trailing slashes, www, tracking params)
  const processedNormalizedUrls = new Set<string>()

  // Helper to extract URL from citation/source object
  const extractUrl = (item: any): string => {
    if (typeof item === 'string') return item
    if (item?.url) return item.url
    if (item?.link) return item.link
    return ''
  }

  // Helper to check if URL should be processed (not empty, not already seen)
  const shouldProcessUrl = (url: string): boolean => {
    if (!url || url.trim().length === 0) return false
    const normalized = normalizeUrlForDedup(url)
    if (processedNormalizedUrls.has(normalized)) return false
    processedNormalizedUrls.add(normalized)
    return true
  }

  // Process explicit citations from API
  if (citations && Array.isArray(citations)) {
    for (const citation of citations) {
      const url = extractUrl(citation)
      if (!shouldProcessUrl(url)) continue

      extractedCitations.push({
        url,
        domain: extractDomain(url),
        title: citation.title || citation.name,
        citationType: categorizeCitation(url, citation.title),
        provider,
        timestamp
      })
    }
  }

  // Process sources (web search results) - matches /api/analytics/citations behavior
  if (sources && Array.isArray(sources)) {
    for (const source of sources) {
      const url = extractUrl(source)
      if (!shouldProcessUrl(url)) continue

      extractedCitations.push({
        url,
        domain: extractDomain(url),
        title: source.title || source.name,
        citationType: categorizeCitation(url, source.title),
        provider,
        timestamp
      })
    }
  }

  // Also extract URLs from response text (for providers that embed citations)
  const urlPattern = /https?:\/\/[^\s\)\]\}\,<>"']+/g
  const urlsInResponse = response.match(urlPattern) || []

  for (const url of urlsInResponse) {
    // Clean up URL (remove trailing punctuation)
    const cleanUrl = url.replace(/[.,;:!?]+$/, '')

    // Skip if already extracted (uses normalized URL for deduplication)
    if (!shouldProcessUrl(cleanUrl)) continue

    extractedCitations.push({
      url: cleanUrl,
      domain: extractDomain(cleanUrl),
      citationType: categorizeCitation(cleanUrl),
      provider,
      timestamp
    })
  }

  return extractedCitations
}

/**
 * Aggregate citations for a specific prompt across all test results
 */
export function aggregateCitationsForPrompt(
  testResults: any[],
  totalResponses: number,
  brandName?: string
): CitationAnalysis {
  const domainMap = new Map<string, {
    citations: ExtractedCitation[]
    normalizedUrls: Set<string>  // Use normalized URLs for deduplication
    urlDetails: Map<string, { url: string; title?: string; citationType: string; brandMentioned: boolean }>  // Key is normalized URL, value includes original URL
    chatsWithCitation: number
    dominantType: Map<string, number>
  }>()

  let totalCitations = 0

  for (const result of testResults) {
    const citations = extractCitationsFromResponse(
      result.response || '',
      result.citations || [],
      result.provider || result.model || 'Unknown',
      result.timestamp ? new Date(result.timestamp) : new Date(),
      result.sources || []  // Include web search results to match /api/analytics/citations behavior
    )

    totalCitations += citations.length

    // Track which domains appear in this response (for frequency calculation)
    const domainsInThisResponse = new Set<string>()

    for (const citation of citations) {
      // Skip empty or invalid URLs
      if (!citation.url || citation.url.trim().length === 0) continue

      domainsInThisResponse.add(citation.domain)

      if (!domainMap.has(citation.domain)) {
        domainMap.set(citation.domain, {
          citations: [],
          normalizedUrls: new Set(),
          urlDetails: new Map(),
          chatsWithCitation: 0,
          dominantType: new Map()
        })
      }

      const domainData = domainMap.get(citation.domain)!
      domainData.citations.push(citation)

      // Use normalized URL for deduplication
      const normalizedUrl = normalizeUrlForDedup(citation.url)

      // Only add URL details if we haven't seen this normalized URL before
      if (!domainData.normalizedUrls.has(normalizedUrl)) {
        domainData.normalizedUrls.add(normalizedUrl)

        // Check if brand is mentioned in the response for this URL
        const brandMentioned = brandName
          ? (result.response || '').toLowerCase().includes(brandName.toLowerCase())
          : result.brandMentioned || false

        domainData.urlDetails.set(normalizedUrl, {
          url: citation.url,  // Store original URL for display
          title: citation.title,
          citationType: citation.citationType,
          brandMentioned
        })
      }

      // Track citation types for determining dominant type
      const currentTypeCount = domainData.dominantType.get(citation.citationType) || 0
      domainData.dominantType.set(citation.citationType, currentTypeCount + 1)
    }
    
    // Increment chat count for each domain that appeared in this response
    for (const domain of domainsInThisResponse) {
      const domainData = domainMap.get(domain)!
      domainData.chatsWithCitation += 1
    }
  }
  
  // Convert to CitationSource array
  const sources: CitationSource[] = []
  
  for (const [domain, data] of domainMap) {
    // Determine dominant citation type
    let dominantType: CitationType = 'Other'
    let maxCount = 0
    for (const [type, count] of data.dominantType) {
      if (count > maxCount) {
        maxCount = count
        dominantType = type as ExtractedCitation['citationType']
      }
    }
    
    // Calculate citation frequency percentage
    const citationFrequencyPercent = totalResponses > 0
      ? Math.round((data.chatsWithCitation / totalResponses) * 100)
      : 0
    
    // Build URL details array (use original URL from details, not the normalized key)
    const urls = Array.from(data.urlDetails.values()).map(details => ({
      url: details.url,
      title: details.title,
      citationType: details.citationType,
      brandMentioned: details.brandMentioned
    }))
    
    sources.push({
      domain,
      frequency: data.chatsWithCitation,
      citationFrequencyPercent,
      citationType: dominantType,
      urls,
      chatsWithCitation: data.chatsWithCitation
    })
  }
  
  // Sort by frequency (descending)
  sources.sort((a, b) => b.frequency - a.frequency)
  
  return {
    totalResponses,
    totalCitations,
    sources,
    topDomains: sources.slice(0, 10).map(s => s.domain)
  }
}

/**
 * Get citation analysis for a prompt from stored analysis results
 */
export async function getCitationAnalysisForPrompt(
  brandProfileId: number,
  promptId: number,
  dateRange?: '7d' | '14d' | '30d',
  platform?: string
): Promise<CitationAnalysis> {
  // Calculate date filter
  const now = new Date()
  let startDate: Date | undefined
  
  if (dateRange) {
    const days = dateRange === '7d' ? 7 : dateRange === '14d' ? 14 : 30
    startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  }
  
  // Get the prompt text
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId }
  })
  
  if (!prompt) {
    return { totalResponses: 0, totalCitations: 0, sources: [], topDomains: [] }
  }
  
  // Get brand profile for brand name
  const brandProfile = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId }
  })
  
  // Get analysis results with date filter
  const analysisResults = await prisma.geoAnalysisResult.findMany({
    where: {
      brandProfileId,
      ...(startDate && { createdAt: { gte: startDate } })
    },
    orderBy: { createdAt: 'desc' }
  })
  
  // Extract test results for this specific prompt
  const allTestResults: any[] = []
  
  for (const analysis of analysisResults) {
    const analyses = typeof analysis.analyses === 'string'
      ? JSON.parse(analysis.analyses)
      : (Array.isArray(analysis.analyses) ? analysis.analyses : [])
    
    for (const item of analyses) {
      // Handle both analysis structures
      if (item.prompt && normalizeText(item.prompt) === normalizeText(prompt.text)) {
        // Apply platform filter if specified
        if (platform && platform !== 'all') {
          const providerMatch = matchesPlatform(item.provider || item.model, platform)
          if (!providerMatch) continue
        }
        
        allTestResults.push({
          ...item,
          timestamp: item.timestamp || analysis.createdAt
        })
      } else if (item.promptTests) {
        const matchingTest = item.promptTests.find((test: any) =>
          normalizeText(test.prompt || '') === normalizeText(prompt.text)
        )
        if (matchingTest) {
          // Apply platform filter
          if (platform && platform !== 'all') {
            const providerMatch = matchesPlatform(item.provider, platform)
            if (!providerMatch) continue
          }
          
          allTestResults.push({
            ...matchingTest,
            provider: item.provider,
            timestamp: matchingTest.timestamp || analysis.createdAt
          })
        }
      }
    }
  }
  
  return aggregateCitationsForPrompt(
    allTestResults,
    allTestResults.length,
    brandProfile?.companyName || undefined
  )
}

/**
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
}

/**
 * Check if a provider matches the selected platform filter
 */
function matchesPlatform(provider: string, platform: string): boolean {
  const providerLower = (provider || '').toLowerCase()
  const platformLower = platform.toLowerCase()
  
  switch (platformLower) {
    case 'chatgpt':
      return providerLower.includes('openai') || providerLower.includes('chatgpt') || providerLower.includes('gpt')
    case 'claude':
      return providerLower.includes('anthropic') || providerLower.includes('claude')
    case 'perplexity':
      return providerLower.includes('perplexity')
    case 'gemini':
      return providerLower.includes('gemini')
    case 'ai overviews':
      return providerLower.includes('google') || providerLower.includes('aio') || providerLower.includes('overviews')
    default:
      return true
  }
}

export default {
  extractDomain,
  categorizeCitation,
  extractCitationsFromResponse,
  aggregateCitationsForPrompt,
  getCitationAnalysisForPrompt
}
