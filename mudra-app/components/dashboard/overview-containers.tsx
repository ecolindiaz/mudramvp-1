"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TechnicalStructureScore } from "./technical-structure-score"
import { ContentQualityScore } from "./content-quality-score"
import type { TimeRange } from "./time-range-selector"
import type { AIModel } from "./model-selector"

interface OverviewContainersProps {
  timeRange: TimeRange
  selectedModel: AIModel
}

export function OverviewContainers({ timeRange, selectedModel }: OverviewContainersProps) {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2">
      {/* Top Row - AI Visibility Containers */}
      <Card className="bg-muted/50 dark:bg-muted/20">
        <CardHeader>
          <CardTitle className="text-lg">AI Visibility Metric</CardTitle>
        </CardHeader>
        <CardContent className="min-h-[280px]">
          {/* Content will be added later */}
        </CardContent>
      </Card>

      <Card className="bg-muted/50 dark:bg-muted/20">
        <CardHeader>
          <CardTitle className="text-lg">AI Visibility Rank</CardTitle>
        </CardHeader>
        <CardContent className="min-h-[280px]">
          {/* Content will be added later */}
        </CardContent>
      </Card>

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
  )
} 