"use client"

import { DashboardStatCard } from "./dashboard-stat-card"
import { mockOverviewMetrics, mockDashboardMetrics } from "@/lib/mock/data"
import type { TimeRange } from "./time-range-selector"
import type { AIModel } from "./model-selector"
import { useState, useEffect } from "react"
import { useBrandProfile } from "@/components/brand-profile-context"

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

  return (
    <div className="grid grid-cols-1 gap-4 md:gap-5 px-4 lg:px-6 @xl/main:grid-cols-2 @4xl/main:grid-cols-3">
      <DashboardStatCard
        title="AI Visibility Score"
        value={aiVisibilityScore}
        delta={aiVisibilityDelta}
        lastValue={hasAiHistory && aiVisibilityPrevious !== null ? aiVisibilityPrevious : 0}
        positive={aiVisibilityScore > (aiVisibilityPrevious || 0)}
        sparkline={aiVisibilityScore > 0 ? [0, Math.max(10, aiVisibilityScore * 0.5), Math.max(20, aiVisibilityScore * 0.7), aiVisibilityScore] : [0]}
        accentColor="rgba(255,255,255,0.9)"
        info="Overall brand visibility combining mention rate (50%) and average ranking (50%) across all AI providers. Firegeo methodology."
      />

      <DashboardStatCard
        title="Share of Voice"
        value={mentionRate}
        suffix="%"
        delta={0}
        lastValue={0}
        positive={true}
        sparkline={mentionRate > 0 ? [0, Math.max(10, mentionRate * 0.6), Math.max(20, mentionRate * 0.8), mentionRate] : [0]}
        accentColor="rgba(147, 197, 253, 0.9)"
        info={`Brand mentioned in ${mentionRate}% of AI responses across ${totalTests} total tests. Higher is better.`}
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
      />

      <DashboardStatCard
        title="Technical Structure Score"
        value={isGeneratingScore ? 0 : technicalScore}
        delta={hasHistoricalData && previousScore !== null ? Math.round(((technicalScore - previousScore) / previousScore) * 100) : 0}
        lastValue={hasHistoricalData && previousScore !== null ? previousScore : 0}
        positive={hasHistoricalData && previousScore !== null ? technicalScore > previousScore : true}
        sparkline={hasHistoricalData ? undefined : technicalScore > 0 ? [0, Math.max(10, technicalScore * 0.6), Math.max(20, technicalScore * 0.8), technicalScore] : [0]}
        accentColor="rgba(255,255,255,0.9)"
        info={isGeneratingScore ? "Calculating score..." : "How well your site is optimized for AI and SEO."}
      />
    </div>
  )
} 