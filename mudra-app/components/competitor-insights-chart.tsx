"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CompetitorData {
  name: string;
  appearances: number;
  avgVisibilityScore: number;
}

interface Props {
  data: CompetitorData[];
}

export function CompetitorInsightsChart({ data }: Props) {
  // Handle null or undefined data
  if (!data || !Array.isArray(data)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Competitor Performance</CardTitle>
          <CardDescription>
            No competitor data available
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No data to display
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map(competitor => ({
    name: competitor.name.length > 12 ? 
      competitor.name.substring(0, 12) + '...' : 
      competitor.name,
    fullName: competitor.name,
    score: competitor.avgVisibilityScore,
    appearances: competitor.appearances,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Competitor Performance</CardTitle>
        <CardDescription>
          See how competitors perform in AI search results
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis 
                dataKey="name" 
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="grid gap-2">
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              {data.fullName}
                            </span>
                            <span className="font-bold text-muted-foreground">
                              Avg Score: {data.score}%
                            </span>
                            <span className="text-muted-foreground">
                              Appearances: {data.appearances}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar 
                dataKey="score" 
                fill="#8884d8"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
