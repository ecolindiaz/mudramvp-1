"use client";

import React, { useEffect, useState } from "react";
import { BrandProfileProvider } from "@/components/brand-profile-context";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VisibilityTrendChart } from "@/components/visibility-trend-chart";
import { CompetitorInsightsChart } from "@/components/competitor-insights-chart";
import { ProviderPerformanceChart } from "@/components/provider-performance-chart";
import { RefreshCw, TrendingUp, Users, Zap, Target, AlertTriangle, Settings } from "lucide-react";
import { useBrandProfile } from "@/hooks/useBrandProfile";
import Link from "next/link";

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
  const { brandProfile, hasWebsite, loading: profileLoading } = useBrandProfile();

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
    if (score >= 60) return "text-green-600";
    if (score >= 30) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBadgeVariant = (score: number): "default" | "secondary" | "destructive" => {
    if (score >= 60) return "default";
    if (score >= 30) return "secondary";
    return "destructive";
  };

  return (
    <BrandProfileProvider>
      <SidebarProvider
        className="dark text-foreground"
        style={{
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties}
      >
        <AppSidebar />
        <SidebarInset className="bg-card dark:bg-card text-foreground dark:text-foreground m-0 shadow-none rounded-none border-none">
          <SiteHeader />
          <Separator className="w-full border-border" />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              {/* Page Header */}
              <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-2 md:pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight">AI Visibility Dashboard</h1>
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
              </div>

              {/* Main Content */}
              <div className="px-4 lg:px-6 pb-4 md:pb-6 space-y-6">
                {error && (
                  <Card className="border-red-200 bg-red-50">
                    <CardContent className="pt-6">
                      <div className="text-red-600">{error}</div>
                    </CardContent>
                  </Card>
                )}

                {/* Website Configuration Alert */}
                {!profileLoading && !hasWebsite && (
                  <Card className="border-yellow-200 bg-yellow-50">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-yellow-800 mb-1">
                            Website URL Required for AI Visibility Metrics
                          </h3>
                          <p className="text-sm text-yellow-700 mb-3">
                            To track your brand's AI visibility across platforms, we need your company website URL. 
                            Firegeo uses this to analyze how often your brand appears in AI responses.
                          </p>
                          <Link href="/dashboard/brand-profile">
                            <Button size="sm" variant="outline" className="border-yellow-300 text-yellow-800 hover:bg-yellow-100">
                              <Settings className="h-4 w-4 mr-2" />
                              Configure Website URL
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Website Tracking Info */}
                {!profileLoading && hasWebsite && brandProfile?.companyWebsite && (
                  <Card className="border-green-200 bg-green-50">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                        <div className="text-sm text-green-800">
                          <span className="font-medium">Tracking AI visibility for:</span> {brandProfile.companyWebsite}
                          {brandProfile.companyName && (
                            <span className="ml-2">({brandProfile.companyName})</span>
                          )}
                        </div>
                      </div>
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
                  {metrics.summary.avgVisibilityScore >= 60 ? 'Excellent' :
                   metrics.summary.avgVisibilityScore >= 30 ? 'Good' : 'Needs Improvement'}
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
              <VisibilityTrendChart data={metrics.visibilityTrend || []} />
            </div>
            
            <CompetitorInsightsChart data={metrics.competitorInsights || []} />
            <ProviderPerformanceChart data={metrics.providerPerformance || []} />
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
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </BrandProfileProvider>
  );
}
