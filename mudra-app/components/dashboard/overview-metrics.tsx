"use client"

import { DashboardStatCard } from "./dashboard-stat-card"
import type { TimeRange } from "./time-range-selector"
import type { AIModel } from "./model-selector"
import { useState, useEffect } from "react"
import { useBrandProfile } from "@/components/brand-profile-context"
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Info, Link, Copy, Check, ArrowUp, ArrowDown, ArrowLeft, Settings, Loader2, AlertCircle, Github, ExternalLink, X } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "react-hot-toast"

interface OverviewMetricsProps {
  showAll?: boolean
  timeRange: TimeRange
  selectedModel: AIModel
}

export function OverviewMetrics({ showAll = false, timeRange, selectedModel }: OverviewMetricsProps) {
  // Suppress unused variable warnings for future use
  void timeRange
  void selectedModel

  const { profile } = useBrandProfile()
  
  // AI Referral Tracking modal state
  const [showTrackingModal, setShowTrackingModal] = useState(false)
  const [scriptCopied, setScriptCopied] = useState(false)
  const [isTrackingConnected, setIsTrackingConnected] = useState(false) // Default to false (not connected)
  const [isConnecting, setIsConnecting] = useState(false) // Loading state
  
  // Generate tracking script dynamically from backend
  const [trackingScript, setTrackingScript] = useState('')
  const [siteIdValue, setSiteIdValue] = useState('')

  // GitHub and repository state for auto-install
  const [githubConnected, setGithubConnected] = useState(false)
  const [githubUsername, setGithubUsername] = useState('')
  const [repositories, setRepositories] = useState<Array<{ fullName: string; defaultBranch: string }>>([])
  const [selectedRepo, setSelectedRepo] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('main')
  const [loadingRepos, setLoadingRepos] = useState(false)

  // Tracking stats state
  const [trackingStats, setTrackingStats] = useState<{
    totalEvents: number
    totalAIReferrals: number
    trackingId: string
    lastEventAt: string | null
    isActive: boolean
  } | null>(null)

  // Install result state
  const [installSuccess, setInstallSuccess] = useState<{ prUrl: string; prNumber: number } | null>(null)
  const [installError, setInstallError] = useState<string | null>(null)

  // Fetch tracking script and tracking stats when modal opens
  useEffect(() => {
    const loadModalData = async () => {
      if (!showTrackingModal || !profile.id) return

      // Reset states when modal opens
      setVerificationStatus('idle')
      setVerificationMessage('')

      try {
        // Fetch tracking script
        const scriptResponse = await fetch(`/api/analytics/script?brandProfileId=${profile.id}`)
        const scriptResult = await scriptResponse.json()

        if (scriptResult.success && scriptResult.data) {
          setTrackingScript(scriptResult.data.script)
          setSiteIdValue(scriptResult.data.siteId)
          if (typeof window !== 'undefined') {
            localStorage.setItem('mudra:siteId', scriptResult.data.siteId)
          }
        }

        // Fetch tracking stats from /api/tracking/code
        try {
          const statsResponse = await fetch('/api/tracking/code')
          const statsResult = await statsResponse.json()

          if (statsResult.success && statsResult.data) {
            setTrackingStats({
              totalEvents: statsResult.data.totalEvents || 0,
              totalAIReferrals: statsResult.data.totalAIReferrals || 0,
              trackingId: statsResult.data.trackingId || '',
              lastEventAt: statsResult.data.lastEventAt,
              isActive: statsResult.data.isActive || false
            })
          }
        } catch (statsError) {
          console.error('Error fetching tracking stats:', statsError)
        }

        // Fetch GitHub connection status and repos
        setLoadingRepos(true)
        try {
          const installStatusResponse = await fetch('/api/tracking/install')
          const installStatus = await installStatusResponse.json()

          if (installStatus.success && installStatus.data) {
            setGithubConnected(installStatus.data.githubConnected || false)
            setGithubUsername(installStatus.data.githubUsername || '')

            const repos = (installStatus.data.repositories || []).map((repoName: string) => ({
              fullName: repoName,
              defaultBranch: 'main'
            }))
            setRepositories(repos)
            if (repos.length > 0 && !selectedRepo) {
              setSelectedRepo(repos[0].fullName)
            }
          } else {
            setGithubConnected(false)
          }
        } catch (githubError) {
          console.error('Error checking GitHub:', githubError)
          setGithubConnected(false)
        } finally {
          setLoadingRepos(false)
        }
      } catch (error) {
        console.error('Error fetching modal data:', error)
      }
    }

    loadModalData()
  }, [showTrackingModal, profile.id])
  
  // Old static script generation (kept as fallback)
  const siteId = typeof window !== 'undefined' ? (localStorage.getItem('mudra:siteId') || siteIdValue || 'your-site-id') : 'your-site-id'
  const fallbackTrackingScript = `<!-- Mudra AI Referral Tracking -->
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
      const scriptToCopy = trackingScript || fallbackTrackingScript
      await navigator.clipboard.writeText(scriptToCopy)
      setScriptCopied(true)
      setTimeout(() => setScriptCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy script:', error)
    }
  }

  const handleConnect = () => {
    setShowTrackingModal(true)
  }

  // Verification state for showing progress in modal
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'success' | 'failed'>('idle')
  const [verificationMessage, setVerificationMessage] = useState('')

  // Modal view mode: 'traffic' for minimal traffic view, 'script' for script settings
  const [modalView, setModalView] = useState<'traffic' | 'script'>('traffic')

  // Mock data for AI referral traffic by model
  const [mockReferralData, setMockReferralData] = useState<{
    total: number
    byModel: { name: string; visits: number; icon: string; color: string }[]
  } | null>(null)

  const handleVerifyScript = async () => {
    setVerificationStatus('verifying')

    try {
      // Call the actual verification API
      const siteIdToVerify = siteIdValue || (typeof window !== 'undefined' ? localStorage.getItem('mudra:siteId') : null)

      if (!siteIdToVerify) {
        setVerificationStatus('failed')
        setVerificationMessage('No tracking ID found. Please copy and install the script first.')
        return
      }

      const response = await fetch('/api/analytics/script/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandProfileId: profile.id,
          siteId: siteIdToVerify
        })
      })
      const result = await response.json()

      if (result.success && result.data?.connected) {
        setVerificationStatus('success')
        setVerificationMessage('Tracking script detected!')

        // Close modal and show loading on widget
        setTimeout(async () => {
          setShowTrackingModal(false)
          setIsTrackingConnected(true)
          setLoadingAiReferral(true)

          // Fetch actual referral data
          await fetchAiReferralTraffic()
          setLoadingAiReferral(false)
        }, 800)
      } else {
        setVerificationStatus('failed')
        setVerificationMessage(result.error?.message || 'Tracking script not detected. Please ensure it is installed correctly.')
      }
    } catch (error) {
      console.error('Verification error:', error)
      setVerificationStatus('failed')
      setVerificationMessage('Failed to verify. Please try again.')
    }
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
  const [averagePositionPrevious, setAveragePositionPrevious] = useState<number | null>(null) // Previous run's average position
  const [hasPositionHistory, setHasPositionHistory] = useState(false)
  const [totalTests, setTotalTests] = useState(0)

  // State for Organic Traffic
  const [organicTraffic, setOrganicTraffic] = useState(0)
  const [organicTrafficPrevious, setOrganicTrafficPrevious] = useState<number | null>(null)
  const [hasTrafficHistory, setHasTrafficHistory] = useState(false)
  const [loadingAIVisibility, setLoadingAIVisibility] = useState(true)
  const [loadingTechnical, setLoadingTechnical] = useState(true)
  const [loadingTraffic, setLoadingTraffic] = useState(true)

  // State for AI Referral Traffic
  const [aiReferralTraffic, setAiReferralTraffic] = useState(0)
  const [aiReferralPrevious, setAiReferralPrevious] = useState<number | null>(null)
  const [hasAiTrafficHistory, setHasAiTrafficHistory] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [isInstallingTracking, setIsInstallingTracking] = useState(false)
  const [loadingAiReferral, setLoadingAiReferral] = useState(false)
  const [loadingReferralModels, setLoadingReferralModels] = useState(false)

  // Handle auto-install tracking script via GitHub agent (uses /api/tracking/install - same as TrackingCodeManager)
  const handleAutoInstall = async () => {
    if (!profile.id) {
      toast.error("Brand profile not found");
      return;
    }

    if (!selectedRepo) {
      setInstallError("Please select a repository");
      return;
    }

    try {
      setIsInstallingTracking(true);
      setInstallError(null);
      setInstallSuccess(null);

      toast("Creating pull request...", { icon: "🤖" });

      // Use /api/tracking/install POST - same endpoint TrackingCodeManager used
      const response = await fetch('/api/tracking/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoFullName: selectedRepo,
          branch: selectedBranch
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to install tracking');
      }

      // Show success with PR link
      if (result.data?.prUrl) {
        setInstallSuccess({
          prUrl: result.data.prUrl,
          prNumber: result.data.prNumber || 0
        });
        toast.success(
          <div>
            <p className="font-semibold">Installation PR created!</p>
            <a href={result.data.prUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-400 hover:underline">
              View PR on GitHub
            </a>
          </div>,
          { duration: 8000 }
        );
      } else {
        toast.success("Tracking script installed successfully!");
      }

      // Refresh tracking status
      await new Promise(resolve => setTimeout(resolve, 2000));
      await fetchAiReferralTraffic();

    } catch (error) {
      console.error('Auto-install error:', error);
      const errorMessage = error instanceof Error ? error.message : "Installation failed. Please try manual install.";
      setInstallError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsInstallingTracking(false);
    }
  };

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
      setLoadingAIVisibility(true)
      
      // Fetch current aggregate score (Firegeo methodology) with timeout
      const controller1 = new AbortController()
      const timeoutId1 = setTimeout(() => controller1.abort(), 10000)
      
      const currentResponse = await fetch(
        `/api/prompts/with-results?brandProfileId=${profile.id}`,
        { signal: controller1.signal }
      )
      clearTimeout(timeoutId1)
      
      if (!currentResponse.ok) {
        throw new Error(`HTTP ${currentResponse.status}: ${currentResponse.statusText}`)
      }
      
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

      // Fetch historical data for comparison with timeout
      const controller2 = new AbortController()
      const timeoutId2 = setTimeout(() => controller2.abort(), 10000)
      
      const historyResponse = await fetch(
        `/api/analysis/geo-history?brandProfileId=${profile.id}&limit=2`,
        { signal: controller2.signal }
      )
      clearTimeout(timeoutId2)
      
      if (!historyResponse.ok) {
        throw new Error(`HTTP ${historyResponse.status}: ${historyResponse.statusText}`)
      }
      
      const historyResult = await historyResponse.json()
      
      if (historyResult.success && historyResult.data && historyResult.data.length > 1) {
        // Use previous run's score for comparison
        const previous = historyResult.data[1]
        setAiVisibilityPrevious(previous.overallScore || 0)
        setHasAiHistory(true)
        console.log('📊 AI Visibility previous score:', previous.overallScore)
        
        // Fetch previous run's average position
        const prevController = new AbortController()
        const prevTimeoutId = setTimeout(() => prevController.abort(), 10000)
        
        const prevPromptResponse = await fetch(
          `/api/prompts/with-results?brandProfileId=${profile.id}&runId=${previous.id}`,
          { signal: prevController.signal }
        )
        clearTimeout(prevTimeoutId)
        
        if (prevPromptResponse.ok) {
          const prevPromptResult = await prevPromptResponse.json()
          if (prevPromptResult.success && prevPromptResult.aggregate) {
            const prevAvgPos = prevPromptResult.aggregate.averagePosition
            setAveragePositionPrevious(prevAvgPos)
            setHasPositionHistory(prevAvgPos > 0)
            console.log('📊 Average Position previous value:', prevAvgPos)
          }
        }
      } else {
        setHasAiHistory(false)
        setAiVisibilityPrevious(null)
      }
    } catch (error) {
      console.error('Error fetching AI visibility history:', error)
      // Set safe defaults on error
      setHasAiHistory(false)
      setAiVisibilityPrevious(null)
      setAiVisibilityScore(0)
    } finally {
      setLoadingAIVisibility(false)
    }
  }

  // Fetch Technical Structure score with historical comparison
  const fetchTechnicalHistory = async () => {
    if (!profile.id) return

    try {
      setLoadingTechnical(true)
      
      // Add timeout to prevent hanging requests
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort('Request timeout'), 10000) // 10s timeout
      
      const response = await fetch(
        `/api/analysis/technical-history?brandProfileId=${profile.id}&limit=2`,
        { signal: controller.signal }
      )
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
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
      // Set safe defaults on error
      setHasHistoricalData(false)
      setPreviousScore(null)
      setTechnicalScore(0)
    } finally {
      setLoadingTechnical(false)
    }
  }

  // Fetch Organic Traffic data from analysis results
  const fetchTrafficMetrics = async () => {
    if (!profile.id) return

    try {
      setLoadingTraffic(true)
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort('Request timeout'), 10000)
      
      const response = await fetch(
        `/api/analysis/results?brandProfileId=${profile.id}`,
        { signal: controller.signal }
      )
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
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
    } finally {
      setLoadingTraffic(false)
    }
  }

  // Fetch AI Referral Traffic data from analytics API
  const fetchAiReferralTraffic = async () => {
    if (!profile.id) {
      console.log('📊 Skipping AI referral fetch - no profile ID')
      return
    }

    try {
      const response = await fetch(`/api/analytics/ai-referral?brandProfileId=${profile.id}&days=7`)
      
      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success && result.data) {
        setAiReferralTraffic(result.data.traffic || 0)
        setAiReferralPrevious(result.data.previous || 0)
        setHasAiTrafficHistory(result.data.previous > 0)
        setIsTrackingConnected(result.data.connected)
        
        if (result.data.lastUpdated) {
          setLastUpdated(new Date(result.data.lastUpdated))
        }
        
        console.log('📊 AI Referral Traffic updated:', {
          traffic: result.data.traffic,
          previous: result.data.previous,
          growth: result.data.growth,
          connected: result.data.connected
        })
      } else {
        console.warn('📊 AI Referral API returned unsuccessful response:', result)
      }
    } catch (error) {
      console.error('📊 Error fetching AI referral traffic:', error)
      // Set default values on error to prevent UI from breaking
      setAiReferralTraffic(0)
      setAiReferralPrevious(0)
      setHasAiTrafficHistory(false)
      setIsTrackingConnected(false)
    }
  }

  // Initial data fetch
  useEffect(() => {
    if (profile.id) {
      fetchAiVisibilityHistory()
      fetchTechnicalHistory()
      fetchTrafficMetrics()
      fetchAiReferralTraffic()
    } else if (profile.id === 0) {
      // Profile explicitly has id=0, meaning no profile exists yet
      // Reset loading states immediately to show empty state
      console.log('📊 No profile ID (id=0), resetting loading states')
      setLoadingAIVisibility(false)
      setLoadingTechnical(false)
      setLoadingTraffic(false)
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
        fetchTrafficMetrics(),
        fetchAiReferralTraffic()
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
        loading={loadingAIVisibility}
      />

      <DashboardStatCard
        title="Average Position"
        value={averagePosition}
        suffix=""
        delta={hasPositionHistory && averagePositionPrevious !== null && averagePosition > 0 && averagePositionPrevious > 0 
          ? Math.round(((averagePositionPrevious - averagePosition) / averagePositionPrevious) * 100) 
          : 0}
        lastValue={hasPositionHistory && averagePositionPrevious !== null ? averagePositionPrevious : 0}
        positive={hasPositionHistory && averagePositionPrevious !== null && averagePosition > 0 ? averagePosition < averagePositionPrevious : true}
        sparkline={averagePosition > 0 ? [10, Math.min(8, averagePosition * 1.2), averagePosition, Math.max(1, averagePosition * 0.8)] : [0]}
        accentColor="rgba(167, 139, 250, 0.9)"
        info={averagePosition > 0 ? `Average ranking position across all mentions. Position #1 is best. Lower numbers indicate better visibility.` : "No position data available yet."}
        showLastPeriod={true}
        loading={loadingAIVisibility}
        emptyValue="—"
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
        loading={loadingTechnical}
      />

      {/* AI Referral Traffic Card */}
      {loadingAiReferral ? (
        <Card className="group relative overflow-hidden bg-transparent backdrop-blur-sm rounded-lg border border-white/[0.08] gap-3">
          <CardHeader className="border-0">
            <CardTitle className="text-muted-foreground text-sm font-medium">AI Referral Traffic</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex items-center justify-between gap-2.5">
              <span className="h-7 w-16 rounded bg-white/[0.06] animate-pulse" />
              <span className="h-5 w-12 rounded bg-white/[0.06] animate-pulse" />
            </div>
            <div className="border-t border-white/[0.06] pt-2.5 mt-2">
              <span className="h-3 w-24 rounded bg-white/[0.06] animate-pulse block" />
            </div>
          </CardContent>
        </Card>
      ) : isTrackingConnected ? (
        <Card className="group relative overflow-hidden bg-transparent backdrop-blur-sm rounded-lg border border-white/[0.08] hover:border-white/[0.12] transition-colors gap-3">
          <CardHeader className="border-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-muted-foreground text-sm font-medium">AI Referral Traffic</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-white/30 hover:text-white/60 transition-colors">
                    <Info className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent sideOffset={8} className="max-w-xs text-white/90">
                  Traffic referred from AI models
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex items-center justify-between gap-2.5">
              <span className="text-2xl font-medium text-foreground tracking-tight">
                {aiReferralTraffic.toLocaleString()}
              </span>
              {aiReferralDelta !== 0 && (
                <Badge
                  variant={aiReferralDelta > 0 ? "success" : "destructive"}
                  className={aiReferralDelta > 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : ""}
                >
                  {aiReferralDelta > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                  {Math.abs(aiReferralDelta)}%
                </Badge>
              )}
            </div>
            <div className="border-t border-white/[0.06] pt-2.5 mt-2 flex items-center justify-between">
              <span className="text-xs text-white/40">
                {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <button
                className="text-xs text-white/40 hover:text-white/70 transition-colors"
                onClick={async () => {
                  setModalView('traffic')
                  setLoadingReferralModels(true)
                  setMockReferralData(null)
                  setShowTrackingModal(true)
                  try {
                    const response = await fetch(`/api/analytics/ai-referral?brandProfileId=${profile.id}&byModel=true`)
                    const result = await response.json()
                    if (result.success && result.data?.byModel) {
                      setMockReferralData({
                        total: result.data.traffic || 0,
                        byModel: result.data.byModel
                      })
                    }
                  } catch (error) {
                    console.error('Error fetching referral data:', error)
                  } finally {
                    setLoadingReferralModels(false)
                  }
                }}
              >
                Details
              </button>
            </div>
          </CardContent>
        </Card>
      ) : isConnecting ? (
        <Card className="group relative overflow-hidden bg-transparent backdrop-blur-sm rounded-lg border border-white/[0.08] gap-3">
          <CardHeader className="border-0">
            <CardTitle className="text-muted-foreground text-sm font-medium">AI Referral Traffic</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex items-center gap-3">
              <div className="size-5 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
              <span className="text-sm text-white/60">Connecting...</span>
            </div>
            <div className="border-t border-white/[0.06] pt-2.5 mt-2">
              <span className="text-xs text-white/30">Verifying installation</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="group relative overflow-hidden bg-transparent backdrop-blur-sm rounded-lg border border-white/[0.08] hover:border-white/[0.12] transition-colors gap-3">
          <CardHeader className="border-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-muted-foreground text-sm font-medium">AI Referral Traffic</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-white/30 hover:text-white/60 transition-colors">
                    <Info className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent sideOffset={8} className="max-w-xs text-white/90">
                  Track visitors from AI chatbots
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex items-center justify-between gap-2.5">
              <span className="text-sm text-white/50">Not connected</span>
              <Button 
                size="sm" 
                onClick={handleConnect}
                className="h-7 px-3 rounded-md bg-white text-black hover:bg-white/90 text-xs font-medium"
              >
                Connect
              </Button>
            </div>
            <div className="border-t border-white/[0.06] pt-2.5 mt-2">
              <span className="text-xs text-white/30">2 min setup</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Referral Tracking Setup Modal */}
      <Dialog open={showTrackingModal} onOpenChange={setShowTrackingModal}>
        <DialogContent className={`${modalView === 'traffic' && isTrackingConnected ? '!max-w-md' : '!max-w-lg'} bg-[#161616] border-white/[0.08] p-0 !rounded-xl overflow-hidden [&>button]:hidden`}>
          <DialogHeader className="sr-only">
            <DialogTitle>AI Referral Tracking</DialogTitle>
          </DialogHeader>
          
          <div className="p-6">
            {/* TRAFFIC VIEW */}
            {modalView === 'traffic' && isTrackingConnected && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-medium text-white">AI Referral Traffic</h2>
                    <p className="text-xs text-white/40 mt-0.5">This month</p>
                  </div>
                  <button 
                    onClick={() => setShowTrackingModal(false)}
                    className="text-white/30 hover:text-white/60 transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {loadingReferralModels || !mockReferralData ? (
                    [1, 2, 3, 4].map((i) => (
                      <div key={i} className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                        <div className="h-4 w-12 rounded bg-white/[0.06] animate-pulse mb-2" />
                        <div className="h-6 w-8 rounded bg-white/[0.06] animate-pulse" />
                      </div>
                    ))
                  ) : (
                    mockReferralData.byModel.map((model) => (
                      <div key={model.name} className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                        <div className="flex items-center gap-2 mb-1">
                          <img src={model.icon} alt="" className="w-4 h-4 opacity-60" />
                          <span className="text-xs text-white/40">{model.name}</span>
                        </div>
                        <div className="text-lg font-medium text-white">{model.visits.toLocaleString()}</div>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1 h-9 bg-white text-black hover:bg-white/90 text-sm font-medium rounded-lg"
                    onClick={() => setShowTrackingModal(false)}
                  >
                    Done
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-9 px-3 text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                    onClick={() => setModalView('script')}
                  >
                    <Settings className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* SCRIPT VIEW */}
            {(modalView === 'script' || !isTrackingConnected) && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-medium text-white">
                      {isTrackingConnected ? "Script Settings" : "Connect Tracking"}
                    </h2>
                    <p className="text-xs text-white/40 mt-0.5">
                      {isTrackingConnected ? "Your tracking script" : "Track AI referral traffic"}
                    </p>
                  </div>
                  <button 
                    onClick={() => isTrackingConnected ? setModalView('traffic') : setShowTrackingModal(false)}
                    className="text-white/30 hover:text-white/60 transition-colors"
                  >
                    {isTrackingConnected ? <ArrowLeft className="size-4" /> : <X className="size-4" />}
                  </button>
                </div>

                {/* Script Code */}
                <div className="relative">
                  <pre className="rounded-lg border border-white/[0.06] bg-black/20 p-4 pr-16 text-[11px] text-white/70 leading-relaxed overflow-x-auto">
                    <code className="break-all whitespace-pre-wrap">{trackingScript || fallbackTrackingScript}</code>
                  </pre>
                  <button
                    onClick={handleCopyScript}
                    className="absolute top-3 right-3 px-2.5 py-1 text-[11px] text-white/50 hover:text-white/80 bg-white/[0.08] hover:bg-white/[0.12] rounded transition-colors"
                  >
                    {scriptCopied ? "Copied" : "Copy"}
                  </button>
                </div>

                <p className="text-xs text-white/30">
                  Add to your site's <code className="px-1 py-0.5 rounded bg-white/[0.06] text-white/50">&lt;head&gt;</code>
                </p>

                {/* GitHub Auto-Install */}
                <div className="pt-4 border-t border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-3">
                    <Github className="size-3.5 text-white/50" />
                    <span className="text-xs font-medium text-white/70">Auto-install via GitHub</span>
                  </div>

                  {loadingRepos ? (
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      <Loader2 className="size-3 animate-spin" />
                      Loading...
                    </div>
                  ) : !githubConnected ? (
                    <a
                      href="/dashboard/integrations"
                      className="text-xs text-white/50 hover:text-white/80 inline-flex items-center gap-1 transition-colors"
                    >
                      Connect GitHub <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    <div className="space-y-2">
                      {githubUsername && (
                        <p className="text-[10px] text-white/30">@{githubUsername}</p>
                      )}
                      {repositories.length > 0 ? (
                        <>
                          <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                            <SelectTrigger className="w-full h-8 bg-white/[0.03] border-white/[0.06] text-white text-xs">
                              <SelectValue placeholder="Select repository" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#161616] border-white/[0.08]">
                              {repositories.map((repo) => (
                                <SelectItem key={repo.fullName} value={repo.fullName} className="text-white text-xs focus:bg-white/[0.06]">
                                  {repo.fullName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {installSuccess ? (
                            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                              <span className="text-xs text-emerald-400">PR created</span>
                              <a href={installSuccess.prUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 hover:underline">
                                View <ExternalLink className="size-3 inline" />
                              </a>
                            </div>
                          ) : installError ? (
                            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                              <span className="text-xs text-red-400">{installError}</span>
                            </div>
                          ) : (
                            <Button
                              className="w-full h-8 bg-white/[0.06] hover:bg-white/[0.1] text-white/70 text-xs border-0"
                              onClick={handleAutoInstall}
                              disabled={isInstallingTracking || !selectedRepo}
                            >
                              {isInstallingTracking ? (
                                <><Loader2 className="size-3 mr-1.5 animate-spin" /> Creating PR...</>
                              ) : (
                                "Create PR"
                              )}
                            </Button>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-white/40">No repositories found</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Verification */}
                <div className="pt-4 border-t border-white/[0.06] space-y-3">
                  {verificationStatus === 'success' && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <Check className="size-4 text-emerald-400" />
                      <span className="text-xs text-emerald-400">Connected</span>
                    </div>
                  )}

                  {verificationStatus === 'failed' && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                      <AlertCircle className="size-4 text-red-400" />
                      <span className="text-xs text-red-400">Not detected</span>
                    </div>
                  )}

                  {(verificationStatus === 'idle' || verificationStatus === 'verifying' || verificationStatus === 'failed') && (
                    <Button
                      className="w-full h-9 bg-white text-black hover:bg-white/90 text-sm font-medium rounded-lg"
                      onClick={handleVerifyScript}
                      disabled={verificationStatus === 'verifying'}
                    >
                      {verificationStatus === 'verifying' ? (
                        <><Loader2 className="size-4 mr-2 animate-spin" /> Verifying...</>
                      ) : verificationStatus === 'failed' ? (
                        "Try Again"
                      ) : (
                        "Verify Connection"
                      )}
                    </Button>
                  )}

                  {verificationStatus === 'success' && (
                    <Button
                      className="w-full h-9 bg-white text-black hover:bg-white/90 text-sm font-medium rounded-lg"
                      onClick={() => setShowTrackingModal(false)}
                    >
                      Done
                    </Button>
                  )}
                </div>

                {(trackingStats?.trackingId || siteIdValue) && (
                  <div className="pt-3 border-t border-white/[0.06]">
                    <p className="text-[10px] text-white/30">
                      ID: <code className="text-white/50">{trackingStats?.trackingId || siteIdValue}</code>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 