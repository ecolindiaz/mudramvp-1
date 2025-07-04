"use client"

import { MetricCard } from "./metric-card"
import { mockContentData } from "@/lib/mock/data"
import type { TimeRange } from "./time-range-selector"
import type { AIModel } from "./model-selector"

interface ContentQualityScoreProps {
  timeRange: TimeRange
  selectedModel: AIModel
}

export function ContentQualityScore({ timeRange, selectedModel }: ContentQualityScoreProps) {
  const { overallScore } = mockContentData

  return (
    <MetricCard
      title="Content Quality Score"
      value={`${overallScore}%`}
      status="Improving"
      trend="up"
      icon="trending-up"
      className="min-h-[280px] flex flex-col justify-start"
    />
  )
} 