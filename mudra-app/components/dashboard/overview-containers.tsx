"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function OverviewContainers() {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2">
      {/* AI Visibility Metric Container */}
      <Card className="bg-muted/50 dark:bg-muted/20">
        <CardHeader>
          <CardTitle className="text-lg">AI Visibility Metric</CardTitle>
        </CardHeader>
        <CardContent className="min-h-[280px]">
          {/* Content will be added later */}
        </CardContent>
      </Card>

      {/* AI Visibility Rank Container */}
      <Card className="bg-muted/50 dark:bg-muted/20">
        <CardHeader>
          <CardTitle className="text-lg">AI Visibility Rank</CardTitle>
        </CardHeader>
        <CardContent className="min-h-[280px]">
          {/* Content will be added later */}
        </CardContent>
      </Card>
    </div>
  )
} 