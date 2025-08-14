"use client"

import { DashboardStatCard } from "./dashboard-stat-card"
import { mockOverviewMetrics, mockDashboardMetrics } from "@/lib/mock/data"
import type { TimeRange } from "./time-range-selector"
import type { AIModel } from "./model-selector"

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

  // helpers
  const technicalScore = mockDashboardMetrics.technicalScore.current

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
        value={technicalScore}
        delta={mockDashboardMetrics.technicalScore.change}
        lastValue={mockDashboardMetrics.technicalScore.previous}
        positive={mockDashboardMetrics.technicalScore.trend === "up"}
        sparkline={[78,80,82,83,84,85]}
        accentColor="rgba(255,255,255,0.9)"
        info="How well your site is optimized for AI and SEO."
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