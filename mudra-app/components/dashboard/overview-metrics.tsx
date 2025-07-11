"use client"

import { MetricCard } from "./metric-card"
import { mockOverviewMetrics } from "@/lib/mock/data"
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

  // Redirect handlers for each metric card
  const handleHumansReferredRedirect = () => {
    // TODO: Navigate to analytics/traffic page
    console.log("Redirecting to Humans Referred analytics page")
  }

  const handleTasksCompletedRedirect = () => {
    // TODO: Navigate to tasks page
    console.log("Redirecting to Tasks page")
  }

  const handleWeekGoalsRedirect = () => {
    // TODO: Navigate to goals/planning page
    console.log("Redirecting to Goals page")
  }

  const handleAIVisibilityRedirect = () => {
    // TODO: Navigate to AI visibility page
    console.log("Redirecting to AI Visibility page")
  }

  const handleContentQualityRedirect = () => {
    // TODO: Navigate to content quality page
    console.log("Redirecting to Content Quality page")
  }

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-3">
      <MetricCard
        title="Humans Referred from LLMs"
        value={humansReferredFromLLMs.current}
        status={humansReferredFromLLMs.status}
        trend={humansReferredFromLLMs.trend}
        icon="users"
        onRedirect={handleHumansReferredRedirect}
        redirectLabel="View"
      />
      
      <MetricCard
        title="Weekly Tasks Completed"
        value={weeklyTasksCompleted.current}
        status={weeklyTasksCompleted.status}
        trend={weeklyTasksCompleted.trend}
        icon="check"
        onRedirect={handleTasksCompletedRedirect}
        redirectLabel="View"
      />

      <MetricCard
        title="This Week Goals"
        value={thisWeekGoals.current}
        status={thisWeekGoals.status}
        trend={thisWeekGoals.trend}
        icon="target"
        onRedirect={handleWeekGoalsRedirect}
        redirectLabel="View"
        showGoalWidget={true}
        goalText="Boost AI Visibility 1.7%"
      />

      {showAll && (
        <>
          <MetricCard
            title="AI Visibility Score"
            value={aiVisibilityRank.current}
            status={aiVisibilityRank.status}
            trend={aiVisibilityRank.trend}
            icon="target"
            onRedirect={handleAIVisibilityRedirect}
            redirectLabel="View"
          />
          
          <MetricCard
            title="Content Quality Score"
            value={contentQualityScore.current}
            status={contentQualityScore.status}
            trend={contentQualityScore.trend}
            icon="check"
            onRedirect={handleContentQualityRedirect}
            redirectLabel="View"
          />
        </>
      )}
    </div>
  )
} 