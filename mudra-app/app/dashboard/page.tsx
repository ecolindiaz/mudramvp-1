"use client"
import React from "react"
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
import { GenerateReportButton } from "@/components/dashboard/generate-report-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CountdownBadge } from "@/components/dashboard/countdown-badge"
import { useDirectGEOAnalysis } from "@/hooks/use-direct-geo-analysis"
import { useAnalysisResults } from "@/hooks/use-analysis-results"
import { useBrandProfile } from "@/components/brand-profile-context"
import { Loader2 } from "lucide-react"
import { GeoMetricsCard, TrafficMetricsCard, TechStructureCard, ReportCard } from "@/components/analysis-results"

// Add isDev definition
const isDev = process.env.NODE_ENV === "development";
import type { TimeRange } from "@/components/dashboard/time-range-selector"
import type { AIModel } from "@/components/dashboard/model-selector"

function DashboardPageInner() {
  const timeRange: TimeRange = "7d"
  const selectedModel: AIModel = "chatgpt"
  const [websiteUrl, setWebsiteUrl] = React.useState("")
  const [isAnalyzing, setIsAnalyzing] = React.useState(false)
  const [profileLoading, setProfileLoading] = React.useState(true)
  const { profile } = useBrandProfile()
  const { state: geoState, runAnalysis, reset } = useDirectGEOAnalysis()
  const analysisResults = useAnalysisResults(profile.id || null)

  React.useEffect(() => {
    if (!websiteUrl && profile.companyWebsite) {
      setWebsiteUrl(profile.companyWebsite)
    }
  }, [profile.companyWebsite, websiteUrl])

  // Track when profile is loaded
  React.useEffect(() => {
    // Profile is loaded if it has an ID > 0 or if it has company data
    if (profile.id > 0 || profile.companyName) {
      setProfileLoading(false)
      console.log('✅ Brand profile loaded:', { id: profile.id, name: profile.companyName })
    } else {
      // Give it 2 seconds to load, then assume no profile exists
      const timeout = setTimeout(() => {
        setProfileLoading(false)
        console.warn('⚠️ No brand profile found after 2 seconds')
      }, 2000)
      return () => clearTimeout(timeout)
    }
  }, [profile.id, profile.companyName])

  // Listen for analysis completion events to refresh results
  React.useEffect(() => {
    const handleAnalysisComplete = () => {
      console.log('[Dashboard] Analysis complete event received, refreshing results...')
      analysisResults.refresh()
    }

    window.addEventListener('mudra:website-analyzed', handleAnalysisComplete)
    
    return () => {
      window.removeEventListener('mudra:website-analyzed', handleAnalysisComplete)
    }
  }, [analysisResults])

  const hasWebsiteSource = Boolean(websiteUrl.trim() || profile.companyWebsite?.trim())

  const handleAnalyzeWebsite = async () => {
    const trimmedInput = websiteUrl.trim()
    const profileWebsite = profile.companyWebsite?.trim() ?? ""
    const websiteToAnalyze = trimmedInput || profileWebsite

    if (!websiteToAnalyze) {
      alert("Please provide a website URL either in the input field or in your Brand Profile before running the analysis.")
      return
    }
    const normalizedUrl = websiteToAnalyze
      .replace(/^https?:\/\//i, "")
      .replace(/\/$/, "")
    const finalUrl = normalizedUrl.startsWith("http") ? normalizedUrl : `https://${normalizedUrl}`

    if (websiteUrl !== websiteToAnalyze) {
      setWebsiteUrl(websiteToAnalyze)
    }

    const brandName = profile.companyName?.trim()
    if (!brandName) {
      alert('Missing company name in brand profile. Please update your Brand Profile before running analysis.')
      return
    }

    if (!profile.id || profile.id === 0) {
      console.error('❌ Missing brand profile ID:', profile)
      alert('Brand profile not loaded. Please refresh the page and try again.')
      return
    }

    try {
      setIsAnalyzing(true)
      reset()

      console.log(`🚀 Starting unified analysis for: ${finalUrl}`)
      console.log(`📋 Brand Profile ID: ${profile.id}, Name: ${brandName}`)

      const sanitizedCompetitors = Array.isArray(profile.competitors)
        ? profile.competitors
            .map((comp) => (typeof comp === 'string' ? comp.trim() : ''))
            .filter(Boolean)
        : []

      // Call unified analysis API
      const response = await fetch('/api/analysis/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandProfileId: profile.id,
          brandName,
          website: finalUrl,
          industry: profile.companyIndustry?.trim() || undefined,
          description: profile.companyDescription?.trim() || undefined,
          competitors: sanitizedCompetitors,
          skipCooldown: true, // Dashboard can re-run without cooldown
          generateReport: false, // Don't generate report for dashboard (only onboarding)
        }),
      })

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.status}`)
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Analysis failed')
      }

      console.log('✅ Unified analysis completed:', result.data.scores)

      // Refresh analysis results to show new data
      analysisResults.refresh()

      // Trigger UI refresh event
      window.dispatchEvent(new CustomEvent('mudra:website-analyzed', {
        detail: { 
          url: finalUrl, 
          scores: result.data.scores 
        }
      }))

    } catch (error) {
      console.error('❌ Website analysis failed:', error)
      alert(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <SidebarProvider
      className="bg-dark-grey text-foreground"
      style={
        {
          "--sidebar-width": "16rem",
          "--header-height": "3rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset className="bg-dark-grey text-foreground m-0 shadow-none rounded-none border-none overflow-x-hidden max-w-full">
        <SiteHeader />
        <Separator className="w-full border-border" />
        <div className="flex flex-1 flex-col pb-8 md:pb-10 overflow-x-hidden max-w-full">
          <div className="@container/main flex flex-1 flex-col gap-3 md:gap-4 overflow-x-hidden max-w-full">
            {/* Page Header */}
            <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6 max-w-full overflow-x-hidden">
              <div className="flex items-center justify-between flex-wrap gap-4 max-w-full">
                <div className="min-w-0">
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
                <div className="flex items-center gap-3 flex-shrink-0">
                  <CountdownBadge />
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap min-w-0">
                    <Input
                      placeholder="Enter website URL (e.g., paradigmai.com)"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      className="w-full sm:w-64 h-9 bg-white text-white placeholder:text-gray-500 min-w-0"
                      disabled={isAnalyzing}
                    />
                    <Button
                      variant="dashed"
                      className="h-9 rounded-lg bg-white text-black hover:bg-white/90 border-transparent whitespace-nowrap flex-shrink-0"
                      onClick={handleAnalyzeWebsite}
                      disabled={profileLoading || isAnalyzing || geoState.isRunning || !hasWebsiteSource || !profile.id || profile.id === 0}
                    >
                      {profileLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Loading Profile...
                        </>
                      ) : isAnalyzing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          {geoState.isRunning ? "Running GEO..." : "Analyzing..."}
                        </>
                      ) : !profile.id || profile.id === 0 ? (
                        "Setup Profile First"
                      ) : (
                        "Analyze Website"
                      )}
                    </Button>
                    <GenerateReportButton />
                  </div>
                </div>
              </div>
              
              {/* Analysis Progress Bar (shown when analysis is running) */}
              {geoState.isRunning && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/70">{geoState.stage}</span>
                    <span className="text-white/70">{geoState.progress}%</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2">
                    <div 
                      className="bg-white h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${geoState.progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Error State */}
              {geoState.error && (
                <div className="mt-4 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <p className="text-red-300 text-sm">{geoState.error}</p>
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
            
            <div className="flex flex-col gap-5 md:gap-6 pb-6 md:pb-8 max-w-full overflow-x-hidden">
              {/* Analysis Results Grid */}
              {(analysisResults.geoAnalysis || analysisResults.trafficMetrics || analysisResults.technicalAnalysis || analysisResults.report) && (
                <div className="px-4 lg:px-6 max-w-full overflow-x-hidden">
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold text-white">Comprehensive Analysis</h2>
                    <p className="text-white/60 text-sm mt-1">Latest analysis results for your brand</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 max-w-full">
                    {analysisResults.geoAnalysis && (
                      <GeoMetricsCard data={analysisResults.geoAnalysis} />
                    )}
                    {analysisResults.trafficMetrics && (
                      <TrafficMetricsCard data={analysisResults.trafficMetrics} />
                    )}
                    {analysisResults.technicalAnalysis && (
                      <TechStructureCard data={analysisResults.technicalAnalysis} />
                    )}
                  </div>
                  
                  {analysisResults.report && (
                    <ReportCard data={analysisResults.report} />
                  )}
                </div>
              )}

              {/* Loading State */}
              {analysisResults.loading && (
                <div className="px-4 lg:px-6">
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-white/60" />
                    <span className="ml-2 text-white/60">Loading analysis results...</span>
                  </div>
                </div>
              )}

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
      
      <FloatingMudraButton siteId={typeof window !== 'undefined' ? (localStorage.getItem('mudra:siteId') || '') : ''} />
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
