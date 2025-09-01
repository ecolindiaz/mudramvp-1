"use client"

import { DashboardStatCard } from "./dashboard-stat-card"
import { mockOverviewMetrics, mockDashboardMetrics } from "@/lib/mock/data"
import type { TimeRange } from "./time-range-selector"
import type { AIModel } from "./model-selector"
import { useState, useEffect } from "react"
import { toScrapeSnapshot } from "@/lib/analysis/technical/adapter"
import { validateScrapeSnapshot } from "@/lib/analysis/technical/validate"

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

  // State for dynamic technical score
  const [technicalScore, setTechnicalScore] = useState(mockDashboardMetrics.technicalScore.current)
  const [isGeneratingScore, setIsGeneratingScore] = useState(false)

  // Fetch latest score from database
  const fetchLatestScore = async () => {
    try {
      const response = await fetch('/api/scores?siteId=test-site-1')
      const result = await response.json()
      
      if (result.success && result.data.score) {
        setTechnicalScore(result.data.score.total)
      }
    } catch (error) {
      console.error('Error fetching latest score:', error)
    }
  }

  // Initial score fetch
  useEffect(() => {
    fetchLatestScore()
  }, [])

  // Listen for generate score event
  useEffect(() => {
    const handleGenerateScore = async () => {
      try {
        setIsGeneratingScore(true)
        
        // Load the test scraper data
        const response = await fetch('/test-data.json')
        const rawData = await response.json()
        
        // Convert to snapshot
        const snapshot = toScrapeSnapshot(rawData)
        
        // Validate snapshot
        const validation = validateScrapeSnapshot(snapshot)
        if (!validation.ok) {
          console.error('Snapshot validation failed:', validation.errors)
          return
        }

        // Call score API (now saves to database)
        const scoreResponse = await fetch('/api/technical-analysis/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshot, siteId: 'test-site-1' })
        })

        if (!scoreResponse.ok) {
          throw new Error(`Score API failed: ${scoreResponse.status}`)
        }

        const { data: scoreResult } = await scoreResponse.json()
        setTechnicalScore(scoreResult.total)
        
        console.log('✅ Score generated successfully:', scoreResult)
      } catch (error) {
        console.error('❌ Error generating score:', error)
      } finally {
        setIsGeneratingScore(false)
      }
    }

    window.addEventListener('mudra:generate-score', handleGenerateScore)
    return () => window.removeEventListener('mudra:generate-score', handleGenerateScore)
  }, [])

  return (
    <div className="grid grid-cols-1 gap-4 md:gap-5 px-4 lg:px-6 @xl/main:grid-cols-3">
      <DashboardStatCard
        title="AI Visibility Metric"
        value={aiVisibilityRank.current}
        delta={aiVisibilityRank.change}
        lastValue={aiVisibilityRank.previous}
        positive={aiVisibilityRank.trend === "up"}
        sparkline={[58,64,61,73,79,86]}
        accentColor="rgba(255,255,255,0.9)"
        info="Amount of times mentioned, referenced, cited, or included in AI responses across the prompts we query."
      />

      <DashboardStatCard
        title="Technical Structure Score"
        value={isGeneratingScore ? 0 : technicalScore}
        delta={mockDashboardMetrics.technicalScore.change}
        lastValue={mockDashboardMetrics.technicalScore.previous}
        positive={mockDashboardMetrics.technicalScore.trend === "up"}
        sparkline={[78,80,82,83,84,85]}
        accentColor="rgba(255,255,255,0.9)"
        info={isGeneratingScore ? "Calculating score..." : "How well your site is optimized for AI and SEO."}
      />

      <DashboardStatCard
        title="Organic Traffic"
        value={humansReferredFromLLMs.current}
        delta={humansReferredFromLLMs.change}
        lastValue={humansReferredFromLLMs.previous}
        positive={humansReferredFromLLMs.trend === "up"}
        sparkline={[120,180,210,190,230,247]}
        accentColor="rgba(255,255,255,0.9)"
        info="Traffic volume over time from your analytics sources."
      />
    </div>
  )
} 