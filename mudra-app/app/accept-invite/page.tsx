"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type InviteState = 'idle' | 'accepting' | 'accepted' | 'error'

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
      return
    }

    if (status === 'unauthenticated') {
      const callbackUrl = `/accept-invite?token=${encodeURIComponent(token)}`
      router.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
    }
  }, [status, token, router])

  useEffect(() => {
    if (!token || status !== 'authenticated' || state === 'accepting' || state === 'accepted') {
      return
    }

    let mounted = true

    const run = async () => {
      setState('accepting')
      setMessage('Accepting your invitation...')

      try {
        const controller = new AbortController()
        const timeoutId = window.setTimeout(() => controller.abort(), 20000)

        const response = await fetch('/api/team/invites/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
          signal: controller.signal,
        })

        window.clearTimeout(timeoutId)

        const payload = await response.json()

        if (!response.ok || !payload.success) {
          throw new Error(payload?.error?.message || 'Unable to accept invite')
        }

        if (!mounted) {
          return
        }

        setBrandProfileId(payload?.data?.brandProfileId ?? null)
        setState('accepted')
        setMessage('Invitation accepted. You can now access this workspace.')
      } catch (error: any) {
        if (!mounted) {
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
      mounted = false
    }
  }, [token, status, state])

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
