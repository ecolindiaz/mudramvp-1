'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'

/**
 * Page View Tracker
 * 
 * Automatically captures page views when the user navigates.
 * This component should be wrapped in Suspense and placed in the root layout.
 * 
 * Features:
 * - Tracks full URL including search params
 * - Integrates with Next.js App Router navigation
 * - Respects PostHog initialization state
 * - Captures on client-side route changes
 * 
 * Usage:
 * ```tsx
 * <Suspense fallback={null}>
 *   <PageViewTracker />
 * </Suspense>
 * ```
 */
export function PageViewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Only track if PostHog is initialized and we have a pathname
    if (pathname && typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      // Build full URL with search params
      let url = window.origin + pathname
      if (searchParams?.toString()) {
        url = url + `?${searchParams.toString()}`
      }
      
      // Capture pageview event
      posthog.capture('$pageview', {
        $current_url: url,
      })
    }
  }, [pathname, searchParams])

  // This component doesn't render anything
  return null
}
