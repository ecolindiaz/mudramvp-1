import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { queueNlrJob } from "@/lib/jobs/nlr";

function isAdmin(req: NextRequest): boolean {
  // MVP: allow local and protected deployments; replace with real auth later
  const token = req.headers.get('x-admin-token') || ''
  return token && token === process.env.ADMIN_API_TOKEN
}

export async function POST(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 })
    }
    const body = await req.json().catch(() => ({}))
    const companyId: string = body?.companyId
    const weekStartUtc: string = body?.weekStartUtc || new Date().toISOString().slice(0,10) + 'T00:00:00.000Z'
    if (!companyId) {
      return NextResponse.json({ success: false, error: { message: 'companyId is required' } }, { status: 400 })
    }
    const job = await queueNlrJob(companyId, weekStartUtc)
    return NextResponse.json({ success: true, data: { jobId: job.id } })
  } catch (err) {
    return NextResponse.json({ success: false, error: { message: (err as Error).message } }, { status: 500 })
  }
}


