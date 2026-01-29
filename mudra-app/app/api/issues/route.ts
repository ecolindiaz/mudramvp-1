import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { discoverIssues, getIssuesForBrand } from "@/lib/services/issue-discovery.service"

// GET /api/issues - Get all issues for the user's brand profile
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const brandProfileIdParam = searchParams.get('brandProfileId')
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const priority = searchParams.get('priority')

    // Get brand profile - either by ID or for user
    let brandProfile
    if (brandProfileIdParam) {
      brandProfile = await prisma.brandProfile.findFirst({
        where: { 
          id: parseInt(brandProfileIdParam),
          userId: session.user.id 
        },
      })
    } else {
      brandProfile = await prisma.brandProfile.findFirst({
        where: { userId: session.user.id },
      })
    }

    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: { message: "Brand profile not found" } },
        { status: 404 }
      )
    }

    const issues = await getIssuesForBrand(brandProfile.id, {
      status: status || undefined,
      category: category || undefined,
      priority: priority || undefined
    })

    // Group by status for Kanban view
    const grouped = {
      identified: issues.filter(i => i.status === 'identified'),
      in_progress: issues.filter(i => i.status === 'in_progress'),
      completed: issues.filter(i => i.status === 'completed'),
      merged: issues.filter(i => i.status === 'merged')
    }

    return NextResponse.json({
      success: true,
      data: {
        issues,
        grouped,
        counts: {
          total: issues.length,
          identified: grouped.identified.length,
          in_progress: grouped.in_progress.length,
          completed: grouped.completed.length,
          merged: grouped.merged.length
        }
      }
    })
  } catch (error) {
    console.error("[Issues API] GET error:", error)
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch issues" } },
      { status: 500 }
    )
  }
}

// POST /api/issues - Create a new issue OR trigger discovery
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
    const { title, description, type, status, priority, brandProfileId, action } = body

    // Get brand profile for user
    let brandProfile
    if (brandProfileId) {
      brandProfile = await prisma.brandProfile.findFirst({
        where: { 
          id: brandProfileId,
          userId: session.user.id 
        },
      })
    } else {
      brandProfile = await prisma.brandProfile.findFirst({
        where: { userId: session.user.id },
      })
    }

    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: { message: "Brand profile not found" } },
        { status: 404 }
      )
    }

    // Action: discover - run issue discovery
    if (action === 'discover') {
      const result = await discoverIssues(brandProfile.id)
      return NextResponse.json({
        success: true,
        data: {
          discovered: result.discovered,
          categories: result.categories,
          tiers: result.tiers
        }
      })
    }

    // Default: create a new issue manually
    if (!title) {
      return NextResponse.json(
        { success: false, error: { message: "Title is required" } },
        { status: 400 }
      )
    }

    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: { message: "Brand profile not found" } },
        { status: 404 }
      )
    }

    // Get the max order for the status column
    const maxOrder = await prisma.issue.aggregate({
      where: {
        brandProfileId: brandProfile.id,
        status: status || "identified",
      },
      _max: { order: true },
    })

    const issue = await prisma.issue.create({
      data: {
        brandProfileId: brandProfile.id,
        title,
        description: description || null,
        type: type || "bug",
        status: status || "identified",
        priority: priority || "medium",
        order: (maxOrder._max.order ?? -1) + 1,
      },
    })

    return NextResponse.json({ success: true, data: issue }, { status: 201 })
  } catch (error) {
    console.error("[Issues API] POST error:", error)
    return NextResponse.json(
      { success: false, error: { message: "Failed to create issue" } },
      { status: 500 }
    )
  }
}
