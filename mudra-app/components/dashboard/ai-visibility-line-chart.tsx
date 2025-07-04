"use client"


import { CartesianGrid, Line, LineChart, XAxis, YAxis, Area, AreaChart, ResponsiveContainer } from "recharts"

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
  return (
    <Card className="bg-muted/50 dark:bg-muted/20">
      <CardHeader>
        <CardTitle className="text-lg">AI Visibility Metric</CardTitle>
        <CardDescription className="text-sm text-gray-400 mt-1">January - June 2024</CardDescription>
      </CardHeader>
      <CardContent className="min-h-[280px] px-2 py-0">
        <ChartContainer config={chartConfig} className="h-[285px] w-full">
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
              strokeDasharray="3 3" 
              opacity={0.2} 
              stroke="#4B5563" 
            />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 12, fill: '#9CA3AF' }}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 12, fill: '#9CA3AF' }}
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