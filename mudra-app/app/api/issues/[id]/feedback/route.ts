import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/issues/[id]/feedback - Submit human feedback on agent output quality
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
    const issueId = parseInt(id, 10)
    if (isNaN(issueId)) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid issue ID' } },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { score, notes } = body

    if (typeof score !== 'number' || score < 1 || score > 5 || !Number.isInteger(score)) {
      return NextResponse.json(
        { success: false, error: { message: 'Score must be an integer between 1 and 5' } },
        { status: 400 }
      )
    }

    if (notes !== undefined && typeof notes !== 'string') {
      return NextResponse.json(
        { success: false, error: { message: 'Notes must be a string' } },
        { status: 400 }
      )
    }

    const brandProfile = await prisma.brandProfile.findFirst({
      where: { userId: session.user.id },
    })
    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: { message: 'Brand profile not found' } },
        { status: 404 }
      )
    }

    const issue = await prisma.issue.findFirst({
      where: { id: issueId, brandProfileId: brandProfile.id },
    })
    if (!issue) {
      return NextResponse.json(
        { success: false, error: { message: 'Issue not found' } },
        { status: 404 }
      )
    }

    const updated = await prisma.issue.update({
      where: { id: issueId },
      data: {
        userFeedbackScore: score,
        userFeedbackNotes: notes || null,
        userReviewedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        issueId: updated.id,
        userFeedbackScore: updated.userFeedbackScore,
        userFeedbackNotes: updated.userFeedbackNotes,
        userReviewedAt: updated.userReviewedAt,
      },
    })
  } catch (error) {
    console.error('[Issues Feedback API] Error:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Failed to save feedback' } },
      { status: 500 }
    )
  }
}
