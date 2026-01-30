"use client"

import type { TimeRange } from "./time-range-selector"
import type { AIModel } from "./model-selector"
import { useState, useEffect } from "react"
import { useBrandProfile } from "@/components/brand-profile-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Info, Check, ArrowUp, ArrowDown, ArrowLeft, Settings, Loader2, AlertCircle, Github, ExternalLink, X, ChevronDown } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "react-hot-toast"

interface OverviewMetricsProps {
  showAll?: boolean
  timeRange: TimeRange
  selectedModel: AIModel | "all"
  days?: number
}

export function OverviewMetrics({ showAll = false, timeRange, selectedModel, days = 30 }: OverviewMetricsProps) {
  // Suppress unused variable warnings for future use
  void timeRange

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

  // Expandable card states
  const [aiVisibilityExpanded, setAiVisibilityExpanded] = useState(false)
  const [technicalScoreExpanded, setTechnicalScoreExpanded] = useState(false)

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
      // Call the agent-based verification API
      const response = await fetch('/api/analytics/verify-installation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandProfileId: profile.id
        })
      })
      const result = await response.json()

      if (result.success && result.data?.verified) {
        setVerificationStatus('success')
        setVerificationMessage(`✅ Script found in ${result.data.location}!`)

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
        const filesChecked = result.error?.filesChecked || []
        const filesMsg = filesChecked.length > 0 ? ` (checked ${filesChecked.length} files)` : ''
        setVerificationMessage(result.error?.message + filesMsg || 'Tracking script not detected in your GitHub repository.')
      }
    } catch (error) {
      console.error('Verification error:', error)
      setVerificationStatus('failed')
      setVerificationMessage('Failed to verify. Please ensure GitHub is connected.')
    }
  }

  // State for dynamic technical score
  const [technicalScore, setTechnicalScore] = useState(0)
  const [previousScore, setPreviousScore] = useState<number | null>(null)
  const [hasHistoricalData, setHasHistoricalData] = useState(false)
  const [isGeneratingScore, setIsGeneratingScore] = useState(false)
  const [technicalScoreHistory, setTechnicalScoreHistory] = useState<number[]>([])

  // State for AI Visibility score
  const [aiVisibilityScore, setAiVisibilityScore] = useState(0)
  const [aiVisibilityPrevious, setAiVisibilityPrevious] = useState<number | null>(null)
  const [hasAiHistory, setHasAiHistory] = useState(false)
  const [aiVisibilityHistory, setAiVisibilityHistory] = useState<number[]>([])
  // Track the number of analysis runs (used to sync chart data points)
  const [analysisRunCount, setAnalysisRunCount] = useState(0)
  
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
  const [loadingAiReferral, setLoadingAiReferral] = useState(true) // Start as true to prevent flash
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
        
        // Store full history for chart (reversed so oldest is first)
        if (result.data.history && Array.isArray(result.data.history)) {
          const historyScores = result.data.history.map((h: { total: number }) => h.total).reverse()
          setTechnicalScoreHistory(historyScores)
        }
        
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

      // Build URL with optional model filter
      const modelParam = selectedModel !== 'all' ? `&model=${selectedModel}` : ''

      // Fetch current aggregate score (Firegeo methodology) with timeout
      const controller1 = new AbortController()
      const timeoutId1 = setTimeout(() => controller1.abort(), 10000)

      const currentResponse = await fetch(
        `/api/prompts/with-results?brandProfileId=${profile.id}${modelParam}&days=${days}`,
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
      } else {
        // No data for this model filter - reset to 0
        console.log('📊 No AI Visibility data for selected model, resetting to 0')
        setAiVisibilityScore(0)
        setMentionRate(0)
        setAveragePosition(0)
        setTotalTests(0)
        setHasAiHistory(false)
        setAiVisibilityPrevious(null)
        setAiVisibilityHistory([])
        setAveragePositionPrevious(null)
        setHasPositionHistory(false)
        // Skip history fetching since there's no current data
        return
      }

      // Only fetch historical data when viewing all models (we don't have per-model history)
      if (selectedModel !== 'all') {
        // When filtering by a specific model, we don't have historical comparison data
        setHasAiHistory(false)
        setAiVisibilityPrevious(null)
        setAiVisibilityHistory([])
        setAveragePositionPrevious(null)
        setHasPositionHistory(false)
      } else {
        // Fetch historical data for comparison with timeout
        const controller2 = new AbortController()
        const timeoutId2 = setTimeout(() => controller2.abort(), 10000)

        const historyResponse = await fetch(
          `/api/analysis/geo-history?brandProfileId=${profile.id}&limit=5&days=${days}`,
          { signal: controller2.signal }
        )
        clearTimeout(timeoutId2)

        if (!historyResponse.ok) {
          throw new Error(`HTTP ${historyResponse.status}: ${historyResponse.statusText}`)
        }

        const historyResult = await historyResponse.json()

        if (historyResult.success && historyResult.data && historyResult.data.length > 1) {
          // Store full history for chart (reversed so oldest is first)
          const historyScores = historyResult.data.map((h: { overallScore: number }) => h.overallScore || 0).reverse()
          setAiVisibilityHistory(historyScores)
          // Track the number of analysis runs for syncing with technical chart
          setAnalysisRunCount(historyResult.data.length)
          console.log('📊 AI Visibility history stored:', historyScores, 'Run count:', historyResult.data.length)

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
          // Set run count for single record or empty
          setAnalysisRunCount(historyResult.data?.length || 0)
        }
      }
    } catch (error) {
      console.error('Error fetching AI visibility history:', error)
      // Set safe defaults on error
      setHasAiHistory(false)
      setAiVisibilityPrevious(null)
      setAiVisibilityScore(0)
      setAnalysisRunCount(0)
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
        `/api/analysis/technical-history?brandProfileId=${profile.id}&limit=5&days=${days}`,
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

        // Store full history for chart (reversed so oldest is first)
        const historyScores = result.data.map((h: { overallScore: number }) => h.overallScore || 0).reverse()
        setTechnicalScoreHistory(historyScores)
        console.log('📊 Technical score history stored:', historyScores)

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
      setLoadingAiReferral(false)
      return
    }

    try {
      setLoadingAiReferral(true)
      // Build URL with optional model filter
      const modelParam = selectedModel !== 'all' ? `&model=${selectedModel}` : ''
      const response = await fetch(`/api/analytics/ai-referral?brandProfileId=${profile.id}&days=${days}${modelParam}`)
      
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
    } finally {
      setLoadingAiReferral(false)
    }
  }

  // Initial data fetch - re-fetch when model filter changes
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
  }, [profile.id, selectedModel, days])

  // Listen for analysis completion events
  useEffect(() => {
    const handleAnalysisComplete = async () => {
      console.log('🔄 Analysis complete, refreshing all metrics')
      // Refresh all metrics from database
      await Promise.all([
        fetchAiVisibilityHistory(),
        fetchTechnicalHistory(),
        fetchTrafficMetrics(),
        fetchAiReferralTraffic()
      ])
    }

    window.addEventListener('mudra:website-analyzed', handleAnalysisComplete)
    window.addEventListener('mudra:analysis-complete', handleAnalysisComplete)
    return () => {
      window.removeEventListener('mudra:website-analyzed', handleAnalysisComplete)
      window.removeEventListener('mudra:analysis-complete', handleAnalysisComplete)
    }
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
      {/* AI Visibility Score */}
      <div 
        className="bg-[#161616]  rounded-xl p-5 flex flex-col cursor-pointer transition-all"
        onClick={() => setAiVisibilityExpanded(!aiVisibilityExpanded)}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/50 font-medium">AI Visibility</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-white/30 hover:text-white/50 transition-colors" onClick={(e) => e.stopPropagation()}>
                  <Info className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent sideOffset={8} className="max-w-xs">
                How visible your brand is across AI responses. Higher is better.
              </TooltipContent>
            </Tooltip>
          </div>
          <ChevronDown className={`size-3.5 text-white/30 transition-transform ${aiVisibilityExpanded ? 'rotate-180' : ''}`} />
        </div>
        <div className="flex-1 flex flex-col justify-center">
          {loadingAIVisibility ? (
            <div className="h-9 w-24 rounded bg-white/[0.06] animate-pulse" />
          ) : (
            <div className="flex items-end justify-between">
              <span className="text-[24px] font-medium text-white">{aiVisibilityScore}%</span>
              {aiVisibilityDelta !== 0 ? (
                <span className={`text-xs flex items-center gap-0.5 ${aiVisibilityDelta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {aiVisibilityDelta > 0 ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                  {Math.abs(aiVisibilityDelta)}%
                </span>
              ) : (
                <span className="text-sm font-medium text-white/40">—</span>
              )}
            </div>
          )}
        </div>
        
        {/* Expanded Chart */}
        {aiVisibilityExpanded && !loadingAIVisibility && (
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            {aiVisibilityHistory.length >= 2 ? (
              <>
                <div className="h-[80px] flex items-end gap-1">
                  {aiVisibilityHistory.map((value, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-white/10 rounded-sm transition-all"
                      style={{ height: `${Math.max(8, value * 0.8)}%` }}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-2">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-white/50 tabular-nums">
                      {`${Math.round(aiVisibilityHistory[0])}%`}
                    </span>
                    <span className="text-[10px] text-white/30">First</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[11px] text-white/50 tabular-nums">{aiVisibilityScore}%</span>
                    <span className="text-[10px] text-white/30">Now</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-[80px] flex items-center justify-center">
                <span className="text-xs text-white/40">Run more analyses to see trends</span>
              </div>
            )}
          </div>
        )}
        
        {!aiVisibilityExpanded && (
          <div className="mt-auto pt-3 border-t border-white/[0.06]">
            {loadingAIVisibility ? (
              <div className="h-4 w-32 rounded bg-white/[0.06] animate-pulse" />
            ) : (
              <span className="text-xs text-white/30">
                {hasAiHistory && aiVisibilityPrevious !== null ? `Last period: ${aiVisibilityPrevious}%` : 'Based on AI responses'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Average Position */}
      <div className="bg-[#161616]  rounded-xl p-5 min-h-[140px] flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-white/50 font-medium">Avg Position</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-white/30">
                <Info className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent sideOffset={8} className="max-w-xs">
              Your ranking when mentioned. #1 is best.
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex-1 flex flex-col justify-center">
          {loadingAIVisibility ? (
            <div className="h-9 w-20 rounded bg-white/[0.06] animate-pulse" />
          ) : (
            <div className="flex items-end justify-between">
              <span className="text-[24px] font-medium text-white">
                {averagePosition > 0 ? `#${averagePosition.toFixed(1)}` : '—'}
              </span>
              {hasPositionHistory && averagePositionPrevious !== null && averagePosition > 0 && averagePositionPrevious > 0 && averagePosition !== averagePositionPrevious ? (
                <span className={`text-xs flex items-center gap-0.5 ${averagePosition < averagePositionPrevious ? 'text-emerald-400' : 'text-red-400'}`}>
                  {averagePosition < averagePositionPrevious ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                  {Math.abs(Math.round(((averagePositionPrevious - averagePosition) / averagePositionPrevious) * 100))}%
                </span>
              ) : (
                <span className="text-sm font-medium text-white/40">—</span>
              )}
            </div>
          )}
        </div>
        <div className="mt-auto pt-3 border-t border-white/[0.06]">
          {loadingAIVisibility ? (
            <div className="h-4 w-32 rounded bg-white/[0.06] animate-pulse" />
          ) : (
            <span className="text-xs text-white/30">
              {hasPositionHistory && averagePositionPrevious !== null ? `Last period: #${averagePositionPrevious.toFixed(1)}` : 'Lower is better'}
            </span>
          )}
        </div>
      </div>

      {/* Technical Structure Score */}
      <div 
        className="bg-[#161616]  rounded-xl p-5 flex flex-col cursor-pointer transition-all"
        onClick={() => setTechnicalScoreExpanded(!technicalScoreExpanded)}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/50 font-medium">Technical Score</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-white/30 hover:text-white/50 transition-colors" onClick={(e) => e.stopPropagation()}>
                  <Info className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent sideOffset={8} className="max-w-xs">
                How well your site is structured for AI crawlers and indexing.
              </TooltipContent>
            </Tooltip>
          </div>
          <ChevronDown className={`size-3.5 text-white/30 transition-transform ${technicalScoreExpanded ? 'rotate-180' : ''}`} />
        </div>
        <div className="flex-1 flex flex-col justify-center">
          {loadingTechnical ? (
            <div className="h-9 w-24 rounded bg-white/[0.06] animate-pulse" />
          ) : (
            <div className="flex items-end justify-between">
              <span className="text-[24px] font-medium text-white">{isGeneratingScore ? '—' : `${technicalScore}%`}</span>
              {!isGeneratingScore && hasHistoricalData && previousScore !== null && technicalScore !== previousScore ? (
                <span className={`text-xs flex items-center gap-0.5 ${technicalScore > previousScore ? 'text-emerald-400' : 'text-red-400'}`}>
                  {technicalScore > previousScore ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                  {Math.abs(Math.round(((technicalScore - previousScore) / previousScore) * 100))}%
                </span>
              ) : !isGeneratingScore ? (
                <span className="text-sm font-medium text-white/40">—</span>
              ) : null}
            </div>
          )}
        </div>
        
        {/* Expanded Chart */}
        {technicalScoreExpanded && !loadingTechnical && !isGeneratingScore && (
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            {(() => {
              // Sync technical history with GEO analysis run count to ensure both charts match
              // This handles cases where technical records may exist without corresponding GEO records
              const syncedHistory = analysisRunCount > 0 && technicalScoreHistory.length > analysisRunCount
                ? technicalScoreHistory.slice(-analysisRunCount)  // Take the most recent N records
                : technicalScoreHistory

              return syncedHistory.length >= 2 ? (
              <>
                <div className="h-[80px] flex items-end gap-1">
                  {syncedHistory.map((value, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-white/10 rounded-sm transition-all"
                      style={{ height: `${Math.max(8, value * 0.8)}%` }}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-2">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-white/50 tabular-nums">
                      {`${Math.round(syncedHistory[0])}%`}
                    </span>
                    <span className="text-[10px] text-white/30">First</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[11px] text-white/50 tabular-nums">{technicalScore}%</span>
                    <span className="text-[10px] text-white/30">Now</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-[80px] flex items-center justify-center">
                <span className="text-xs text-white/40">Run more analyses to see trends</span>
              </div>
            )
            })()}
          </div>
        )}

        {!technicalScoreExpanded && (
          <div className="mt-auto pt-3 border-t border-white/[0.06]">
            {loadingTechnical ? (
              <div className="h-4 w-32 rounded bg-white/[0.06] animate-pulse" />
            ) : (
              <span className="text-xs text-white/30">
                {hasHistoricalData && previousScore !== null ? `Last period: ${previousScore}%` : 'Site structure analysis'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* AI Referral Traffic */}
      <div className="bg-[#161616]  rounded-xl p-5 min-h-[140px] flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-white/50 font-medium">AI Referral</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-white/30">
                <Info className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent sideOffset={8} className="max-w-xs">
              Traffic from AI chatbots
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex-1 flex flex-col justify-center">
          {loadingAiReferral ? (
            <div className="h-9 w-20 rounded bg-white/[0.06] animate-pulse" />
          ) : isTrackingConnected ? (
            <div className="flex items-end justify-between">
              <span className="text-[24px] font-medium text-white">{aiReferralTraffic.toLocaleString()}</span>
              {aiReferralDelta !== 0 ? (
                <span className={`text-xs flex items-center gap-0.5 ${aiReferralDelta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {aiReferralDelta > 0 ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                  {Math.abs(aiReferralDelta)}%
                </span>
              ) : (
                <span className="text-sm font-medium text-white/40">—</span>
              )}
            </div>
          ) : isConnecting ? (
            <div className="flex items-center gap-2">
              <div className="size-4 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
              <span className="text-sm text-white/50">Connecting...</span>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/40">Not connected</span>
              <Button 
                size="sm" 
                onClick={handleConnect}
                className="h-7 px-3 rounded-md bg-white text-black hover:bg-white/90 text-xs font-medium"
              >
                Connect
              </Button>
            </div>
          )}
        </div>
        <div className="mt-auto pt-3 border-t border-white/[0.06]">
          {loadingAiReferral ? (
            <div className="h-4 w-24 rounded bg-white/[0.06] animate-pulse" />
          ) : isTrackingConnected ? (
            <button
              className="text-xs text-white/30"
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
              View details →
            </button>
          ) : (
            <span className="text-xs text-white/30">2 min setup</span>
          )}
        </div>
      </div>

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
                      <div key={i} className="p-3 rounded-lg  bg-white/[0.02]">
                        <div className="h-4 w-12 rounded bg-white/[0.06] animate-pulse mb-2" />
                        <div className="h-6 w-8 rounded bg-white/[0.06] animate-pulse" />
                      </div>
                    ))
                  ) : (
                    mockReferralData.byModel.map((model) => (
                      <div key={model.name} className="p-3 rounded-lg  bg-white/[0.02]">
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
                  <pre className="rounded-lg  bg-black/20 p-4 pr-16 text-[11px] text-white/70 leading-relaxed overflow-x-auto">
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