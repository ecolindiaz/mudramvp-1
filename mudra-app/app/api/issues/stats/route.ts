import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// Prevent Vercel timeout
export const maxDuration = 60

// GET /api/issues/stats - Get issue statistics for analysis view
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
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

    // Get counts by status
    const statusCounts = await prisma.issue.groupBy({
      by: ["status"],
      where: { brandProfileId: brandProfile.id },
      _count: { id: true },
    })

    // Get counts by category
    const categoryCounts = await prisma.issue.groupBy({
      by: ["category"],
      where: { brandProfileId: brandProfile.id },
      _count: { id: true },
    })

    // Get counts by priority
    const priorityCounts = await prisma.issue.groupBy({
      by: ["priority"],
      where: { brandProfileId: brandProfile.id },
      _count: { id: true },
    })

    // Get recent issues (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const recentIssues = await prisma.issue.count({
      where: {
        brandProfileId: brandProfile.id,
        createdAt: { gte: sevenDaysAgo },
      },
    })

    // Get completed this week
    const completedThisWeek = await prisma.issue.count({
      where: {
        brandProfileId: brandProfile.id,
        status: { in: ["completed", "merged"] },
        updatedAt: { gte: sevenDaysAgo },
      },
    })

    // Total count
    const total = await prisma.issue.count({
      where: { brandProfileId: brandProfile.id },
    })

    // Transform to objects
    const byStatus = Object.fromEntries(
      statusCounts.map((s) => [s.status, s._count.id])
    )
    const byCategory = Object.fromEntries(
      categoryCounts.map((c) => [c.category, c._count.id])
    )
    const byPriority = Object.fromEntries(
      priorityCounts.map((p) => [p.priority, p._count.id])
    )

    return NextResponse.json({
      success: true,
      data: {
        total,
        byStatus: {
          identified: byStatus.identified || 0,
          in_progress: byStatus.in_progress || 0,
          completed: byStatus.completed || 0,
          merged: byStatus.merged || 0,
        },
        byCategory: {
          technical_structure: byCategory.technical_structure || 0,
          ai_visibility: byCategory.ai_visibility || 0,
          conversation: byCategory.conversation || 0,
        },
        byPriority: {
          low: byPriority.low || 0,
          medium: byPriority.medium || 0,
          high: byPriority.high || 0,
        },
        recentIssues,
        completedThisWeek,
      },
    })
  } catch (error) {
    console.error("[Issues API] Stats error:", error)
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch issue stats" } },
      { status: 500 }
    )
  }
}
