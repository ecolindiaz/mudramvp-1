import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'
import { quickValidateName } from '@/lib/services/competitor-validation.service'
import { resolveCompetitorDomains } from '@/lib/competitor-domain'
import { getCompanyDomain } from '@/lib/logo'

interface CompetitorMention {
  name: string
  position: number | null
  sentiment: 'positive' | 'neutral' | 'negative'
  promptId?: string
  provider?: string
}

// Known technology companies whitelist for instant verification
const KNOWN_COMPANIES = new Set([
  // Cloud & Hosting
  'aws', 'amazon web services', 'google cloud', 'gcp', 'azure', 'microsoft azure',
  'vercel', 'netlify', 'heroku', 'railway', 'render', 'fly.io', 'digitalocean',
  'cloudflare', 'cloudflare pages', 'cloudflare workers', 'fastly', 'akamai',
  'firebase', 'firebase hosting', 'supabase', 'planetscale', 'neon',
  'aws amplify', 'aws lambda', 'aws cloudfront', 'github pages',
  'digitalocean app platform', 'northflank', 'coolify', 'dokku', 'caprover',

  // DevOps & CI/CD
  'github', 'gitlab', 'bitbucket', 'jenkins', 'circleci', 'travis ci',
  'github actions', 'gitlab ci/cd', 'teamcity', 'bamboo', 'harness',
  'docker', 'kubernetes', 'terraform', 'pulumi', 'ansible',

  // Monitoring & Observability
  'datadog', 'new relic', 'sentry', 'splunk', 'elastic', 'grafana',
  'prometheus', 'dynatrace', 'logrocket', 'fullstory', 'hotjar',
  'pagerduty', 'opsgenie', 'statuspage', 'raygun', 'bugsnag', 'speedcurve',
  'debugbear', 'elastic apm', 'splunk observability cloud',

  // Databases
  'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch',
  'cockroachdb', 'fauna', 'dynamodb', 'cassandra', 'snowflake',

  // Frameworks & Tools
  'next.js', 'nuxt', 'gatsby', 'remix', 'astro', 'svelte', 'vue',
  'react', 'angular', 'webpack', 'vite', 'turbopack', 'esbuild',

  // AI & ML
  'openai', 'anthropic', 'hugging face', 'replicate', 'modal',
  'langchain', 'pinecone', 'weaviate', 'cohere', 'stability ai',
  'bolt.new', 'lovable', 'copilotkit', 'botpress', 'v0', 'cursor',
  'e2b', 'e2b.dev', 'beam cloud', 'beam', 'sagemaker', 'databricks',
  'replit', 'codesandbox',

  // E-commerce & CMS
  'shopify', 'stripe', 'square', 'paypal', 'contentful', 'sanity',
  'strapi', 'wordpress', 'webflow', 'wix', 'squarespace',
  'salesforce commerce cloud', 'bigcommerce',

  // CDN & Performance
  'bunny.net', 'amazon cloudfront', 'keycdn', 'stackpath',

  // Other tech
  'twilio', 'sendgrid', 'mailgun', 'postmark', 'slack', 'discord',
  'auth0', 'okta', 'clerk', 'segment', 'amplitude', 'mixpanel',
  'launchdarkly', 'split', 'optimizely', 'algolia', 'typesense',
  'retool', 'bubble', 'airtable', 'notion', 'coda', 'zapier',
  'dokploy', 'zeabur', 'koyeb', 'adaptable', 'cyclic', 'deta',
  'qovery', 'porter', 'kuberns', 'gartner peer insights',
  'google search console', 'g2',
])

/**
 * Filter out invalid competitor names (sentences, generic terms, etc.)
 * This is applied at query time to clean up existing bad data in the database.
 * Uses both whitelist matching and pattern-based validation.
 */
function isValidCompetitorName(name: string): boolean {
  if (!name || typeof name !== 'string') return false

  const compLower = name.toLowerCase().trim()

  // Fast path: check known companies whitelist first
  if (KNOWN_COMPANIES.has(compLower)) {
    return true
  }

  // Check if any known company is a close match
  for (const known of KNOWN_COMPANIES) {
    if (compLower === known || known.includes(compLower) || compLower.includes(known)) {
      return true
    }
  }

  // Use the validation service for pattern-based checks
  if (!quickValidateName(name)) {
    return false
  }

  // Additional pattern checks for this API

  // Length check: company names are typically 2-35 characters
  if (name.length < 2 || name.length > 35) return false

  // Filter out generic single words that aren't company names
  const genericSingleWords = [
    'for', 'the', 'and', 'but', 'framework', 'built', 'platform', 'service',
    'tool', 'tools', 'solution', 'solutions', 'system', 'systems', 'app',
    'application', 'software', 'cloud', 'server', 'servers', 'hosting',
    'enterprise', 'startup', 'startups', 'company', 'companies', 'product',
    'products', 'website', 'websites', 'web', 'mobile', 'desktop', 'api',
    // Single-word abstract/category terms
    'security', 'performance', 'reliability', 'scalability', 'compliance',
    'governance', 'automation', 'integration', 'deployment', 'infrastructure',
    'engagement', 'methodology', 'philosophy',
  ]
  if (genericSingleWords.includes(compLower)) return false

  // Sentence starters that indicate this is a phrase, not a company name
  const invalidStarts = [
    'others ', 'other ', 'posts ', 'reach out', 'sign up', 'check out',
    'learn more', 'get started', 'the ', 'a ', 'an ', 'some ', 'many ',
    'leading ', 'top ', 'best ', 'great ', 'amazing ', 'excellent ',
    'consider ', 'explore ', 'visit ', 'contact ', 'try ', 'use ',
    'as ', 'like ', 'such ', 'for ', 'with ', 'and ', 'or ', 'but ',
    'if ', 'when ', 'while ', 'although ', 'because ', 'since ',
    'however ', 'therefore ', 'thus ', 'hence ', 'also ', 'even ',
    'this ', 'that ', 'these ', 'those ', 'it ', 'they ', 'we ', 'you ',
    'i ', 'my ', 'our ', 'your ', 'their ', 'its ', 'his ', 'her ',
    'more ', 'less ', 'most ', 'least ', 'very ', 'quite ', 'rather ',
    'exceptional ', 'excellent ', 'enterprise', 'platform ',
  ]
  if (invalidStarts.some(start => compLower.startsWith(start))) return false

  // Verb patterns that indicate this is a sentence, not a company name
  const verbPatterns = [
    ' is ', ' are ', ' was ', ' were ', ' has ', ' have ', ' had ',
    ' does ', ' do ', ' did ', ' can ', ' may ', ' must ', ' will ',
    ' being ', ' been ', ' having ', ' doing ', ' would ', ' could ',
    ' should ', ' might ', ' shall ',
    ' that ', ' which ', ' who ', ' whom ', ' whose ', ' where ',
    ' because ', ' since ', ' although ', ' though ', ' while ',
    ' share ', ' highlight', ' recommend', ' suggest', ' contact ',
    ' directly', ' their team', ' your ', ' to your ', ' can help',
    ' sign up', ' check out', ' learn more', ' get started',
    ' want ', ' need ', ' require ', ' prefer ',
  ]
  if (verbPatterns.some(pattern => compLower.includes(pattern))) return false

  // Max 3 spaces (4 words) - company names rarely have more
  const spaceCount = (name.match(/\s/g) || []).length
  if (spaceCount > 3) return false

  // Ends with punctuation (sentences, not company names)
  if (/[.!?:,;]$/.test(name)) return false

  // Filter entries containing commas — company names almost never have commas
  if (name.includes(',')) return false

  // Contains lowercase-only words longer than 15 chars (likely description)
  if (name === compLower && name.length > 15 && !/[A-Z0-9.]/.test(name)) return false

  // Filter names containing '/' — almost never companies
  if (name.includes('/')) {
    const slashExceptions = ['fly.io', 'bolt.new', 'ci/cd', 'gitlab ci/cd', 'next.js']
    if (!slashExceptions.some(ex => compLower.includes(ex))) return false
  }

  // Filter multi-word phrases ending with plural category nouns
  const words = compLower.split(/\s+/)
  const pluralCategoryNouns = [
    'marketplaces', 'networks', 'services', 'providers', 'platforms',
    'solutions', 'tools', 'systems', 'agencies', 'organizations',
    'ecosystems', 'protocols', 'frameworks', 'offerings', 'alternatives', 'options',
  ]
  const lastWord = words[words.length - 1]
  const genericFirstWordsForCategory = [
    'ai', 'cloud', 'data', 'web', 'digital', 'enterprise', 'commercial',
    'decentralized', 'centralized', 'distributed', 'gpu', 'compute',
    'edge', 'serverless', 'managed', 'global', 'auto', 'instant',
    'online', 'virtual', 'professional', 'technical', 'coding',
    'career', 'job', 'industry', 'software', 'tech', 'open',
    'annotation', 'labeling', 'training',
  ]
  if (pluralCategoryNouns.includes(lastWord)) {
    if (words.length >= 2 && genericFirstWordsForCategory.includes(words[0])) return false
    if (words.length === 2) {
      const genericFirstWords = [
        'ai', 'cloud', 'data', 'web', 'digital', 'enterprise', 'commercial',
        'decentralized', 'centralized', 'distributed', 'gpu', 'compute',
        'edge', 'serverless', 'managed', 'global', 'auto', 'instant',
        'online', 'virtual', 'professional', 'technical', 'coding',
        'career', 'job', 'industry', 'software', 'tech', 'open',
        'annotation', 'labeling', 'training',
      ]
      if (genericFirstWords.includes(words[0])) return false
    }
  }

  // Filter 2-word names that are comparison category headings / attribute labels
  // e.g., "Core Identity", "Primary Strength", "Build Speed", "Engagement Model"
  if (words.length === 2) {
    const abstractNouns = new Set([
      'identity', 'strength', 'control', 'latency', 'speed', 'cost',
      'generosity', 'pricing', 'tier', 'stage', 'assessment', 'evaluation',
      'compliance', 'governance', 'scalability', 'flexibility', 'compatibility',
      'reliability', 'accuracy', 'performance', 'management', 'deployment',
      'integration', 'verification', 'automation', 'model', 'complexity',
      'maturity', 'readiness', 'coverage', 'efficiency', 'quality',
      'capability', 'capacity', 'overhead', 'footprint', 'posture',
      'focus', 'approach', 'methodology', 'philosophy',
      'security', 'experience', 'infrastructure',
    ]);
    const genericFirstForAbstract = new Set([
      'core', 'primary', 'best', 'free', 'low', 'high', 'setup', 'build',
      'deployment', 'infrastructure', 'security', 'model', 'engagement',
      'data', 'network', 'api', 'cloud', 'cost', 'price', 'code',
      'developer', 'user', 'platform', 'service', 'system', 'overall',
      'total', 'key', 'main', 'top', 'base', 'resource', 'vendor',
    ]);
    // Also check hyphenated first words (e.g., "low-latency" → check "low")
    const firstWordBase = words[0].split('-')[0]
    if (abstractNouns.has(words[1]) && (genericFirstForAbstract.has(words[0]) || genericFirstForAbstract.has(firstWordBase))) return false;
  }

  // 3+ word generic combo: first word generic AND last word generic tech term → filter
  if (words.length >= 3) {
    const genericFirstSet = [
      'ai', 'edge', 'cloud', 'serverless', 'managed', 'global', 'auto', 'instant',
      'decentralized', 'centralized', 'distributed', 'gpu', 'compute', 'data',
      'web', 'digital', 'enterprise', 'commercial', 'open',
      'free', 'low', 'high', 'fast', 'setup', 'build', 'deploy',
    ]
    const genericLastSet = [
      'sdk', 'gateway', 'service', 'platform', 'runtime', 'functions',
      'network', 'cdn', 'edge', 'proxy', 'cache', 'dashboard', 'console',
      'portal', 'studio', 'hub', 'center', 'marketplace', 'provider',
      'solution', 'tool', 'system', 'framework', 'protocol', 'ecosystem',
      'integration', 'automation', 'verification', 'deployment', 'management',
      'generosity', 'performance', 'latency', 'speed', 'cost', 'pricing',
    ]
    if (genericFirstSet.includes(words[0]) && genericLastSet.includes(lastWord)) return false
  }

  return true
}

interface AggregatedCompetitor {
  name: string
  mentionCount: number
  shareOfVoice: number // SOV % = (competitor mentions ÷ all competitor mentions) × 100
  averagePosition: number
  sentiment: 'positive' | 'neutral' | 'negative'
  domain: string
}

/**
 * GET /api/analysis/competitors?brandProfileId={id}&limit={n}
 *
 * Returns aggregated competitor data with proper Share of Voice calculation:
 * - Aggregates across ALL analysis runs (all tracked prompts)
 * - SOV % = (competitor mentions ÷ total competitor mentions) × 100
 * - Ranked by SOV (highest first)
 * - Returns top N competitors if limit is specified, otherwise ALL competitors
 * - Excludes the user's brand from the competitor list
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const brandProfileId = searchParams.get('brandProfileId')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam) : null // null means no limit (return all)
    const modelFilter = searchParams.get('model') // Optional: filter by specific AI model
    const countryFilter = searchParams.get('country') // Optional: filter by country code
    const daysParam = searchParams.get('days')
    const days = daysParam ? parseInt(daysParam, 10) : 30
    const sinceDate = days && !isNaN(days) && days > 0
      ? new Date(Date.now() - days * 86400000)
      : null

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

    // Require authentication and verify brand profile access
    const authResult = await requireAuthWithBrandAccess(brandProfileId)
    if (!authResult.success) {
      return authResult.response
    }

    const profileId = authResult.brandProfileId!

    // Get the brand profile to know the user's brand name (to exclude from competitors)
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { id: profileId }
    })

    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: 'Brand profile not found' },
        { status: 404 }
      )
    }

    const userBrandName = (brandProfile.companyName || '').toLowerCase()

    // Get GEO analysis results for this brand profile (filtered by time range)
    const geoAnalyses = await prisma.geoAnalysisResult.findMany({
      where: {
        brandProfileId: profileId,
        ...(countryFilter ? { country: countryFilter } : {}),
        ...(sinceDate ? { createdAt: { gte: sinceDate } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        analyses: true,
        summary: true,
        createdAt: true
      }
    })

    if (!geoAnalyses.length) {
      return NextResponse.json({
        success: true,
        data: {
          competitors: [],
          totalMentions: 0,
          analysisCount: 0,
          message: 'No analysis data available yet'
        }
      })
    }

    // Aggregate all competitor mentions across all analyses
    // Use lowercase key for deduplication, but track display names
    const competitorMentionMap = new Map<string, CompetitorMention[]>()
    const competitorDisplayNames = new Map<string, Map<string, number>>() // lowerKey -> { displayName -> count }
    // Collect all citations/sources for domain resolution
    const allCitations: Array<{ url?: string }> = []
    // Track brand mentions separately (for "You" row in SOV table)
    let brandMentionCount = 0
    const brandMentions: Array<{ position: number | null; sentiment: 'positive' | 'neutral' | 'negative' }> = []

    // Helper to add a competitor mention with case-insensitive deduplication
    const addCompetitorMention = (
      rawName: string,
      position: number | null,
      sentiment: 'positive' | 'neutral' | 'negative',
      provider?: string
    ) => {
      const trimmedName = rawName.trim()

      // CRITICAL: Filter out invalid competitor names (sentences, generic terms, etc.)
      // This cleans up bad data that was stored before the improved filter was added
      if (!isValidCompetitorName(trimmedName)) {
        return // Skip this entry
      }

      const lowerKey = trimmedName.toLowerCase()

      // Get or create the mentions array using lowercase key
      if (!competitorMentionMap.has(lowerKey)) {
        competitorMentionMap.set(lowerKey, [])
        competitorDisplayNames.set(lowerKey, new Map())
      }

      // Track display name frequency to pick the most common casing
      const displayCounts = competitorDisplayNames.get(lowerKey)!
      displayCounts.set(trimmedName, (displayCounts.get(trimmedName) || 0) + 1)

      competitorMentionMap.get(lowerKey)!.push({
        name: trimmedName,
        position,
        sentiment,
        provider
      })
    }

    for (const analysis of geoAnalyses) {
      // Parse analyses if it's a string
      let analysesData: any[] = []
      if (typeof analysis.analyses === 'string') {
        try {
          analysesData = JSON.parse(analysis.analyses)
        } catch {
          analysesData = []
        }
      } else if (Array.isArray(analysis.analyses)) {
        analysesData = analysis.analyses
      }

      // Extract competitor mentions from each analysis
      for (const providerAnalysis of analysesData) {
        // Handle different data structures
        const promptTests = providerAnalysis.promptTests || providerAnalysis.tests || []
        const provider = providerAnalysis.provider || 'unknown'

        // Skip this provider if model filter is specified and doesn't match
        if (modelFilter && modelFilter !== 'all') {
          const normalizedProvider = normalizeModelName(provider)
          const targetModel = normalizeModelName(modelFilter)
          if (normalizedProvider !== targetModel) continue
        }

        for (const test of promptTests) {
          // Get competitors mentioned in this test
          const competitors = test.competitors || test.competitorsMentioned || []
          const positions = test.competitorPositions || {}
          const sentiments = test.competitorSentiments || {}

          // Collect citations/sources for domain resolution
          if (test.citations) allCitations.push(...test.citations)
          if (test.sources) allCitations.push(...test.sources)

          // Track brand mentions from the brandMentioned field (for "You" row)
          if (test.brandMentioned === true) {
            brandMentionCount++
            brandMentions.push({
              position: test.brandPosition ?? null,
              sentiment: test.sentiment || 'neutral'
            })
          }

          for (const competitorName of competitors) {
            if (!competitorName || typeof competitorName !== 'string') continue

            const trimmedName = competitorName.trim()
            const lowerName = trimmedName.toLowerCase()

            // Skip if this is the user's brand (shouldn't be in competitors, but safety check)
            if (lowerName === userBrandName ||
                lowerName.includes(userBrandName) ||
                (userBrandName.length >= 3 && userBrandName.includes(lowerName))) {
              continue
            }

            addCompetitorMention(
              trimmedName,
              positions[competitorName] || positions[trimmedName] || null,
              sentiments[competitorName] || sentiments[trimmedName] || 'neutral',
              provider
            )
          }
        }
      }

      // Note: summary.competitorData is derived from the same per-prompt test data above.
      // We intentionally skip it to avoid double-counting competitor mentions.
    }

    // Dedup merge: merge "X" and "X suffix" entries (e.g., "akash" + "akash network")
    // Also handles TLD variants: "e2b" + "e2b.dev", "fly" + "fly.io"
    // Prefer the longer (more specific) name as display name
    const companySuffixes = new Set([
      'network', 'ai', 'labs', 'protocol', 'cloud', 'tech', 'technologies',
      'digital', 'studio', 'studios', 'global', 'group', 'hq', 'io',
      'platform', 'software', 'computing', 'systems', 'data', 'health',
    ])
    const tldSuffixes = new Set(['dev', 'io', 'ai', 'com', 'net', 'cloud', 'new', 'app', 'sh'])

    const mergePair = (keepKey: string, removeKey: string) => {
      const keepMentions = competitorMentionMap.get(keepKey) || []
      const removeMentions = competitorMentionMap.get(removeKey) || []
      competitorMentionMap.set(keepKey, [...keepMentions, ...removeMentions])
      const keepDisplayCounts = competitorDisplayNames.get(keepKey)
      const removeDisplayCounts = competitorDisplayNames.get(removeKey)
      if (removeDisplayCounts && keepDisplayCounts) {
        removeDisplayCounts.forEach((count, name) => {
          keepDisplayCounts.set(name, (keepDisplayCounts.get(name) || 0) + count)
        })
      }
      competitorMentionMap.delete(removeKey)
      competitorDisplayNames.delete(removeKey)
    }

    const allKeys = Array.from(competitorMentionMap.keys())
    for (const key of allKeys) {
      if (!competitorMentionMap.has(key)) continue // already merged
      const keyWords = key.split(/\s+/)
      // Only check 1-word keys for potential merge with 2-word keys
      if (keyWords.length !== 1) continue
      for (const otherKey of allKeys) {
        if (key === otherKey || !competitorMentionMap.has(otherKey)) continue
        // Space-separated suffix: "akash" + "akash network"
        const otherWords = otherKey.split(/\s+/)
        if (otherWords.length === 2 && otherWords[0] === key && companySuffixes.has(otherWords[1])) {
          mergePair(otherKey, key)
          break
        }
        // TLD suffix: "e2b" + "e2b.dev", "fly" + "fly.io"
        if (otherWords.length === 1 && otherKey.includes('.')) {
          const dotParts = otherKey.split('.')
          if (dotParts.length === 2 && dotParts[0] === key && tldSuffixes.has(dotParts[1])) {
            mergePair(otherKey, key)
            break
          }
        }
      }
    }

    // Second pass: merge dot-separated and space-separated variants
    // e.g., "beam.cloud" and "beam cloud" are the same entity
    const remainingKeys = Array.from(competitorMentionMap.keys())
    for (const key of remainingKeys) {
      if (!competitorMentionMap.has(key)) continue
      if (!key.includes('.')) continue
      const dotParts = key.split('.')
      if (dotParts.length !== 2 || !tldSuffixes.has(dotParts[1])) continue
      const spaceVariant = dotParts.join(' ')
      if (competitorMentionMap.has(spaceVariant)) {
        // Merge the smaller into the larger
        const dotCount = competitorMentionMap.get(key)!.length
        const spaceCount = competitorMentionMap.get(spaceVariant)!.length
        if (spaceCount >= dotCount) {
          mergePair(spaceVariant, key)
        } else {
          mergePair(key, spaceVariant)
        }
      }
    }

    // Helper to get the best display name (most frequently used casing)
    const getBestDisplayName = (lowerKey: string): string => {
      const displayCounts = competitorDisplayNames.get(lowerKey)
      if (!displayCounts || displayCounts.size === 0) return lowerKey

      let bestName = lowerKey
      let maxCount = 0
      displayCounts.forEach((count, name) => {
        if (count > maxCount) {
          maxCount = count
          bestName = name
        }
      })
      return bestName
    }

    // Calculate total mentions across all competitors
    let totalMentions = 0
    competitorMentionMap.forEach(mentions => {
      totalMentions += mentions.length
    })

    // Resolve competitor domains from citations
    const competitorNames = Array.from(competitorMentionMap.keys()).map(k => getBestDisplayName(k))
    const resolvedDomains = resolveCompetitorDomains(competitorNames, allCitations)

    // Calculate aggregated stats for each competitor (SOV placeholder — recalculated below)
    const aggregatedCompetitors: AggregatedCompetitor[] = []

    competitorMentionMap.forEach((mentions, lowerKey) => {
      const mentionCount = mentions.length

      // Get the best display name (most frequently used casing)
      const displayName = getBestDisplayName(lowerKey)

      // Calculate average position (only from mentions with positions)
      const positionsWithValues = mentions.filter(m => m.position !== null && m.position > 0)
      const averagePosition = positionsWithValues.length > 0
        ? positionsWithValues.reduce((sum, m) => sum + (m.position || 0), 0) / positionsWithValues.length
        : 0

      // Calculate overall sentiment (majority wins)
      const sentimentCounts = { positive: 0, neutral: 0, negative: 0 }
      mentions.forEach(m => {
        sentimentCounts[m.sentiment]++
      })
      const overallSentiment = Object.entries(sentimentCounts)
        .sort(([, a], [, b]) => b - a)[0][0] as 'positive' | 'neutral' | 'negative'

      // Resolve domain: citation match > static mapping > fallback
      const domain = resolvedDomains.get(lowerKey) || getCompanyDomain(displayName)

      aggregatedCompetitors.push({
        name: displayName,
        mentionCount,
        shareOfVoice: 0, // Placeholder — recalculated with top-10 denominator below
        averagePosition: Math.round(averagePosition * 10) / 10,
        sentiment: overallSentiment,
        domain
      })
    })

    // Sort by mention count to determine the top 10 competitors
    aggregatedCompetitors.sort((a, b) => b.mentionCount - a.mentionCount)

    // Calculate SOV using top-10 denominator for meaningful percentages
    // Industry standard: SOV is scoped to top competitors, not all 90+ entities
    const TOP_N = 10
    const topNTotalMentions = aggregatedCompetitors
      .slice(0, TOP_N)
      .reduce((sum, c) => sum + c.mentionCount, 0)

    for (const competitor of aggregatedCompetitors) {
      competitor.shareOfVoice = topNTotalMentions > 0
        ? Math.round((competitor.mentionCount / topNTotalMentions) * 100 * 10) / 10
        : 0
    }

    // Calculate brand SOV + stats using the same top-10 denominator
    const brandShareOfVoice = topNTotalMentions > 0
      ? Math.round((brandMentionCount / topNTotalMentions) * 100 * 10) / 10
      : 0

    const brandPositionsWithValues = brandMentions.filter(m => m.position !== null && m.position! > 0)
    const brandAvgPosition = brandPositionsWithValues.length > 0
      ? Math.round(brandPositionsWithValues.reduce((sum, m) => sum + (m.position || 0), 0) / brandPositionsWithValues.length * 10) / 10
      : 0

    const brandSentimentCounts = { positive: 0, neutral: 0, negative: 0 }
    brandMentions.forEach(m => { brandSentimentCounts[m.sentiment]++ })
    const brandSentiment = (Object.entries(brandSentimentCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'neutral') as 'positive' | 'neutral' | 'negative'

    const brandDomain = brandProfile.companyWebsite
      ? brandProfile.companyWebsite.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0]
      : ''

    // Re-sort by SOV (same order as mentionCount since denominator is constant)
    const sortedCompetitors = aggregatedCompetitors.sort((a, b) => b.shareOfVoice - a.shareOfVoice)
    const topCompetitors = limit !== null ? sortedCompetitors.slice(0, limit) : sortedCompetitors

    return NextResponse.json({
      success: true,
      data: {
        competitors: topCompetitors,
        brandData: brandMentionCount > 0 ? {
          name: brandProfile.companyName || 'Your Brand',
          mentionCount: brandMentionCount,
          shareOfVoice: brandShareOfVoice,
          averagePosition: brandAvgPosition,
          sentiment: brandSentiment,
          domain: brandDomain
        } : null,
        totalMentions,
        topNTotalMentions,
        analysisCount: geoAnalyses.length,
        lastAnalysisAt: geoAnalyses[0]?.createdAt
      }
    })

  } catch (error) {
    console.error('Error fetching competitor SOV data:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch competitor data' },
      { status: 500 }
    )
  }
}
