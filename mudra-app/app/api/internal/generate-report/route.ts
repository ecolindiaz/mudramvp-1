import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/analysis/technical/repo";
import { queueNlrJob } from "@/lib/jobs/nlr";
import crypto from 'crypto';

function isAdmin(req: NextRequest): boolean {
  const token = req.headers.get('x-admin-token') || ''
  const adminToken = process.env.ADMIN_API_TOKEN || ''
  if (!token || !adminToken) return false
  const hashA = crypto.createHash('sha256').update(token).digest()
  const hashB = crypto.createHash('sha256').update(adminToken).digest()
  return crypto.timingSafeEqual(hashA, hashB)
}

export async function POST(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized - Admin token required' } }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}));
    const siteId: string | undefined = body?.siteId;
    const weekStartRaw: string | undefined = body?.weekStart || body?.weekStartUtc;
    const weekStartUtc: string = weekStartRaw || new Date().toISOString().slice(0,10) + 'T00:00:00.000Z';

    if (!siteId) {
      return NextResponse.json({ success: false, error: { message: "siteId is required" } }, { status: 400 });
    }

    const site = await prisma.site.findUnique({ where: { id: siteId }, select: { companyId: true } });
    if (!site) {
      return NextResponse.json({ success: false, error: { message: "Site not found" } }, { status: 404 });
    }

    // Resolve brand profiles for this company and generate for the first (lowest order)
    const { resolveBrandProfileIds } = await import('@/lib/analysis/nlr/mappers/resolve-brand-profiles');
    const bpIds = await resolveBrandProfileIds(site.companyId);
    if (bpIds.length === 0) {
      return NextResponse.json({ success: false, error: { message: "No brand profiles found for this site's company" } }, { status: 404 });
    }

    const bp = await prisma.brandProfile.findFirst({
      where: { id: { in: bpIds } },
      orderBy: { monitorOrder: 'asc' },
      select: { id: true, userId: true },
    });
    const brandProfileId = bp?.id ?? bpIds[0];

    const job = await queueNlrJob(site.companyId, brandProfileId, weekStartUtc, bp?.userId ?? undefined);
    return NextResponse.json({ success: true, data: { jobId: job.id } });
  } catch (err) {
    console.error('[Internal Generate Report] Error:', err);
    return NextResponse.json({ success: false, error: { message: 'Failed to generate report' } }, { status: 500 });
  }
}
