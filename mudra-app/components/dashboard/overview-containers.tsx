"use client"

import { TechnicalStructureScore } from "./technical-structure-score"
import { ContentQualityScore } from "./content-quality-score"
import { AIVisibilityLineChart } from "./ai-visibility-line-chart"
import { AIVisibilityRank } from "./ai-visibility-rank"
import { AIVisibilityProvider } from "@/contexts/ai-visibility-context"
import type { TimeRange } from "./time-range-selector"
import type { AIModel } from "./model-selector"

interface OverviewContainersProps {
  timeRange: TimeRange
  selectedModel: AIModel
}

export function OverviewContainers({ timeRange, selectedModel }: OverviewContainersProps) {
  return (
    <AIVisibilityProvider>
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2">
        {/* Top Row - AI Visibility Containers */}
        <AIVisibilityLineChart />

        <AIVisibilityRank 
          timeRange={timeRange}
          selectedModel={selectedModel}
        />

        {/* Bottom Row - Score Components */}
        <TechnicalStructureScore 
          timeRange={timeRange}
          selectedModel={selectedModel}
        />
        
        <ContentQualityScore 
          timeRange={timeRange}
          selectedModel={selectedModel}
        />
      </div>
    </AIVisibilityProvider>
  )
} 