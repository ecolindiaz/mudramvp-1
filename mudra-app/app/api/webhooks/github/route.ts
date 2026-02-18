/**
 * GitHub Webhook Handler
 * 
 * POST /api/webhooks/github
 * 
 * Receives webhook events from the Mudra GitHub App.
 * Currently handles:
 * - pull_request events (merge/close detection)
 * - automatic post-merge re-analysis trigger (can disable with GITHUB_PR_MERGE_AUTO_REANALYZE=false)
 * 
 * Setup:
 * 1. In your GitHub App settings, set Webhook URL to:
 *    https://your-domain.com/api/webhooks/github
 * 2. Set a Webhook Secret and add it as GITHUB_WEBHOOK_SECRET env var
 * 3. Subscribe to "Pull requests" events
 */

import { NextRequest, NextResponse, after } from 'next/server'
import {
  verifyGitHubWebhookSignature,
  handlePullRequestEvent,
  triggerPostMergeReanalysis,
} from '@/lib/services/github-webhook.service'

// Allow enough time for background post-merge re-analysis via after()
export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET
    const signature = request.headers.get('x-hub-signature-256')
    const event = request.headers.get('x-github-event')
    const deliveryId = request.headers.get('x-github-delivery')

    console.log(`[GitHubWebhook] Received event: ${event}, delivery: ${deliveryId}`)

    // Read raw body for signature verification
    const payload = await request.text()

    // Verify signature if webhook secret is configured
    if (webhookSecret) {
      if (!verifyGitHubWebhookSignature(payload, signature, webhookSecret)) {
        console.error('[GitHubWebhook] Invalid signature')
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }
    } else {
      // In development, warn but allow. In production, you should always have a secret.
      console.warn('[GitHubWebhook] GITHUB_WEBHOOK_SECRET not set — skipping signature verification')
    }

    // Parse the payload
    const body = JSON.parse(payload)

    // Handle ping event (sent when webhook is first configured)
    if (event === 'ping') {
      console.log('[GitHubWebhook] Ping received — webhook is configured correctly')
      return NextResponse.json({
        success: true,
        message: 'Pong! Webhook configured successfully.',
        zen: body.zen,
      })
    }

    // Handle pull_request events
    if (event === 'pull_request') {
      const result = await handlePullRequestEvent(body)
      const mergedBrandProfileIds = result.mergedBrandProfileIds || []
      const autoReanalysisEnabled = process.env.GITHUB_PR_MERGE_AUTO_REANALYZE !== 'false'
      const shouldQueueReanalysis = autoReanalysisEnabled && result.isMerged === true && mergedBrandProfileIds.length > 0

      if (shouldQueueReanalysis) {
        after(async () => {
          try {
            const summary = await triggerPostMergeReanalysis(mergedBrandProfileIds)
            console.log('[GitHubWebhook] Post-merge re-analysis summary:', summary)
          } catch (reanalysisError) {
            console.error('[GitHubWebhook] Post-merge re-analysis failed:', reanalysisError)
          }
        })
      }

      console.log(`[GitHubWebhook] PR event processed:`, result)

      return NextResponse.json({
        success: true,
        autoReanalysisQueued: shouldQueueReanalysis,
        ...result,
      })
    }

    // Ignore other events gracefully
    console.log(`[GitHubWebhook] Ignoring event type: ${event}`)
    return NextResponse.json({
      success: true,
      message: `Event type '${event}' not handled`,
    })
  } catch (error) {
    console.error('[GitHubWebhook] Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
