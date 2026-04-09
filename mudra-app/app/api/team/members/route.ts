import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'
import { listTeamForBrand, removeTeamMember } from '@/lib/services/team-members.service'

const removeMemberSchema = z.object({
  brandProfileId: z.number().int().positive(),
  targetUserId: z.string().min(1),
})

export async function GET(request: NextRequest) {
  try {
    const brandProfileIdParam = request.nextUrl.searchParams.get('brandProfileId')
    const authResult = await requireAuthWithBrandAccess(brandProfileIdParam)

    if (!authResult.success) {
      return authResult.response
    }

    const teamData = await listTeamForBrand(authResult.brandProfileId!)

    return NextResponse.json({
      success: true,
      data: {
        ...teamData,
        brandProfileId: authResult.brandProfileId,
        accessRole: authResult.accessRole ?? 'MEMBER',
      },
    })
  } catch (error) {
    console.error('[Team Members GET] Failed to load team:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Failed to load team members' } },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const payload = await request.json()
    const parsed = removeMemberSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid request body', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const authResult = await requireAuthWithBrandAccess(parsed.data.brandProfileId)
    if (!authResult.success) {
      return authResult.response
    }

    const removed = await removeTeamMember({
      brandProfileId: parsed.data.brandProfileId,
      actorUserId: authResult.user.id,
      targetUserId: parsed.data.targetUserId,
    })

    return NextResponse.json({ success: true, data: { removed } })
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Failed to remove member'
    const status = /not found/i.test(message) ? 404 : /only owners|cannot remove/i.test(message) ? 403 : 500

    return NextResponse.json(
      { success: false, error: { message } },
      { status }
    )
  }
}
