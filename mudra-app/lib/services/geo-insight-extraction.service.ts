/**
 * GEO Insight Extraction Service
 *
 * Extracts actionable improvement suggestions from raw AI provider responses
 * stored in GeoAnalysisResult.analyses JSON. Creates Issue records with
 * category='ai_visibility' and agentType='geo_insight'.
 *
 * Used in two phases:
 * - Phase 1: On-demand via POST /api/issues { action: 'extract-insights' }
 * - Phase 2: Automatic in unified analysis pipeline (runPostAnalysisSteps)
 */

import { prisma } from '@/lib/prisma'
import { generateIssueHash } from './issue-discovery.service'
import { geoInsightExtractorAgent, geoInsightSchema } from '@/mastra/agents/geo-insight-extractor-agent'
import type { ExtractedInsight } from '@/mastra/agents/geo-insight-extractor-agent'

const ISSUE_BACKLOG_THRESHOLD = 10
const MAX_NEW_AI_ISSUES_PER_RUN = 5
const MAX_GEO_RESULTS = 3
const MAX_RESPONSE_LENGTH = 2000
const MAX_ENTRIES_PER_BATCH = 15

interface PromptResponseEntry {
  prompt: string
  response: string
  provider: string
  brandMentioned: boolean
  sentiment: 'positive' | 'neutral' | 'negative'
}

interface BrandContext {
  companyName: string
  companyDescription: string | null
  companyIndustry: string | null
  companyWebsite: string | null
  competitors: string[]
}

export interface GeoInsightExtractionResult {
  extracted: number
  created: number
  skipped: number
  skippedBacklog: boolean
}

/**
 * Main entry point for GEO insight extraction.
 * Called by both Phase 1 (on-demand API) and Phase 2 (pipeline).
 */
export async function extractGeoInsights(
  brandProfileId: number,
  options?: { forceExtraction?: boolean }
): Promise<GeoInsightExtractionResult> {
  const defaultResult: GeoInsightExtractionResult = {
    extracted: 0,
    created: 0,
    skipped: 0,
    skippedBacklog: false,
  }

  try {
    // 1. Check backlog threshold
    if (!options?.forceExtraction) {
      const identifiedCount = await prisma.issue.count({
        where: { brandProfileId, status: 'identified', category: 'ai_visibility' },
      })
      if (identifiedCount >= ISSUE_BACKLOG_THRESHOLD) {
        console.log(`[GeoInsight] Skipping: ${identifiedCount} identified issues pending (threshold: ${ISSUE_BACKLOG_THRESHOLD})`)
        return { ...defaultResult, skippedBacklog: true }
      }
    }

    // 2. Fetch recent prompt responses
    const entries = await fetchRecentPromptResponses(brandProfileId)
    if (entries.length === 0) {
      console.log('[GeoInsight] No prompt responses found')
      return defaultResult
    }

    // 3. Fetch brand context
    const brandContext = await fetchBrandContext(brandProfileId)
    if (!brandContext) {
      console.log('[GeoInsight] Brand profile not found')
      return defaultResult
    }

    // 4. Batch and extract insights
    const allInsights: ExtractedInsight[] = []
    const batches = batchEntries(entries, MAX_ENTRIES_PER_BATCH)

    for (const batch of batches) {
      const prompt = buildExtractionPrompt(batch, brandContext)
      try {
        const response = await geoInsightExtractorAgent.generate(prompt, {
          structuredOutput: { schema: geoInsightSchema },
        })
        if (response.object?.insights) {
          allInsights.push(...response.object.insights)
        }
      } catch (agentError) {
        console.warn('[GeoInsight] Agent call failed for batch:', agentError)
        // Continue with remaining batches
      }
    }

    if (allInsights.length === 0) {
      console.log('[GeoInsight] No actionable insights extracted')
      return defaultResult
    }

    // 5. Sort insights: fundamental > intermediate > advanced, then high > medium > low
    const tierOrder: Record<string, number> = { fundamental: 0, intermediate: 1, advanced: 2 }
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
    allInsights.sort((a, b) => {
      const tierDiff = (tierOrder[a.discoveryTier] ?? 2) - (tierOrder[b.discoveryTier] ?? 2)
      if (tierDiff !== 0) return tierDiff
      return (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1)
    })

    // 6. Deduplicate and create issues (capped at MAX_NEW_AI_ISSUES_PER_RUN new creations)
    const { created, skipped } = await upsertInsightIssues(brandProfileId, allInsights, MAX_NEW_AI_ISSUES_PER_RUN)

    console.log(`[GeoInsight] Extracted: ${allInsights.length}, Created: ${created}, Skipped (dedup): ${skipped}`)
    return {
      extracted: allInsights.length,
      created,
      skipped,
      skippedBacklog: false,
    }
  } catch (error) {
    console.error('[GeoInsight] Extraction failed:', error)
    return defaultResult
  }
}

/**
 * Fetch recent GeoAnalysisResult rows and parse prompt/response entries.
 * Handles both provider-grouped and flat JSON structures.
 */
async function fetchRecentPromptResponses(brandProfileId: number): Promise<PromptResponseEntry[]> {
  const results = await prisma.geoAnalysisResult.findMany({
    where: { brandProfileId },
    orderBy: { createdAt: 'desc' },
    take: MAX_GEO_RESULTS,
    select: { analyses: true },
  })

  const entries: PromptResponseEntry[] = []
  for (const result of results) {
    entries.push(...parseAnalysesJson(result.analyses))
  }
  return entries
}

/**
 * Parse the analyses JSON column, handling both structures:
 * - Provider-grouped: { provider, promptTests: PromptTest[] }
 * - Flat: { prompt, response, provider|model }
 */
function parseAnalysesJson(analyses: unknown): PromptResponseEntry[] {
  let parsed: unknown[]
  if (typeof analyses === 'string') {
    try {
      parsed = JSON.parse(analyses)
    } catch {
      return []
    }
  } else if (Array.isArray(analyses)) {
    parsed = analyses
  } else {
    return []
  }

  const entries: PromptResponseEntry[] = []

  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>

    // Provider-grouped structure
    if (rec.provider && Array.isArray(rec.promptTests)) {
      for (const test of rec.promptTests) {
        if (!test || typeof test !== 'object') continue
        const t = test as Record<string, unknown>
        if (typeof t.response === 'string' && t.response.length > 20) {
          entries.push({
            prompt: String(t.prompt || ''),
            response: t.response,
            provider: String(rec.provider),
            brandMentioned: Boolean(t.brandMentioned),
            sentiment: normalizeSentiment(t.sentiment),
          })
        }
      }
      continue
    }

    // Flat structure
    if (typeof rec.prompt === 'string' && typeof rec.response === 'string' && rec.response.length > 20) {
      entries.push({
        prompt: rec.prompt,
        response: rec.response,
        provider: String(rec.provider || rec.model || 'unknown'),
        brandMentioned: Boolean(rec.brandMentioned),
        sentiment: normalizeSentiment(rec.sentiment),
      })
    }
  }

  return entries
}

function normalizeSentiment(val: unknown): 'positive' | 'neutral' | 'negative' {
  if (val === 'positive' || val === 'neutral' || val === 'negative') return val
  return 'neutral'
}

/**
 * Fetch brand context for the extraction prompt.
 */
async function fetchBrandContext(brandProfileId: number): Promise<BrandContext | null> {
  const bp = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId },
    select: {
      companyName: true,
      companyDescription: true,
      companyIndustry: true,
      companyWebsite: true,
      competitors: true,
    },
  })

  if (!bp || !bp.companyName) return null

  let competitors: string[] = []
  if (bp.competitors) {
    try {
      const parsed = JSON.parse(bp.competitors)
      if (Array.isArray(parsed)) competitors = parsed.map(String)
    } catch {
      competitors = bp.competitors.split(',').map((s: string) => s.trim()).filter(Boolean)
    }
  }

  return {
    companyName: bp.companyName,
    companyDescription: bp.companyDescription,
    companyIndustry: bp.companyIndustry,
    companyWebsite: bp.companyWebsite,
    competitors,
  }
}

/**
 * Split entries into batches of maxSize.
 */
function batchEntries(entries: PromptResponseEntry[], maxSize: number): PromptResponseEntry[][] {
  const batches: PromptResponseEntry[][] = []
  for (let i = 0; i < entries.length; i += maxSize) {
    batches.push(entries.slice(i, i + maxSize))
  }
  return batches
}

/**
 * Build the user prompt for the extraction agent.
 */
function buildExtractionPrompt(entries: PromptResponseEntry[], brand: BrandContext): string {
  const brandSection = [
    `## Brand Context`,
    `- Name: ${brand.companyName}`,
    brand.companyDescription ? `- Description: ${brand.companyDescription}` : null,
    brand.companyIndustry ? `- Industry: ${brand.companyIndustry}` : null,
    brand.companyWebsite ? `- Website: ${brand.companyWebsite}` : null,
    brand.competitors.length > 0 ? `- Competitors: ${brand.competitors.join(', ')}` : null,
  ].filter(Boolean).join('\n')

  const responsesSection = entries.map((entry, i) => {
    const truncated = entry.response.length > MAX_RESPONSE_LENGTH
      ? entry.response.slice(0, MAX_RESPONSE_LENGTH) + '...[truncated]'
      : entry.response
    return [
      `### Response ${i + 1} (${entry.provider})`,
      `**Prompt:** ${entry.prompt}`,
      `**Brand Mentioned:** ${entry.brandMentioned ? 'Yes' : 'No'}`,
      `**Sentiment:** ${entry.sentiment}`,
      `**Response:**`,
      truncated,
    ].join('\n')
  }).join('\n\n')

  return `${brandSection}\n\n## AI Provider Responses (${entries.length} total)\n\n${responsesSection}\n\nAnalyze these responses and extract actionable improvement suggestions for ${brand.companyName}.`
}

/**
 * Deduplicate and create Issue records from extracted insights.
 * Follows the same upsert pattern as issue-discovery.service.ts.
 */
async function upsertInsightIssues(
  brandProfileId: number,
  insights: ExtractedInsight[],
  maxNewCreations?: number
): Promise<{ created: number; skipped: number }> {
  let created = 0
  let skipped = 0

  for (const insight of insights) {
    const hash = generateIssueHash(brandProfileId, 'ai_visibility', insight.title)

    const existing = await prisma.issue.findUnique({
      where: { issueHash: hash },
    })

    if (existing) {
      // Update description if still in 'identified' status (keep it fresh)
      if (existing.status === 'identified') {
        const description = formatInsightDescription(insight)
        await prisma.issue.update({
          where: { id: existing.id },
          data: {
            description,
            priority: insight.priority,
            estimatedImpact: insight.estimatedImpact,
            updatedAt: new Date(),
          },
        })
      }
      skipped++
      continue
    }

    // Respect per-run cap on new creations (deduped updates don't count)
    if (maxNewCreations !== undefined && created >= maxNewCreations) {
      skipped++
      continue
    }

    const description = formatInsightDescription(insight)
    await prisma.issue.create({
      data: {
        brandProfileId,
        title: insight.title,
        description,
        status: 'identified',
        priority: insight.priority,
        category: 'ai_visibility',
        discoveryTier: insight.discoveryTier,
        agentType: 'geo_insight',
        estimatedImpact: insight.estimatedImpact,
        sourceAnalysis: 'geo_analysis',
        outputType: 'guidance',
        issueHash: hash,
      },
    })
    created++
  }

  return { created, skipped }
}

/**
 * Format the insight description with source evidence for traceability.
 */
function formatInsightDescription(insight: ExtractedInsight): string {
  const parts = [insight.description]

  if (insight.sourceEvidence) {
    parts.push('')
    parts.push('---')
    parts.push(`**Discovered via ${insight.sourceEvidence.provider}**`)
    parts.push(`**Prompt:** "${insight.sourceEvidence.prompt}"`)
    parts.push(`**Evidence:** "${insight.sourceEvidence.relevantExcerpt}"`)
  }

  return parts.join('\n')
}
