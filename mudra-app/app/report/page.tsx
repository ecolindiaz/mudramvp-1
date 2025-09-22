"use client"

import React, { useEffect, useState, Suspense } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { FloatingMudraButton } from "@/components/floating-mudra-button"
import { GeoResultsDisplay } from "@/components/dashboard/geo-results-display"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconLoader, IconSparkles, IconTrendingUp } from "@tabler/icons-react"
import { RefreshCw, TrendingUp, Users, Zap, Target } from "lucide-react"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { VisibilityTrendChart } from "@/components/visibility-trend-chart"
import { CompetitorInsightsChart } from "@/components/competitor-insights-chart"
import { ProviderPerformanceChart } from "@/components/provider-performance-chart"
import type { EnhancedGEOResult } from "@/lib/scrapers/enhanced-geo-scraper"

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

function ReportContent() {
  const [isRunning, setIsRunning] = useState(false)
  const [geoResults, setGeoResults] = useState<EnhancedGEOResult | null>(null)
  const [autoStarted, setAutoStarted] = useState(false)
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d')
  const [activeView, setActiveView] = useState<'analysis' | 'dashboard'>('analysis')
  
  const searchParams = useSearchParams()
  const router = useRouter()
  const magicRun = searchParams?.get('magic') === 'true'

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

  const runAnalysis = async (targetUrl?: string) => {
    const url = targetUrl || 
                (typeof window !== 'undefined' ? sessionStorage.getItem('magicAnalysisUrl') : null) || 
                "https://www.ycombinator.com/"
    
    setIsRunning(true)
    
    try {
      const siteName = new URL(url).hostname.replace('www.', '')
      toast.info("🎯 Magic Button Activated!", {
        description: `Running Enhanced GEO Analysis on ${siteName}...`
      })

      const response = await fetch('/api/run-scraper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })

      const result = await response.json()

      if (result.success) {
        toast.success("✨ Magic Analysis Complete!", {
          description: `${siteName} scored ${result.data.geoScore.overall}/100`
        })
        
        setGeoResults(result.data)
      } else {
        const errorMsg = result.error.message
        if (errorMsg.includes('timeout') || errorMsg.includes('408')) {
          toast.error("Analysis timed out", {
            description: "Website took too long to analyze. Please try again later."
          })
        } else if (errorMsg.includes('FIRECRAWL_API_KEY')) {
          toast.error("API key missing", {
            description: "Please configure your FIRECRAWL_API_KEY in the environment variables."
          })
        } else {
          toast.error("Analysis failed", {
            description: result.error.message
          })
        }
      }
    } catch (error) {
      console.error("Magic Button analysis failed:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      if (errorMessage.includes('timeout') || errorMessage.includes('fetch')) {
        toast.error("Network timeout", {
          description: "The magic analysis took too long. Please try again."
        })
      } else {
        toast.error("Magic analysis failed", {
          description: "Please check your connection and try again"
        })
      }
    } finally {
      setIsRunning(false)
    }
  }

  const generateTasks = () => {
    if (!geoResults) {
      toast.error("No analysis results available")
      return
    }

    sessionStorage.setItem('cachedGeoResults', JSON.stringify(geoResults))
    
    toast.info("🤖 Generating AI Tasks...", {
      description: "Navigating to tasks page with cached analysis"
    })
    
    router.push('/dashboard/tasks?cached=true')
  }

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

  useEffect(() => {
    fetchMetrics();
  }, [timeframe]);

  useEffect(() => {
    if (magicRun && !autoStarted && !isRunning) {
      setAutoStarted(true)
      runAnalysis()
    }
  }, [magicRun, autoStarted, isRunning])

  return (
    <SidebarProvider
      className="bg-dark-grey text-foreground"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset className="bg-dark-grey m-0 shadow-none rounded-none border-none">
        <SiteHeader />
        <Separator className="w-full border-border" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            {/* Page Header */}
            <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-2 md:pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-white">
                    Report
                  </h1>
                  <p className="text-muted-foreground">
                    Comprehensive website analysis and AI visibility insights
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {/* View Toggle */}
                  <div className="flex gap-2">
                    <Button
                      variant={activeView === 'analysis' ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveView('analysis')}
                    >
                      Website Analysis
                    </Button>
                    <Button
                      variant={activeView === 'dashboard' ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveView('dashboard')}
                    >
                      AI Visibility
                    </Button>
                  </div>
                  {magicRun && (
                    <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                      <IconSparkles className="w-3 h-3 mr-1" />
                      Magic Run
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-4 pb-4 md:gap-6 md:pb-6">
              {/* Website Analysis View */}
              {activeView === 'analysis' && (
                <div className="px-4 lg:px-6">
                  {!isRunning && !geoResults && (
                    <div className="text-center py-12">
                      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-primary/10 rounded-lg p-8 border border-primary/20">
                        <div className="space-y-4">
                          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
                            <IconTrendingUp className="w-8 h-8 text-primary" />
                          </div>
                          <h3 className="text-xl font-semibold text-foreground">Ready for Analysis</h3>
                          <p className="text-muted-foreground/80 max-w-md mx-auto leading-relaxed">
                            Start comprehensive website analysis to discover optimization opportunities and improve your digital presence.
                          </p>
                          <div className="pt-6">
                            <Button 
                              onClick={() => runAnalysis()}
                              className="gap-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-semibold px-8 py-3 h-auto rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                              disabled={isRunning}
                              size="lg"
                            >
                              <IconTrendingUp className="w-5 h-5" />
                              Start Analysis
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {isRunning && (
                    <div className="text-center py-12">
                      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-primary/10 rounded-lg p-8 border border-primary/20">
                        <div className="space-y-4">
                          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
                            <IconLoader className="w-8 h-8 text-primary animate-spin" />
                          </div>
                          <h3 className="text-xl font-semibold text-foreground">Running Analysis</h3>
                          <p className="text-muted-foreground/80 max-w-md mx-auto leading-relaxed">
                            Analyzing website structure, content, and SEO optimization. This may take 1-3 minutes.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {geoResults && (
                    <div className="space-y-6">
                      <GeoResultsDisplay result={geoResults} />
                      
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <IconTrendingUp className="w-5 h-5 text-blue-500" />
                            Ready for AI-Powered Optimization?
                          </CardTitle>
                          <CardDescription>
                            Generate personalized GEO improvement tasks based on this analysis
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                            <div className="space-y-1">
                              <p className="font-medium">Generate AI Tasks</p>
                              <p className="text-sm text-muted-foreground">
                                Get specific, actionable recommendations to improve your AI visibility score from {geoResults.geoScore.overall}/100
                              </p>
                            </div>
                            <Button onClick={generateTasks} className="shrink-0">
                              <IconTrendingUp className="w-4 h-4 mr-2" />
                              Generate Tasks
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              )}

              {/* AI Visibility Dashboard View */}
              {activeView === 'dashboard' && (
                <div className="px-4 lg:px-6 space-y-6">
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
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
      
      <FloatingMudraButton siteId={typeof window !== 'undefined' ? (localStorage.getItem('mudra:siteId') || '') : ''} />
    </SidebarProvider>
  )
}

export default function ReportPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="flex items-center gap-2">
          <IconLoader className="size-6 animate-spin" />
          <span>Loading Report...</span>
        </div>
      </div>
    }>
      <ReportContent />
    </Suspense>
  )
} 