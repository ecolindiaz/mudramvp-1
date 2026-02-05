"use client"
import React from "react"
import { BrandProfileProvider, useBrandProfile } from "@/components/brand-profile-context"
import { useAnalysis } from "@/components/analysis-context"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { OverviewMetrics } from "@/components/dashboard/overview-metrics"
import { NaturalLanguageReport } from "@/components/dashboard/natural-language-report"
import type { TimeRange } from "@/components/dashboard/time-range-selector"
import type { AIModel } from "@/components/dashboard/model-selector"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { CountdownBadge } from "@/components/dashboard/countdown-badge"
import { Loader2, PlayCircle } from "lucide-react"
import Image from "next/image"
import toast from "react-hot-toast"
import { trackEvent } from "@/lib/analytics/posthog-events"

type PlatformFilter = "all" | AIModel

const platformOptions = [
  { value: "all" as PlatformFilter, label: "All Models", icon: null },
  { value: "chatgpt" as PlatformFilter, label: "ChatGPT", icon: "/openai_dark.svg" },
  { value: "claude" as PlatformFilter, label: "Claude", icon: "/claude-ai-icon.svg" },
  { value: "perplexity" as PlatformFilter, label: "Perplexity", icon: "/perplexity (2).svg" },
  { value: "gemini" as PlatformFilter, label: "Gemini", icon: "/gemini (3).svg" },
  { value: "google-aio" as PlatformFilter, label: "Google AIO", icon: "/google-logo.svg" },
]

const timeRangeOptions = [
  { value: "7d" as TimeRange, label: "Last 7 days" },
  { value: "15d" as TimeRange, label: "Last 15 days" },
  { value: "1m" as TimeRange, label: "Last month" },
]

function DashboardPageInner() {
  const { profile } = useBrandProfile()
  const {
    isRunningAnalysis,
    startAnalysis,
    completeAnalysis,
    getAbortSignal,
    checkForRecentCompletion
  } = useAnalysis()
  const [timeRange, setTimeRange] = React.useState<TimeRange>("1m")
  const [selectedPlatform, setSelectedPlatform] = React.useState<PlatformFilter>("all")

  // Calculate days from timeRange for API calls
  const days = timeRange === '7d' ? 7 : timeRange === '15d' ? 15 : 30

  // Analysis cooldown state
  const [canRunAnalysis, setCanRunAnalysis] = React.useState(false)
  const [nextAnalysisTime, setNextAnalysisTime] = React.useState<number | null>(null)

  // Check if analysis completed while user was away and refresh data
  React.useEffect(() => {
    if (profile?.id && checkForRecentCompletion(profile.id)) {
      console.log('[Dashboard] Analysis completed while away, refreshing data...')
      // Dispatch event to refresh dashboard metrics
      window.dispatchEvent(new Event('mudra:website-analyzed'))
      toast.success('Analysis completed! Data has been refreshed.')
    }
  }, [profile?.id, checkForRecentCompletion])

  // Check cooldown status
  React.useEffect(() => {
    const checkCooldown = async () => {
      // Make sure profile is loaded and has a valid ID
      if (!profile?.id || profile.id <= 0) return

      try {
        const response = await fetch(`/api/analysis/cooldown?brandProfileId=${profile.id}`)
        const data = await response.json()

        if (data.success) {
          setCanRunAnalysis(data.allowed)
          if (data.lastRunAt && data.timeUntilNext) {
            // Calculate target time (when analysis will be available)
            setNextAnalysisTime(Date.now() + data.timeUntilNext)
          } else {
            setNextAnalysisTime(null)
          }
        } else {
          // If cooldown check fails, allow analysis (fail-open for better UX)
          console.warn('Cooldown check returned error, allowing analysis:', data.error)
          setCanRunAnalysis(true)
        }
      } catch (error) {
        console.error('Failed to check cooldown:', error)
        // On network error, allow analysis (fail-open)
        setCanRunAnalysis(true)
      }
    }

    checkCooldown()
    // Check every 30 seconds
    const interval = setInterval(checkCooldown, 30000)
    return () => clearInterval(interval)
  }, [profile?.id])

  // Handle run analysis
  const handleRunAnalysis = async () => {
    if (!profile?.id || profile.id <= 0) {
      toast.error('Profile not loaded. Please refresh the page.')
      return
    }

    if (!canRunAnalysis) {
      toast.error('Analysis is on cooldown. Please wait 24 hours.')
      return
    }

    if (isRunningAnalysis) {
      return
    }

    // Start analysis using global context (persists across navigation)
    startAnalysis(profile.id)
    const toastId = toast.loading('Running analysis... This may take 1-2 minutes.')
    const startTime = Date.now()

    // Track analysis start
    trackEvent.analysisStarted(profile.id, 'unified')

    try {
      const response = await fetch('/api/analysis/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandProfileId: profile.id,
          brandName: profile.companyName,
          website: profile.companyWebsite,
          description: profile.companyDescription,
          industry: profile.companyIndustry,
          competitors: [],
          skipCooldown: false, // Enforce 24-hour cooldown
          generateReport: true, // Generate natural language report on each analysis
        }),
        signal: getAbortSignal(), // Allow cancellation if user navigates away
      })

      const result = await response.json()
      console.log('[Dashboard] Analysis result:', result)

      if (result.success) {
        const duration = Date.now() - startTime

        // Track successful analysis
        trackEvent.analysisCompleted(profile.id, 'unified', duration, {
          geo_score: result.data?.geoScore,
          technical_score: result.data?.technicalScore,
        })

        toast.success('Analysis completed successfully!', { id: toastId })
        // Dispatch event to refresh dashboard metrics
        window.dispatchEvent(new Event('mudra:website-analyzed'))
        // Reset cooldown state
        setCanRunAnalysis(false)
        setNextAnalysisTime(Date.now() + (24 * 60 * 60 * 1000)) // 24 hours from now

        // Mark analysis as complete in global context
        completeAnalysis(true)
      } else {
        const errorMsg = typeof result.error === 'string'
          ? result.error
          : result.error?.message || 'Analysis failed'
        console.error('[Dashboard] Analysis failed:', result)

        // Track analysis failure
        trackEvent.analysisFailed(profile.id, 'unified', errorMsg)

        toast.error(errorMsg, { id: toastId })

        // Mark analysis as complete (with failure) in global context
        completeAnalysis(false)
      }
    } catch (error) {
      // Check if this was an abort (user navigated away)
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[Dashboard] Analysis request aborted (user navigated away)')
        toast.dismiss(toastId)
        // Don't mark as complete - analysis may still be running on server
        return
      }

      console.error('[Dashboard] Analysis error:', error)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'

      // Track analysis error
      trackEvent.analysisFailed(profile.id, 'unified', errorMsg)

      toast.error('Failed to run analysis. Please try again.', { id: toastId })

      // Mark analysis as complete (with failure) in global context
      completeAnalysis(false)
    }
  }

  return (
    <SidebarProvider
      className="bg-dark-grey"
      style={
        {
          "--sidebar-width": "16rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col overflow-x-hidden max-w-full">
          <div className="@container/main flex flex-1 flex-col overflow-x-hidden max-w-full">
            {/* Page Header */}
            <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold tracking-tight text-white">Overview</h1>
                  <p className="text-sm text-white/60 mt-1">
                    Your brands performance across AI Search Engines
                  </p>
                </div>
                
                <div className="flex items-center gap-2.5 flex-shrink-0">
                  {/* Platform Filter */}
                  <Select value={selectedPlatform} onValueChange={(value) => setSelectedPlatform(value as PlatformFilter)}>
                    <SelectTrigger className="w-[160px] h-9 !bg-[#161616] hover:!bg-[#1c1c1c] !border-0 text-white rounded-lg transition-all duration-200 focus-visible:ring-0 focus-visible:ring-offset-0 outline-none">
                      <SelectValue placeholder="All Models" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#161616] border-0 duration-200">
                      {platformOptions.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          className="focus:bg-white/[0.08] hover:bg-white/[0.05] outline-none text-white transition-colors duration-150"
                        >
                          <div className="flex items-center gap-2">
                            {option.icon && (
                              <Image
                                src={option.icon}
                                alt=""
                                width={16}
                                height={16}
                                className="shrink-0"
                              />
                            )}
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Time Range Filter */}
                  <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
                    <SelectTrigger className="w-[140px] h-9 !bg-[#161616] hover:!bg-[#1c1c1c] !border-0 text-white rounded-lg transition-all duration-200 focus-visible:ring-0 focus-visible:ring-offset-0 outline-none">
                      <SelectValue placeholder="Last month" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#161616] border-0 duration-200">
                      {timeRangeOptions.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          className="focus:bg-white/[0.08] hover:bg-white/[0.05] outline-none text-white transition-colors duration-150"
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Countdown Badge */}
                  {!canRunAnalysis && nextAnalysisTime && (
                    <CountdownBadge targetMs={nextAnalysisTime} />
                  )}

                  {/* Run Analysis Button */}
                  <Button
                    onClick={handleRunAnalysis}
                    disabled={!canRunAnalysis || isRunningAnalysis}
                    className="h-9 bg-white text-black hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium px-4"
                  >
                    {isRunningAnalysis ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <PlayCircle className="size-4 mr-2" />
                        Run Analysis
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Divider Line - Full Width */}
            <div className="h-[0.5px] bg-white/10"></div>
            
            <div className="flex flex-1 flex-col pt-6 pb-8">
              {/* Overview Metrics */}
              <div>
                <OverviewMetrics
                  timeRange={timeRange}
                  selectedModel={selectedPlatform}
                  days={days}
                />
              </div>

              {/* Natural Language Report */}
              <div className="px-4 lg:px-6 pt-6">
                <NaturalLanguageReport
                  timeRange={timeRange}
                  selectedModel={selectedPlatform}
                  days={days}
                />
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function Page() {
  return (
    <BrandProfileProvider>
      <DashboardPageInner />
    </BrandProfileProvider>
  );
}
