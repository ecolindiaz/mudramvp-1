"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useBrandProfile } from '@/components/brand-profile-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type TeamRole = 'OWNER' | 'ADMIN' | 'MEMBER'

interface TeamMember {
  userId: string
  email: string
  name: string | null
  image: string | null
  role: TeamRole
  joinedAt: string
  isOwner: boolean
}

interface TeamInvite {
  id: number
  invitedEmail: string
  role: TeamRole
  invitedById: string
  createdAt: string
  expiresAt: string
}

interface TeamResponseData {
  brandProfileId: number
  accessRole: TeamRole
  teamMemberLimit: number
  usedSeats: number
  pendingInvites: number
  members: TeamMember[]
  invites: TeamInvite[]
}

export default function TeamMembersPage() {
  const { profile } = useBrandProfile()

  const [data, setData] = useState<TeamResponseData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER')
  const [isInviting, setIsInviting] = useState(false)

  const canManageTeam = data?.accessRole === 'OWNER' || data?.accessRole === 'ADMIN'

  const seatsLeft = useMemo(() => {
    if (!data) return 0
    const usedIncludingPending = data.usedSeats + data.pendingInvites
    return Math.max(data.teamMemberLimit - usedIncludingPending, 0)
  }, [data])

  const fetchTeam = useCallback(async () => {
    if (!profile?.id) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/team/members?brandProfileId=${profile.id}`)
      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload?.error?.message || 'Failed to load team members')
      }

      setData(payload.data)
    } catch (fetchError: any) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load team members')
    } finally {
      setIsLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    fetchTeam()
  }, [fetchTeam])

  const handleInvite = async () => {
    if (!profile?.id || !inviteEmail.trim()) {
      return
    }

    setIsInviting(true)
    setError(null)

    try {
      const response = await fetch('/api/team/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandProfileId: profile.id,
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      })

      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload?.error?.message || 'Unable to send invite')
      }

      setInviteEmail('')
      setInviteRole('MEMBER')
      await fetchTeam()
    } catch (inviteError: any) {
      setError(inviteError instanceof Error ? inviteError.message : 'Unable to send invite')
    } finally {
      setIsInviting(false)
    }
  }

  const handleRemoveMember = async (targetUserId: string) => {
    if (!profile?.id) {
      return
    }

    setError(null)

    try {
      const response = await fetch('/api/team/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandProfileId: profile.id,
          targetUserId,
        }),
      })

      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload?.error?.message || 'Unable to remove member')
      }

      await fetchTeam()
    } catch (removeError: any) {
      setError(removeError instanceof Error ? removeError.message : 'Unable to remove member')
    }
  }

  const handleCancelInvite = async (inviteId: number) => {
    if (!profile?.id) {
      return
    }

    setError(null)

    try {
      const response = await fetch('/api/team/invites', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandProfileId: profile.id,
          inviteId,
        }),
      })

      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload?.error?.message || 'Unable to cancel invite')
      }

      await fetchTeam()
    } catch (cancelError: any) {
      setError(cancelError instanceof Error ? cancelError.message : 'Unable to cancel invite')
    }
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            Invite collaborators into this workspace and manage seat usage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">Seats used: {data?.usedSeats ?? 0}</Badge>
            <Badge variant="secondary">Pending invites: {data?.pendingInvites ?? 0}</Badge>
            <Badge variant={seatsLeft > 0 ? 'secondary' : 'destructive'}>
              Seats left: {seatsLeft}
            </Badge>
          </div>

          {canManageTeam && (
            <div className="grid gap-3 md:grid-cols-[1fr_160px_auto] items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium">Invite by email</label>
                <Input
                  type="email"
                  placeholder="teammate@company.com"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <Select value={inviteRole} onValueChange={(value: 'ADMIN' | 'MEMBER') => setInviteRole(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEMBER">Member</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleInvite} disabled={isInviting || !inviteEmail.trim() || seatsLeft <= 0}>
                {isInviting ? 'Sending...' : 'Send Invite'}
              </Button>
            </div>
          )}

          {!canManageTeam && (
            <p className="text-sm text-muted-foreground">Only workspace owners or admins can invite members.</p>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading team members...</p>}

          {!isLoading && (data?.members.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">No team members found.</p>
          )}

          {(data?.members ?? []).map((member) => (
            <div key={member.userId} className="flex items-center justify-between border rounded-md px-3 py-2">
              <div>
                <p className="font-medium">{member.name || member.email}</p>
                <p className="text-sm text-muted-foreground">{member.email}</p>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={member.role === 'OWNER' ? 'default' : 'outline'}>{member.role}</Badge>
                {canManageTeam && !member.isOwner && (
                  <Button variant="outline" size="sm" onClick={() => handleRemoveMember(member.userId)}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending Invites</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(data?.invites.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">No pending invites.</p>
          )}

          {(data?.invites ?? []).map((invite) => (
            <div key={invite.id} className="flex items-center justify-between border rounded-md px-3 py-2">
              <div>
                <p className="font-medium">{invite.invitedEmail}</p>
                <p className="text-sm text-muted-foreground">Expires {new Date(invite.expiresAt).toLocaleDateString()}</p>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline">{invite.role}</Badge>
                {canManageTeam && (
                  <Button variant="outline" size="sm" onClick={() => handleCancelInvite(invite.id)}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
