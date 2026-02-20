/**
 * Issue Discovery Service
 *
 * Deterministic discovery of optimization opportunities based on
 * computePageScore() results. Uses scoring-based issue creation
 * instead of LLM hallucination.
 *
 * Features:
 * - Technical issues created automatically during analysis (Step 8.5)
 * - AI visibility issues from policy file checks
 * - Progressive discovery based on score tiers
 */

import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import {
  createIssuesFromPageScore,
} from './issue-from-scoring.service'
import type { FullPageScore } from '@/lib/analysis/technical/types'

// Types
export type IssueCategory = 'technical_structure' | 'ai_visibility'
export type DiscoveryTier = 'fundamental' | 'intermediate' | 'advanced' | 'polish'
export type IssuePriority = 'low' | 'medium' | 'high'

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
 * Get the next page for issue discovery using pagination
 * Returns the next page to analyze, or null if all pages have been processed
 */
async function getNextPageForIssueDiscovery(brandProfileId: number): Promise<{
  pageScore: FullPageScore | null
  pageIndex: number
  totalPages: number
} | null> {
  // Get brand profile with pagination state
  const brandProfile = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId },
    select: {
      issueDiscoveryPageIndex: true,
      issueDiscoveryTotalPages: true,
    }
  })

  if (!brandProfile) {
    return null
  }

  // Get the latest technical analysis with multi-page data
  const techAnalysis = await prisma.technicalStructureAnalysis.findFirst({
    where: { brandProfileId },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true }
  })

  if (!techAnalysis) {
    return null
  }

  // Handle both properly stored JSON objects and legacy double-serialized strings
  let metadata = techAnalysis.metadata as Record<string, unknown> | null
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata) as Record<string, unknown>
    } catch {
      metadata = null
    }
  }
  const multiPageData = metadata?.multiPageAnalysis as {
    pageScores?: FullPageScore[]
  } | undefined

  if (!multiPageData?.pageScores || multiPageData.pageScores.length === 0) {
    return null
  }

  const totalPages = multiPageData.pageScores.length
  let currentIndex = brandProfile.issueDiscoveryPageIndex

  // Wrap around if we've reached the end
  if (currentIndex >= totalPages) {
    currentIndex = 0
  }

  const pageScore = multiPageData.pageScores[currentIndex]

  // Update the page index for next run
  const nextIndex = (currentIndex + 1) % totalPages
  await prisma.brandProfile.update({
    where: { id: brandProfileId },
    data: {
      issueDiscoveryPageIndex: nextIndex,
      issueDiscoveryTotalPages: totalPages
    }
  })

  return {
    pageScore: pageScore || null,
    pageIndex: currentIndex,
    totalPages
  }
}

/**
 * Discover technical structure issues using page scoring (not LLM)
 * Uses pagination to process one page per run
 */
async function discoverTechnicalIssuesFromScoring(
  brandProfileId: number
): Promise<{ created: number; pageUrl: string | null }> {
  // Get next page to process
  const nextPage = await getNextPageForIssueDiscovery(brandProfileId)

  if (!nextPage || !nextPage.pageScore) {
    console.log(`[IssueDiscovery] No page scores available for brand ${brandProfileId}`)
    return { created: 0, pageUrl: null }
  }

  console.log(`[IssueDiscovery] Processing page ${nextPage.pageIndex + 1}/${nextPage.totalPages}: ${nextPage.pageScore.page_url}`)

  // Create issues from page score
  const result = await createIssuesFromPageScore(brandProfileId, nextPage.pageScore)

  return {
    created: result.created,
    pageUrl: nextPage.pageScore.page_url
  }
}

/**
 * Discover AI visibility issues based on policy file checks (deterministic)
 */
async function discoverAIVisibilityIssues(
  brandProfileId: number,
  currentScore: number
): Promise<DiscoveredIssue[]> {
  const issues: DiscoveredIssue[] = []

  // Check if llms.txt exists
  const policyFile = await prisma.policyFile.findFirst({
    where: {
      brand_profile_id: brandProfileId
    }
  })

  // Missing llms.txt - fundamental issue
  if (!policyFile?.llms_txt_exists) {
    const hash = generateIssueHash(brandProfileId, 'ai_visibility', 'Create llms.txt File')
    const existing = await prisma.issue.findUnique({ where: { issueHash: hash } })

    if (!existing) {
      issues.push({
        title: 'Create llms.txt File',
        description: 'Your website lacks an llms.txt file, which AI systems use to understand how to represent your brand. This is critical for consistent AI-generated responses about your company.',
        priority: 'high',
        agentType: 'llms_txt',
        estimatedImpact: '+10-15 visibility points',
        category: 'ai_visibility',
        discoveryTier: 'fundamental',
        discoveredFromScore: currentScore
      })
    }
  } else if (policyFile.llms_txt_content && policyFile.llms_txt_content.length < 500) {
    // llms.txt exists but is too short - intermediate issue
    const hash = generateIssueHash(brandProfileId, 'ai_visibility', 'Expand llms.txt Content')
    const existing = await prisma.issue.findUnique({ where: { issueHash: hash } })

    if (!existing) {
      issues.push({
        title: 'Expand llms.txt Content',
        description: 'Your llms.txt file exists but may be too brief. A comprehensive llms.txt helps AI systems better understand and represent your brand.',
        priority: 'medium',
        agentType: 'llms_txt_optimizer',
        estimatedImpact: '+5-8 visibility points',
        category: 'ai_visibility',
        discoveryTier: 'intermediate',
        discoveredFromScore: currentScore
      })
    }
  }

  return issues
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

    // Create new issue (type field removed from schema)
    await prisma.issue.create({
      data: {
        brandProfileId,
        title: issue.title,
        description: issue.description,
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
          : 'geo_analysis',
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
 *
 * Technical structure issues are now created automatically during analysis
 * (unified-analysis.service.ts Step 8.5 calls createIssuesFromMultiplePageScores).
 * This function only discovers AI visibility issues.
 */
export async function discoverIssues(brandProfileId: number): Promise<DiscoveryResult> {
  console.log(`[IssueDiscovery] Starting discovery for brand ${brandProfileId}`)

  // 1. Get current AI visibility score for policy-based issues
  const aiVisibilityScore = await getLatestAIVisibilityScore(brandProfileId)
  console.log(`[IssueDiscovery] AI Visibility Score: ${aiVisibilityScore}`)

  // 2. Discover AI visibility issues (technical issues created during analysis)
  const aiVisibilityIssues = await discoverAIVisibilityIssues(brandProfileId, aiVisibilityScore)
  console.log(`[IssueDiscovery] AI Visibility: ${aiVisibilityIssues.length} found`)

  // 3. Upsert AI visibility issues
  const created = await upsertDiscoveredIssues(brandProfileId, aiVisibilityIssues)
  console.log(`[IssueDiscovery] Total created: ${created}`)

  // 4. Calculate tier distribution
  const tierCounts: Record<DiscoveryTier, number> = {
    fundamental: 0,
    intermediate: 0,
    advanced: 0,
    polish: 0
  }

  for (const issue of aiVisibilityIssues) {
    tierCounts[issue.discoveryTier]++
  }

  return {
    discovered: created,
    categories: {
      technical_structure: 0, // Created during analysis, not here
      ai_visibility: aiVisibilityIssues.length,
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
