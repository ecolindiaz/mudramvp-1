"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ProviderData {
  name: string;
  totalQueries: number;
  avgPosition: number;
}

interface Props {
  data: ProviderData[];
}

export function ProviderPerformanceChart({ data }: Props) {
  // Handle null or undefined data
  if (!data || !Array.isArray(data)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Provider Performance</CardTitle>
          <CardDescription>
            Compare performance across different AI platforms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No provider data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map(provider => ({
    name: provider.name,
    queries: provider.totalQueries,
    position: provider.avgPosition,
    // Invert position for better visualization (lower position = better)
    invertedPosition: 10 - provider.avgPosition,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Provider Performance</CardTitle>
        <CardDescription>
          Compare performance across different AI platforms
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
                tickFormatter={(value) => `${value}`}
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
                              {label}
                            </span>
                            <span className="font-bold text-muted-foreground">
                              Total Queries: {data.queries}
                            </span>
                            <span className="text-muted-foreground">
                              Avg Position: {data.position}
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
                dataKey="queries" 
                fill="#82ca9d"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
