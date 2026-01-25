import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

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

    const issues = await prisma.issue.findMany({
      where: { brandProfileId: brandProfile.id },
      orderBy: [
        { status: "asc" },
        { order: "asc" },
        { createdAt: "desc" },
      ],
    })

    return NextResponse.json({ success: true, data: issues })
  } catch (error) {
    console.error("[Issues API] GET error:", error)
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch issues" } },
      { status: 500 }
    )
  }
}

// POST /api/issues - Create a new issue
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
    const { title, description, type, status, priority } = body

    if (!title) {
      return NextResponse.json(
        { success: false, error: { message: "Title is required" } },
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
