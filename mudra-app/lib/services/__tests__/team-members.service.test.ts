/**
 * Team members service tests
 *
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  brandProfileFindUnique: vi.fn(),
  brandProfileFindFirst: vi.fn(),
  brandProfileMemberCount: vi.fn(),
  brandProfileMemberFindFirst: vi.fn(),
  brandProfileMemberFindUnique: vi.fn(),
  brandProfileMemberUpsert: vi.fn(),
  brandProfileMemberDeleteMany: vi.fn(),
  brandProfileInviteCount: vi.fn(),
  brandProfileInviteFindFirst: vi.fn(),
  brandProfileInviteFindUnique: vi.fn(),
  brandProfileInviteCreate: vi.fn(),
  brandProfileInviteUpdate: vi.fn(),
  userFindUnique: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('node:crypto', () => ({
  randomUUID: () => 'uuid-token',
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    brandProfile: {
      findUnique: mocks.brandProfileFindUnique,
      findFirst: mocks.brandProfileFindFirst,
    },
    brandProfileMember: {
      count: mocks.brandProfileMemberCount,
      findFirst: mocks.brandProfileMemberFindFirst,
      findUnique: mocks.brandProfileMemberFindUnique,
      upsert: mocks.brandProfileMemberUpsert,
      deleteMany: mocks.brandProfileMemberDeleteMany,
    },
    brandProfileInvite: {
      count: mocks.brandProfileInviteCount,
      findFirst: mocks.brandProfileInviteFindFirst,
      findUnique: mocks.brandProfileInviteFindUnique,
      create: mocks.brandProfileInviteCreate,
      update: mocks.brandProfileInviteUpdate,
    },
    user: {
      findUnique: mocks.userFindUnique,
    },
    $transaction: mocks.transaction,
  },
}))

import {
  acceptTeamInvite,
  createTeamInvite,
  getUserBrandAccessRole,
} from '../team-members.service'

describe('team-members.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves OWNER role for brand owner', async () => {
    mocks.brandProfileFindUnique.mockResolvedValue({ userId: 'owner-1' })

    const role = await getUserBrandAccessRole('owner-1', 1)

    expect(role).toBe('OWNER')
    expect(mocks.brandProfileMemberFindUnique).not.toHaveBeenCalled()
  })

  it('resolves membership role for non-owner members', async () => {
    mocks.brandProfileFindUnique.mockResolvedValue({ userId: 'owner-1' })
    mocks.brandProfileMemberFindUnique.mockResolvedValue({ role: 'ADMIN' })

    const role = await getUserBrandAccessRole('admin-1', 1)

    expect(role).toBe('ADMIN')
  })

  it('blocks invite creation when seat limit is reached', async () => {
    mocks.brandProfileFindUnique.mockResolvedValue({
      id: 1,
      teamMemberLimit: 2,
      companyName: 'Acme',
      userId: 'owner-1',
    })
    mocks.brandProfileMemberFindFirst.mockResolvedValue(null)
    mocks.brandProfileInviteCount.mockResolvedValue(0)
    mocks.brandProfileMemberCount.mockResolvedValueOnce(2).mockResolvedValueOnce(1)
    mocks.brandProfileMemberFindUnique.mockResolvedValue({ role: 'ADMIN' })

    await expect(
      createTeamInvite({
        brandProfileId: 1,
        invitedById: 'admin-1',
        invitedEmail: 'new-user@acme.com',
      })
    ).rejects.toThrow('Team seat limit reached')

    expect(mocks.brandProfileInviteCreate).not.toHaveBeenCalled()
  })

  it('blocks invite creation for duplicate team emails', async () => {
    mocks.brandProfileFindUnique.mockResolvedValue({
      id: 1,
      teamMemberLimit: 5,
      companyName: 'Acme',
      userId: 'owner-1',
    })
    mocks.brandProfileMemberFindFirst.mockResolvedValue({ id: 99 })
    mocks.brandProfileInviteCount.mockResolvedValue(0)
    mocks.brandProfileMemberCount.mockResolvedValueOnce(1).mockResolvedValueOnce(1)
    mocks.brandProfileMemberFindUnique.mockResolvedValue({ role: 'ADMIN' })

    await expect(
      createTeamInvite({
        brandProfileId: 1,
        invitedById: 'admin-1',
        invitedEmail: 'existing@acme.com',
      })
    ).rejects.toThrow('already belongs to a team member')
  })

  it('rejects invite acceptance when email does not match', async () => {
    const tx = {
      brandProfileInvite: {
        findUnique: vi.fn().mockResolvedValue({
          id: 10,
          token: 'token-1',
          status: 'PENDING',
          invitedEmail: 'invitee@acme.com',
          invitedById: 'admin-1',
          role: 'MEMBER',
          expiresAt: new Date(Date.now() + 60_000),
          brandProfileId: 1,
          brandProfile: { id: 1, userId: 'owner-1', teamMemberLimit: 5 },
        }),
        update: vi.fn(),
      },
      brandProfileMember: {
        findUnique: vi.fn(),
        count: vi.fn(),
        upsert: vi.fn(),
      },
      brandProfile: {
        findUnique: vi.fn(),
      },
    }

    mocks.transaction.mockImplementation(async (fn: any) => fn(tx))

    await expect(
      acceptTeamInvite({
        token: 'token-1',
        userId: 'member-1',
        userEmail: 'other@acme.com',
      })
    ).rejects.toThrow('Invite email does not match your signed-in account')
  })

  it('marks expired invites and rejects acceptance', async () => {
    const update = vi.fn()
    const tx = {
      brandProfileInvite: {
        findUnique: vi.fn().mockResolvedValue({
          id: 11,
          token: 'token-2',
          status: 'PENDING',
          invitedEmail: 'invitee@acme.com',
          invitedById: 'admin-1',
          role: 'MEMBER',
          expiresAt: new Date(Date.now() - 60_000),
          brandProfileId: 1,
          brandProfile: { id: 1, userId: 'owner-1', teamMemberLimit: 5 },
        }),
        update,
      },
      brandProfileMember: {
        findUnique: vi.fn(),
        count: vi.fn(),
        upsert: vi.fn(),
      },
      brandProfile: {
        findUnique: vi.fn(),
      },
    }

    mocks.transaction.mockImplementation(async (fn: any) => fn(tx))

    await expect(
      acceptTeamInvite({
        token: 'token-2',
        userId: 'member-1',
        userEmail: 'invitee@acme.com',
      })
    ).rejects.toThrow('Invite has expired')

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 11 },
        data: { status: 'EXPIRED' },
      })
    )
  })

  it('rejects invite acceptance when no seat is available', async () => {
    const tx = {
      brandProfileInvite: {
        findUnique: vi.fn().mockResolvedValue({
          id: 12,
          token: 'token-3',
          status: 'PENDING',
          invitedEmail: 'invitee@acme.com',
          invitedById: 'admin-1',
          role: 'MEMBER',
          expiresAt: new Date(Date.now() + 60_000),
          brandProfileId: 1,
          brandProfile: { id: 1, userId: 'owner-1', teamMemberLimit: 2 },
        }),
        update: vi.fn(),
      },
      brandProfileMember: {
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(1),
        upsert: vi.fn(),
      },
      brandProfile: {
        findUnique: vi.fn().mockResolvedValue({ userId: 'owner-1' }),
      },
    }

    mocks.transaction.mockImplementation(async (fn: any) => fn(tx))

    await expect(
      acceptTeamInvite({
        token: 'token-3',
        userId: 'member-1',
        userEmail: 'invitee@acme.com',
      })
    ).rejects.toThrow('No seats available in this workspace')
  })
})
