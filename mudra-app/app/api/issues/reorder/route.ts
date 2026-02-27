import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { z } from 'zod'

const reorderSchema = z.object({
  issueId: z.number().int().positive(),
  newStatus: z.enum(['identified', 'in_progress', 'completed', 'merged', 'dismissed']).optional(),
  newOrder: z.number().int().min(0),
});

// POST /api/issues/reorder - Reorder issues (for drag-and-drop)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      )
    }

    const body = await request.json()
    const parsed = reorderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid input', details: parsed.error.errors } },
        { status: 400 }
      )
    }
    const { issueId, newStatus, newOrder } = parsed.data

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

    const targetStatus = newStatus || existingIssue.status

    // If moving to a different status column
    if (newStatus && newStatus !== existingIssue.status) {
      // Shift issues in old column (decrease order for items after the moved one)
      await prisma.issue.updateMany({
        where: {
          brandProfileId: brandProfile.id,
          status: existingIssue.status,
          order: { gt: existingIssue.order },
        },
        data: { order: { decrement: 1 } },
      })

      // Shift issues in new column (increase order for items at or after the new position)
      await prisma.issue.updateMany({
        where: {
          brandProfileId: brandProfile.id,
          status: newStatus,
          order: { gte: newOrder },
        },
        data: { order: { increment: 1 } },
      })
    } else {
      // Moving within the same column
      if (newOrder > existingIssue.order) {
        // Moving down: shift items between old and new position up
        await prisma.issue.updateMany({
          where: {
            brandProfileId: brandProfile.id,
            status: targetStatus,
            order: { gt: existingIssue.order, lte: newOrder },
            id: { not: issueId },
          },
          data: { order: { decrement: 1 } },
        })
      } else if (newOrder < existingIssue.order) {
        // Moving up: shift items between new and old position down
        await prisma.issue.updateMany({
          where: {
            brandProfileId: brandProfile.id,
            status: targetStatus,
            order: { gte: newOrder, lt: existingIssue.order },
            id: { not: issueId },
          },
          data: { order: { increment: 1 } },
        })
      }
    }

    // Update the moved issue
    const updatedIssue = await prisma.issue.update({
      where: { id: issueId },
      data: {
        status: targetStatus,
        order: newOrder,
      },
    })

    return NextResponse.json({ success: true, data: updatedIssue })
  } catch (error) {
    console.error("[Issues API] Reorder error:", error)
    return NextResponse.json(
      { success: false, error: { message: "Failed to reorder issues" } },
      { status: 500 }
    )
  }
}
