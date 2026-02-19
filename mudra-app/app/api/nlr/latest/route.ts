import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getWeeklyReportByWeek } from "@/lib/db/reports";
import { prisma } from "@/lib/prisma";
import { requireAuthWithBrandAccess } from "@/lib/auth/require-auth";
import { resolveCompanyIdFromBrandProfile } from "@/lib/analysis/nlr/mappers/resolve-brand-profiles";
import { calculateAggregateFromResults } from "@/lib/analysis/nlr/mappers/ai-visibility";

function isAdmin(req: NextRequest): boolean {
  const token = req.headers.get('x-admin-token') || ''
  return !!token && token === process.env.ADMIN_API_TOKEN
}

function startOfIsoWeekUtc(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = date.getUTCDay() || 7
  const diff = day - 1
  date.setUTCDate(date.getUTCDate() - diff)
  return date
}

function pctDelta(current: number | null, previous: number | null) {
  if (current == null && previous == null) return { current: null, previous: null, absolute: null, relative: null, direction: "flat" as const };
  if (previous == null) return { current, previous: null, absolute: null, relative: null, direction: "up" as const };
  if (current == null) return { current: null, previous, absolute: null, relative: null, direction: "down" as const };
  const abs = current - previous;
  const rel = previous !== 0 ? abs / previous : null;
  const direction = abs > 0 ? "up" as const : abs < 0 ? "down" as const : "flat" as const;
  return { current, previous, absolute: abs, relative: rel, direction };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    let companyId = url.searchParams.get('companyId')
    const brandProfileIdStr = url.searchParams.get('brandProfileId')
    const weekStartStr = url.searchParams.get('weekStartUtc')
    const country = url.searchParams.get('country')

    let resolvedBrandProfileId: number | null = null

    // brandProfileId-based lookup (used by dashboard)
    if (!companyId && brandProfileIdStr) {
      // Authenticate via session + verify ownership
      const authResult = await requireAuthWithBrandAccess(brandProfileIdStr)
      if (!authResult.success) {
        return authResult.response
      }
      resolvedBrandProfileId = authResult.brandProfileId!
      companyId = await resolveCompanyIdFromBrandProfile(resolvedBrandProfileId)
    }

    if (!companyId) {
      return NextResponse.json({ success: false, error: { message: 'companyId or brandProfileId is required' } }, { status: 400 })
    }

    // For companyId-based requests (admin/cron), check admin token
    if (!brandProfileIdStr && !isAdmin(req)) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 })
    }

    const targetWeek = weekStartStr ? new Date(weekStartStr) : startOfIsoWeekUtc(new Date())

    // Try the requested week
    let report = await getWeeklyReportByWeek(companyId, targetWeek)

    // Fallback: most recent ready
    if (!report) {
      const latest = await prisma.weeklyReport.findFirst({
        where: { companyId, status: 'ready' },
        orderBy: { weekStartUtc: 'desc' },
        include: { sections: { orderBy: { order: 'asc' } } },
      })
      if (latest) {
        report = latest as any
      }
    }

    // Compute country overlay if country param provided and we have a brandProfileId
    let countryOverlay: { aiVisibility: { score: ReturnType<typeof pctDelta>; averagePosition: ReturnType<typeof pctDelta> } } | null = null

    if (country && resolvedBrandProfileId && report) {
      const reportWeek = report.weekStartUtc instanceof Date ? report.weekStartUtc : new Date(report.weekStartUtc)
      const weekEnd = new Date(reportWeek)
      weekEnd.setDate(weekEnd.getDate() + 7)
      const prevWeekStart = new Date(reportWeek)
      prevWeekStart.setDate(prevWeekStart.getDate() - 7)

      const [currentResults, prevResults] = await Promise.all([
        prisma.geoAnalysisResult.findMany({
          where: {
            brandProfileId: resolvedBrandProfileId,
            country,
            timestamp: { gte: reportWeek, lt: weekEnd },
          },
        }),
        prisma.geoAnalysisResult.findMany({
          where: {
            brandProfileId: resolvedBrandProfileId,
            country,
            timestamp: { gte: prevWeekStart, lt: reportWeek },
          },
        }),
      ])

      if (currentResults.length > 0 || prevResults.length > 0) {
        const currentAggregate = calculateAggregateFromResults(
          currentResults.map((result) => ({ analyses: result.analyses }))
        )
        const prevAggregate = calculateAggregateFromResults(
          prevResults.map((result) => ({ analyses: result.analyses }))
        )

        countryOverlay = {
          aiVisibility: {
            score: pctDelta(
              currentAggregate.overallScore,
              prevAggregate.overallScore
            ),
            averagePosition: pctDelta(
              currentAggregate.averagePosition,
              prevAggregate.averagePosition
            ),
          },
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: report
        ? { report, sections: (report as any).sections ?? [], countryOverlay }
        : { report: null, sections: [], countryOverlay: null },
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: { message: (err as Error).message } }, { status: 500 })
  }
}
