"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type InviteState = 'idle' | 'accepting' | 'accepted' | 'error'

const INVITE_COOKIE = 'mudra_invite_token'

function setInviteCookie(token: string) {
  if (typeof document === 'undefined' || !token) return
  document.cookie = `${INVITE_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=3600; SameSite=Lax`
}

function clearInviteCookie() {
  if (typeof document === 'undefined') return
  document.cookie = `${INVITE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
}

function setActiveInviteProfile(profileId: number | null) {
  if (typeof window === 'undefined' || !profileId || profileId <= 0) return
  try {
    localStorage.setItem('mudra_active_profile_id', String(profileId))
    // Force fresh fetch for the newly selected workspace profile.
    localStorage.removeItem('mudra_brand_profile')
  } catch {
    // Ignore storage errors and continue with navigation.
  }
}

export default function AcceptInvitePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { status } = useSession()

  const token = useMemo(() => searchParams.get('token') || '', [searchParams])
  const [state, setState] = useState<InviteState>('idle')
  const [message, setMessage] = useState<string>('Preparing your invitation...')
  const [brandProfileId, setBrandProfileId] = useState<number | null>(null)

  useEffect(() => {
    if (!token) {
      setState('error')
      setMessage('Missing invite token.')
      clearInviteCookie()
      return
    }

    // Persist token through OAuth/new-user redirects.
    setInviteCookie(token)

    if (status === 'unauthenticated') {
      const callbackUrl = `/accept-invite?token=${encodeURIComponent(token)}`
      router.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
    }
  }, [status, token, router])

  useEffect(() => {
    if (!token || status !== 'authenticated') {
      return
    }

    let isActive = true
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 20000)

    const run = async () => {
      setState('accepting')
      setMessage('Accepting your invitation...')

      try {
        const response = await fetch('/api/team/invites/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
          signal: controller.signal,
        })

        const payload = await response.json()

        if (!response.ok || !payload.success) {
          throw new Error(payload?.error?.message || 'Unable to accept invite')
        }

        if (!isActive) {
          return
        }

        setBrandProfileId(payload?.data?.brandProfileId ?? null)
        setState('accepted')
        setMessage('Invitation accepted. You can now access this workspace.')
      } catch (error: any) {
        if (!isActive) {
          return
        }
        setState('error')
        if (error instanceof Error && error.name === 'AbortError') {
          setMessage('Accept invite timed out. Please try again in a moment.')
          return
        }
        setMessage(error instanceof Error ? error.message : 'Unable to accept invite')
      }
    }

    run()

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [token, status])

  useEffect(() => {
    if (state !== 'accepted') {
      return
    }

    clearInviteCookie()
    setActiveInviteProfile(brandProfileId)

    const redirectTimer = window.setTimeout(() => {
      if (brandProfileId) {
        router.replace(`/dashboard?profileId=${brandProfileId}`)
        return
      }
      router.replace('/dashboard')
    }, 1200)

    return () => {
      window.clearTimeout(redirectTimer)
    }
  }, [state, brandProfileId, router])

  useEffect(() => {
    if (state === 'error') {
      clearInviteCookie()
    }
  }, [state])

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <Card className="w-full max-w-xl bg-[#111] border-white/10 text-white">
        <CardHeader>
          <CardTitle>Workspace Invitation</CardTitle>
          <CardDescription className="text-white/70">
            Accept your invite to collaborate with your team in Mudra.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-white/80">{message}</p>

          {state === 'accepted' && (
            <Button
              onClick={() => {
                setActiveInviteProfile(brandProfileId)
                if (brandProfileId) {
                  router.push(`/dashboard?profileId=${brandProfileId}`)
                  return
                }
                router.push('/dashboard')
              }}
            >
              Go to Dashboard
            </Button>
          )}

          {state === 'error' && (
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              Go to Dashboard
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
