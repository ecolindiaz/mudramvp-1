import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'
import { cancelTeamInvite, createTeamInvite } from '@/lib/services/team-members.service'
import { sendTeamInviteEmail } from '@/lib/email'

const createInviteSchema = z.object({
  brandProfileId: z.number().int().positive(),
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER']).optional(),
})

const cancelInviteSchema = z.object({
  brandProfileId: z.number().int().positive(),
  inviteId: z.number().int().positive(),
})

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    const parsed = createInviteSchema.safeParse(payload)

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

    const { invite, brandName } = await createTeamInvite({
      brandProfileId: parsed.data.brandProfileId,
      invitedById: authResult.user.id,
      invitedEmail: parsed.data.email,
      role: parsed.data.role,
    })

    const emailResult = await sendTeamInviteEmail({
      to: invite.invitedEmail,
      inviterName: authResult.user.name,
      brandName,
      inviteToken: invite.token,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: invite.id,
        invitedEmail: invite.invitedEmail,
        role: invite.role,
        expiresAt: invite.expiresAt,
        emailSent: emailResult.success,
      },
    })
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Failed to invite team member'
    const status = /limit reached|already belongs|cannot invite/i.test(message)
      ? 409
      : /only owners|admins/i.test(message)
        ? 403
        : /not found/i.test(message)
          ? 404
          : 500

    return NextResponse.json(
      { success: false, error: { message } },
      { status }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const payload = await request.json()
    const parsed = cancelInviteSchema.safeParse(payload)

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

    const cancelled = await cancelTeamInvite({
      brandProfileId: parsed.data.brandProfileId,
      actorUserId: authResult.user.id,
      inviteId: parsed.data.inviteId,
    })

    return NextResponse.json({
      success: true,
      data: { cancelled },
    })
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Failed to cancel invite'
    const status = /only owners|admins/i.test(message)
      ? 403
      : /not found/i.test(message)
        ? 404
        : 500

    return NextResponse.json(
      { success: false, error: { message } },
      { status }
    )
  }
}
