/**
 * Issue Discovery Service
 * 
 * AI-powered discovery of optimization opportunities based on
 * current analysis scores. Issues are progressively discovered
 * as scores improve - fundamentals first, then advanced.
 */

import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import crypto from 'crypto'

// Types
export type IssueCategory = 'technical_structure' | 'ai_visibility' | 'conversation'
export type DiscoveryTier = 'fundamental' | 'intermediate' | 'advanced' | 'polish'
export type IssuePriority = 'low' | 'medium' | 'high' | 'critical'

export interface DiscoveredIssue {
  title: string
  description: string
  priority: IssuePriority
  agentType: string
  estimatedImpact: string
  affectedUrl?: string
  category: IssueCategory
  discoveryTier: DiscoveryTier
  discoveredFromScore?: number
}

interface DiscoveryResult {
  discovered: number
  categories: Record<IssueCategory, number>
  tiers: Record<DiscoveryTier, number>
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/**
 * Get discovery tiers based on current score
 * Higher scores unlock more advanced issue tiers
 */
export function getTiersForScore(score: number): DiscoveryTier[] {
  if (score >= 80) return ['fundamental', 'intermediate', 'advanced', 'polish']
  if (score >= 60) return ['fundamental', 'intermediate', 'advanced']
  if (score >= 30) return ['fundamental', 'intermediate']
  return ['fundamental']
}

/**
 * Get tier description for LLM prompts
 */
export function getTierDescription(tier: DiscoveryTier): string {
  const descriptions: Record<DiscoveryTier, string> = {
    fundamental: 'Critical basics that every site needs - the foundation for AI visibility',
    intermediate: 'Common optimizations that significantly improve AI discoverability',
    advanced: 'Sophisticated improvements for competitive advantage in AI responses',
    polish: 'Fine-tuning and edge cases for maximum optimization'
  }
  return descriptions[tier]
}

/**
 * Generate unique hash for issue deduplication
 * Same title + category + brand = same issue
 */
export function generateIssueHash(
  brandProfileId: number,
  category: string,
  title: string
): string {
  const normalized = `${brandProfileId}-${category}-${title.toLowerCase().trim()}`
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

/**
 * Get latest technical structure score for a brand
 */
export async function getLatestTechnicalScore(brandProfileId: number): Promise<number> {
  const analysis = await prisma.technicalStructureAnalysis.findFirst({
    where: { brandProfileId },
    orderBy: { createdAt: 'desc' },
    select: { overallScore: true }
  })
  return analysis?.overallScore ?? 0
}

/**
 * Get latest AI visibility score for a brand
 */
export async function getLatestAIVisibilityScore(brandProfileId: number): Promise<number> {
  const result = await prisma.geoAnalysisResult.findFirst({
    where: { brandProfileId },
    orderBy: { createdAt: 'desc' },
    select: { overallScore: true }
  })
  return result?.overallScore ?? 0
}

/**
 * Get website analysis data for discovery prompts
 */
async function getWebsiteAnalysisData(brandProfileId: number) {
  const [brandProfile, technicalAnalysis, geoAnalysis] = await Promise.all([
    prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: {
        companyName: true,
        companyWebsite: true,
        companyIndustry: true,
        companyServices: true,
        companyDescription: true
      }
    }),
    prisma.technicalStructureAnalysis.findFirst({
      where: { brandProfileId },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.geoAnalysisResult.findFirst({
      where: { brandProfileId },
      orderBy: { createdAt: 'desc' }
    })
  ])

  return {
    brandProfile,
    technicalAnalysis,
    geoAnalysis
  }
}

/**
 * Discover technical structure issues using LLM
 */
async function discoverTechnicalIssues(
  brandProfileId: number,
  websiteData: Awaited<ReturnType<typeof getWebsiteAnalysisData>>,
  tiers: DiscoveryTier[],
  currentScore: number
): Promise<DiscoveredIssue[]> {
  const { brandProfile, technicalAnalysis } = websiteData

  if (!brandProfile || !technicalAnalysis) {
    return []
  }

  // Extract metadata from JSON field
  const metadata = (technicalAnalysis.metadata || {}) as Record<string, unknown>

  const tierDescriptions = tiers.map(t => `- ${t.toUpperCase()}: ${getTierDescription(t)}`).join('\n')

  const prompt = `You are an expert at identifying technical SEO and AI-optimization issues.

WEBSITE ANALYSIS:
- Company: ${brandProfile.companyName}
- URL: ${brandProfile.companyWebsite}
- Industry: ${brandProfile.companyIndustry || 'Unknown'}
- Technical Score: ${currentScore}/100

CURRENT TECHNICAL STATE:
- Has Schema Markup: ${metadata.hasSchemaMarkup ?? 'Unknown'}
- Schema Types Found: ${JSON.stringify(metadata.schemaTypes || [])}
- Has FAQ Schema: ${metadata.hasFaqSchema ?? 'Unknown'}
- Has Sitemap: ${metadata.hasSitemap ?? 'Unknown'}
- Has Robots.txt: ${metadata.hasRobotsTxt ?? 'Unknown'}
- Page Speed Score: ${metadata.pageSpeedScore || technicalAnalysis.performanceScore || 'Unknown'}
- Heading Structure Valid: ${metadata.headingStructureValid ?? 'Unknown'}
- Meta Description Present: ${metadata.hasMetaDescription ?? 'Unknown'}

ALLOWED TIERS (based on current score):
${tierDescriptions}

ISSUE TYPES BY TIER:

FUNDAMENTAL (score 0-30):
- Missing robots.txt or sitemap.xml
- No meta descriptions
- Missing basic Organization schema
- No heading hierarchy (H1 missing)
- No favicon

INTERMEDIATE (score 30-60):
- FAQ schema improvements
- Article/BlogPosting schema
- Internal linking optimization
- Heading restructuring for Q&A format
- Image alt text improvements

ADVANCED (score 60-80):
- Rich snippet optimization
- Breadcrumb schema
- Speakable schema for voice search
- HowTo schema for guides
- Video schema

POLISH (score 80+):
- Minor performance optimizations
- Edge case schema additions
- Mobile-specific optimizations

Generate issues ONLY for the allowed tiers. Each issue must be:
1. Specific and actionable
2. Fixable by an automated agent
3. Have measurable impact

Return a JSON object with an "issues" array:
{
  "issues": [
    {
      "title": "Add Organization Schema Markup",
      "description": "Your homepage lacks Organization schema markup, which helps AI systems understand your brand identity and display rich results.",
      "priority": "high",
      "agentType": "schema_markup",
      "estimatedImpact": "+5-8 points",
      "discoveryTier": "fundamental",
      "affectedUrl": "/"
    }
  ]
}

AGENT TYPES:
- schema_markup: For JSON-LD schema generation
- heading_hierarchy: For heading structure fixes
- site_config: For robots.txt, sitemap issues
- meta_optimization: For meta tags, descriptions
- content_structure: For FAQ sections, lists, tables

Generate 2-5 issues maximum. Focus on highest impact items first.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3
    })

    const content = response.choices[0].message.content
    if (!content) return []

    const parsed = JSON.parse(content) as { issues: DiscoveredIssue[] }
    
    return parsed.issues.map(issue => ({
      ...issue,
      category: 'technical_structure' as const,
      discoveredFromScore: currentScore
    }))
  } catch (error) {
    console.error('[IssueDiscovery] Technical issues discovery failed:', error)
    return []
  }
}

/**
 * Discover AI visibility issues using LLM
 */
async function discoverAIVisibilityIssues(
  brandProfileId: number,
  websiteData: Awaited<ReturnType<typeof getWebsiteAnalysisData>>,
  tiers: DiscoveryTier[],
  currentScore: number
): Promise<DiscoveredIssue[]> {
  const { brandProfile, geoAnalysis } = websiteData

  if (!brandProfile) {
    return []
  }

  // Check if llms.txt exists
  const policyFile = await prisma.policyFile.findFirst({
    where: { 
      brand_profile_id: brandProfileId
    }
  })

  const tierDescriptions = tiers.map(t => `- ${t.toUpperCase()}: ${getTierDescription(t)}`).join('\n')

  const prompt = `You are an expert at optimizing websites for AI visibility (LLMs, ChatGPT, Perplexity, etc.).

WEBSITE CONTEXT:
- Company: ${brandProfile.companyName}
- URL: ${brandProfile.companyWebsite}
- Industry: ${brandProfile.companyIndustry || 'Unknown'}
- Services: ${brandProfile.companyServices || 'Unknown'}

AI VISIBILITY STATE:
- AI Visibility Score: ${currentScore}/100
- llms.txt exists: ${policyFile?.llms_txt_exists ? 'Yes' : 'No'}
- llms.txt content length: ${policyFile?.llms_txt_content?.length || 0} chars
- Overall GEO Score: ${geoAnalysis?.overallScore || 'Not analyzed'}

ALLOWED TIERS:
${tierDescriptions}

ISSUE TYPES BY TIER:

FUNDAMENTAL (score 0-30):
- Missing llms.txt file entirely
- No AI-readable content structure
- Poor citation signals (no authoritative claims)
- Content not formatted for LLM consumption
- No clear brand messaging for AI

INTERMEDIATE (score 30-60):
- llms.txt exists but incomplete/outdated
- Content restructuring for AI understanding
- Citation-worthy statement improvements
- Authority signal enhancements
- Key differentiators not highlighted

ADVANCED (score 60+):
- llms.txt optimization for competitive positioning
- Advanced citation strategies
- Multi-platform AI optimization
- Thought leadership content gaps
- Industry-specific AI optimizations

Generate issues ONLY for allowed tiers. Each must be:
1. Specific to AI visibility improvement
2. Actionable by an automated agent
3. Have clear impact on AI citations

Return JSON:
{
  "issues": [
    {
      "title": "Create llms.txt File",
      "description": "Your website lacks an llms.txt file, which AI systems use to understand how to represent your brand. This is critical for consistent AI-generated responses about your company.",
      "priority": "critical",
      "agentType": "llms_txt",
      "estimatedImpact": "+10-15 points",
      "discoveryTier": "fundamental"
    }
  ]
}

AGENT TYPES:
- llms_txt: For creating/updating llms.txt
- llms_txt_optimizer: For optimizing existing llms.txt
- citation_signals: For improving citation-worthy content
- ai_content_optimizer: For restructuring content for AI
- brand_messaging: For clarifying brand identity for AI

Generate 2-5 issues maximum.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3
    })

    const content = response.choices[0].message.content
    if (!content) return []

    const parsed = JSON.parse(content) as { issues: DiscoveredIssue[] }
    
    return parsed.issues.map(issue => ({
      ...issue,
      category: 'ai_visibility' as const,
      discoveredFromScore: currentScore
    }))
  } catch (error) {
    console.error('[IssueDiscovery] AI visibility issues discovery failed:', error)
    return []
  }
}

/**
 * Discover conversation opportunities from Conversation Radar
 */
async function discoverConversationOpportunities(
  brandProfileId: number
): Promise<DiscoveredIssue[]> {
  // Get active conversation opportunities that haven't been converted to issues
  const opportunities = await prisma.conversationOpportunity.findMany({
    where: {
      brandProfileId,
      status: 'new'
    },
    orderBy: { relevanceScore: 'desc' },
    take: 5
  })

  return opportunities.map(opp => ({
    title: `Engage: ${opp.postTitle?.slice(0, 50) || 'Conversation Opportunity'}`,
    description: `${opp.platform} opportunity with relevance score ${opp.relevanceScore || 0}. ${opp.conversationSnapshot || ''}`,
    priority: (opp.relevanceScore || 0) >= 80 ? 'high' : (opp.relevanceScore || 0) >= 50 ? 'medium' : 'low' as IssuePriority,
    agentType: 'conversation_engagement',
    estimatedImpact: 'Brand visibility boost',
    affectedUrl: opp.postUrl || undefined,
    category: 'conversation' as const,
    discoveryTier: 'fundamental' as const,
    discoveredFromScore: opp.relevanceScore ?? undefined
  }))
}

/**
 * Upsert discovered issues with deduplication
 */
async function upsertDiscoveredIssues(
  brandProfileId: number,
  issues: DiscoveredIssue[]
): Promise<number> {
  let created = 0

  for (const issue of issues) {
    const hash = generateIssueHash(brandProfileId, issue.category, issue.title)

    // Check if issue already exists (by hash)
    const existing = await prisma.issue.findUnique({
      where: { issueHash: hash }
    })

    if (existing) {
      // Only update if still in 'identified' status
      if (existing.status === 'identified') {
        await prisma.issue.update({
          where: { id: existing.id },
          data: {
            description: issue.description,
            priority: issue.priority,
            estimatedImpact: issue.estimatedImpact,
            updatedAt: new Date()
          }
        })
      }
      // Skip if already in progress/completed/merged
      continue
    }

    // Create new issue
    await prisma.issue.create({
      data: {
        brandProfileId,
        title: issue.title,
        description: issue.description,
        type: 'improvement',
        status: 'identified',
        priority: issue.priority,
        category: issue.category,
        discoveryTier: issue.discoveryTier,
        agentType: issue.agentType,
        estimatedImpact: issue.estimatedImpact,
        affectedUrl: issue.affectedUrl,
        discoveredFromScore: issue.discoveredFromScore,
        sourceAnalysis: issue.category === 'technical_structure' 
          ? 'technical_analysis' 
          : issue.category === 'ai_visibility'
            ? 'geo_analysis'
            : 'conversation_radar',
        issueHash: hash
      }
    })
    created++
  }

  return created
}

/**
 * Main discovery orchestrator
 * Runs after each analysis to discover new issues
 */
export async function discoverIssues(brandProfileId: number): Promise<DiscoveryResult> {
  console.log(`[IssueDiscovery] Starting discovery for brand ${brandProfileId}`)

  // 1. Get current scores
  const [technicalScore, aiVisibilityScore] = await Promise.all([
    getLatestTechnicalScore(brandProfileId),
    getLatestAIVisibilityScore(brandProfileId)
  ])

  console.log(`[IssueDiscovery] Scores - Technical: ${technicalScore}, AI Visibility: ${aiVisibilityScore}`)

  // 2. Get tiers for each category
  const technicalTiers = getTiersForScore(technicalScore)
  const aiVisibilityTiers = getTiersForScore(aiVisibilityScore)

  console.log(`[IssueDiscovery] Tiers - Technical: ${technicalTiers.join(', ')}, AI: ${aiVisibilityTiers.join(', ')}`)

  // 3. Get website data
  const websiteData = await getWebsiteAnalysisData(brandProfileId)

  // 4. Discover issues in parallel
  const [technicalIssues, aiVisibilityIssues, conversationIssues] = await Promise.all([
    discoverTechnicalIssues(brandProfileId, websiteData, technicalTiers, technicalScore),
    discoverAIVisibilityIssues(brandProfileId, websiteData, aiVisibilityTiers, aiVisibilityScore),
    discoverConversationOpportunities(brandProfileId)
  ])

  console.log(`[IssueDiscovery] Found - Technical: ${technicalIssues.length}, AI: ${aiVisibilityIssues.length}, Conversation: ${conversationIssues.length}`)

  // 5. Upsert all issues (handles deduplication)
  const allIssues = [...technicalIssues, ...aiVisibilityIssues, ...conversationIssues]
  const created = await upsertDiscoveredIssues(brandProfileId, allIssues)

  console.log(`[IssueDiscovery] Created ${created} new issues`)

  // 6. Calculate tier distribution
  const tierCounts: Record<DiscoveryTier, number> = {
    fundamental: 0,
    intermediate: 0,
    advanced: 0,
    polish: 0
  }
  
  for (const issue of allIssues) {
    tierCounts[issue.discoveryTier]++
  }

  return {
    discovered: allIssues.length,
    categories: {
      technical_structure: technicalIssues.length,
      ai_visibility: aiVisibilityIssues.length,
      conversation: conversationIssues.length
    },
    tiers: tierCounts
  }
}

/**
 * Get issues for a brand profile
 */
export async function getIssuesForBrand(
  brandProfileId: number,
  filters?: {
    status?: string
    category?: string
    priority?: string
  }
) {
  return prisma.issue.findMany({
    where: {
      brandProfileId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.category && { category: filters.category }),
      ...(filters?.priority && { priority: filters.priority })
    },
    orderBy: [
      { priority: 'desc' },
      { order: 'asc' },
      { createdAt: 'desc' }
    ],
    include: {
      deployedAgent: {
        select: {
          id: true,
          status: true,
          agentName: true
        }
      }
    }
  })
}
