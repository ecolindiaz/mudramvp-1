"use client"

import { MetricCard } from "./metric-card"
import { mockOverviewMetrics } from "@/lib/mock/data"
import type { TimeRange } from "./time-range-selector"

interface OverviewMetricsProps {
  showAll?: boolean
  timeRange: TimeRange
}

export function OverviewMetrics({ showAll = false, timeRange }: OverviewMetricsProps) {
  const { 
    humansReferredFromLLMs, 
    weeklyTasksCompleted,
    thisWeekGoals,
    aiVisibilityRank,
    contentQualityScore 
  } = mockOverviewMetrics

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-3">
      <MetricCard
        title="Humans Referred from LLMs"
        value={humansReferredFromLLMs.current}
        status={humansReferredFromLLMs.status}
        trend={humansReferredFromLLMs.trend}
        icon="users"
      />
      
      <MetricCard
        title="Weekly Tasks Completed"
        value={weeklyTasksCompleted.current}
        status={weeklyTasksCompleted.status}
        trend={weeklyTasksCompleted.trend}
        icon="check"
      />

      <MetricCard
        title="This Week Goals"
        value={thisWeekGoals.current}
        status={thisWeekGoals.status}
        trend={thisWeekGoals.trend}
        icon="target"
      />

      {showAll && (
        <>
          <MetricCard
            title="AI Visibility Score"
            value={aiVisibilityRank.current}
            status={aiVisibilityRank.status}
            trend={aiVisibilityRank.trend}
            icon="target"
          />
          
          <MetricCard
            title="Content Quality Score"
            value={contentQualityScore.current}
            status={contentQualityScore.status}
            trend={contentQualityScore.trend}
            icon="check"
          />
        </>
      )}
    </div>
  )
} 