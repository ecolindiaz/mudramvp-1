/**
 * Issue Reconciliation Service
 *
 * Auto-closes issues when their underlying checks pass on re-analysis.
 * Called after unified analysis completes to reconcile open issues with
 * current page scores.
 *
 * Features:
 * - Maps issues back to check codes using title/agentType
 * - Closes issues when their checks no longer fail
 * - Preserves issues that are in_progress or completed
 */

import { prisma } from '@/lib/prisma'
import type { FullPageScore } from '@/lib/analysis/technical/types'
import { CHECK_TO_AGENT_MAP, ISSUE_TITLES, getFailingChecks } from './issue-from-scoring.service'
import { normalizeUrl } from '@/lib/utils/normalize-url'

/**
 * Reverse mapping from agent type to check codes
 */
const AGENT_TO_CHECKS: Record<string, string[]> = {}

// Build reverse mapping on module load
for (const [check, agent] of Object.entries(CHECK_TO_AGENT_MAP)) {
  if (!AGENT_TO_CHECKS[agent]) {
    AGENT_TO_CHECKS[agent] = []
  }
  AGENT_TO_CHECKS[agent].push(check)
}

/**
 * Reverse mapping from issue title to check code
 */
const TITLE_TO_CHECK: Record<string, string> = {}

// Build reverse mapping on module load
for (const [check, title] of Object.entries(ISSUE_TITLES)) {
  TITLE_TO_CHECK[title] = check
}

/**
 * Extract the check code from an issue
 * Uses title matching primarily, falls back to agent type
 */
export function extractCheckFromIssue(issue: { title: string; agentType: string | null }): string | null {
  // Remove page name suffix like "(Homepage)" or "(about)"
  const cleanTitle = issue.title.replace(/\s*\([^)]+\)$/, '').trim()

  // Try to match the clean title to a check code
  if (cleanTitle in TITLE_TO_CHECK) {
    return TITLE_TO_CHECK[cleanTitle]
  }

  // Fall back to finding a check from the agent type
  if (issue.agentType && AGENT_TO_CHECKS[issue.agentType]) {
    // Return the first matching check (not perfect but reasonable fallback)
    return AGENT_TO_CHECKS[issue.agentType][0] || null
  }

  return null
}

/**
 * Build a set of all currently failing checks across all pages
 * Format: "check_code:page_url" for per-page tracking
 */
function buildFailingCheckSet(pageScores: FullPageScore[]): Set<string> {
  const failingChecks = new Set<string>()

  for (const pageScore of pageScores) {
    const checks = getFailingChecks(pageScore)
    for (const check of checks) {
      // Store as check:url for per-page matching (normalized)
      failingChecks.add(`${check}:${normalizeUrl(pageScore.page_url)}`)
    }
  }

  return failingChecks
}

/**
 * Reconcile open issues with current page scores
 * Auto-closes issues when their underlying checks pass
 *
 * @param brandProfileId - The brand profile ID
 * @param pageScores - All page scores from the current analysis
 * @returns Stats about closed and still-open issues
 */
export async function reconcileIssuesWithScores(
  brandProfileId: number,
  pageScores: FullPageScore[]
): Promise<{ closed: number; stillOpen: number }> {
  let closed = 0
  let stillOpen = 0

  // Build set of all currently failing checks
  const failingChecks = buildFailingCheckSet(pageScores)

  // Get all open technical_structure issues (status = 'identified')
  // We don't auto-close 'in_progress' issues as they may be being worked on
  const openIssues = await prisma.issue.findMany({
    where: {
      brandProfileId,
      category: 'technical_structure',
      status: 'identified',
    },
    select: {
      id: true,
      title: true,
      agentType: true,
      affectedUrl: true,
      checkCode: true,
    },
  })

  console.log(`[IssueReconciliation] Found ${openIssues.length} open technical issues for brand ${brandProfileId}`)

  for (const issue of openIssues) {
    const check = issue.checkCode ?? extractCheckFromIssue(issue)

    if (!check) {
      // Can't determine check code, skip this issue
      stillOpen++
      continue
    }

    // Check if this issue's check:url combo still fails
    const pageUrl = issue.affectedUrl ? normalizeUrl(issue.affectedUrl) : ''
    const checkKey = `${check}:${pageUrl}`

    if (failingChecks.has(checkKey)) {
      // Check still failing, issue stays open
      stillOpen++
    } else {
      // Check passes now, auto-close the issue
      await prisma.issue.update({
        where: { id: issue.id },
        data: {
          status: 'completed',
          updatedAt: new Date(),
        },
      })
      closed++
      console.log(`[IssueReconciliation] Auto-closed issue "${issue.title}" - check ${check} now passes`)
    }
  }

  console.log(`[IssueReconciliation] Reconciliation complete: closed=${closed}, stillOpen=${stillOpen}`)
  return { closed, stillOpen }
}

/**
 * Get check codes that are currently failing for a brand
 * Useful for debugging and verification
 */
export async function getCurrentlyFailingChecks(
  brandProfileId: number
): Promise<Map<string, string[]>> {
  // Get the latest technical analysis
  const techAnalysis = await prisma.technicalStructureAnalysis.findFirst({
    where: { brandProfileId },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true },
  })

  if (!techAnalysis) {
    return new Map()
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

  if (!multiPageData?.pageScores) {
    return new Map()
  }

  // Build map of URL -> failing checks
  const checksByUrl = new Map<string, string[]>()

  for (const pageScore of multiPageData.pageScores) {
    const checks = getFailingChecks(pageScore)
    checksByUrl.set(pageScore.page_url, Array.from(checks))
  }

  return checksByUrl
}
