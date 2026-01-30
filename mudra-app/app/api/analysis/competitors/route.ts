import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'
import { quickValidateName } from '@/lib/services/competitor-validation.service'

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

  // Contains lowercase-only words longer than 15 chars (likely description)
  if (name === compLower && name.length > 15 && !/[A-Z0-9.]/.test(name)) return false

  return true
}

interface AggregatedCompetitor {
  name: string
  mentionCount: number
  shareOfVoice: number // SOV % = (competitor mentions ÷ all competitor mentions) × 100
  averagePosition: number
  sentiment: 'positive' | 'neutral' | 'negative'
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

    // Get ALL GEO analysis results for this brand profile
    const geoAnalyses = await prisma.geoAnalysisResult.findMany({
      where: { brandProfileId: profileId },
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

          for (const competitorName of competitors) {
            if (!competitorName || typeof competitorName !== 'string') continue

            const trimmedName = competitorName.trim()
            const lowerName = trimmedName.toLowerCase()

            // Skip if this is the user's brand
            if (lowerName === userBrandName ||
                lowerName.includes(userBrandName) ||
                userBrandName.includes(lowerName)) {
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

      // Also check summary.competitorData if it exists
      // Skip this when filtering by model since summary data doesn't have per-provider breakdown
      if (!modelFilter || modelFilter === 'all') {
        let summaryData: any = {}
        if (typeof analysis.summary === 'string') {
          try {
            summaryData = JSON.parse(analysis.summary)
          } catch {
            summaryData = {}
          }
        } else if (analysis.summary) {
          summaryData = analysis.summary
        }

        const competitorData = summaryData.competitorData || summaryData.competitorComparison || []
        if (Array.isArray(competitorData)) {
          for (const comp of competitorData) {
            if (!comp.name) continue

            const trimmedName = comp.name.trim()
            const lowerName = trimmedName.toLowerCase()

            // Skip user's brand
            if (lowerName === userBrandName ||
                lowerName.includes(userBrandName) ||
                userBrandName.includes(lowerName)) {
              continue
            }

            // Add mentions based on mentionCount
            const mentionCount = comp.mentionCount || 1
            for (let i = 0; i < mentionCount; i++) {
              addCompetitorMention(
                trimmedName,
                comp.averagePosition || null,
                'neutral'
              )
            }
          }
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

    // Calculate aggregated stats for each competitor
    const aggregatedCompetitors: AggregatedCompetitor[] = []

    competitorMentionMap.forEach((mentions, lowerKey) => {
      const mentionCount = mentions.length

      // Get the best display name (most frequently used casing)
      const displayName = getBestDisplayName(lowerKey)

      // Calculate SOV: (competitor mentions ÷ all competitor mentions) × 100
      const shareOfVoice = totalMentions > 0
        ? (mentionCount / totalMentions) * 100
        : 0

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

      aggregatedCompetitors.push({
        name: displayName,
        mentionCount,
        shareOfVoice: Math.round(shareOfVoice * 10) / 10, // Round to 1 decimal
        averagePosition: Math.round(averagePosition * 10) / 10,
        sentiment: overallSentiment
      })
    })

    // Sort by SOV (highest first) and optionally limit results
    const sortedCompetitors = aggregatedCompetitors.sort((a, b) => b.shareOfVoice - a.shareOfVoice)
    const topCompetitors = limit !== null ? sortedCompetitors.slice(0, limit) : sortedCompetitors

    return NextResponse.json({
      success: true,
      data: {
        competitors: topCompetitors,
        totalMentions,
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
