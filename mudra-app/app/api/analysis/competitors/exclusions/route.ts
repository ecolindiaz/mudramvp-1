import { NextRequest, NextResponse } from 'next/server'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'
import {
  addExcludedCompetitor,
  listExcludedCompetitors,
  removeExcludedCompetitor,
} from '@/lib/services/competitor-exclusions.service'

export async function GET(request: NextRequest) {
  const brandProfileId = request.nextUrl.searchParams.get('brandProfileId')
  const auth = await requireAuthWithBrandAccess(brandProfileId)
  if (!auth.success) return auth.response

  const exclusions = await listExcludedCompetitors(auth.brandProfileId!)
  return NextResponse.json({ success: true, data: { exclusions } })
}

export async function POST(request: NextRequest) {
  let body: { brandProfileId?: number | string; name?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const auth = await requireAuthWithBrandAccess(body.brandProfileId ?? null)
  if (!auth.success) return auth.response

  const name = typeof body.name === 'string' ? body.name : ''
  if (!name.trim()) {
    return NextResponse.json(
      { success: false, error: 'name is required' },
      { status: 400 }
    )
  }

  const exclusions = await addExcludedCompetitor(auth.brandProfileId!, name)
  return NextResponse.json({ success: true, data: { exclusions } })
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const brandProfileId = searchParams.get('brandProfileId')
  const name = searchParams.get('name') || ''

  const auth = await requireAuthWithBrandAccess(brandProfileId)
  if (!auth.success) return auth.response

  if (!name.trim()) {
    return NextResponse.json(
      { success: false, error: 'name is required' },
      { status: 400 }
    )
  }

  const exclusions = await removeExcludedCompetitor(auth.brandProfileId!, name)
  return NextResponse.json({ success: true, data: { exclusions } })
}
