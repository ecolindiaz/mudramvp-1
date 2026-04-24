"use client"

import { Suspense } from "react"
import Link from "next/link"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"

import { Loader2, Search, Radio, BookOpen, Info, MessageSquare, TrendingUp, Clock, Languages } from "lucide-react"
import { BrandProfileProvider, useBrandProfile } from "@/components/brand-profile-context"
import { useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import { trackEvent } from "@/lib/analytics/posthog-events"
import { COUNTRY_LANGUAGE_MAP, isAllowedCountry, type CountryCode } from "@/lib/geo/country-config"

const RADAR_RUNNING_KEY = 'mudra_radar_running'
const RADAR_RUN_TIMEOUT = 150_000 // 150s (backend maxDuration is 120s + buffer)

function getRadarRunState(): { startedAt: number; brandProfileId: number; country?: string } | null {
  try {
    const stored = localStorage.getItem(RADAR_RUNNING_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored)
    if (Date.now() - parsed.startedAt > RADAR_RUN_TIMEOUT) {
      localStorage.removeItem(RADAR_RUNNING_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

interface Opportunity {
  id: string
  dbId?: number
  title: string
  description: string
  impact: "High" | "Medium" | "Low"
  status: "queued" | "running" | "completed" | "failed"
  lastActivity: Date
  url?: string
  platform: "Reddit"
  postedAt?: Date
  engagement?: { upvotes?: number; comments?: number }
  promptOrigin?: "search" | "tracked"
  trackedPrompt?: string
  relevanceScore?: number
}

function ConversationRadarPageInner() {
  const { profile, selectedCountry, setProfile, refreshBrandProfile } = useBrandProfile()

  // State
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [stats, setStats] = useState<{ total: number; new: number } | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [viewFilter, setViewFilter] = useState<"active" | "all">("active")
  const [isMounted, setIsMounted] = useState(false)
  const [cronInfo, setCronInfo] = useState<{ lastRun: string | null; nextRun: string | null } | null>(null)
  const [cronFailed, setCronFailed] = useState(false)

  // Strict-language toggle: reflects BrandProfile.strictLanguageFilter and
  // PATCHes the brand profile when flipped. Only meaningful for Spanish
  // countries — for English countries we hide the control entirely.
  const selectedLanguage: 'en' | 'es' = isAllowedCountry(selectedCountry)
    ? COUNTRY_LANGUAGE_MAP[selectedCountry as CountryCode]
    : 'en'
  const showStrictLanguageToggle = selectedLanguage === 'es'
  const strictLanguageEnabled = Boolean((profile as any)?.strictLanguageFilter)
  const [isSavingStrictLanguage, setIsSavingStrictLanguage] = useState(false)

  const toggleStrictLanguage = async () => {
    if (!profile.id || isSavingStrictLanguage) return
    const next = !strictLanguageEnabled
    setIsSavingStrictLanguage(true)
    try {
      // setProfile persists to /api/brand-profile itself — don't POST twice.
      await setProfile({ ...(profile as any), strictLanguageFilter: next })
    } catch (err) {
      // setProfile optimistically flipped the toggle before the POST failed.
      // Resync from the server so the UI reflects the real persisted state
      // instead of the rejected value.
      console.error('Error toggling strictLanguageFilter:', err)
      try { await refreshBrandProfile() } catch { /* best-effort */ }
    } finally {
      setIsSavingStrictLanguage(false)
    }
  }

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Always tracks the latest country so async fetches can detect staleness.
  const currentCountryRef = useRef(selectedCountry)
  currentCountryRef.current = selectedCountry

  // Reset state when country/region changes so stale results from
  // the previous language don't remain visible while re-fetching.
  const prevCountryRef = useRef(selectedCountry)
  useEffect(() => {
    if (prevCountryRef.current !== selectedCountry) {
      prevCountryRef.current = selectedCountry
      setOpportunities([])
      setIsInitialLoad(true)
      setStats(null)
    }
  }, [selectedCountry])

  // Fetch cron schedule info (per-brand)
  const fetchCronInfo = useCallback(async () => {
    if (!profile.id) return
    try {
      const res = await fetch(`/api/conversation-radar/cron?brandProfileId=${profile.id}`)
      const data = await res.json()
      if (data.success) {
        setCronInfo({ lastRun: data.lastRun, nextRun: data.nextRun })
        setCronFailed(false)
      } else {
        setCronFailed(true)
      }
    } catch {
      setCronFailed(true)
    }
  }, [profile.id])

  useEffect(() => {
    fetchCronInfo()
  }, [fetchCronInfo])

  // Format relative time for timing indicator
  const formatNextRun = (isoDate: string | null): string => {
    if (!isoDate) return "Not scheduled"
    const date = new Date(isoDate)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    if (diffMs < 0) return "Soon"
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays > 0) return `in ${diffDays}d ${diffHours % 24}h`
    if (diffHours > 0) return `in ${diffHours}h`
    return "Soon"
  }

  // Calculate active opportunities count (not engaged/dismissed)
  const activeOpportunitiesCount = opportunities.filter((o) => {
    return (o.status === "queued" || o.status === "running") && (o.relevanceScore || 0) >= 70
  }).length

  // Show "Run Radar" when: cron failed, overdue, never run (nextRun null), or no opportunities yet
  const isCronOverdue = cronInfo?.nextRun ? new Date(cronInfo.nextRun).getTime() < Date.now() : false
  const neverRun = cronInfo !== null && cronInfo.nextRun === null
  const showManualRun = cronFailed || isCronOverdue || neverRun || (!isInitialLoad && opportunities.length === 0)

  // Cooldown: radar was recently run and next scheduled run is in the future
  const isInCooldown = cronInfo !== null && cronInfo.lastRun !== null && cronInfo.nextRun !== null && new Date(cronInfo.nextRun).getTime() > Date.now()

  // Low-relevance only: opportunities exist but none are active/high-relevance
  const hasLowRelevanceOpportunities = !isInitialLoad && !isLoading && opportunities.length > 0 && activeOpportunitiesCount === 0

  // Refresh opportunities data without touching loading state.
  // Captures selectedCountry at call-time and discards responses if
  // the country changed while the fetch was in flight.
  const refreshData = useCallback(async () => {
    if (!profile.id) return
    const requestCountry = selectedCountry
    try {
      const response = await fetch(`/api/conversation-radar/opportunities?brandProfileId=${profile.id}&status=all&limit=50&country=${selectedCountry}&minRelevanceScore=50`)
      const result = await response.json()

      // Discard stale response (country changed while fetch was in flight)
      if (currentCountryRef.current !== requestCountry) return

      if (result.success && result.data) {
        const mapped: Opportunity[] = result.data.map((opp: any) => ({
          id: opp.id,
          dbId: opp.dbId,
          title: opp.title,
          description: opp.description || 'Conversation opportunity',
          impact: opp.impact || 'Medium',
          status: opp.status,
          lastActivity: new Date(opp.lastActivity),
          url: opp.url,
          platform: 'Reddit' as const,
          postedAt: opp.postedAt ? new Date(opp.postedAt) : undefined,
          engagement: opp.engagement,
          promptOrigin: opp.promptOrigin as "search" | "tracked",
          trackedPrompt: opp.trackedPrompt,
          relevanceScore: opp.relevanceScore,
        }))
        setOpportunities(mapped)
      }

      // Fetch stats + last run time
      const statsResponse = await fetch(`/api/conversation-radar/run?brandProfileId=${profile.id}&country=${selectedCountry}`)
      const statsResult = await statsResponse.json()

      // Discard stale response
      if (currentCountryRef.current !== requestCountry) return

      if (statsResult.success && statsResult.data) {
        setStats({
          total: statsResult.data.counts.total,
          new: statsResult.data.counts.new,
        })
      }
    } catch (error) {
      console.error('Error fetching opportunities:', error)
    }
  }, [profile.id, selectedCountry])

  // Fetch opportunities (with loading state - used for initial load)
  const fetchOpportunities = useCallback(async () => {
    if (!profile.id) return
    setIsLoading(true)
    try {
      await refreshData()
    } finally {
      setIsLoading(false)
      setIsInitialLoad(false)
    }
  }, [profile.id, refreshData])

  // Fetch on mount + restore loading state if a radar run was in progress
  useEffect(() => {
    if (!profile.id) return

    const runState = getRadarRunState()
    const isRunInProgress = runState && runState.brandProfileId === profile.id && runState.country === selectedCountry

    if (isRunInProgress) {
      // A run is still active - show loading and poll for completion
      setIsLoading(true)
      setIsInitialLoad(false)
      refreshData() // Fetch current data immediately (without resetting loading)
      const pollInterval = setInterval(() => {
        const current = getRadarRunState()
        if (!current) {
          // Run completed (cleared by the original fetch) or timed out
          setIsLoading(false)
          clearInterval(pollInterval)
          refreshData()
          return
        }
        // Refresh data while waiting so user sees progress incrementally
        refreshData()
      }, 8_000)
      return () => clearInterval(pollInterval)
    } else {
      // No active run - normal initial load
      fetchOpportunities()
    }
  }, [profile.id, refreshData, fetchOpportunities])

  // Run radar search
  const runRadarSearch = async () => {
    if (isLoading || !profile.id) return

    setIsLoading(true)
    trackEvent.conversationScanStarted(profile.id, selectedCountry || 'default')
    localStorage.setItem(RADAR_RUNNING_KEY, JSON.stringify({
      startedAt: Date.now(),
      brandProfileId: profile.id,
      country: selectedCountry,
    }))
    try {
      console.log('🔄 Running Conversation Radar search...')
      const response = await fetch('/api/conversation-radar/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandProfileId: profile.id,
          country: selectedCountry,
          mode: 'proactive',
          analyze: true,
          analyzeLimit: 15,
        }),
      })
      const result = await response.json()
      console.log('📊 Radar run result:', result)
      trackEvent.conversationScanCompleted(profile.id, result?.opportunities?.length ?? 0)
      await refreshData()
      await fetchCronInfo() // Refresh "Next scan" after run stamps lastRadarRunAt
    } catch (error) {
      console.error('❌ Error running radar:', error)
    } finally {
      localStorage.removeItem(RADAR_RUNNING_KEY)
      setIsLoading(false)
    }
  }

  // Filter opportunities
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredOpportunities = (viewFilter === "active"
    ? opportunities.filter((o) => {
        return (o.status === "queued" || o.status === "running") && (o.relevanceScore || 0) >= 70
      })
    : opportunities
  ).filter((o) => {
    if (!normalizedQuery) return true
    return (
      o.title.toLowerCase().includes(normalizedQuery) ||
      o.description.toLowerCase().includes(normalizedQuery)
    )
  })

  // Calculated metrics
  const highRelevanceCount = opportunities.filter(o => (o.relevanceScore || 0) >= 80).length

  if (!isMounted) {
    return null
  }

  return (
    <SidebarProvider
      className="bg-dark-grey"
      style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
    >
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <Separator className="w-full border-border" />
        <div className="flex flex-1 flex-col bg-dark-grey">
          <div className="@container/main flex flex-1 flex-col bg-dark-grey">
            {/* Page Header */}
            <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">Conversation Radar</h1>
                  <p className="text-sm text-white/60">Find and engage with conversations about your brand</p>
                </div>
                
                {/* Right side - buttons + timing */}
                <div className="flex items-center gap-3">
                  {/* Timing indicator */}
                  {cronInfo && !cronFailed && (
                    <div className="hidden sm:flex items-center gap-1.5 text-xs text-white/40">
                      <Clock className="size-3" />
                      <span>Next scan {formatNextRun(cronInfo.nextRun)}</span>
                    </div>
                  )}
                  {showStrictLanguageToggle && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={toggleStrictLanguage}
                          disabled={isSavingStrictLanguage}
                          className={cn(
                            "h-9 px-3 rounded-full border-0 text-xs font-medium gap-1.5 flex items-center transition-colors disabled:opacity-50",
                            strictLanguageEnabled
                              ? "bg-white/15 text-white hover:bg-white/20"
                              : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
                          )}
                        >
                          {isSavingStrictLanguage ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Languages className="w-3.5 h-3.5" />
                          )}
                          <span>Español only {strictLanguageEnabled ? 'on' : 'off'}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={8} className="max-w-xs">
                        When on, the radar only searches Spanish-language subreddits (r/Colombia, r/argentina, r/programacion, etc.). Turn off to include English subs too.
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {showManualRun && (
                    <Button
                      size="sm"
                      onClick={runRadarSearch}
                      disabled={isLoading}
                      className="h-9 px-4 rounded-full bg-white text-[#0a0a0a] hover:bg-white/90 hover:text-[#0a0a0a] text-sm font-medium shadow-sm hover:shadow-md transition-all border-0 gap-2 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <Radio className="w-4 h-4" />
                          Run Radar
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => window.open("https://docs.trymudra.com/agentic-features/conversation-radar", "_blank", "noopener")}
                    className="h-9 px-4 rounded-full bg-white/5 text-white hover:bg-white/10 border-0 text-sm font-medium gap-2"
                  >
                    <BookOpen className="w-4 h-4" />
                    Documentation
                  </Button>
                </div>
              </div>
            </div>

            {/* Header Divider */}
            <div className="h-[0.5px] bg-white/[0.04]"></div>

            {/* Metrics Section - matching agents-lab style */}
            <div className="py-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 px-4 lg:px-6">
                {/* Active Opportunities */}
                <div className="bg-[#1b1b1b] rounded-2xl p-5 min-h-[140px] flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Radio className="size-4 text-white/50" />
                      <span className="text-sm text-white/50 font-medium">Active Opportunities</span>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="text-white/30 hover:text-white/50 transition-colors">
                          <Info className="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={8} className="max-w-xs">
                        Conversations you can engage with right now. Counts opportunities not yet engaged or dismissed.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                    {isLoading && isInitialLoad ? (
                      <div className="h-9 w-14 rounded bg-white/[0.06] animate-pulse" />
                    ) : (
                      <div className="flex items-end justify-between">
                        <span className="text-[28px] font-medium text-white tabular-nums">{activeOpportunitiesCount}</span>
                        <span className="text-sm font-medium text-white/40">—</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-auto pt-3 border-t border-white/[0.06]">
                    {isLoading && isInitialLoad ? (
                      <div className="h-4 w-28 rounded bg-white/[0.06] animate-pulse" />
                    ) : (
                      <span className="text-xs text-white/30">Awaiting engagement</span>
                    )}
                  </div>
                </div>

                {/* Total Discovered */}
                <div className="bg-[#1b1b1b] rounded-2xl p-5 min-h-[140px] flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="size-4 text-white/50" />
                      <span className="text-sm text-white/50 font-medium">Total Discovered</span>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="text-white/30 hover:text-white/50 transition-colors">
                          <Info className="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={8} className="max-w-xs">
                        Total conversation opportunities found by the radar.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                    {isLoading && isInitialLoad ? (
                      <div className="h-9 w-16 rounded bg-white/[0.06] animate-pulse" />
                    ) : (
                      <div className="flex items-end justify-between">
                        <span className="text-[28px] font-medium text-white tabular-nums">{opportunities.filter(o => (o.relevanceScore || 0) >= 70).length}</span>
                        <span className="text-sm font-medium text-white/40">—</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-auto pt-3 border-t border-white/[0.06]">
                    {isLoading && isInitialLoad ? (
                      <div className="h-4 w-28 rounded bg-white/[0.06] animate-pulse" />
                    ) : (
                      <span className="text-xs text-white/30">All time discoveries</span>
                    )}
                  </div>
                </div>

                {/* High Relevance */}
                <div className="bg-[#1b1b1b] rounded-2xl p-5 min-h-[140px] flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="size-4 text-white/50" />
                      <span className="text-sm text-white/50 font-medium">High Relevance</span>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="text-white/30 hover:text-white/50 transition-colors">
                          <Info className="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={8} className="max-w-xs">
                        Opportunities with 80%+ relevance score - highest priority.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                    {isLoading && isInitialLoad ? (
                      <div className="h-9 w-14 rounded bg-white/[0.06] animate-pulse" />
                    ) : (
                      <div className="flex items-end justify-between">
                        <span className="text-[28px] font-medium text-white tabular-nums">{highRelevanceCount}</span>
                        <span className="text-sm font-medium text-white/40">—</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-auto pt-3 border-t border-white/[0.06]">
                    {isLoading && isInitialLoad ? (
                      <div className="h-4 w-32 rounded bg-white/[0.06] animate-pulse" />
                    ) : (
                      <span className="text-xs text-white/30">80%+ relevance score</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-[0.5px] bg-white/[0.04]"></div>

            {/* Main Content */}
            <div className="flex-1 px-4 lg:px-6 py-6">
              <div className="max-w-4xl mx-auto">
              {/* Toolbar - tabs left, search right */}
              <div className="flex items-center justify-between mb-4 gap-4">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setViewFilter("active")}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium rounded-full transition-colors",
                      viewFilter === "active"
                        ? "text-white bg-white/10"
                        : "text-white/40 hover:text-white/60"
                    )}
                  >
                    Active
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setViewFilter("all")}
                      className={cn(
                        "px-3 py-1.5 text-sm font-medium rounded-full transition-colors",
                        viewFilter === "all"
                          ? "text-white bg-white/10"
                          : "text-white/40 hover:text-white/60"
                      )}
                    >
                      All
                    </button>
                    {hasLowRelevanceOpportunities && viewFilter !== "all" && (
                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    )}
                  </div>
                </div>

                <div className="relative w-full max-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-white/30" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search opportunities"
                    className="h-8 rounded-2xl !bg-[#1b1b1b] border-[1.5px] border-transparent text-xs text-white/80 placeholder:text-white/30 pl-8 pr-3 focus-visible:ring-0 focus-visible:border-blue-500 focus-visible:!bg-[#1b1b1b]"
                  />
                </div>
              </div>

              {/* Opportunities Table */}
              {isInitialLoad ? (
                <div className="rounded-2xl bg-[#1b1b1b] overflow-hidden">
                  {/* Table header skeleton */}
                  <div className="px-5 py-3 border-b border-white/[0.06]">
                    <div className="h-3 w-20 rounded bg-white/[0.04]" />
                  </div>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="px-5 py-3.5 flex items-center gap-4 border-b border-white/[0.04] last:border-b-0">
                      <div className="flex-1 space-y-1">
                        <div className="h-3.5 w-2/3 rounded bg-white/[0.06] animate-pulse" />
                      </div>
                      <div className="h-3 w-16 rounded bg-white/[0.06] animate-pulse" />
                      <div className="h-3 w-10 rounded bg-white/[0.06] animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : filteredOpportunities.length === 0 ? (
                <div className="rounded-2xl bg-[#1b1b1b] overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_120px_100px] gap-4 px-5 py-3 border-b border-white/[0.06]">
                    <span className="text-xs font-medium text-white/30">Name</span>
                    <span className="text-xs font-medium text-white/30 text-right">Relevance</span>
                    <span className="text-xs font-medium text-white/30 text-right">Engagement</span>
                  </div>
                  {/* Empty state */}
                  <div className="flex flex-col items-center justify-center py-16 px-6">
                    <div className="size-10 rounded-lg bg-white/[0.04] flex items-center justify-center mb-4">
                      <Radio className="size-5 text-white/20" />
                    </div>
                    <h3 className="text-sm font-medium text-white/70 mb-1">
                      {viewFilter === "active" && hasLowRelevanceOpportunities
                        ? "No high-relevance opportunities"
                        : viewFilter === "active"
                        ? "No active opportunities"
                        : "No opportunities found"}
                    </h3>
                    <p className="text-xs text-white/30 mb-5 text-center max-w-xs">
                      {viewFilter === "active" && hasLowRelevanceOpportunities
                        ? "The radar found some conversations, but none were highly relevant. Check the All tab to see them."
                        : viewFilter === "active"
                        ? "Run the radar to discover conversations about your brand"
                        : "No conversations have been discovered yet"}
                    </p>
                    {!isInCooldown && !hasLowRelevanceOpportunities && (
                      <Button
                        onClick={runRadarSearch}
                        disabled={isLoading}
                        size="sm"
                        className="h-8 px-4 rounded-full bg-white text-[#0a0a0a] hover:bg-white/90 hover:text-[#0a0a0a] text-xs font-medium gap-2 transition-all border-0 disabled:opacity-50"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" />
                            Searching...
                          </>
                        ) : (
                          <>
                            <Radio className="size-3.5" />
                            Run Radar
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-[#1b1b1b] overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_120px_100px] gap-4 px-5 py-3 border-b border-white/[0.06]">
                    <span className="text-xs font-medium text-white/30">Name</span>
                    <span className="text-xs font-medium text-white/30 text-right">Relevance</span>
                    <span className="text-xs font-medium text-white/30 text-right">Engagement</span>
                  </div>
                  {/* Table rows */}
                  <div className="px-2 py-1">
                  {filteredOpportunities.map((opportunity) => (
                    <Link
                      key={opportunity.id}
                      href={`/dashboard/conversation-radar/${opportunity.dbId || opportunity.id}`}
                      className="block"
                    >
                      <div className="grid grid-cols-[1fr_120px_100px] gap-4 px-3 py-3.5 items-center transition-colors hover:bg-white/[0.06] rounded-2xl group">
                        {/* Name cell */}
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate transition-colors">
                            {opportunity.title}
                          </p>
                        </div>

                        {/* Relevance cell */}
                        <div className="flex justify-end">
                          {typeof opportunity.relevanceScore === 'number' ? (
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.05]",
                            )}>
                              <span className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                opportunity.relevanceScore >= 80
                                  ? "bg-emerald-400"
                                  : opportunity.relevanceScore >= 70
                                    ? "bg-amber-400"
                                    : "bg-white/40"
                              )} />
                              <span className={cn(
                                "text-[11px] font-medium tabular-nums",
                                opportunity.relevanceScore >= 80
                                  ? "text-emerald-400"
                                  : opportunity.relevanceScore >= 70
                                    ? "text-amber-400"
                                    : "text-white/40"
                              )}>
                                {opportunity.relevanceScore}%
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs text-white/20">—</span>
                          )}
                        </div>

                        {/* Engagement cell */}
                        <div className="flex items-center justify-end gap-3 text-xs text-white">
                          {opportunity.engagement?.upvotes !== undefined && (
                            <span className="flex items-center gap-1">
                              <TrendingUp className="size-3" />
                              {opportunity.engagement.upvotes}
                            </span>
                          )}
                          {opportunity.engagement?.comments !== undefined && (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="size-3" />
                              {opportunity.engagement.comments}
                            </span>
                          )}
                          {opportunity.engagement?.upvotes === undefined && opportunity.engagement?.comments === undefined && (
                            <span className="text-white/20">—</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function ConversationRadarPage() {
  return (
    <BrandProfileProvider>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
        <ConversationRadarPageInner />
      </Suspense>
    </BrandProfileProvider>
  )
}
