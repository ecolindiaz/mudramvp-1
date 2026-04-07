import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { acceptTeamInvite } from '@/lib/services/team-members.service'

const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Token is required'),
})

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    const parsed = acceptInviteSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid request body', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const authResult = await requireAuth()
    if (!authResult.success) {
      return authResult.response
    }

    const result = await acceptTeamInvite({
      token: parsed.data.token,
      userId: authResult.user.id,
      userEmail: authResult.user.email,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Failed to accept invite'
    const status = /not found|expired|no longer active/i.test(message)
      ? 404
      : /does not match|seats available/i.test(message)
        ? 409
        : 500

    return NextResponse.json(
      { success: false, error: { message } },
      { status }
    )
  }
}
