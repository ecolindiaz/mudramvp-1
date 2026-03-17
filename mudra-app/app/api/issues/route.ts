import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { z } from "zod"
import { discoverIssues, getIssuesForBrand } from "@/lib/services/issue-discovery.service"

const statusEnum = z.enum(['identified', 'in_progress', 'completed', 'merged', 'dismissed'])
const priorityEnum = z.enum(['low', 'medium', 'high'])
const categoryEnum = z.enum(['technical_structure', 'ai_visibility'])

const issueQuerySchema = z.object({
  status: statusEnum.optional(),
  category: categoryEnum.optional(),
  priority: priorityEnum.optional(),
})

const createIssueSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(10000).nullable().optional(),
  status: statusEnum.optional().default('identified'),
  priority: priorityEnum.optional().default('medium'),
  brandProfileId: z.number().int().positive().optional(),
})

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
    const page = searchParams.get('page')

    // Validate filter query params
    const rawFilters: Record<string, string> = {}
    const statusParam = searchParams.get('status')
    const categoryParam = searchParams.get('category')
    const priorityParam = searchParams.get('priority')
    if (statusParam) rawFilters.status = statusParam
    if (categoryParam) rawFilters.category = categoryParam
    if (priorityParam) rawFilters.priority = priorityParam

    const filterResult = issueQuerySchema.safeParse(rawFilters)
    if (!filterResult.success) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid query parameters', details: filterResult.error.errors } },
        { status: 400 }
      )
    }
    const filters = filterResult.data

    // Get brand profile - either by ID or for user
    let brandProfile
    if (brandProfileIdParam) {
      brandProfile = await prisma.brandProfile.findFirst({
        where: {
          id: parseInt(brandProfileIdParam),
          userId: session.user.id
        },
        select: { id: true },
      })
    } else {
      brandProfile = await prisma.brandProfile.findFirst({
        where: { userId: session.user.id },
        select: { id: true },
      })
    }

    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: { message: "Brand profile not found" } },
        { status: 404 }
      )
    }

    const issues = await getIssuesForBrand(brandProfile.id, {
      status: filters.status,
      category: filters.category,
      priority: filters.priority
    })

    let filteredIssues = issues

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
    // Cap identified issues to avoid overwhelming the user — show the top 10 by priority.
    // Issues in other statuses (in_progress, completed, merged) always show in full.
    const MAX_IDENTIFIED_DISPLAY = 10
    const allIdentified = filteredIssues.filter(i => i.status === 'identified')
    const grouped = {
      identified: allIdentified.slice(0, MAX_IDENTIFIED_DISPLAY),
      in_progress: filteredIssues.filter(i => i.status === 'in_progress'),
      completed: filteredIssues.filter(i => i.status === 'completed'),
      merged: filteredIssues.filter(i => i.status === 'merged')
    }

    // Only return the capped set to the client
    const displayedIssues = [
      ...grouped.identified,
      ...grouped.in_progress,
      ...grouped.completed,
      ...grouped.merged
    ]

    return NextResponse.json({
      success: true,
      data: {
        issues: displayedIssues,
        grouped,
        counts: {
          total: filteredIssues.length,
          identified: allIdentified.length,
          identifiedShown: grouped.identified.length,
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

    // Action: discover - run issue discovery (checked before schema validation)
    if (body.action === 'discover') {
      // Get brand profile for user
      let brandProfile
      if (body.brandProfileId) {
        brandProfile = await prisma.brandProfile.findFirst({
          where: {
            id: body.brandProfileId,
            userId: session.user.id
          },
          select: { id: true },
        })
      } else {
        brandProfile = await prisma.brandProfile.findFirst({
          where: { userId: session.user.id },
          select: { id: true },
        })
      }

      if (!brandProfile) {
        return NextResponse.json(
          { success: false, error: { message: "Brand profile not found" } },
          { status: 404 }
        )
      }

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

    // Action: extract-insights - extract GEO insights from AI provider responses
    if (body.action === 'extract-insights') {
      let brandProfile
      if (body.brandProfileId) {
        brandProfile = await prisma.brandProfile.findFirst({
          where: {
            id: body.brandProfileId,
            userId: session.user.id
          },
          select: { id: true },
        })
      } else {
        brandProfile = await prisma.brandProfile.findFirst({
          where: { userId: session.user.id },
          select: { id: true },
        })
      }

      if (!brandProfile) {
        return NextResponse.json(
          { success: false, error: { message: "Brand profile not found" } },
          { status: 404 }
        )
      }

      const { extractGeoInsights } = await import('@/lib/services/geo-insight-extraction.service')
      const result = await extractGeoInsights(brandProfile.id, {
        forceExtraction: body.force === true,
      })
      return NextResponse.json({
        success: true,
        data: {
          extracted: result.extracted,
          created: result.created,
          skipped: result.skipped,
          skippedBacklog: result.skippedBacklog,
        }
      })
    }

    // Validate body for manual issue creation
    const parsed = createIssueSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid input', details: parsed.error.errors } },
        { status: 400 }
      )
    }
    const { title, description, status, priority, brandProfileId } = parsed.data

    // Get brand profile for user
    let brandProfile
    if (brandProfileId) {
      brandProfile = await prisma.brandProfile.findFirst({
        where: {
          id: brandProfileId,
          userId: session.user.id
        },
        select: { id: true },
      })
    } else {
      brandProfile = await prisma.brandProfile.findFirst({
        where: { userId: session.user.id },
        select: { id: true },
      })
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
        status: status,
      },
      _max: { order: true },
    })

    const issue = await prisma.issue.create({
      data: {
        brandProfileId: brandProfile.id,
        title,
        description: description || null,
        status: status,
        priority: priority,
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
