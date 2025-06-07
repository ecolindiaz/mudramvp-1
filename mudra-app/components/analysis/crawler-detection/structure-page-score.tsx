"use client"

import { useState } from "react"
import { TrendingUp, Info } from "lucide-react"
import { Label, PolarRadiusAxis, RadialBar, RadialBarChart } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

const chartData = [{ month: "current", optimized: 85, issues: 15 }]

const chartConfig = {
  optimized: {
    label: "Optimized",
    color: "#FFFFFF",
  },
  issues: {
    label: "Issues",
    color: "#27272A",
  },
} satisfies ChartConfig

// Added mock data for structure metrics
const structureMetrics = [
  { name: "Schema Markup", status: "Good", score: 92 },
  { name: "URL Structure", status: "Excellent", score: 95 },
  { name: "Meta Tags", status: "Needs Work", score: 68 },
]

export function StructurePageScore() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <Card className="flex flex-col relative h-full bg-black">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start mb-4">
            <div>
              <CardDescription className="text-gray-400">Structure Page Score</CardDescription>
              <CardTitle className="text-white">Technical optimization metrics</CardTitle>
            </div>
            <Badge variant="outline" className="bg-black text-white border-gray-800">
              <TrendingUp className="h-3 w-3 mr-1" />+3.2%
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col p-0 pt-2">
          <div className="grid grid-cols-5 gap-4 w-full flex-1">
            <div className="col-span-3 flex items-center justify-center">
              <ChartContainer
                config={chartConfig}
                className="mx-auto aspect-square w-full max-w-[230px]"
              >
                <RadialBarChart
                  data={chartData}
                  endAngle={180}
                  innerRadius={70}
                  outerRadius={110}
                >
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                    <Label
                      content={({ viewBox }) => {
                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                          return (
                            <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy || 0) - 12}
                                className="fill-white text-2xl font-bold"
                              >
                                {chartData[0].optimized}%
                              </tspan>
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy || 0) + 8}
                                className="fill-gray-400 text-sm"
                              >
                                Score
                              </tspan>
                            </text>
                          )
                        }
                      }}
                    />
                  </PolarRadiusAxis>
                  <RadialBar
                    dataKey="optimized"
                    stackId="a"
                    cornerRadius={5}
                    fill="#FFFFFF"
                    className="stroke-transparent stroke-2"
                  />
                  <RadialBar
                    dataKey="issues"
                    fill="#27272A"
                    stackId="a"
                    cornerRadius={5}
                    className="stroke-transparent stroke-2"
                  />
                </RadialBarChart>
              </ChartContainer>
            </div>
            <div className="col-span-2 flex flex-col justify-center space-y-3 pr-4">
              {structureMetrics.map((metric, index) => (
                <div key={index} className="border border-white/20 rounded-xl p-4 bg-black/40">
                  <div className="text-lg font-semibold text-white">{metric.score}%</div>
                  <div className="text-xs text-gray-400">{metric.name}</div>
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
              Structure Page Score
              <span className="text-2xl font-bold text-primary">85%</span>
            </DialogTitle>
            <DialogDescription>
              Detailed analysis of your page structure optimization for AI crawlers
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Progress Overview */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">85%</div>
                <div className="text-sm text-muted-foreground">Optimized</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">15%</div>
                <div className="text-sm text-muted-foreground">Issues</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">Good</div>
                <div className="text-sm text-muted-foreground">Status</div>
              </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="space-y-4">
              <h4 className="font-semibold">Structure Analysis</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <div className="font-medium">Schema Markup</div>
                    <div className="text-sm text-muted-foreground">Structured data implementation</div>
                  </div>
                  <div className="text-white font-semibold">Excellent</div>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <div className="font-medium">URL Structure</div>
                    <div className="text-sm text-muted-foreground">Clean and semantic URLs</div>
                  </div>
                  <div className="text-white font-semibold">Good</div>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <div className="font-medium">Internal Linking</div>
                    <div className="text-sm text-muted-foreground">Navigation and link structure</div>
                  </div>
                  <div className="text-white font-semibold">Needs Work</div>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="space-y-4">
              <h4 className="font-semibold">Recommendations</h4>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 bg-black/40 border border-white/20 rounded-lg">
                  <div className="w-2 h-2 bg-white rounded-full mt-2"></div>
                  <div>
                    <div className="font-medium text-white">Improve Internal Linking</div>
                    <div className="text-sm text-gray-400">Add more contextual links between related pages</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-black/40 border border-white/20 rounded-lg">
                  <div className="w-2 h-2 bg-white rounded-full mt-2"></div>
                  <div>
                    <div className="font-medium text-white">Optimize Meta Tags</div>
                    <div className="text-sm text-gray-400">Enhance meta descriptions for better AI understanding</div>
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