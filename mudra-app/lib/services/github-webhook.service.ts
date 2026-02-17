/**
 * GitHub Webhook Service
 * 
 * Handles incoming GitHub webhook events, specifically pull_request events.
 * When a PR created by an issues agent is merged, updates the issue status
 * from "completed" to "merged" and sets prStatus to "merged".
 */

import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

// ─── Token Refresh (for polling fallback) ────────────────────────────────────

/**
 * Refresh a GitHub App installation token.
 * Mirrors the logic in github.service.ts but is self-contained for this module.
 */
async function refreshInstallationTokenForSync(installationId: number): Promise<string> {
  const appId = process.env.GITHUB_APP_ID
  const privateKey = process.env.GITHUB_PRIVATE_KEY

  if (!appId || !privateKey) {
    throw new Error('GitHub App credentials not configured')
  }

  const now = Math.floor(Date.now() / 1000)
  const formattedKey = privateKey.replace(/\\n/g, '\n').trim()
  const appJwt = jwt.sign({ iat: now - 60, exp: now + 600, iss: appId }, formattedKey, { algorithm: 'RS256' })

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: 'application/vnd.github+json',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to refresh installation token: ${response.status}`)
  }

  const data = await response.json()
  return data.token
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface GitHubPullRequestEvent {
  action: string // 'opened' | 'closed' | 'reopened' | 'synchronize' | etc.
  number: number
  pull_request: {
    id: number
    number: number
    title: string
    state: 'open' | 'closed'
    merged: boolean
    merged_at: string | null
    html_url: string
    head: { ref: string; sha: string }
    base: { ref: string; repo: { full_name: string } }
    user: { login: string }
  }
  repository: {
    id: number
    full_name: string // "owner/repo"
    name: string
    owner: { login: string }
  }
  installation?: {
    id: number
  }
}

// ─── Signature Verification ──────────────────────────────────────────────────

/**
 * Verify GitHub webhook signature (HMAC-SHA256)
 * 
 * GitHub sends a `X-Hub-Signature-256` header with each webhook payload.
 * We verify it against our webhook secret to ensure authenticity.
 */
export function verifyGitHubWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf-8')
    .digest('hex')

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch {
    return false
  }
}

// ─── PR Event Handlers ──────────────────────────────────────────────────────

/**
 * Handle a pull_request webhook event from GitHub.
 * 
 * When a PR is merged (action=closed + merged=true), finds matching
 * issues by prNumber and updates their status to "merged".
 * When a PR is closed without merge, updates prStatus to "closed".
 */
export async function handlePullRequestEvent(
  event: GitHubPullRequestEvent
): Promise<{
  processed: boolean
  issuesUpdated: number
  details?: string
  isMerged?: boolean
  mergedBrandProfileIds?: number[]
}> {
  const { action, pull_request: pr } = event
  const repoFullName = event.repository.full_name

  console.log(`[GitHubWebhook] PR #${pr.number} event: action=${action}, merged=${pr.merged}, repo=${repoFullName}`)

  // Only handle 'closed' events (which include merges)
  if (action !== 'closed') {
    return {
      processed: false,
      issuesUpdated: 0,
      details: `Ignored action: ${action}`,
      isMerged: false,
      mergedBrandProfileIds: [],
    }
  }

  const isMerged = pr.merged === true

  // Find all issues with this PR number
  // We match on prNumber since it's stored when the agent creates the PR
  const matchingIssues = await prisma.issue.findMany({
    where: {
      prNumber: pr.number,
      prStatus: 'open', // Only update issues that still have an open PR
    },
    select: {
      id: true,
      title: true,
      status: true,
      prUrl: true,
      prNumber: true,
      prStatus: true,
      brandProfileId: true,
    },
  })

  if (matchingIssues.length === 0) {
    // Also try matching by PR URL for extra reliability
    const matchByUrl = await prisma.issue.findMany({
      where: {
        prUrl: pr.html_url,
        prStatus: 'open',
      },
      select: {
        id: true,
        title: true,
        status: true,
        prUrl: true,
        prNumber: true,
        prStatus: true,
        brandProfileId: true,
      },
    })

    if (matchByUrl.length === 0) {
      console.log(`[GitHubWebhook] No matching issues found for PR #${pr.number} (${pr.html_url})`)
      return {
        processed: true,
        issuesUpdated: 0,
        details: 'No matching issues',
        isMerged,
        mergedBrandProfileIds: [],
      }
    }

    // Use URL-matched issues
    matchingIssues.push(...matchByUrl)
  }

  console.log(`[GitHubWebhook] Found ${matchingIssues.length} issue(s) for PR #${pr.number}`)

  // Update each matching issue
  const updatePromises = matchingIssues.map(async (issue) => {
    const updateData: Record<string, unknown> = {
      prStatus: isMerged ? 'merged' : 'closed',
    }

    // If the PR was merged, move the issue to "merged" status
    if (isMerged) {
      updateData.status = 'merged'
      console.log(`[GitHubWebhook] Issue #${issue.id} "${issue.title}" → merged (PR #${pr.number})`)
    } else {
      // PR was closed without merging — keep issue as completed, 
      // user may want to reopen or redeploy
      console.log(`[GitHubWebhook] Issue #${issue.id} "${issue.title}" → PR closed without merge`)
    }

    return prisma.issue.update({
      where: { id: issue.id },
      data: updateData,
    })
  })

  const results = await Promise.all(updatePromises)
  const mergedBrandProfileIds = isMerged
    ? [...new Set(matchingIssues.map((issue) => issue.brandProfileId))]
    : []

  return {
    processed: true,
    issuesUpdated: results.length,
    details: isMerged
      ? `Merged: ${results.map(r => `#${r.id}`).join(', ')}`
      : `Closed: ${results.map(r => `#${r.id}`).join(', ')}`,
    isMerged,
    mergedBrandProfileIds,
  }
}

/**
 * Trigger unified re-analysis for all provided brand profiles.
 *
 * Used after a PR merge so score deltas reflect newly deployed changes.
 * Runs sequentially to reduce API pressure and keep logs readable.
 */
export async function triggerPostMergeReanalysis(brandProfileIds: number[]): Promise<{
  triggered: number
  failed: number
  errors: string[]
}> {
  const uniqueIds = [...new Set(brandProfileIds)].filter((id) => Number.isFinite(id))
  const result = { triggered: 0, failed: 0, errors: [] as string[] }

  if (uniqueIds.length === 0) {
    return result
  }

  const { runUnifiedAnalysis } = await import('./unified-analysis.service')

  for (const brandProfileId of uniqueIds) {
    try {
      const profile = await prisma.brandProfile.findUnique({
        where: { id: brandProfileId },
        select: {
          id: true,
          companyName: true,
          companyWebsite: true,
          companyDescription: true,
          companyIndustry: true,
          competitors: true,
          trackingCountries: true,
        },
      })

      if (!profile?.companyName || !profile.companyWebsite) {
        throw new Error('Missing companyName/companyWebsite on brand profile')
      }

      const competitors = profile.competitors
        ? profile.competitors.split(',').map((c) => c.trim()).filter(Boolean)
        : []
      const countries = profile.trackingCountries?.length
        ? profile.trackingCountries
        : ['US']

      console.log(`[GitHubWebhook] Triggering post-merge re-analysis for brand ${brandProfileId} (${profile.companyName})`)

      const analysis = await runUnifiedAnalysis({
        brandProfileId: profile.id,
        brandName: profile.companyName,
        website: profile.companyWebsite,
        description: profile.companyDescription || undefined,
        industry: profile.companyIndustry || undefined,
        competitors,
        skipCooldown: true,
        generateReport: false,
        countries,
      })

      if (!analysis.success) {
        throw new Error(analysis.error || 'Unified analysis returned success=false')
      }

      // runUnifiedAnalysis may queue additional country jobs and expose
      // a backgroundWork promise the API route normally passes to after().
      // Since we're calling the service directly here, explicitly await it.
      if (analysis.backgroundWork) {
        await analysis.backgroundWork
      }

      result.triggered++
      console.log(
        `[GitHubWebhook] Re-analysis completed for brand ${brandProfileId}: technical=${analysis.scores.technical ?? 'n/a'}, aiVisibility=${analysis.scores.aiVisibility ?? 'n/a'}`
      )
    } catch (error) {
      result.failed++
      const message = error instanceof Error ? error.message : String(error)
      result.errors.push(`brand ${brandProfileId}: ${message}`)
      console.error(`[GitHubWebhook] Re-analysis failed for brand ${brandProfileId}:`, message)
    }
  }

  return result
}

// ─── PR Status Sync (Polling Fallback) ──────────────────────────────────────

/**
 * Sync PR statuses for all open PRs belonging to a brand profile.
 * 
 * This is a fallback mechanism that polls GitHub to catch any missed
 * webhook events. Called from the dashboard or a cron job.
 */
export async function syncPrStatuses(brandProfileId: number): Promise<{
  synced: number
  merged: number
  closed: number
  errors: string[]
}> {
  const result = { synced: 0, merged: 0, closed: 0, errors: [] as string[] }

  // Find all issues with open PRs for this brand
  const issuesWithOpenPRs = await prisma.issue.findMany({
    where: {
      brandProfileId,
      prNumber: { not: null },
      prStatus: 'open',
    },
    select: {
      id: true,
      title: true,
      prNumber: true,
      prUrl: true,
      prStatus: true,
      status: true,
      brandProfile: {
        select: {
          userId: true,
        },
      },
    },
  })

  if (issuesWithOpenPRs.length === 0) {
    return result
  }

  // Get GitHub integration for this brand's user
  const userId = issuesWithOpenPRs[0].brandProfile.userId
  if (!userId) {
    result.errors.push('Brand profile has no linked user')
    return result
  }

  const integration = await prisma.gitHubIntegration.findUnique({
    where: { userId },
  })

  if (!integration) {
    result.errors.push('No GitHub integration found')
    return result
  }

  // Get a valid token (must handle installation token expiry)
  const { decryptToken } = await import('@/lib/crypto/token-encryption')
  let token: string
  try {
    if (integration.integrationType === 'installation' && integration.installationId) {
      // Installation tokens expire after 1 hour — always check expiry first
      const now = new Date()
      const tokenExpiresAt = integration.tokenExpiresAt
      const isExpiredOrExpiringSoon = !tokenExpiresAt || 
        (new Date(tokenExpiresAt).getTime() - now.getTime() < 5 * 60 * 1000)
      
      if (isExpiredOrExpiringSoon) {
        console.log(`[PRSync] Installation token expired or expiring soon — refreshing`)
        token = await refreshInstallationTokenForSync(integration.installationId)
      } else {
        try {
          token = decryptToken(integration.accessToken)
        } catch {
          console.log(`[PRSync] Failed to decrypt token — refreshing`)
          token = await refreshInstallationTokenForSync(integration.installationId)
        }
      }
    } else {
      token = decryptToken(integration.accessToken)
    }
  } catch (error) {
    result.errors.push(`Failed to get GitHub token: ${error instanceof Error ? error.message : 'Unknown'}`)
    return result
  }

  // Check each PR's status via GitHub API
  for (const issue of issuesWithOpenPRs) {
    if (!issue.prUrl || !issue.prNumber) continue

    try {
      // Extract owner/repo from PR URL: https://github.com/owner/repo/pull/123
      const urlMatch = issue.prUrl.match(/github\.com\/([^/]+\/[^/]+)\/pull\//)
      if (!urlMatch) {
        result.errors.push(`Invalid PR URL for issue #${issue.id}: ${issue.prUrl}`)
        continue
      }

      const repoFullName = urlMatch[1]
      const prResponse = await fetch(
        `https://api.github.com/repos/${repoFullName}/pulls/${issue.prNumber}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      )

      if (!prResponse.ok) {
        result.errors.push(`GitHub API error for PR #${issue.prNumber}: ${prResponse.status}`)
        continue
      }

      const prData = await prResponse.json()
      const isMerged = !!prData.merged_at
      const isClosed = prData.state === 'closed'

      if (isMerged) {
        await prisma.issue.update({
          where: { id: issue.id },
          data: {
            prStatus: 'merged',
            status: 'merged',
          },
        })
        result.merged++
        result.synced++
        console.log(`[PRSync] Issue #${issue.id} "${issue.title}" → merged`)
      } else if (isClosed) {
        await prisma.issue.update({
          where: { id: issue.id },
          data: {
            prStatus: 'closed',
          },
        })
        result.closed++
        result.synced++
        console.log(`[PRSync] Issue #${issue.id} "${issue.title}" → PR closed`)
      }
    } catch (error) {
      result.errors.push(`Error checking PR #${issue.prNumber}: ${error instanceof Error ? error.message : 'Unknown'}`)
    }
  }

  return result
}
