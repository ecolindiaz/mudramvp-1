import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/analysis/technical/repo";
import { queueNlrJob } from "@/lib/jobs/nlr";
import crypto from 'crypto';

function isAdmin(req: NextRequest): boolean {
  const token = req.headers.get('x-admin-token') || ''
  const adminToken = process.env.ADMIN_API_TOKEN || ''
  if (!token || !adminToken) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(adminToken))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    // Always require admin token - no dev bypass
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

    const job = await queueNlrJob(site.companyId, weekStartUtc);
    return NextResponse.json({ success: true, data: { jobId: job.id } });
  } catch (err) {
    console.error('[Internal Generate Report] Error:', err);
    return NextResponse.json({ success: false, error: { message: 'Failed to generate report' } }, { status: 500 });
  }
}


