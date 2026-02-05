/**
 * Issue Deploy API
 * 
 * POST /api/issues/[id]/deploy - Deploy an agent to resolve this issue
 * 
 * Uses async execution pattern:
 * 1. Immediately mark issue as in_progress
 * 2. Start agent execution without waiting
 * 3. Return immediately with status 'processing'
 * 4. Client polls /api/issues/[id] to check completion
 */

// Allow longer execution for agent deployment
// (see below for actual export)

/**
 * Continued description...
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { executeIssueAgent } from '@/lib/services/issue-agent-executor.service'

// Extend timeout for Vercel Pro (max 300s)
export const maxDuration = 300

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      )
    }

    const { id } = await params
    const issueId = parseInt(id)

    if (isNaN(issueId)) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid issue ID' } },
        { status: 400 }
      )
    }

    // Get issue and verify ownership
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        brandProfile: {
          select: { userId: true }
        }
      }
    })

    if (!issue) {
      return NextResponse.json(
        { success: false, error: { message: 'Issue not found' } },
        { status: 404 }
      )
    }

    if (issue.brandProfile.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 403 }
      )
    }

    // Check if issue is in a valid state for deployment
    if (issue.status !== 'identified') {
      return NextResponse.json(
        { success: false, error: { message: `Cannot deploy: issue is ${issue.status}` } },
        { status: 400 }
      )
    }

    // Immediately set to in_progress before starting agent execution
    await prisma.issue.update({
      where: { id: issueId },
      data: { status: 'in_progress' }
    })

    // Check if we should run async (fire-and-forget) or sync (wait for result)
    // Async mode returns immediately - client polls for completion
    const asyncMode = request.headers.get('x-async-mode') === 'true'

    if (asyncMode) {
      // Use waitUntil pattern: return response immediately, but keep function alive
      // Vercel kills detached promises after response is sent, so we use
      // a streaming approach - send initial status, then await completion
      
      // Start execution (awaited within this function's lifetime)
      const executionPromise = executeIssueAgent(issueId)
        .then(async (result) => {
          console.log(`[Deploy] Issue ${issueId} completed:`, result.success ? 'success' : 'failed')
          if (result.prUrl) {
            console.log(`[Deploy] PR created: ${result.prUrl}`)
          }
        })
        .catch(async (error) => {
          console.error(`[Deploy] Issue ${issueId} failed:`, error)
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          try {
            await prisma.issue.update({
              where: { id: issueId },
              data: { 
                status: 'failed',
                generatedOutput: JSON.stringify({
                  error: errorMessage,
                  lastAttempt: new Date().toISOString()
                })
              }
            })
          } catch (dbError) {
            console.error(`[Deploy] Failed to update issue status:`, dbError)
          }
        })

      // Return processing status immediately to the client
      const response = NextResponse.json({
        success: true,
        data: {
          issueId,
          status: 'processing',
          message: 'Agent execution started. Poll the issue status for updates.'
        }
      })
      
      // CRITICAL: Await the execution to keep the Vercel function alive
      // The response is already sent, but the function stays alive due to maxDuration=300
      await executionPromise
      
      return response
    }

    // Sync mode - wait for result (may timeout on Vercel Free tier)
    const result = await executeIssueAgent(issueId)

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: {
          issueId,
          status: 'completed',
          // PR-creating agents
          prUrl: result.prUrl,
          prNumber: result.prNumber,
          generatedContent: result.generatedContent,
          // Conversation agents
          conversationUrl: result.conversationUrl,
          engagementGuidance: result.engagementGuidance,
          suggestedResponse: result.suggestedResponse,
          // E2B validation
          e2bValidation: result.e2bValidation ? {
            valid: result.e2bValidation.data?.valid,
            executionMs: result.e2bValidation.executionMs,
            sandboxId: result.e2bValidation.sandboxId
          } : undefined
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        error: { message: result.error || 'Agent execution failed' }
      }, { status: 500 })
    }
  } catch (error) {
    console.error('[Issues Deploy API] Error:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Failed to deploy agent' } },
      { status: 500 }
    )
  }
}
