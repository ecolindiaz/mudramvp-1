
"use client"
import React, { useState } from "react"
import { BrandProfileProvider } from "@/components/brand-profile-context"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { FloatingMudraButton } from "@/components/floating-mudra-button"
import { OverviewMetrics } from "@/components/dashboard/overview-metrics"
import { NaturalLanguageReport } from "@/components/dashboard/natural-language-report"
import { Button } from "@/components/ui/button"
import { CountdownBadge } from "@/components/dashboard/countdown-badge"
import { useDirectGEOAnalysis } from "@/hooks/use-direct-geo-analysis"
import { useBrandProfile } from "@/components/brand-profile-context"
import { Loader2, Target } from "lucide-react"
import { isDevelopmentClient, shouldEnforceAnalysisRestrictions } from "@/lib/utils/dev-mode"
import type { TimeRange } from "@/components/dashboard/time-range-selector"
import type { AIModel } from "@/components/dashboard/model-selector"

export default function Page() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d")
  const [selectedModel, setSelectedModel] = useState<AIModel>("chatgpt")

  return (
    <BrandProfileProvider>
      <DashboardContent timeRange={timeRange} setTimeRange={setTimeRange} selectedModel={selectedModel} setSelectedModel={setSelectedModel} />
    </BrandProfileProvider>
  )
}

function DashboardContent({ 
  timeRange, 
  setTimeRange, 
  selectedModel, 
  setSelectedModel 
}: {
  timeRange: TimeRange
  setTimeRange: (range: TimeRange) => void
  selectedModel: AIModel
  setSelectedModel: (model: AIModel) => void
}) {
  const { profile } = useBrandProfile()
  const { state, runAnalysis, loadLatestAnalysis } = useDirectGEOAnalysis()
  const [isDev, setIsDev] = useState(false)

  // Load existing analysis on mount and check dev mode
  React.useEffect(() => {
    setIsDev(isDevelopmentClient())
    if (profile?.companyName) {
      loadLatestAnalysis(profile.companyName)
    }
  }, [profile?.companyName, loadLatestAnalysis])

  const handleRunAnalysis = async () => {
    if (!profile?.companyName) {
      console.error("No brand profile available for analysis")
      return
    }

    await runAnalysis({
      brandName: profile.companyName,
      website: profile.companyWebsite || undefined,
      industry: profile.companyIndustry || undefined,
      description: profile.companyDescription || undefined,
      competitors: profile.competitors || [],
    })
  }

  // In development mode, always allow analysis
  // In production, add timer restrictions if needed
  const isAnalysisDisabled = state.isRunning || !profile?.companyName || 
    (shouldEnforceAnalysisRestrictions() && false) // Add timer logic here for production

  return (
    <SidebarProvider
      className="bg-dark-grey text-foreground"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 52)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset className="bg-dark-grey text-foreground m-0 shadow-none rounded-none border-none">
        <SiteHeader />
        <Separator className="w-full border-border" />
        <div className="flex flex-1 flex-col pb-8 md:pb-10">
          <div className="@container/main flex flex-1 flex-col gap-3 md:gap-4">
            {/* Page Header */}
            <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
                  <p className="text-muted-foreground">
                    Your brands performance across AI Search Engines
                    {isDev && (
                      <span className="ml-2 text-green-400 text-sm">
                        • Development Mode
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <CountdownBadge />
                  <Button
                    variant="dashed"
                    className="h-9 rounded-lg bg-white text-black hover:bg-white/90 border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleRunAnalysis}
                    disabled={isAnalysisDisabled}
                    title={isDev ? "Development mode - unlimited analysis" : undefined}
                  >
                    {state.isRunning ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {state.stage}
                      </>
                    ) : (
                      <>
                        <Target className="w-4 h-4 mr-2" />
                        Run Analysis {isDev && "(DEV)"}
                      </>
                    )}
                  </Button>
                </div>
              </div>
              
              {/* Analysis Progress Bar (shown when analysis is running) */}
              {state.isRunning && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/70">{state.stage}</span>
                    <span className="text-white/70">{state.progress}%</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2">
                    <div 
                      className="bg-white h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${state.progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Analysis Results (shown when analysis is complete) */}
              {state.results && (
                <div className="mt-4 p-4 bg-white/10 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-white">Latest Analysis Complete</h3>
                      <p className="text-white/70 text-sm">
                        AI Visibility Score: <span className="font-bold text-white">{state.results.overallScore}/100</span>
                      </p>
                    </div>
                    <div className="text-right text-sm text-white/60">
                      {state.results.analyses.length} providers tested
                    </div>
                  </div>
                </div>
              )}

              {/* Error State */}
              {state.error && (
                <div className="mt-4 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <p className="text-red-300 text-sm">{state.error}</p>
                </div>
              )}

              {/* Elegant Separator with White Dot (mirrors Insights) */}
              <div className="mt-4">
                <div className="relative">
                  <div className="h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                  <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-5 md:gap-6 pb-6 md:pb-8">
              {/* Overview Metrics */}
              <OverviewMetrics 
                timeRange={timeRange}
                selectedModel={selectedModel}
              />

              {/* Natural Language Report below the 3 main cards */}
              <div className="px-4 lg:px-6 mt-1 md:mt-2">
                <NaturalLanguageReport 
                  timeRange={timeRange}
                  selectedModel={selectedModel}
                />
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
      
      <FloatingMudraButton />
    </SidebarProvider>
  )
}
