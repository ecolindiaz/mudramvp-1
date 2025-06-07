"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

export const description = "AI Visibility Score across all models"

// Generate current month data dynamically
function generateCurrentMonthData() {
  const today = new Date()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  
  const data = []
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentYear, currentMonth, day)
    // Generate realistic AI Visibility scores between 75-95%
    const baseScore = 85
    const variation = Math.sin(day * 0.2) * 8 + Math.random() * 6 - 3
    const aiVisibility = Math.max(75, Math.min(95, baseScore + variation))
    
    data.push({
      date: date.toISOString().split('T')[0],
      aiVisibility: Math.round(aiVisibility * 10) / 10
    })
  }
  return data
}

// AI Visibility Score data - current month
const chartData = generateCurrentMonthData()

const chartConfig = {
  aiVisibility: {
    label: "AI Visibility Score",
    color: "hsl(142, 76%, 36%)", // Green color for better visibility
  },
} satisfies ChartConfig

// Simplified AI Visibility Score Button Component
function VisibilityScoreButton() {
  return (
    <div className="px-4 py-2 bg-card border rounded-lg text-center">
      <div className="text-xl font-bold">89.8%</div>
    </div>
  )
}

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("7d") // Default to 7 days
  const [prevIsMobile, setPrevIsMobile] = React.useState(isMobile)

  if (isMobile !== prevIsMobile) {
    setPrevIsMobile(isMobile)
    // Keep 7d as default even on mobile
  }

  const filteredData = chartData.filter((item) => {
    const date = new Date(item.date)
    const today = new Date()
    let daysToSubtract = 90
    if (timeRange === "30d") {
      daysToSubtract = 30
    } else if (timeRange === "7d") {
      daysToSubtract = 7
    }
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - daysToSubtract)
    return date >= startDate
  })

  return (
    <Card className="@container/card">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-8">
            <div>
              <CardTitle>AI Visibility Metric</CardTitle>
              <CardDescription className="mt-1.5">
                <span className="hidden @[540px]/card:block">
                  Overall AI visibility score across all models
                </span>
                <span className="@[540px]/card:hidden">AI visibility score</span>
              </CardDescription>
            </div>
            <VisibilityScoreButton />
          </div>
          <CardAction>
            <ToggleGroup
              type="single"
              value={timeRange}
              onValueChange={setTimeRange}
              variant="outline"
              className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
            >
              <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
              <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
              <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
            </ToggleGroup>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger
                className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
                size="sm"
                aria-label="Select a value"
              >
                <SelectValue placeholder="Last 7 days" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="90d" className="rounded-lg">
                  Last 3 months
                </SelectItem>
                <SelectItem value="30d" className="rounded-lg">
                  Last 30 days
                </SelectItem>
                <SelectItem value="7d" className="rounded-lg">
                  Last 7 days
                </SelectItem>
              </SelectContent>
            </Select>
          </CardAction>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillAiVisibility" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-aiVisibility)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-aiVisibility)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("en-US", {
                  day: "numeric",
                })
              }}
            />
            <YAxis
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `${value}%`}
            />
            <ChartTooltip
              cursor={false}
              defaultIndex={isMobile ? -1 : 3}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }}
                  indicator="dot"
                  formatter={(value) => [`${value}%`, "AI Visibility Score"]}
                />
              }
            />
            <Area
              dataKey="aiVisibility"
              type="natural"
              fill="url(#fillAiVisibility)"
              stroke="var(--color-aiVisibility)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
