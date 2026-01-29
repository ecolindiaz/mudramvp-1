/**
 * Issue Retry API
 * 
 * POST /api/issues/[id]/retry - Retry a failed agent execution
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { retryIssueExecution } from '@/lib/services/issue-agent-executor.service'

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

    // Check if issue is in a valid state for retry
    if (issue.status !== 'failed') {
      return NextResponse.json(
        { success: false, error: { message: `Cannot retry: issue status is ${issue.status}` } },
        { status: 400 }
      )
    }

    // Retry the agent execution
    const result = await retryIssueExecution(issueId)

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: {
          issueId,
          status: 'completed',
          prUrl: result.prUrl,
          prNumber: result.prNumber,
          generatedContent: result.generatedContent,
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
        error: { message: result.error || 'Retry failed' }
      }, { status: 500 })
    }
  } catch (error) {
    console.error('[Issues Retry API] Error:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Failed to retry agent' } },
      { status: 500 }
    )
  }
}
