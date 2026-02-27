import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { z } from 'zod'

export const maxDuration = 60

const issuePatchSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).nullable().optional(),
  status: z.enum(['identified', 'in_progress', 'completed', 'merged', 'dismissed']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  order: z.number().int().min(0).optional(),
  dismissedAt: z.string().datetime().nullable().optional(),
  prUrl: z.string().url().max(500).nullable().optional(),
  prNumber: z.number().int().nullable().optional(),
  prStatus: z.enum(['open', 'merged', 'closed']).nullable().optional(),
});

// GET /api/issues/[id] - Get a single issue
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      )
    }

    const { id } = await params
    const issueId = parseInt(id, 10)

    if (isNaN(issueId)) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid issue ID" } },
        { status: 400 }
      )
    }

    // Get brand profile for user
    const brandProfile = await prisma.brandProfile.findFirst({
      where: { userId: session.user.id },
    })

    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: { message: "Brand profile not found" } },
        { status: 404 }
      )
    }

    const issue = await prisma.issue.findFirst({
      where: {
        id: issueId,
        brandProfileId: brandProfile.id,
      },
      include: {
        agentTask: true,
        deployedAgent: {
          select: { id: true, agentName: true, status: true }
        }
      }
    })

    if (!issue) {
      return NextResponse.json(
        { success: false, error: { message: "Issue not found" } },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: issue })
  } catch (error) {
    console.error("[Issues API] GET by ID error:", error)
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch issue" } },
      { status: 500 }
    )
  }
}

// PATCH /api/issues/[id] - Update an issue
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      )
    }

    const { id } = await params
    const issueId = parseInt(id, 10)

    if (isNaN(issueId)) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid issue ID" } },
        { status: 400 }
      )
    }

    const body = await request.json()
    const parsed = issuePatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid input', details: parsed.error.errors } },
        { status: 400 }
      )
    }
    const { title, description, status, priority, order, dismissedAt, prUrl, prNumber, prStatus } = parsed.data

    // Get brand profile for user
    const brandProfile = await prisma.brandProfile.findFirst({
      where: { userId: session.user.id },
    })

    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: { message: "Brand profile not found" } },
        { status: 404 }
      )
    }

    // Check issue exists and belongs to user
    const existingIssue = await prisma.issue.findFirst({
      where: {
        id: issueId,
        brandProfileId: brandProfile.id,
      },
    })

    if (!existingIssue) {
      return NextResponse.json(
        { success: false, error: { message: "Issue not found" } },
        { status: 404 }
      )
    }

    // Build update data with new fields
    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (status !== undefined) updateData.status = status
    if (priority !== undefined) updateData.priority = priority
    if (order !== undefined) updateData.order = order
    if (prUrl !== undefined) updateData.prUrl = prUrl
    if (prNumber !== undefined) updateData.prNumber = prNumber
    if (prStatus !== undefined) updateData.prStatus = prStatus
    
    // Handle dismissedAt - set automatically when status changes to dismissed
    if (status === 'dismissed' && !dismissedAt) {
      updateData.dismissedAt = new Date()
    } else if (dismissedAt !== undefined) {
      updateData.dismissedAt = dismissedAt
    }

    const issue = await prisma.issue.update({
      where: { id: issueId },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: issue })
  } catch (error) {
    console.error("[Issues API] PATCH error:", error)
    return NextResponse.json(
      { success: false, error: { message: "Failed to update issue" } },
      { status: 500 }
    )
  }
}

// DELETE /api/issues/[id] - Delete an issue
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      )
    }

    const { id } = await params
    const issueId = parseInt(id, 10)

    if (isNaN(issueId)) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid issue ID" } },
        { status: 400 }
      )
    }

    // Get brand profile for user
    const brandProfile = await prisma.brandProfile.findFirst({
      where: { userId: session.user.id },
    })

    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: { message: "Brand profile not found" } },
        { status: 404 }
      )
    }

    // Check issue exists and belongs to user
    const existingIssue = await prisma.issue.findFirst({
      where: {
        id: issueId,
        brandProfileId: brandProfile.id,
      },
    })

    if (!existingIssue) {
      return NextResponse.json(
        { success: false, error: { message: "Issue not found" } },
        { status: 404 }
      )
    }

    await prisma.issue.delete({
      where: { id: issueId },
    })

    return NextResponse.json({ success: true, data: { deleted: true } })
  } catch (error) {
    console.error("[Issues API] DELETE error:", error)
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete issue" } },
      { status: 500 }
    )
  }
}
