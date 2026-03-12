"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

interface AnalysisState {
  isRunning: boolean
  brandProfileId: number | null
  startedAt: number | null
  lastCompletedAt: number | null
}

interface AnalysisContextType {
  isRunningAnalysis: boolean
  runningBrandProfileId: number | null
  analysisStartedAt: number | null
  lastCompletedAt: number | null
  startAnalysis: (brandProfileId: number) => void
  completeAnalysis: (success: boolean) => void
  cancelAnalysis: () => void
  getAbortSignal: () => AbortSignal | undefined
  checkForRecentCompletion: (brandProfileId: number) => boolean
}

const AnalysisContext = createContext<AnalysisContextType | null>(null)

const STORAGE_KEY = 'mudra:analysis-state'
const COMPLETION_CHECK_THRESHOLD = 5 * 60 * 1000 // 5 minutes - consider "recent" if completed within this time

function getStoredState(): AnalysisState | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.warn('[AnalysisContext] Failed to read stored state:', e)
  }
  return null
}

function setStoredState(state: AnalysisState) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('[AnalysisContext] Failed to store state:', e)
  }
}

function clearStoredState() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (e) {
    console.warn('[AnalysisContext] Failed to clear stored state:', e)
  }
}

export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const [isRunning, setIsRunning] = useState(false)
  const [brandProfileId, setBrandProfileId] = useState<number | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [lastCompletedAt, setLastCompletedAt] = useState<number | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Restore state from localStorage on mount
  useEffect(() => {
    const stored = getStoredState()
    if (stored) {
      // If analysis was running but started more than 10 minutes ago, consider it stale
      const isStale = stored.isRunning && stored.startedAt &&
        (Date.now() - stored.startedAt > 10 * 60 * 1000)

      if (isStale) {
        console.log('[AnalysisContext] Clearing stale analysis state')
        clearStoredState()
      } else {
        setIsRunning(stored.isRunning)
        setBrandProfileId(stored.brandProfileId)
        setStartedAt(stored.startedAt)
        setLastCompletedAt(stored.lastCompletedAt)
      }
    }
  }, [])

  const startAnalysis = useCallback((profileId: number) => {
    // Create new AbortController for this analysis
    abortControllerRef.current = new AbortController()

    const now = Date.now()
    setIsRunning(true)
    setBrandProfileId(profileId)
    setStartedAt(now)

    setStoredState({
      isRunning: true,
      brandProfileId: profileId,
      startedAt: now,
      lastCompletedAt
    })

    console.log('[AnalysisContext] Analysis started for profile:', profileId)
  }, [lastCompletedAt])

  const completeAnalysis = useCallback((success: boolean) => {
    // Don't abort - the request already completed
    abortControllerRef.current = null

    const now = Date.now()
    setIsRunning(false)
    setStartedAt(null)
    setLastCompletedAt(now)

    setStoredState({
      isRunning: false,
      brandProfileId,
      startedAt: null,
      lastCompletedAt: now
    })

    console.log('[AnalysisContext] Analysis completed:', success ? 'success' : 'failed')
  }, [brandProfileId])

  const cancelAnalysis = useCallback(() => {
    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    setIsRunning(false)
    setStartedAt(null)

    setStoredState({
      isRunning: false,
      brandProfileId,
      startedAt: null,
      lastCompletedAt
    })

    console.log('[AnalysisContext] Analysis cancelled')
  }, [brandProfileId, lastCompletedAt])

  const getAbortSignal = useCallback(() => {
    return abortControllerRef.current?.signal
  }, [])

  const checkForRecentCompletion = useCallback((profileId: number) => {
    // Check if analysis completed recently for this profile
    // This helps detect when analysis finished while user was on another page
    if (lastCompletedAt && brandProfileId === profileId) {
      const timeSinceCompletion = Date.now() - lastCompletedAt
      return timeSinceCompletion < COMPLETION_CHECK_THRESHOLD
    }
    return false
  }, [lastCompletedAt, brandProfileId])

  return (
    <AnalysisContext.Provider
      value={{
        isRunningAnalysis: isRunning,
        runningBrandProfileId: brandProfileId,
        analysisStartedAt: startedAt,
        lastCompletedAt,
        startAnalysis,
        completeAnalysis,
        cancelAnalysis,
        getAbortSignal,
        checkForRecentCompletion
      }}
    >
      {children}
    </AnalysisContext.Provider>
  )
}

export function useAnalysis(activeBrandProfileId?: number | null) {
  const context = useContext(AnalysisContext)
  if (!context) {
    throw new Error('useAnalysis must be used within an AnalysisProvider')
  }

  if (activeBrandProfileId === null || activeBrandProfileId === undefined) {
    return context
  }

  return {
    ...context,
    isRunningAnalysis:
      context.isRunningAnalysis && context.runningBrandProfileId === activeBrandProfileId,
  }
}
