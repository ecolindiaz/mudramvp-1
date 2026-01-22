"use client"

import React, { useEffect, useState, Suspense } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { GeoResultsDisplay } from "@/components/dashboard/geo-results-display"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconLoader, IconSparkles, IconTrendingUp } from "@tabler/icons-react"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import type { EnhancedGEOResult } from "@/lib/scrapers/enhanced-geo-scraper"

function ReportContent() {
  const [isRunning, setIsRunning] = useState(false)
  const [geoResults, setGeoResults] = useState<EnhancedGEOResult | null>(null)
  const [autoStarted, setAutoStarted] = useState(false)
  
  const searchParams = useSearchParams()
  const router = useRouter()
  const magicRun = searchParams?.get('magic') === 'true'

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
          description: `${siteName} scored ${result.data.geoScore.overall}/100 and saved to database`
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
              {/* Website Analysis Content */}
              <div className="px-4 lg:px-6">
                {!isRunning && !geoResults && (
                  <div className="text-center py-12">
                    <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-primary/10 rounded-lg p-8 border border-primary/20">
                      <div className="space-y-4">
                        <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
                          <IconTrendingUp className="w-8 h-8 text-primary" />
                        </div>
                        <h3 className="text-xl font-semibold text-foreground">Ready to Analyze</h3>
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
                            <h4 className="font-medium">Generate Improvement Tasks</h4>
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
            </div>
          </div>
        </div>
      </SidebarInset>
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