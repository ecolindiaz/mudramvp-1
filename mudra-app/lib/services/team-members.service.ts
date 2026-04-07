import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

export type BrandAccessRole = 'OWNER' | 'ADMIN' | 'MEMBER'

export interface TeamMemberView {
  userId: string
  email: string
  name: string | null
  image: string | null
  role: BrandAccessRole
  joinedAt: string
  isOwner: boolean
}

export interface TeamInviteView {
  id: number
  invitedEmail: string
  role: BrandAccessRole
  invitedById: string
  createdAt: string
  expiresAt: string
}

const DEFAULT_INVITE_EXPIRY_DAYS = 7

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function getInviteExpiryDate(): Date {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + DEFAULT_INVITE_EXPIRY_DAYS)
  return expiresAt
}

async function getActiveTeamSeatCount(brandProfileId: number): Promise<number> {
  const [brandProfile, membershipCount] = await Promise.all([
    prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { userId: true },
    }),
    prisma.brandProfileMember.count({
      where: { brandProfileId },
    }),
  ])

  if (!brandProfile) {
    throw new Error('Brand profile not found')
  }

  if (!brandProfile.userId) {
    return membershipCount
  }

  // If owner membership backfill has not run yet, count the owner seat once.
  const ownerMembershipCount = await prisma.brandProfileMember.count({
    where: {
      brandProfileId,
      userId: brandProfile.userId,
    },
  })

  return membershipCount + (ownerMembershipCount > 0 ? 0 : 1)
}

export async function getDefaultBrandProfileIdForUser(userId: string): Promise<number | null> {
  const [ownedProfile, membership] = await Promise.all([
    prisma.brandProfile.findFirst({
      where: {
        userId,
        id: { not: 0 },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }),
    prisma.brandProfileMember.findFirst({
      where: {
        userId,
        brandProfile: {
          id: { not: 0 },
        },
      },
      orderBy: { createdAt: 'asc' },
      select: { brandProfileId: true },
    }),
  ])

  return ownedProfile?.id ?? membership?.brandProfileId ?? null
}

export async function getUserBrandAccessRole(
  userId: string,
  brandProfileId: number
): Promise<BrandAccessRole | null> {
  const brandProfile = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId },
    select: { userId: true },
  })

  if (!brandProfile) {
    return null
  }

  if (brandProfile.userId === userId) {
    return 'OWNER'
  }

  const membership = await prisma.brandProfileMember.findUnique({
    where: {
      brandProfileId_userId: {
        brandProfileId,
        userId,
      },
    },
    select: { role: true },
  })

  if (!membership) {
    return null
  }

  return membership.role as BrandAccessRole
}

export async function userHasBrandProfileAccess(userId: string, brandProfileId: number): Promise<boolean> {
  const role = await getUserBrandAccessRole(userId, brandProfileId)
  return role !== null
}

export async function ensureOwnerMembership(brandProfileId: number): Promise<void> {
  const brandProfile = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId },
    select: { userId: true },
  })

  if (!brandProfile?.userId) {
    return
  }

  await prisma.brandProfileMember.upsert({
    where: {
      brandProfileId_userId: {
        brandProfileId,
        userId: brandProfile.userId,
      },
    },
    update: {
      role: 'OWNER',
    },
    create: {
      brandProfileId,
      userId: brandProfile.userId,
      role: 'OWNER',
    },
  })
}

export async function listTeamForBrand(brandProfileId: number): Promise<{
  teamMemberLimit: number
  usedSeats: number
  pendingInvites: number
  members: TeamMemberView[]
  invites: TeamInviteView[]
}> {
  await ensureOwnerMembership(brandProfileId)

  const brandProfile = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId },
    select: {
      id: true,
      userId: true,
      teamMemberLimit: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          createdAt: true,
        },
      },
      teamMembers: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      teamInvites: {
        where: {
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!brandProfile) {
    throw new Error('Brand profile not found')
  }

  const ownerUserId = brandProfile.userId

  const ownerMember: TeamMemberView[] =
    ownerUserId && brandProfile.user
      ? [
          {
            userId: brandProfile.user.id,
            email: brandProfile.user.email,
            name: brandProfile.user.name,
            image: brandProfile.user.image,
            role: 'OWNER',
            joinedAt: brandProfile.user.createdAt.toISOString(),
            isOwner: true,
          },
        ]
      : []

  const members = brandProfile.teamMembers
    .filter((member) => member.user.id !== ownerUserId)
    .map((member) => ({
      userId: member.user.id,
      email: member.user.email,
      name: member.user.name,
      image: member.user.image,
      role: member.role as BrandAccessRole,
      joinedAt: member.createdAt.toISOString(),
      isOwner: false,
    }))

  const invites = brandProfile.teamInvites.map((invite) => ({
    id: invite.id,
    invitedEmail: invite.invitedEmail,
    role: invite.role as BrandAccessRole,
    invitedById: invite.invitedById,
    createdAt: invite.createdAt.toISOString(),
    expiresAt: invite.expiresAt.toISOString(),
  }))

  return {
    teamMemberLimit: brandProfile.teamMemberLimit,
    usedSeats: ownerMember.length + members.length,
    pendingInvites: invites.length,
    members: [...ownerMember, ...members],
    invites,
  }
}

export async function createTeamInvite(params: {
  brandProfileId: number
  invitedById: string
  invitedEmail: string
  role?: BrandAccessRole
}) {
  const invitedEmail = normalizeEmail(params.invitedEmail)
  const role = params.role ?? 'MEMBER'

  const [brandProfile, existingMemberByEmail, pendingInviteCount, activeSeatCount] = await Promise.all([
    prisma.brandProfile.findUnique({
      where: { id: params.brandProfileId },
      select: {
        id: true,
        teamMemberLimit: true,
        companyName: true,
        userId: true,
      },
    }),
    prisma.brandProfileMember.findFirst({
      where: {
        brandProfileId: params.brandProfileId,
        user: {
          email: invitedEmail,
        },
      },
      select: { id: true },
    }),
    prisma.brandProfileInvite.count({
      where: {
        brandProfileId: params.brandProfileId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    }),
    getActiveTeamSeatCount(params.brandProfileId),
  ])

  if (!brandProfile) {
    throw new Error('Brand profile not found')
  }

  if (brandProfile.userId === params.invitedById) {
    await ensureOwnerMembership(params.brandProfileId)
  }

  const inviterRole = await getUserBrandAccessRole(params.invitedById, params.brandProfileId)
  if (!inviterRole || (inviterRole !== 'OWNER' && inviterRole !== 'ADMIN')) {
    throw new Error('Only owners or admins can invite team members')
  }

  if (activeSeatCount + pendingInviteCount >= brandProfile.teamMemberLimit) {
    throw new Error(`Team seat limit reached (${brandProfile.teamMemberLimit})`)
  }

  if (existingMemberByEmail) {
    throw new Error('This email already belongs to a team member')
  }

  const ownerEmail = brandProfile.userId
    ? (
        await prisma.user.findUnique({
          where: { id: brandProfile.userId },
          select: { email: true },
        })
      )?.email
    : null

  if (ownerEmail && ownerEmail.toLowerCase() === invitedEmail) {
    throw new Error('Cannot invite the owner email')
  }

  const token = randomUUID()
  const expiresAt = getInviteExpiryDate()

  const existingPendingInvite = await prisma.brandProfileInvite.findFirst({
    where: {
      brandProfileId: params.brandProfileId,
      invitedEmail,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  })

  const invite = existingPendingInvite
    ? await prisma.brandProfileInvite.update({
        where: { id: existingPendingInvite.id },
        data: {
          role,
          token,
          invitedById: params.invitedById,
          expiresAt,
          status: 'PENDING',
        },
      })
    : await prisma.brandProfileInvite.create({
        data: {
          brandProfileId: params.brandProfileId,
          invitedEmail,
          role,
          invitedById: params.invitedById,
          token,
          expiresAt,
          status: 'PENDING',
        },
      })

  return {
    invite,
    brandName: brandProfile.companyName || 'Your workspace',
  }
}

export async function acceptTeamInvite(params: {
  token: string
  userId: string
  userEmail: string
}): Promise<{ brandProfileId: number }> {
  const token = params.token.trim()
  if (!token) {
    throw new Error('Invite token is required')
  }

  const invite = await prisma.brandProfileInvite.findUnique({
    where: { token },
    include: {
      brandProfile: {
        select: {
          id: true,
          userId: true,
          teamMemberLimit: true,
        },
      },
    },
  })

  if (!invite) {
    throw new Error('Invite not found')
  }

  if (invite.status !== 'PENDING') {
    throw new Error('Invite is no longer active')
  }

  if (invite.expiresAt <= new Date()) {
    await prisma.brandProfileInvite.update({
      where: { id: invite.id },
      data: { status: 'EXPIRED' },
    })
    throw new Error('Invite has expired')
  }

  if (normalizeEmail(params.userEmail) !== invite.invitedEmail.toLowerCase()) {
    throw new Error('Invite email does not match your signed-in account')
  }

  const activeSeatCount = await getActiveTeamSeatCount(invite.brandProfileId)
  if (activeSeatCount >= invite.brandProfile.teamMemberLimit) {
    throw new Error('No seats available in this workspace')
  }

  await prisma.$transaction(async (tx) => {
    if (invite.brandProfile.userId !== params.userId) {
      await tx.brandProfileMember.upsert({
        where: {
          brandProfileId_userId: {
            brandProfileId: invite.brandProfileId,
            userId: params.userId,
          },
        },
        update: {
          role: invite.role,
          invitedById: invite.invitedById,
        },
        create: {
          brandProfileId: invite.brandProfileId,
          userId: params.userId,
          role: invite.role,
          invitedById: invite.invitedById,
        },
      })
    }

    await tx.brandProfileInvite.update({
      where: { id: invite.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    })
  })

  return { brandProfileId: invite.brandProfileId }
}

export async function removeTeamMember(params: {
  brandProfileId: number
  actorUserId: string
  targetUserId: string
}) {
  const actorRole = await getUserBrandAccessRole(params.actorUserId, params.brandProfileId)
  if (actorRole !== 'OWNER' && actorRole !== 'ADMIN') {
    throw new Error('Only owners or admins can remove members')
  }

  const brandProfile = await prisma.brandProfile.findUnique({
    where: { id: params.brandProfileId },
    select: { userId: true },
  })

  if (!brandProfile) {
    throw new Error('Brand profile not found')
  }

  if (brandProfile.userId === params.targetUserId) {
    throw new Error('Cannot remove workspace owner')
  }

  const removed = await prisma.brandProfileMember.deleteMany({
    where: {
      brandProfileId: params.brandProfileId,
      userId: params.targetUserId,
    },
  })

  return removed.count > 0
}

export async function cancelTeamInvite(params: {
  brandProfileId: number
  actorUserId: string
  inviteId: number
}) {
  const actorRole = await getUserBrandAccessRole(params.actorUserId, params.brandProfileId)
  if (actorRole !== 'OWNER' && actorRole !== 'ADMIN') {
    throw new Error('Only owners or admins can cancel invites')
  }

  const invite = await prisma.brandProfileInvite.findUnique({
    where: { id: params.inviteId },
    select: { brandProfileId: true, status: true },
  })

  if (!invite || invite.brandProfileId !== params.brandProfileId) {
    throw new Error('Invite not found')
  }

  if (invite.status !== 'PENDING') {
    return false
  }

  await prisma.brandProfileInvite.update({
    where: { id: params.inviteId },
    data: {
      status: 'REVOKED',
    },
  })

  return true
}
