import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getWeeklyReportByWeek, prisma } from "@/lib/db/reports";

function isAdmin(req: NextRequest): boolean {
  const token = req.headers.get('x-admin-token') || ''
  return !!token && token === process.env.ADMIN_API_TOKEN
}

function isOrgAuthorized(req: NextRequest, companyId: string): boolean {
  // MVP org-scope check: require either admin OR matching x-company-id header
  if (isAdmin(req)) return true
  const requesterCompanyId = req.headers.get('x-company-id') || ''
  return requesterCompanyId !== '' && requesterCompanyId === companyId
}

function startOfIsoWeekUtc(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = date.getUTCDay() || 7 // 1..7 where 1=Mon, 7=Sun
  const diff = day - 1
  date.setUTCDate(date.getUTCDate() - diff)
  return date
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const companyId = url.searchParams.get('companyId')
    const weekStartStr = url.searchParams.get('weekStartUtc')

    if (!companyId) {
      return NextResponse.json({ success: false, error: { message: 'companyId is required' } }, { status: 400 })
    }

    if (!isOrgAuthorized(req, companyId)) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 })
    }

    const targetWeek = weekStartStr ? new Date(weekStartStr) : startOfIsoWeekUtc(new Date())

    // Try the requested week
    const report = await getWeeklyReportByWeek(companyId, targetWeek)
    if (report) {
      return NextResponse.json({ success: true, data: { report, sections: report.sections } })
    }

    // Fallback: most recent ready
    const latest = await prisma.weeklyReport.findFirst({
      where: { companyId, status: 'ready' },
      orderBy: { weekStartUtc: 'desc' },
      include: { sections: { orderBy: { order: 'asc' } } },
    })

    return NextResponse.json({ success: true, data: latest ? { report: latest, sections: (latest as any).sections } : { report: null, sections: [] } })
  } catch (err) {
    return NextResponse.json({ success: false, error: { message: (err as Error).message } }, { status: 500 })
  }
}


