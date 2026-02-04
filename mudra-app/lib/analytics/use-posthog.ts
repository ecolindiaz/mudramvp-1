/**
 * PostHog Analytics Integration Hook
 * 
 * A convenient React hook for accessing PostHog tracking functions.
 * Provides safe access to PostHog with graceful fallbacks.
 * 
 * Usage:
 * ```tsx
 * import { usePostHog } from '@/lib/analytics/use-posthog'
 * 
 * function MyComponent() {
 *   const posthog = usePostHog()
 *   
 *   const handleClick = () => {
 *     posthog?.capture('button_clicked', { button_name: 'Submit' })
 *   }
 * }
 * ```
 */

'use client'

import { usePostHog as usePostHogBase } from 'posthog-js/react'

export function usePostHog() {
  try {
    return usePostHogBase()
  } catch (error) {
    // Gracefully handle if PostHog isn't initialized
    if (process.env.NODE_ENV === 'development') {
      console.warn('[PostHog] Hook called but PostHog not initialized')
    }
    return null
  }
}
