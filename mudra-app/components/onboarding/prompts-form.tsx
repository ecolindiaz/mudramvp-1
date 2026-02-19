"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { useAnalysisPipeline } from "@/hooks/use-analysis-pipeline"
import { useBrandProfile } from "@/components/brand-profile-context"
import { useOnboarding } from "./onboarding-context"
import { useAnalysis } from "@/components/analysis-context"
import { UnicodeLoader } from "@/components/ui/unicode-loader"



const LOADING_STEPS = [
  "Defining your prompts",
  "Analyzing your brand",
  "Testing AI visibility",
  "Scanning competitors",
  "Testing agent readiness",
  "Preparing your dashboard",
]

const STALE_THRESHOLD_MS = 12 * 60 * 1000 // 12 minutes
const POLL_INTERVAL_MS = 15 * 1000 // 15 seconds

type RecoveryState = 'none' | 'checking' | 'completed' | 'still-running'

export function PromptsForm() {
  const router = useRouter()
  const { profile, refreshBrandProfile } = useBrandProfile()
  const { data: onboardingData, saveToProfile, additionalMonitorIds } = useOnboarding()
  const { state, error, simulatedProgress, runPipeline } = useAnalysisPipeline()
  const {
    isRunningAnalysis,
    analysisStartedAt,
    startAnalysis,
    completeAnalysis,
    checkForRecentCompletion,
  } = useAnalysis()

  const [analysisStarted, setAnalysisStarted] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [recoveryState, setRecoveryState] = useState<RecoveryState>('none')
  const hasSaved = useRef(false)
  const hasTriggeredAnalysis = useRef(false)
  const hasCheckedRecovery = useRef(false)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [])

  // Recovery: check if analysis was already started (survives refresh)
  useEffect(() => {
    if (hasCheckedRecovery.current || !profile?.id) return
    hasCheckedRecovery.current = true

    const profileId = profile.id

    // Case 1: Analysis is marked as running in AnalysisContext (persisted in localStorage)
    if (isRunningAnalysis && analysisStartedAt) {
      const elapsed = Date.now() - analysisStartedAt

      if (elapsed > STALE_THRESHOLD_MS) {
        // Stale — analysis started too long ago, allow fresh trigger
        console.log('[PromptsForm] Stale analysis detected, clearing state')
        completeAnalysis(false)
        setRecoveryState('none')
        return
      }

      // Prevent re-trigger during recovery
      hasSaved.current = true
      hasTriggeredAnalysis.current = true
      setRecoveryState('checking')

      // Check if backend already completed
      fetch(`/api/analysis/latest?brandProfileId=${profileId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.analysis?.createdAt) {
            const analysisTime = new Date(data.analysis.createdAt).getTime()
            if (analysisTime >= analysisStartedAt) {
              // Analysis completed on the backend while we were away
              console.log('[PromptsForm] Analysis already completed on backend')
              completeAnalysis(true)
              setRecoveryState('completed')
              return
            }
          }
          // Still running — enter polling mode
          console.log('[PromptsForm] Analysis still running, entering polling mode')
          setRecoveryState('still-running')
          startPolling(profileId, analysisStartedAt)
        })
        .catch(() => {
          // Network error during check — assume still running
          setRecoveryState('still-running')
          startPolling(profileId, analysisStartedAt)
        })
      return
    }

    // Case 2: Analysis completed recently (user might have navigated away and back)
    if (checkForRecentCompletion(profileId)) {
      console.log('[PromptsForm] Recent completion detected')
      hasSaved.current = true
      hasTriggeredAnalysis.current = true
      setRecoveryState('completed')
      return
    }

    // Case 3: No recovery needed — normal flow
    setRecoveryState('none')
  }, [profile?.id, isRunningAnalysis, analysisStartedAt, completeAnalysis, checkForRecentCompletion])

  const startPolling = useCallback((profileId: number, startedAfter: number) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)

    pollIntervalRef.current = setInterval(() => {
      fetch(`/api/analysis/latest?brandProfileId=${profileId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.analysis?.createdAt) {
            const analysisTime = new Date(data.analysis.createdAt).getTime()
            if (analysisTime >= startedAfter) {
              // Analysis completed!
              console.log('[PromptsForm] Polling detected analysis completion')
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
                pollIntervalRef.current = null
              }
              completeAnalysis(true)
              setRecoveryState('completed')
            }
          }
        })
        .catch(() => {
          // Ignore polling errors, will retry next interval
        })
    }, POLL_INTERVAL_MS)
  }, [completeAnalysis])

  // Save + trigger flow (only when recoveryState === 'none')
  useEffect(() => {
    if (recoveryState !== 'none') return
    if (!hasSaved.current && !analysisStarted && onboardingData.companyName) {
      hasSaved.current = true

      const saveAndAnalyze = async () => {
        console.log("[PromptsForm] Starting save process...")
        await saveToProfile()
        await refreshBrandProfile()
        await new Promise(resolve => setTimeout(resolve, 500))
        setAnalysisStarted(true)
      }

      saveAndAnalyze()
    }
  }, [recoveryState, onboardingData.companyName, analysisStarted, saveToProfile, refreshBrandProfile])

  useEffect(() => {
    if (recoveryState !== 'none') return

    if (analysisStarted && onboardingData.companyName && profile?.id && profile.id > 0 && !hasTriggeredAnalysis.current) {
      if (!onboardingData.companyWebsite) {
        console.error("[PromptsForm] Cannot trigger analysis - missing website URL")
        return
      }

      hasTriggeredAnalysis.current = true

      // Mark analysis as running in AnalysisContext (persists across refresh)
      startAnalysis(profile.id)

      const primaryRegions = onboardingData.domainEntries?.[0]?.regions?.filter(Boolean)
      const config = {
        brandProfileId: profile.id,
        brandName: onboardingData.companyName,
        website: onboardingData.companyWebsite,
        industry: onboardingData.companyIndustry || undefined,
        description: onboardingData.companyDescription || undefined,
        competitors: onboardingData.competitors || [],
        countries: primaryRegions && primaryRegions.length > 0 ? primaryRegions : ["US"],
      }

      ;(async () => {
        try {
          console.log("[PromptsForm] Generating initial prompts...")
          await fetch('/api/prompts/generate-initial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brandProfileId: profile.id }),
          })
          console.log("[PromptsForm] Initial prompts generated")
        } catch (err) {
          console.warn("[PromptsForm] Initial prompt generation failed, fallback will handle:", err)
        }

        try {
          await runPipeline(config)
          completeAnalysis(true)
        } catch (err) {
          console.error("[PromptsForm] Pipeline failed:", err)
          completeAnalysis(false)
        }
      })()

      // Fire-and-forget analysis for additional monitors
      if (additionalMonitorIds.length > 0) {
        const extraEntries = onboardingData.domainEntries.slice(1).filter(e => e.domain.trim())
        additionalMonitorIds.forEach((monitorId, idx) => {
          const entry = extraEntries[idx]
          if (!entry) return
          const countries = entry.regions.filter(Boolean)
          console.log(`[PromptsForm] Triggering analysis for additional monitor ${monitorId} (${entry.domain})`)
          fetch("/api/analysis/unified", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              brandProfileId: monitorId,
              brandName: onboardingData.companyName,
              website: entry.domain,
              industry: onboardingData.companyIndustry || undefined,
              description: onboardingData.companyDescription || undefined,
              competitors: onboardingData.competitors || [],
              countries: countries.length > 0 ? countries : ["US"],
              skipCooldown: true,
            }),
          }).catch(err => {
            console.error(`[PromptsForm] Additional monitor ${monitorId} analysis failed:`, err)
          })
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recoveryState, analysisStarted, profile?.id])

  const handleFinish = () => {
    // Clear onboarding data from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('onboardingData')
    }
    router.push("/dashboard")
  }

  const isAnalysisComplete = state === 'completed' || recoveryState === 'completed'
  const hasError = state === 'error'
  const isRunning = state === 'running' || recoveryState === 'still-running'

  // Calculate overall progress
  const calculateProgress = () => {
    if (isAnalysisComplete) return 100
    if (hasError) return 0
    if (recoveryState === 'still-running') return -1 // indeterminate
    if (state === 'idle' && recoveryState === 'none') return 0
    return Math.round(simulatedProgress)
  }

  const currentProgress = calculateProgress()
  const isIndeterminate = currentProgress === -1

  // Cycle through loading steps based on progress
  useEffect(() => {
    if (!isRunning) return

    if (isIndeterminate) {
      // For recovery polling, cycle through steps on a timer
      const interval = setInterval(() => {
        setCurrentStepIndex(prev => (prev + 1) % LOADING_STEPS.length)
      }, 3000)
      return () => clearInterval(interval)
    }

    const stepProgress = currentProgress / 100
    const newStepIndex = Math.min(
      Math.floor(stepProgress * LOADING_STEPS.length),
      LOADING_STEPS.length - 1
    )

    if (newStepIndex !== currentStepIndex) {
      setCurrentStepIndex(newStepIndex)
    }
  }, [currentProgress, isRunning, currentStepIndex, isIndeterminate])

  if (isAnalysisComplete) {
    return (
      <Card className="w-full max-w-[400px] mx-auto bg-[#161616] border border-white/[0.06] rounded-2xl shadow-2xl">
        <CardContent className="pt-8 pb-6 px-6 text-center space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-white">
              AI Visibility Analysis Complete!
            </h2>
            <p className="text-sm text-white/60">
              Your brand's AI visibility has been analyzed across major models
            </p>
          </div>
          <Button
            type="button"
            onClick={handleFinish}
            className="w-full h-11 bg-white text-black hover:bg-white/90 rounded-lg font-medium"
          >
            View Dashboard
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (hasError) {
    return (
      <Card className="w-full max-w-[400px] mx-auto bg-[#161616] border border-white/[0.06] rounded-2xl shadow-2xl">
        <CardContent className="pt-8 pb-6 px-6 text-center space-y-6">
          <div className="space-y-3">
            <div className="w-12 h-12 mx-auto bg-red-500/10 rounded-full flex items-center justify-center">
              <span className="text-xl">⚠️</span>
            </div>
            <h2 className="text-xl font-semibold text-white">Analysis Failed</h2>
            <p className="text-sm text-red-400">{error || 'An error occurred during analysis'}</p>
            <p className="text-xs text-white/50">
              You can run analysis later from your dashboard
            </p>
          </div>
          <Button
            type="button"
            onClick={handleFinish}
            className="w-full h-11 bg-white text-black hover:bg-white/90 rounded-lg font-medium"
          >
            Continue to Dashboard
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-[400px] mx-auto bg-[#161616] border border-white/[0.06] rounded-2xl shadow-2xl">
      <CardContent className="pt-8 pb-6 px-6 text-center space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-white">
            Analyzing Your AI Visibility
          </h2>
          <p className="text-sm text-white/60">
            {recoveryState === 'still-running'
              ? 'Your analysis is still running...'
              : 'Testing how AI models rank your brand'}
          </p>
        </div>

        <div className="space-y-4">
          {/* Single loader pattern for the entire final onboarding run */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-4 flex items-center gap-3 text-left">
            <UnicodeLoader className="w-5 text-[18px] text-white/70 flex-shrink-0" animate />
            <div className="min-w-0">
              <p className="text-sm font-medium text-white/90 truncate">
                {LOADING_STEPS[currentStepIndex]}
              </p>
              <p className="text-xs text-white/50 mt-1">
                {isIndeterminate ? "Analysis in progress" : `${Math.round(currentProgress)}% complete`}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-white/[0.08] rounded-full h-1.5 overflow-hidden">
            {isIndeterminate ? (
              <div
                className="bg-white h-1.5 rounded-full w-1/3"
                style={{
                  animation: "onboarding-loader-sweep 1.5s ease-in-out infinite",
                }}
              />
            ) : (
              <div
                className="bg-white h-1.5 rounded-full"
                style={{ width: `${currentProgress}%`, transition: "width 0.5s ease-out" }}
              />
            )}
          </div>
        </div>
      </CardContent>
      <style jsx>{`
        @keyframes onboarding-loader-sweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </Card>
  )
}
