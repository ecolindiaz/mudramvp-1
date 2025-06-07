"use client"

import { useState } from "react"
import { IconTrendingUp } from "@tabler/icons-react"
import { Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { mockCrawlerData } from "@/lib/mock/data"

interface CrawlerHealthScoreProps {
  score?: number
  change?: number
  trend?: "up" | "down"
  status?: string
}

export function CrawlerHealthScore({ 
  score = mockCrawlerData.overallAccessRate, 
  change = 7, 
  trend = "up",
  status = "Excellent crawl accessibility"
}: CrawlerHealthScoreProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Added mock data for metrics
  const metrics = [
    { label: "Bot Accessibility", value: "98%" },
    { label: "Crawl Efficiency", value: "92%" },
  ]

  return (
    <>
      <Card className="@container/card relative flex flex-col h-full bg-black">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start mb-8">
            <CardDescription className="text-base text-gray-400">Crawler Health Score</CardDescription>
            <Badge variant="outline" className="bg-black text-white border-gray-800">
              <IconTrendingUp className="w-4 h-4 mr-1" />
              +{change}%
            </Badge>
          </div>
          <div className="flex items-end">
            <CardTitle className="text-7xl font-semibold tabular-nums text-white">
              {score}%
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 pt-2 flex flex-col justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-white">{status}</p>
            <Progress value={score} className="h-1.5 bg-gray-900 [&>div]:bg-white" />
          </div>
          
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-400">Key Metrics</h4>
            <div className="grid grid-cols-2 gap-3">
              {metrics.map((metric, index) => (
                <div key={index} className="border border-white/20 rounded-xl p-4 bg-black/40">
                  <div className="text-lg font-semibold text-white">{metric.value}</div>
                  <div className="text-xs text-gray-400">{metric.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* More Info Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="mt-6 w-full bg-black hover:bg-gray-900 text-white border-gray-800"
          >
            <Info className="h-4 w-4 mr-2" />
            More Info
          </Button>
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Crawler Health Score
              <span className="text-2xl font-bold text-primary">{score}%</span>
            </DialogTitle>
            <DialogDescription>
              Detailed analysis of AI crawler accessibility and performance
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Progress Overview */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">{score}%</div>
                <div className="text-sm text-muted-foreground">Health Score</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">+{change}%</div>
                <div className="text-sm text-muted-foreground">This Month</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">Excellent</div>
                <div className="text-sm text-muted-foreground">Status</div>
              </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="space-y-4">
              <h4 className="font-semibold">Crawler Analysis</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <div className="font-medium">Bot Accessibility</div>
                    <div className="text-sm text-muted-foreground">AI bots can access your content</div>
                  </div>
                  <div className="text-green-600 font-semibold">Excellent</div>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <div className="font-medium">Crawl Efficiency</div>
                    <div className="text-sm text-muted-foreground">Speed and success rate</div>
                  </div>
                  <div className="text-green-600 font-semibold">Very Good</div>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <div className="font-medium">Content Indexing</div>
                    <div className="text-sm text-muted-foreground">How well content is indexed</div>
                  </div>
                  <div className="text-green-600 font-semibold">Good</div>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="space-y-4">
              <h4 className="font-semibold">Performance Metrics</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="text-lg font-semibold">2.1s</div>
                  <div className="text-sm text-muted-foreground">Average Crawl Time</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="text-lg font-semibold">1,247</div>
                  <div className="text-sm text-muted-foreground">Bot Visits Today</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="text-lg font-semibold">5</div>
                  <div className="text-sm text-muted-foreground">Unique Bots</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="text-lg font-semibold">98.5%</div>
                  <div className="text-sm text-muted-foreground">Success Rate</div>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="space-y-4">
              <h4 className="font-semibold">Recommendations</h4>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <div className="font-medium">Maintain Current Performance</div>
                    <div className="text-sm text-muted-foreground">Your crawler health is excellent, keep monitoring</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <div className="font-medium">Monitor Bot Activity</div>
                    <div className="text-sm text-muted-foreground">Keep tracking new AI crawlers and their behavior</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
} 