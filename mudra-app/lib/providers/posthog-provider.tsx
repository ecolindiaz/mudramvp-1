'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useBrandProfile } from '@/components/brand-profile-context'

/**
 * PostHog Analytics Provider
 * 
 * Initializes PostHog for client-side tracking and provides:
 * - Automatic user identification when logged in
 * - Session tracking and user properties
 * - Brand profile enrichment
 * - Page view tracking (via PageViewTracker component)
 * - Custom event tracking (via trackEvent utilities)
 * - Feature flags and A/B testing capabilities
 * 
 * Environment Variables Required:
 * - NEXT_PUBLIC_POSTHOG_KEY: PostHog project API key
 * - NEXT_PUBLIC_POSTHOG_HOST: PostHog instance URL (defaults to US cloud)
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const sessionData = useSession()
  const session = sessionData?.data
  const { profile: brandProfile } = useBrandProfile()
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'
  const posthogUiHost = posthogHost.replace('.i.posthog.com', '.posthog.com')

  useEffect(() => {
    // Initialize PostHog on client-side only
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      const apiHost = `${window.location.origin}/ingest`

      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        // Route through first-party origin to reduce extension-based blocking.
        api_host: apiHost,
        ui_host: posthogUiHost,
        
        // Enable debug mode in development
        loaded: (ph: any) => {
          if (process.env.NODE_ENV === 'development') {
            ph.debug()
            console.log('[PostHog] Initialized in debug mode')
          }
        },
        
        // Disable automatic pageview capture (we handle manually via PageViewTracker)
        capture_pageview: false,
        
        // Capture when users leave pages
        capture_pageleave: true,
        
        // Enable autocapture for all user interactions
        autocapture: {
          // Capture specific DOM events to reduce noise
          dom_event_allowlist: ['click', 'submit', 'change'],
        },
        
        // Enable session recording (optional - can be expensive)
        disable_session_recording: process.env.NEXT_PUBLIC_POSTHOG_DISABLE_RECORDINGS === 'true',
        
        // Respect user privacy preferences
        respect_dnt: true,
        
        // Enable persistence across sessions
        persistence: 'localStorage',
      })

      // Re-assert host config in case a stale persisted config exists.
      posthog.set_config({
        api_host: apiHost,
        ui_host: posthogUiHost,
      })
    }
  }, [posthogUiHost])

  // Identify user when logged in and reset on logout
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return

    if (session?.user) {
      // Identify user with their unique ID and properties
      posthog.identify(session.user.id, {
        email: session.user.email,
        name: session.user.name,
      })
      
      console.log(`[PostHog] User identified: ${session.user.email}`)
    } else {
      // Clear user data on logout
      posthog.reset()
      console.log('[PostHog] User logged out, session reset')
    }
  }, [session])

  // Set brand profile properties when available
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || !session?.user || !brandProfile?.id) return

    posthog.setPersonProperties({
      current_brand_id: brandProfile.id,
      brand_name: brandProfile.companyName,
      website_url: brandProfile.companyWebsite,
      industry: brandProfile.companyIndustry,
      // Add more brand properties as needed
    })

    console.log(`[PostHog] Brand properties set: ${brandProfile.companyName}`)
  }, [session, brandProfile])

  // If PostHog key is not configured, just render children without provider
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[PostHog] NEXT_PUBLIC_POSTHOG_KEY not set - analytics disabled')
    }
    return <>{children}</>
  }

  return <PHProvider client={posthog}>{children}</PHProvider>
}
