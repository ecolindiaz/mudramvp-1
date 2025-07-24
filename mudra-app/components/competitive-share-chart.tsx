"use client"

import * as React from "react"
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const competitiveData = [
  { name: "Your Company", value: 18, color: "#8B5CF6" }, // Purple
  { name: "Competitor A", value: 25, color: "#F59E0B" }, // Orange  
  { name: "Competitor B", value: 22, color: "#10B981" }, // Green
  { name: "Competitor C", value: 15, color: "#3B82F6" }, // Blue
  { name: "Others", value: 20, color: "#6B7280" }, // Gray
]

const chartConfig = {
  competitiveShare: {
    label: "Market Share %",
  },
} satisfies ChartConfig

export function CompetitiveShareChart() {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null)

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-card-foreground">Competitive Share vs Competitors</CardTitle>
        <CardDescription className="text-muted-foreground">
          Market share distribution
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-6">
          <div className="w-full lg:w-1/2 relative">
            <ChartContainer
              config={chartConfig}
              className="h-48 lg:h-52 w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={competitiveData}
                    cx="50%"
                    cy="50%"
                    innerRadius="35%"
                    outerRadius="80%"
                    paddingAngle={2}
                    dataKey="value"
                    onMouseEnter={(_, index) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                  >
                    {competitiveData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color}
                        stroke={activeIndex === index ? "#ffffff" : "transparent"}
                        strokeWidth={activeIndex === index ? 2 : 0}
                        style={{
                          filter: activeIndex === index ? "brightness(1.1)" : "brightness(1)",
                          transition: "all 0.2s ease"
                        }}
                      />
                    ))}
                  </Pie>
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    formatter={(value, name) => [
                      `${value}%`,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-lg lg:text-xl font-bold text-card-foreground">18%</div>
                <div className="text-xs text-muted-foreground">Your Share</div>
              </div>
            </div>
          </div>
          <div className="w-full lg:w-1/2 space-y-2">
            {competitiveData.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-card-foreground font-medium text-sm truncate">{item.name}</span>
                </div>
                <span className="text-muted-foreground font-bold text-base ml-2 flex-shrink-0">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 