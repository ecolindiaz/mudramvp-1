"use client"


import { CartesianGrid, Line, LineChart, XAxis, YAxis, Area, AreaChart, ResponsiveContainer } from "recharts"
import {
  RiArrowDownSFill,
  RiArrowRightSFill,
  RiArrowUpSFill,
} from '@remixicon/react'

import {
  Card,
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

export const description = "AI Visibility Metric trend over time"

const chartData = [
  { month: "January", visibility: 58 },
  { month: "February", visibility: 64 },
  { month: "March", visibility: 61 },
  { month: "April", visibility: 73 },
  { month: "May", visibility: 79 },
  { month: "June", visibility: 86 },
]

const chartConfig = {
  visibility: {
    label: "AI Visibility Score",
    color: "hsl(0, 0%, 100%)",
  },
} satisfies ChartConfig

export function AIVisibilityLineChart() {
  // Calculate trend from last two months
  const lastMonth = chartData[chartData.length - 1]
  const previousMonth = chartData[chartData.length - 2]
  const change = lastMonth.visibility - previousMonth.visibility
  const changePercent = Math.abs(change).toFixed(1)
  
  const getTrendIndicator = () => {
    if (change > 0) {
      return (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-x-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20 backdrop-blur-sm">
            <RiArrowUpSFill className="size-3.5" aria-hidden={true} />
            +{changePercent}%
          </span>
        </div>
      )
    } else if (change < 0) {
      return (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-x-1.5 rounded-full bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 ring-1 ring-red-500/20 backdrop-blur-sm">
            <RiArrowDownSFill className="size-3.5" aria-hidden={true} />
            -{changePercent}%
          </span>
        </div>
      )
    } else {
      return (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-x-1.5 rounded-full bg-gray-500/10 px-3 py-1.5 text-xs font-medium text-gray-400 ring-1 ring-gray-500/20 backdrop-blur-sm">
            <RiArrowRightSFill className="size-3.5" aria-hidden={true} />
            {changePercent}%
          </span>
        </div>
      )
    }
  }

  return (
    <Card className="bg-muted/50 dark:bg-muted/20">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-6">
        <div className="space-y-2">
          <CardTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
            AI Visibility Metric
          </CardTitle>
          <div className="flex items-center gap-3">
            <CardDescription className="text-sm text-muted-foreground/70">
              January - June 2024
            </CardDescription>
            <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
            <div className="text-sm font-medium text-muted-foreground/90">
              Current: {lastMonth.visibility}%
            </div>
          </div>
        </div>
        {getTrendIndicator()}
      </CardHeader>
      <CardContent className="min-h-[280px] px-3 pt-2 pb-4">
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 0,
              right: 10,
              top: 10,
              bottom: 8,
            }}
          >
            <defs>
              <linearGradient id="fillVisibility" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-visibility)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-visibility)"
                  stopOpacity={0.05}
                />
              </linearGradient>
            </defs>
            <CartesianGrid 
              vertical={false} 
              strokeDasharray="2 4" 
              opacity={0.15} 
              stroke="hsl(var(--muted-foreground))" 
            />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
              domain={[50, 95]}
              ticks={[50, 60, 70, 80, 90]}
              tickFormatter={(value) => `${value}%`}
            />
            <ChartTooltip
              cursor={{
                stroke: "var(--color-visibility)",
                strokeWidth: 1,
                strokeDasharray: "4 4",
                opacity: 0.5
              }}
              content={<ChartTooltipContent 
                hideLabel 
                formatter={(value) => [`${value}%`, "AI Visibility"]}
                className="bg-background/95 backdrop-blur border border-border/50"
              />}
            />
            <Area
              dataKey="visibility"
              type="monotone"
              fill="url(#fillVisibility)"
              fillOpacity={1}
              stroke="var(--color-visibility)"
              strokeWidth={3}
              dot={{
                fill: "var(--color-visibility)",
                strokeWidth: 2,
                r: 4,
                stroke: "#111827",
              }}
              activeDot={{
                r: 6,
                fill: "var(--color-visibility)",
                stroke: "#111827",
                strokeWidth: 3,
                filter: "drop-shadow(0 0 8px rgba(255, 255, 255, 0.4))"
              }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>

    </Card>
  )
} 