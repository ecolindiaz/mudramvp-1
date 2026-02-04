import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { discoverIssues, getIssuesForBrand } from "@/lib/services/issue-discovery.service"

// Prevent Vercel timeout for issue queries with large datasets
export const maxDuration = 60

// GET /api/issues - Get all issues for the user's brand profile
export async function GET(request: NextRequest) {
  try {
    console.log('[Issues API] GET request started')
    const session = await getServerSession(authOptions)
    console.log('[Issues API] Session:', session ? 'Found' : 'Not found', session?.user?.id)
    if (!session?.user?.id) {
      console.log('[Issues API] Unauthorized - no session')
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
    const page = searchParams.get('page')

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

    // Progressive issue reveal: only show issues for pages that have been "unlocked"
    // issueDiscoveryPageIndex tracks how many pages' issues are visible (incremented each analysis run)
    let filteredIssues = issues
    const unlockedPageCount = brandProfile.issueDiscoveryPageIndex ?? 0

    if (unlockedPageCount > 0) {
      // Get ordered page URLs from latest technical analysis metadata
      const techAnalysis = await prisma.technicalStructureAnalysis.findFirst({
        where: { brandProfileId: brandProfile.id },
        orderBy: { createdAt: 'desc' },
        select: { metadata: true },
      })

      let metadata = techAnalysis?.metadata as Record<string, unknown> | null
      if (typeof metadata === 'string') {
        try { metadata = JSON.parse(metadata) } catch { metadata = null }
      }

      const pageScores = (metadata?.multiPageAnalysis as { pageScores?: Array<{ page_url: string }> })?.pageScores
      if (pageScores && pageScores.length > 0 && unlockedPageCount < pageScores.length) {
        // Build set of unlocked page URLs
        const unlockedUrls = new Set(
          pageScores.slice(0, unlockedPageCount).map(ps => ps.page_url)
        )

        filteredIssues = issues.filter(issue => {
          // Always show issues without a specific URL (AI visibility, conversation)
          if (!issue.affectedUrl) return true
          return unlockedUrls.has(issue.affectedUrl)
        })
      }
      // If unlockedPageCount >= pageScores.length, all pages are unlocked - show everything
    }

    // Additional filter by page param if requested
    if (page) {
      filteredIssues = filteredIssues.filter(issue => {
        if (!issue.affectedUrl) return true // Keep issues without a specific URL (AI visibility, conversation)
        try {
          const urlPath = new URL(issue.affectedUrl).pathname
          if (page === 'home' || page === 'homepage') {
            return urlPath === '/' || urlPath === ''
          }
          // Match by path segment (e.g., 'pricing' matches '/pricing', '/pricing/enterprise')
          return urlPath.toLowerCase().includes(page.toLowerCase())
        } catch {
          return issue.affectedUrl.toLowerCase().includes(page.toLowerCase())
        }
      })
    }

    // Group by status for Kanban view
    const grouped = {
      identified: filteredIssues.filter(i => i.status === 'identified'),
      in_progress: filteredIssues.filter(i => i.status === 'in_progress'),
      completed: filteredIssues.filter(i => i.status === 'completed'),
      merged: filteredIssues.filter(i => i.status === 'merged')
    }

    return NextResponse.json({
      success: true,
      data: {
        issues: filteredIssues,
        grouped,
        counts: {
          total: filteredIssues.length,
          identified: grouped.identified.length,
          in_progress: grouped.in_progress.length,
          completed: grouped.completed.length,
          merged: grouped.merged.length
        }
      }
    })
  } catch (error) {
    console.error("[Issues API] GET error:", error)
    console.error("[Issues API] Error details:", {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
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
    const { title, description, status, priority, brandProfileId, action } = body

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
