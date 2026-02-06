/**
 * GitHub Webhook Handler
 * 
 * POST /api/webhooks/github
 * 
 * Receives webhook events from the Mudra GitHub App.
 * Currently handles: pull_request events (merge/close detection)
 * 
 * Setup:
 * 1. In your GitHub App settings, set Webhook URL to:
 *    https://your-domain.com/api/webhooks/github
 * 2. Set a Webhook Secret and add it as GITHUB_WEBHOOK_SECRET env var
 * 3. Subscribe to "Pull requests" events
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  verifyGitHubWebhookSignature,
  handlePullRequestEvent,
} from '@/lib/services/github-webhook.service'

export const maxDuration = 30

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

      console.log(`[GitHubWebhook] PR event processed:`, result)

      return NextResponse.json({
        success: true,
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
