"use client"

import { MetricCard } from "./metric-card"
import { mockTechnicalData } from "@/lib/mock/data"
import type { TimeRange } from "./time-range-selector"
import type { AIModel } from "./model-selector"

interface TechnicalStructureScoreProps {
  timeRange: TimeRange
  selectedModel: AIModel
}

export function TechnicalStructureScore({ timeRange, selectedModel }: TechnicalStructureScoreProps) {
  const { overallScore } = mockTechnicalData

  return (
    <MetricCard
      title="Technical Structure Score"
      value={`${overallScore}%`}
      status="Optimized"
      trend="up"
      icon="check"
      className="min-h-[280px] flex flex-col justify-start"
    />
  )
} 