"use client"

import { useState } from "react"
import { IconTrendingUp } from "@tabler/icons-react"
import { Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
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

interface ContentQualityScoreProps {
  score?: number
  change?: number
  trend?: "up" | "down"
  status?: string
  readability?: number
  authority?: number
  relevance?: number
}

export function ContentQualityScore({ 
  score = 78, 
  change = 2.1, 
  trend = "up",
  status = "AI-optimized content analysis across key quality metrics",
  readability = 85,
  authority = 72,
  relevance = 76
}: ContentQualityScoreProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Backend-ready metrics structure
  const metrics = [
    { label: "Readability", value: readability, description: "Content clarity and comprehension" },
    { label: "Authority", value: authority, description: "Source credibility and expertise" },
    { label: "Relevance", value: relevance, description: "Topic alignment and context" },
  ]

  return (
    <>
      <Card className="@container/card relative flex flex-col h-full bg-black">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start mb-8">
            <CardDescription className="text-base text-gray-400">Content Quality Score</CardDescription>
            <Badge variant="outline" className="bg-black text-white border-gray-800">
              <IconTrendingUp className="w-4 h-4 mr-1" />
              +{change}%
            </Badge>
          </div>
          <div className="flex items-end">
            <CardTitle className="text-5xl font-semibold tabular-nums text-white">
              {score}%
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 pt-2 flex flex-col justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-white">Good content optimization</p>
            <Progress value={score} className="h-1.5 bg-gray-900 [&>div]:bg-white" />
          </div>
          
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-400">Key Metrics</h4>
            <div className="grid grid-cols-3 gap-3">
              {metrics.map((metric, index) => (
                <div key={index} className="border border-white/20 rounded-xl p-4 bg-black/40">
                  <div className="text-lg font-semibold text-white">{metric.value}%</div>
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
              Content Quality Score
              <span className="text-2xl font-bold text-primary">{score}%</span>
            </DialogTitle>
            <DialogDescription>
              Detailed analysis of your content quality for AI optimization
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Progress Overview */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">{score}%</div>
                <div className="text-sm text-muted-foreground">Overall Score</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">+{change}%</div>
                <div className="text-sm text-muted-foreground">This Month</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">Good</div>
                <div className="text-sm text-muted-foreground">Status</div>
              </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="space-y-4">
              <h4 className="font-semibold">Quality Analysis</h4>
              <div className="space-y-3">
                {metrics.map((metric, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <div className="font-medium">{metric.label}</div>
                      <div className="text-sm text-muted-foreground">{metric.description}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{metric.value}%</div>
                      <div className="text-xs text-muted-foreground">
                        {metric.value >= 80 ? "Excellent" : metric.value >= 70 ? "Good" : "Needs Work"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="space-y-4">
              <h4 className="font-semibold">Content Metrics</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="text-lg font-semibold">1,247</div>
                  <div className="text-sm text-muted-foreground">Pages Analyzed</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="text-lg font-semibold">89%</div>
                  <div className="text-sm text-muted-foreground">AI Citability</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="text-lg font-semibold">156</div>
                  <div className="text-sm text-muted-foreground">Keywords Optimized</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="text-lg font-semibold">92%</div>
                  <div className="text-sm text-muted-foreground">Content Freshness</div>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="space-y-4">
              <h4 className="font-semibold">Recommendations</h4>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                  <div>
                    <div className="font-medium">Improve Authority Signals</div>
                    <div className="text-sm text-muted-foreground">Add more expert citations and credible sources</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <div className="font-medium">Enhance Content Depth</div>
                    <div className="text-sm text-muted-foreground">Provide more comprehensive coverage of topics</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <div className="font-medium">Maintain Readability</div>
                    <div className="text-sm text-muted-foreground">Continue producing clear, well-structured content</div>
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