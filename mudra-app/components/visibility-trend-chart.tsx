"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface VisibilityTrendData {
  date: string;
  companyName: string;
  visibilityScore: number;
  shareOfVoice: number;
  averagePosition: number;
  competitorCount: number;
}

interface Props {
  data: VisibilityTrendData[];
}

export function VisibilityTrendChart({ data }: Props) {
  // Handle null or undefined data
  if (!data || !Array.isArray(data)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Visibility Score Trend</CardTitle>
          <CardDescription>
            Track your visibility performance over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No trend data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map(item => ({
    date: new Date(item.date).toLocaleDateString(),
    score: item.visibilityScore,
    shareOfVoice: item.shareOfVoice,
    position: item.averagePosition,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Visibility Score Trend</CardTitle>
        <CardDescription>
          Track your brand's visibility across AI platforms over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis 
                dataKey="date" 
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
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="grid gap-2">
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              {label}
                            </span>
                            <span className="font-bold text-muted-foreground">
                              Visibility Score: {payload[0].value}%
                            </span>
                            {payload[1] && (
                              <span className="text-muted-foreground">
                                Share of Voice: {payload[1].value}%
                              </span>
                            )}
                            {payload[2] && (
                              <span className="text-muted-foreground">
                                Avg Position: {payload[2].value}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                strokeWidth={2}
                stroke="#8884d8"
                activeDot={{
                  r: 6,
                  style: { fill: "#8884d8" },
                }}
              />
              <Line
                type="monotone"
                dataKey="shareOfVoice"
                strokeWidth={2}
                stroke="#82ca9d"
                activeDot={{
                  r: 4,
                  style: { fill: "#82ca9d" },
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
