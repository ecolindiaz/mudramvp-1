import { NextRequest, NextResponse } from "next/server"
import { requireAuthWithBrandAccess } from "@/lib/auth/require-auth"
import { canRunRecommender, generateRecommendations } from "@/lib/services/prompt-recommender.service"

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { brandProfileId, country } = body

    const auth = await requireAuthWithBrandAccess(brandProfileId)
    if (!auth.success) return auth.response!

    const resolvedId = auth.brandProfileId!

    // Check 7-day cooldown
    const cooldownCheck = await canRunRecommender(resolvedId)
    if (!cooldownCheck.allowed) {
      const hoursLeft = Math.ceil((cooldownCheck.timeUntilNext || 0) / (1000 * 60 * 60))
      const daysLeft = Math.ceil(hoursLeft / 24)
      return NextResponse.json(
        {
          error: "Recommender cooldown active",
          timeUntilNext: cooldownCheck.timeUntilNext,
          lastRunAt: cooldownCheck.lastRunAt,
          message: `Prompt recommendations can be run once per week. Available again in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
        },
        { status: 429 }
      )
    }

    const recommendations = await generateRecommendations(resolvedId, country || "US")

    return NextResponse.json({
      success: true,
      data: recommendations,
      count: recommendations.length,
    })
  } catch (error: any) {
    console.error("Prompt recommender error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const brandProfileId = request.nextUrl.searchParams.get("brandProfileId")

    const auth = await requireAuthWithBrandAccess(brandProfileId)
    if (!auth.success) return auth.response!

    const resolvedId = auth.brandProfileId!
    const cooldownCheck = await canRunRecommender(resolvedId)

    return NextResponse.json({
      success: true,
      ...cooldownCheck,
    })
  } catch (error: any) {
    console.error("Recommender cooldown check error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
