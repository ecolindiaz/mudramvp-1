import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { queueNlrJob } from "@/lib/jobs/nlr";
import { rateLimitByKey } from "@/lib/auth/rate-limiter-redis";
import crypto from 'crypto';

function timingSafeCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function isAdmin(req: NextRequest): boolean {
  const token = req.headers.get('x-admin-token') || ''
  const adminToken = process.env.ADMIN_API_TOKEN || ''
  return !!token && !!adminToken && timingSafeCompare(token, adminToken)
}

function isCronSigned(req: NextRequest): boolean {
  const sig = req.headers.get('x-cron-secret') || ''
  const cronSecret = process.env.CRON_SECRET || ''
  return !!sig && !!cronSecret && timingSafeCompare(sig, cronSecret)
}

export async function POST(req: NextRequest) {
  try {
    if (!isAdmin(req) && !isCronSigned(req)) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 })
    }
    const body = await req.json().catch(() => ({}))
    const companyId: string = body?.companyId
    const weekStartRaw: string | undefined = body?.weekStart || body?.weekStartUtc
    const weekStartUtc: string = weekStartRaw || new Date().toISOString().slice(0,10) + 'T00:00:00.000Z'
    if (!companyId) {
      return NextResponse.json({ success: false, error: { message: 'companyId is required' } }, { status: 400 })
    }

    // Rate limit per-org: 1 per minute
    const allowed = rateLimitByKey(`nlr_generate_${companyId}`, 1, 60)
    if (!allowed) {
      return NextResponse.json({ success: false, error: { message: 'Rate limited. Try again in a minute.' } }, { status: 429 })
    }
    const job = await queueNlrJob(companyId, weekStartUtc)
    return NextResponse.json({ success: true, data: { jobId: job.id } })
  } catch (err) {
    console.error('[NLR Generate] Error:', err);
    return NextResponse.json({ success: false, error: { message: 'Failed to generate report' } }, { status: 500 })
  }
}


