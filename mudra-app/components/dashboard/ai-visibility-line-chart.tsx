"use client"


import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

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
    <Card>
      <CardHeader className="pb-1 pt-5 px-5">
        <CardTitle className="text-lg font-semibold text-white">AI Visibility Trend</CardTitle>
        <CardDescription className="text-sm text-gray-400 mt-1">January - June 2024</CardDescription>
      </CardHeader>
      <CardContent className="px-2 py-0">
        <ChartContainer config={chartConfig} className="h-[285px] w-full">
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 0,
              right: 10,
              top: 10,
              bottom: 8,
            }}
          >
            <CartesianGrid vertical={false} strokeDasharray="2 2" opacity={0.4} stroke="#374151" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              domain={[50, 95]}
              ticks={[50, 60, 70, 80, 90]}
              tickFormatter={(value) => `${value}%`}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel formatter={(value) => [`${value}%`, "AI Visibility"]} />}
            />
            <Line
              dataKey="visibility"
              type="monotone"
              stroke="var(--color-visibility)"
              strokeWidth={2.5}
              dot={{
                fill: "var(--color-visibility)",
                strokeWidth: 0,
                r: 3.5,
                stroke: "transparent",
              }}
              activeDot={{
                r: 5,
                fill: "var(--color-visibility)",
                stroke: "#1f2937",
                strokeWidth: 2,
              }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>

    </Card>
  )
} 