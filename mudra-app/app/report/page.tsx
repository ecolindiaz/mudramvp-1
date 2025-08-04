"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VisibilityTrendChart } from "@/components/visibility-trend-chart";
import { CompetitorInsightsChart } from "@/components/competitor-insights-chart";
import { ProviderPerformanceChart } from "@/components/provider-performance-chart";
import { RefreshCw, TrendingUp, Users, Zap, Target } from "lucide-react";

interface DashboardMetrics {
  timeframe: string;
  summary: {
    totalAnalyses: number;
    totalMessages: number;
    totalConversations: number;
    totalCreditsUsed: number;
    avgVisibilityScore: number;
  };
  visibilityTrend: Array<{
    date: string;
    companyName: string;
    visibilityScore: number;
    shareOfVoice: number;
    averagePosition: number;
    competitorCount: number;
  }>;
  competitorInsights: Array<{
    name: string;
    appearances: number;
    avgVisibilityScore: number;
  }>;
  providerPerformance: Array<{
    name: string;
    totalQueries: number;
    avgPosition: number;
  }>;
  recentActivity: any[];
}

export default function ReportPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d');

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/firegeo/metrics?timeframe=${timeframe}&competitors=true`);
      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }
      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError("Failed to fetch AI visibility metrics");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [timeframe]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBadgeVariant = (score: number): "default" | "secondary" | "destructive" => {
    if (score >= 80) return "default";
    if (score >= 60) return "secondary";
    return "destructive";
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Visibility Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your brand's performance across AI platforms and chat interfaces
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            {(['7d', '30d', '90d'] as const).map((period) => (
              <Button
                key={period}
                variant={timeframe === period ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeframe(period)}
              >
                {period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : '90 Days'}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMetrics}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-red-600">{error}</div>
          </CardContent>
        </Card>
      )}

      {loading && !metrics && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {metrics && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Avg Visibility Score
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getScoreColor(metrics.summary.avgVisibilityScore)}`}>
                  {metrics.summary.avgVisibilityScore.toFixed(1)}%
                </div>
                <Badge variant={getScoreBadgeVariant(metrics.summary.avgVisibilityScore)} className="mt-2">
                  {metrics.summary.avgVisibilityScore >= 80 ? 'Excellent' : 
                   metrics.summary.avgVisibilityScore >= 60 ? 'Good' : 'Needs Improvement'}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Analyses
                </CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.summary.totalAnalyses}</div>
                <p className="text-xs text-muted-foreground">
                  Brand monitoring sessions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  AI Conversations
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.summary.totalConversations}</div>
                <p className="text-xs text-muted-foreground">
                  {metrics.summary.totalMessages} total messages
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Credits Used
                </CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.summary.totalCreditsUsed}</div>
                <p className="text-xs text-muted-foreground">
                  API usage credits
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <VisibilityTrendChart data={metrics.visibilityTrend} />
            </div>
            
            <CompetitorInsightsChart data={metrics.competitorInsights} />
            <ProviderPerformanceChart data={metrics.providerPerformance} />
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Analysis Results</CardTitle>
              <CardDescription>
                Latest AI visibility assessments and insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.visibilityTrend.length > 0 ? (
                <div className="space-y-4">
                  {metrics.visibilityTrend.slice(0, 3).map((item, index) => (
                    <div key={index} className="flex items-center justify-between border-b pb-4 last:border-b-0">
                      <div>
                        <div className="font-medium">{item.companyName}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(item.date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-medium ${getScoreColor(item.visibilityScore)}`}>
                          {item.visibilityScore}% visibility
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Position {item.averagePosition.toFixed(1)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No recent activity to display
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
