import { getCompanyDomain } from '@/lib/logo'

/**
 * Domains of article/review sites that should NOT be matched as competitor homepages.
 */
const EXCLUDED_DOMAINS = new Set([
  'techcrunch.com', 'forbes.com', 'bloomberg.com', 'reuters.com', 'cnbc.com',
  'theverge.com', 'wired.com', 'zdnet.com', 'venturebeat.com', 'medium.com',
  'dev.to', 'reddit.com', 'stackoverflow.com', 'g2.com', 'gartner.com',
  'capterra.com', 'trustradius.com', 'producthunt.com', 'crunchbase.com',
  'linkedin.com', 'twitter.com', 'x.com', 'youtube.com', 'wikipedia.org',
  'github.com', 'news.ycombinator.com',
])

interface Citation {
  url?: string
  [key: string]: any
}

/**
 * Extract the "brand part" from a hostname (hostname minus TLD).
 * e.g. "dataloop.ai" -> "dataloop", "fly.io" -> "fly", "aws.amazon.com" -> "amazon"
 */
function extractBrandPart(hostname: string): string {
  const parts = hostname.split('.')
  // For subdomains like "cloud.google.com", take the second-to-last part
  // For simple domains like "dataloop.ai", take the first part
  if (parts.length >= 3) {
    return parts[parts.length - 2]
  }
  return parts[0]
}

/**
 * Resolve competitor domains by matching competitor names to URLs
 * found in citation/source data from AI analysis responses.
 *
 * For each competitor name, searches all citation URLs for domains
 * whose "brand part" (hostname minus TLD) matches the normalized competitor name.
 * Excludes known article/review sites to avoid false matches.
 *
 * @returns Map of lowercased competitor name -> domain (e.g. "dataloop" -> "dataloop.ai")
 */
export function resolveCompetitorDomains(
  competitors: string[],
  citations: Citation[],
  sources?: Citation[]
): Map<string, string> {
  const resolved = new Map<string, string>()

  // Collect all URLs from citations and sources
  const allUrls: string[] = []
  for (const c of citations) {
    if (c.url) allUrls.push(c.url)
  }
  if (sources) {
    for (const s of sources) {
      if (s.url) allUrls.push(s.url)
    }
  }

  // Parse all URLs into { hostname, brandPart } for efficient matching
  const parsedUrls: Array<{ hostname: string; brandPart: string }> = []
  for (const url of allUrls) {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
      const hostname = parsed.hostname.replace(/^www\./, '')
      if (EXCLUDED_DOMAINS.has(hostname)) continue
      parsedUrls.push({ hostname, brandPart: extractBrandPart(hostname) })
    } catch {
      // skip invalid URLs
    }
  }

  for (const name of competitors) {
    const lowerName = name.toLowerCase().trim()
    const normalized = lowerName.replace(/[^a-z0-9]/g, '')
    if (!normalized) continue

    // If the competitor name looks like a domain (e.g. "fly.io", "bolt.new"),
    // also try matching it directly against hostnames
    const nameIsDomain = lowerName.includes('.') && !lowerName.includes(' ')

    for (const { hostname, brandPart } of parsedUrls) {
      if (brandPart === normalized) {
        resolved.set(lowerName, hostname)
        break
      }
      // Direct hostname match for domain-like names (e.g. "fly.io" === "fly.io")
      if (nameIsDomain && hostname === lowerName) {
        resolved.set(lowerName, hostname)
        break
      }
    }
  }

  return resolved
}

/**
 * Get the full URL for a competitor, using resolved domain first,
 * then falling back to the static mapping in lib/logo.ts,
 * then falling back to cleaned name + .com.
 */
export function getCompetitorUrl(name: string, resolvedDomain?: string): string {
  if (resolvedDomain) {
    return `https://${resolvedDomain}`
  }
  const domain = getCompanyDomain(name)
  return `https://${domain}`
}
