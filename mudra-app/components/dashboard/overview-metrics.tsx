"use client"

import { DashboardStatCard } from "./dashboard-stat-card"
import { mockOverviewMetrics, mockDashboardMetrics } from "@/lib/mock/data"
import type { TimeRange } from "./time-range-selector"
import type { AIModel } from "./model-selector"
import { useState, useEffect } from "react"
import { useBrandProfile } from "@/components/brand-profile-context"
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Info, Link, Copy, Check, ExternalLink, X, ArrowUp, Settings } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

interface OverviewMetricsProps {
  showAll?: boolean
  timeRange: TimeRange
  selectedModel: AIModel
}

export function OverviewMetrics({ showAll = false, timeRange, selectedModel }: OverviewMetricsProps) {
  const { 
    humansReferredFromLLMs, 
    weeklyTasksCompleted,
    thisWeekGoals,
    aiVisibilityRank,
    contentQualityScore 
  } = mockOverviewMetrics

  // Suppress unused variable warnings for future use
  void timeRange
  void selectedModel

  const { profile } = useBrandProfile()
  
  // AI Referral Tracking modal state
  const [showTrackingModal, setShowTrackingModal] = useState(false)
  const [scriptCopied, setScriptCopied] = useState(false)
  const [isTrackingConnected, setIsTrackingConnected] = useState(false) // Default to false (not connected)
  const [isConnecting, setIsConnecting] = useState(false) // Loading state
  
  // Generate tracking script with user's site ID (will use actual siteId from backend)
  const siteId = typeof window !== 'undefined' ? (localStorage.getItem('mudra:siteId') || 'your-site-id') : 'your-site-id'
  const trackingScript = `<!-- Mudra AI Referral Tracking -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = 'https://cdn.mudra.ai/tracker.js';
    script.async = true;
    script.setAttribute('data-site-id', '${siteId}');
    document.head.appendChild(script);
  })();
</script>`

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(trackingScript)
      setScriptCopied(true)
      setTimeout(() => setScriptCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy script:', error)
    }
  }

  const handleConnect = () => {
    setShowTrackingModal(true)
  }

  const handleVerifyScript = async () => {
    setShowTrackingModal(false)
    setIsConnecting(true)
    
    // Simulate checking for traffic (will be replaced with backend API call)
    // TODO: Replace with actual backend API call to check for tracking script installation
    // Backend should return: { connected: boolean, traffic: number, lastUpdated: timestamp }
    setTimeout(() => {
      setIsConnecting(false)
      setIsTrackingConnected(true)
      setLastUpdated(new Date()) // Update timestamp when data is refreshed
    }, 3000) // Simulate 3 second loading/verification
  }

  // State for dynamic technical score
  const [technicalScore, setTechnicalScore] = useState(0)
  const [previousScore, setPreviousScore] = useState<number | null>(null)
  const [hasHistoricalData, setHasHistoricalData] = useState(false)
  const [isGeneratingScore, setIsGeneratingScore] = useState(false)

  // State for AI Visibility score
  const [aiVisibilityScore, setAiVisibilityScore] = useState(0)
  const [aiVisibilityPrevious, setAiVisibilityPrevious] = useState<number | null>(null)
  const [hasAiHistory, setHasAiHistory] = useState(false)
  
  // Additional Firegeo aggregate metrics
  const [mentionRate, setMentionRate] = useState(0) // Percentage
  const [averagePosition, setAveragePosition] = useState(0) // Average ranking
  const [totalTests, setTotalTests] = useState(0)

  // State for Organic Traffic
  const [organicTraffic, setOrganicTraffic] = useState(0)
  const [organicTrafficPrevious, setOrganicTrafficPrevious] = useState<number | null>(null)
  const [hasTrafficHistory, setHasTrafficHistory] = useState(false)

  // State for AI Referral Traffic
  // TODO: Backend integration - fetch from API endpoint: GET /api/analytics/ai-referral
  // Response shape: { traffic: number, previous: number, lastUpdated: string, connected: boolean }
  const [aiReferralTraffic, setAiReferralTraffic] = useState(247) // Mock data
  const [aiReferralPrevious, setAiReferralPrevious] = useState(189) // Mock previous
  const hasAiTrafficHistory = true
  
  // Last updated timestamp for all metrics (will be fetched from backend)
  // TODO: Backend should return lastUpdated timestamp for each metric
  const [lastUpdated, setLastUpdated] = useState(new Date()) // Track when data was last refreshed

  // Fetch latest score and historical data from database
  const fetchLatestScore = async () => {
    try {
      const siteId = typeof window !== 'undefined' ? (localStorage.getItem('mudra:siteId') || '') : ''
      const response = await fetch(`/api/scores/history?siteId=${encodeURIComponent(siteId)}&limit=5`)
      const result = await response.json()
      
      if (result.success && result.data.latest) {
        const currentScore = result.data.latest.total
        setTechnicalScore(currentScore)
        
        // Check if we have historical data to compare
        if (result.data.hasHistoricalData && result.data.previous) {
          setHasHistoricalData(true)
          setPreviousScore(result.data.previous.total)
        } else {
          setHasHistoricalData(false)
          setPreviousScore(null)
        }
      }
    } catch (error) {
      console.error('Error fetching latest score:', error)
    }
  }

  // Fetch AI Visibility score with historical comparison
  // Now uses Firegeo aggregate methodology from prompts/with-results API
  const fetchAiVisibilityHistory = async () => {
    if (!profile.id) return

    try {
      // Fetch current aggregate score (Firegeo methodology)
      const currentResponse = await fetch(`/api/prompts/with-results?brandProfileId=${profile.id}`)
      const currentResult = await currentResponse.json()
      
      if (currentResult.success && currentResult.aggregate) {
        setAiVisibilityScore(Math.round(currentResult.aggregate.overallScore))
        setMentionRate(currentResult.aggregate.mentionRate)
        setAveragePosition(currentResult.aggregate.averagePosition)
        setTotalTests(currentResult.aggregate.totalTests || 0)
        console.log('📊 AI Visibility score updated (Firegeo):', currentResult.aggregate.overallScore, {
          mentionRate: currentResult.aggregate.mentionRate,
          avgPosition: currentResult.aggregate.averagePosition,
          tests: currentResult.aggregate.totalTests
        })
      }

      // Fetch historical data for comparison
      const historyResponse = await fetch(`/api/analysis/geo-history?brandProfileId=${profile.id}&limit=2`)
      const historyResult = await historyResponse.json()
      
      if (historyResult.success && historyResult.data && historyResult.data.length > 1) {
        // Use previous run's score for comparison
        const previous = historyResult.data[1]
        setAiVisibilityPrevious(previous.overallScore || 0)
        setHasAiHistory(true)
        console.log('📊 AI Visibility previous score:', previous.overallScore)
      } else {
        setHasAiHistory(false)
        setAiVisibilityPrevious(null)
      }
    } catch (error) {
      console.error('Error fetching AI visibility history:', error)
    }
  }

  // Fetch Technical Structure score with historical comparison
  const fetchTechnicalHistory = async () => {
    if (!profile.id) return

    try {
      const response = await fetch(`/api/analysis/technical-history?brandProfileId=${profile.id}&limit=2`)
      const result = await response.json()
      
      if (result.success && result.data && result.data.length > 0) {
        // Most recent score
        const current = result.data[0]
        setTechnicalScore(current.overallScore || 0)
        console.log('📊 Technical score updated:', current.overallScore)
        
        // Previous score for comparison
        if (result.data.length > 1) {
          const previous = result.data[1]
          setPreviousScore(previous.overallScore || 0)
          setHasHistoricalData(true)
          console.log('📊 Technical previous score:', previous.overallScore)
        } else {
          setHasHistoricalData(false)
          setPreviousScore(null)
        }
      }
    } catch (error) {
      console.error('Error fetching technical history:', error)
    }
  }

  // Fetch Organic Traffic data from analysis results
  const fetchTrafficMetrics = async () => {
    if (!profile.id) return

    try {
      const response = await fetch(`/api/analysis/results?brandProfileId=${profile.id}`)
      const result = await response.json()
      
      if (result.success && result.trafficMetrics) {
        setOrganicTraffic(result.trafficMetrics.monthlyVisitors || 0)
        // Calculate previous period value if available
        if (result.trafficMetrics.monthOverMonthGrowth !== undefined) {
          const growth = result.trafficMetrics.monthOverMonthGrowth / 100
          const previous = Math.round(result.trafficMetrics.monthlyVisitors / (1 + growth))
          setOrganicTrafficPrevious(previous)
          setHasTrafficHistory(true)
        } else {
          setHasTrafficHistory(false)
          setOrganicTrafficPrevious(null)
        }
      }
    } catch (error) {
      console.error('Error fetching traffic metrics:', error)
    }
  }

  // Initial data fetch
  useEffect(() => {
    if (profile.id) {
      fetchAiVisibilityHistory()
      fetchTechnicalHistory()
      fetchTrafficMetrics()
    }
  }, [profile.id])

  // Listen for website analysis completion
  useEffect(() => {
    const handleWebsiteAnalyzed = async () => {
      console.log('🔄 Website analyzed, refreshing all metrics')
      // Refresh all metrics from database
      await Promise.all([
        fetchAiVisibilityHistory(),
        fetchTechnicalHistory(),
        fetchTrafficMetrics()
      ])
    }

    window.addEventListener('mudra:website-analyzed', handleWebsiteAnalyzed)
    return () => window.removeEventListener('mudra:website-analyzed', handleWebsiteAnalyzed)
  }, [profile.id])

  // Calculate deltas for display
  const aiVisibilityDelta = hasAiHistory && aiVisibilityPrevious !== null && aiVisibilityPrevious > 0
    ? Math.round(((aiVisibilityScore - aiVisibilityPrevious) / aiVisibilityPrevious) * 100)
    : 0

  const organicTrafficDelta = hasTrafficHistory && organicTrafficPrevious !== null && organicTrafficPrevious > 0
    ? Math.round(((organicTraffic - organicTrafficPrevious) / organicTrafficPrevious) * 100)
    : 0

  const aiReferralDelta = hasAiTrafficHistory && aiReferralPrevious !== null && aiReferralPrevious > 0
    ? Math.round(((aiReferralTraffic - aiReferralPrevious) / aiReferralPrevious) * 100)
    : 0

  return (
    <div className="grid grid-cols-1 gap-4 md:gap-5 px-4 lg:px-6 @xl/main:grid-cols-2 @3xl/main:grid-cols-4">
      <DashboardStatCard
        title="AI Visibility Score"
        value={aiVisibilityScore}
        suffix="%"
        delta={aiVisibilityDelta}
        lastValue={hasAiHistory && aiVisibilityPrevious !== null ? aiVisibilityPrevious : 0}
        positive={aiVisibilityScore > (aiVisibilityPrevious || 0)}
        sparkline={aiVisibilityScore > 0 ? [0, Math.max(10, aiVisibilityScore * 0.5), Math.max(20, aiVisibilityScore * 0.7), aiVisibilityScore] : [0]}
        accentColor="rgba(255,255,255,0.9)"
        info="Overall brand visibility combining mention rate (50%) and average ranking (50%) across all AI providers. Firegeo methodology."
        showLastPeriod={true}
      />

      <DashboardStatCard
        title="Average Position"
        value={averagePosition > 0 ? Math.round(averagePosition * 10) / 10 : 0}
        suffix=""
        delta={0}
        lastValue={0}
        positive={true}
        sparkline={averagePosition > 0 ? [10, Math.min(8, averagePosition * 1.2), averagePosition, Math.max(1, averagePosition * 0.8)] : [0]}
        accentColor="rgba(167, 139, 250, 0.9)"
        info={averagePosition > 0 ? `Average ranking position across all mentions. Position #1 is best. Lower numbers indicate better visibility.` : "No position data available yet."}
        showLastPeriod={true}
      />

      <DashboardStatCard
        title="Technical Structure Score"
        value={isGeneratingScore ? 0 : technicalScore}
        suffix="%"
        delta={hasHistoricalData && previousScore !== null ? Math.round(((technicalScore - previousScore) / previousScore) * 100) : 0}
        lastValue={hasHistoricalData && previousScore !== null ? previousScore : 0}
        positive={hasHistoricalData && previousScore !== null ? technicalScore > previousScore : true}
        sparkline={hasHistoricalData ? undefined : technicalScore > 0 ? [0, Math.max(10, technicalScore * 0.6), Math.max(20, technicalScore * 0.8), technicalScore] : [0]}
        accentColor="rgba(255,255,255,0.9)"
        info={isGeneratingScore ? "Calculating score..." : "How well your site is optimized for AI and SEO."}
        showLastPeriod={true}
      />

      {/* AI Referral Traffic Card */}
      {isTrackingConnected ? (
        <Card className="group relative overflow-hidden bg-transparent backdrop-blur-sm rounded-lg border border-white/[0.08] gap-3">
          <CardHeader className="border-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-muted-foreground text-sm font-medium">AI Referral Traffic</CardTitle>
              </div>
              <CardAction>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="-me-1.5" aria-label="About this metric">
                      <Info className="size-4 text-white/70" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={8} className="max-w-xs text-white/90">
                    Traffic referred from AI Models
                  </TooltipContent>
                </Tooltip>
              </CardAction>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex items-center justify-between gap-2.5">
              <span className="text-2xl font-medium text-foreground tracking-tight">
                {aiReferralTraffic.toLocaleString()}
              </span>
              <Badge
                variant="success"
                className="appearance-light bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
              >
                <ArrowUp className="size-3" />
                {aiReferralDelta}%
              </Badge>
            </div>
            <div className="overflow-hidden transition-all duration-300 ease-out max-h-0 group-hover:max-h-12">
              <div className="h-10 w-full opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                <svg viewBox="0 0 100 20" className="w-full h-full text-emerald-400/70">
                  <defs>
                    <linearGradient id="aiTrafficGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="currentColor" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0.8"
                    points="0,15 14.3,13 28.6,11 42.9,9 57.1,10 71.4,7 85.7,5 100,3"
                  />
                  <polygon
                    fill="url(#aiTrafficGradient)"
                    points="0,15 14.3,13 28.6,11 42.9,9 57.1,10 71.4,7 85.7,5 100,3 100,20 0,20"
                  />
                </svg>
              </div>
            </div>
            <div className="mt-2 border-t border-white/10 pt-2.5 flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                Last Updated:{" "}
                <span className="font-medium text-foreground">
                  {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-white/70 hover:text-white"
                onClick={() => setShowTrackingModal(true)}
              >
                Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : isConnecting ? (
        <Card className="group relative overflow-hidden bg-transparent backdrop-blur-sm rounded-lg border border-white/[0.08] gap-3">
          <CardHeader className="border-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-muted-foreground text-sm font-medium">AI Referral Traffic</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="relative size-8">
                  <div className="absolute inset-0 rounded-full border-2 border-white/10"></div>
                  <div className="absolute inset-0 rounded-full border-2 border-t-emerald-500 border-r-emerald-500/50 border-b-transparent border-l-transparent animate-spin"></div>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-base font-medium text-white/90">Connecting...</span>
                  <span className="text-xs text-white/60">Detecting traffic</span>
                </div>
              </div>
            </div>
            <div className="mt-2 border-t border-white/10 pt-2.5">
              <div className="text-xs text-muted-foreground">
                Verifying script installation...
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="group relative overflow-hidden bg-transparent backdrop-blur-sm rounded-lg border border-white/[0.08] gap-3 hover:border-white/[0.12] transition-colors">
          <CardHeader className="border-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-muted-foreground text-sm font-medium">AI Referral Traffic</CardTitle>
              </div>
              <CardAction>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="-me-1.5 hover:bg-white/5" aria-label="About this metric">
                      <Info className="size-4 text-white/70 group-hover:text-white/90 transition-colors" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={8} className="max-w-xs text-white/90">
                    Track traffic referred from AI agents and chatbots
                  </TooltipContent>
                </Tooltip>
              </CardAction>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center size-8 rounded-md border border-white/10 bg-white/5 group-hover:border-white/20 transition-colors">
                  <Link className="size-4 text-white/80" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-base font-medium text-foreground">Not Connected</span>
                </div>
              </div>
              <Button 
                size="sm" 
                onClick={handleConnect}
                className="h-8 px-3 rounded-md bg-white text-black hover:bg-white/90 text-xs font-medium shadow-sm hover:shadow transition-shadow"
              >
                Connect
              </Button>
            </div>
            <div className="mt-2 border-t border-white/10 pt-2.5 flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <svg className="size-3 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path strokeLinecap="round" d="M12 6v6l4 2" />
                </svg>
                2 min setup
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Referral Tracking Setup Modal */}
      <Dialog open={showTrackingModal} onOpenChange={setShowTrackingModal}>
        <DialogContent className="max-w-3xl bg-dark-grey border-0 p-0 overflow-hidden">
          <DialogHeader className="p-7 pb-5">
            <DialogTitle className="text-lg font-semibold text-white">
              {isTrackingConnected ? "AI Referral Tracking Settings" : "Connect AI Referral Tracking"}
            </DialogTitle>
            <DialogDescription className="text-white/60 text-sm mt-1.5">
              {isTrackingConnected 
                ? "View your tracking script and setup instructions." 
                : "Track traffic from AI search engines by adding our tracking script."}
            </DialogDescription>
          </DialogHeader>

          <div className="px-7 pb-7 space-y-5">
            {/* Step 1: Copy Script */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center size-5 rounded-full bg-white/10 text-white text-xs font-medium">1</span>
                <h3 className="text-sm font-medium text-white">Copy the tracking script</h3>
              </div>
              <div className="relative">
                <pre className="rounded-lg border border-white/[0.08] bg-black/40 p-4 pr-24 text-[11px] text-white/85 leading-relaxed overflow-hidden">
                  <code style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{trackingScript}</code>
                </pre>
                <Button
                  size="sm"
                  onClick={handleCopyScript}
                  className="absolute top-3 right-3 h-7 px-3 text-xs bg-white/10 hover:bg-white/20 text-white border-0 rounded-md"
                  variant="ghost"
                >
                  {scriptCopied ? (
                    <>
                      <Check className="size-3.5 mr-1.5" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5 mr-1.5" /> Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Step 2: Paste in Head */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center size-5 rounded-full bg-white/10 text-white text-xs font-medium">2</span>
                <h3 className="text-sm font-medium text-white">Paste it in the <code className="text-white/90 font-mono text-xs">&lt;head&gt;</code> of your site</h3>
              </div>
              <p className="text-sm text-white/60 pl-7 leading-relaxed">
                Add the script to the <code className="px-1.5 py-0.5 rounded bg-white/10 text-white/90 text-xs font-mono">&lt;head&gt;</code> section, preferably before the closing <code className="px-1.5 py-0.5 rounded bg-white/10 text-white/90 text-xs font-mono">&lt;/head&gt;</code> tag.
              </p>
            </div>

            {/* Step 3: Help Links */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center size-6 rounded-full bg-white/10 text-white text-sm font-medium">3</span>
                <h3 className="text-sm font-medium text-white">Need help?</h3>
              </div>
              <div className="flex items-center gap-2.5 pl-7 flex-wrap">
                <a href="#" className="inline-flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition-colors">
                  <ExternalLink className="size-3" /> Installation Guide
                </a>
                <span className="text-white/30">•</span>
                <a href="#" className="inline-flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition-colors">
                  <ExternalLink className="size-3" /> Troubleshooting
                </a>
              </div>
            </div>

            {/* Verify Button */}
            <div className="pt-5 border-t border-white/[0.08]">
              <Button 
                className="w-full h-10 bg-white text-black hover:bg-white/90 font-medium rounded-lg"
                onClick={handleVerifyScript}
                disabled={isConnecting}
              >
                {isConnecting ? "Verifying..." : "Script Added - Verify Connection"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 