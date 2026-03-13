import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getWeeklyReportByWeek } from "@/lib/db/reports";
import { prisma } from "@/lib/prisma";
import { requireAuthWithBrandAccess } from "@/lib/auth/require-auth";
import { calculateAggregateFromResults } from "@/lib/analysis/nlr/mappers/ai-visibility";
import crypto from 'crypto';

function isAdmin(req: NextRequest): boolean {
  const token = req.headers.get('x-admin-token') || ''
  const adminToken = process.env.ADMIN_API_TOKEN || ''
  if (!token || !adminToken) return false
  const hashA = crypto.createHash('sha256').update(token).digest()
  const hashB = crypto.createHash('sha256').update(adminToken).digest()
  return crypto.timingSafeEqual(hashA, hashB)
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
    const brandProfileIdStr = url.searchParams.get('brandProfileId')
    const companyIdParam = url.searchParams.get('companyId')
    const weekStartStr = url.searchParams.get('weekStartUtc')
    const country = url.searchParams.get('country')

    let companyId: string | null = null
    let brandProfileId: number | null = null
    const adminRequest = isAdmin(req)

    // Primary path: brandProfileId (used by dashboard) — resolve to companyId for report lookup
    if (brandProfileIdStr) {
      if (!adminRequest) {
        const authResult = await requireAuthWithBrandAccess(brandProfileIdStr)
        if (!authResult.success) {
          return authResult.response
        }
        brandProfileId = authResult.brandProfileId!
      } else {
        const parsed = Number.parseInt(brandProfileIdStr, 10)
        if (Number.isNaN(parsed)) {
          return NextResponse.json({ success: false, error: { message: 'Invalid brandProfileId' } }, { status: 400 })
        }
        brandProfileId = parsed
      }

      // Resolve companyId from brandProfileId
      const { resolveCompanyIdFromBrandProfile } = await import('@/lib/analysis/nlr/mappers/resolve-brand-profiles')
      companyId = await resolveCompanyIdFromBrandProfile(brandProfileId)
    } else if (companyIdParam && adminRequest) {
      // Admin-only: direct companyId lookup
      companyId = companyIdParam
      // Resolve a brandProfileId for country overlay queries
      const { resolveBrandProfileIds } = await import('@/lib/analysis/nlr/mappers/resolve-brand-profiles')
      const bpIds = await resolveBrandProfileIds(companyId)
      if (bpIds.length > 0) {
        const bp = await prisma.brandProfile.findFirst({
          where: { id: { in: bpIds } },
          orderBy: { monitorOrder: 'asc' },
          select: { id: true },
        })
        brandProfileId = bp?.id ?? bpIds[0]
      }
    } else {
      return NextResponse.json({ success: false, error: { message: 'brandProfileId is required' } }, { status: 400 })
    }

    if (!companyId) {
      return NextResponse.json({ success: false, error: { message: 'Could not resolve companyId' } }, { status: 400 })
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

    // Compute country overlay if country param provided
    let countryOverlay: { aiVisibility: { score: ReturnType<typeof pctDelta>; averagePosition: ReturnType<typeof pctDelta> } } | null = null

    if (country && brandProfileId && report) {
      const reportWeek = report.weekStartUtc instanceof Date ? report.weekStartUtc : new Date(report.weekStartUtc)
      const weekEnd = new Date(reportWeek)
      weekEnd.setDate(weekEnd.getDate() + 7)
      const prevWeekStart = new Date(reportWeek)
      prevWeekStart.setDate(prevWeekStart.getDate() - 7)

      const [currentResults, prevResults] = await Promise.all([
        prisma.geoAnalysisResult.findMany({
          where: {
            brandProfileId,
            country,
            timestamp: { gte: reportWeek, lt: weekEnd },
          },
        }),
        prisma.geoAnalysisResult.findMany({
          where: {
            brandProfileId,
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
