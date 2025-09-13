"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { FloatingMudraButton } from "@/components/floating-mudra-button"
import { GeoResultsDisplay } from "@/components/dashboard/geo-results-display"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconLoader, IconSparkles, IconCheck, IconTrendingUp } from "@tabler/icons-react"
import { useEffect, useState, Suspense } from "react"
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
    // Get URL from parameter, sessionStorage, or fallback to Y Combinator
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
          description: `Y Combinator scored ${result.data.geoScore.overall}/100`
        })
        
        setGeoResults(result.data)
      } else {
        const errorMsg = result.error.message
        if (errorMsg.includes('timeout') || errorMsg.includes('408')) {
          toast.error("Analysis timed out", {
            description: "Y Combinator took too long to analyze. Please try again later."
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

    // Store the GEO results in sessionStorage for the tasks page
    sessionStorage.setItem('cachedGeoResults', JSON.stringify(geoResults))
    
    toast.info("🤖 Generating AI Tasks...", {
      description: "Navigating to tasks page with cached analysis"
    })
    
    // Navigate to tasks page
    router.push('/dashboard/tasks?cached=true')
  }

  // Auto-start analysis when coming from Magic Button
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
                  <p className="text-white/70">
                    Comprehensive website analysis and performance insights
                  </p>
                </div>
                {magicRun && (
                  <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                    <IconSparkles className="w-3 h-3 mr-1" />
                    Magic Run
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex flex-col gap-4 pb-4 md:gap-6 md:pb-6">
              {/* Ready for Analysis Container */}
              <div className="px-4 lg:px-6">
                {!isRunning && !geoResults && (
                  <div className="text-center py-10 md:py-12">
                    <div className="rounded-2xl p-8 border border-white/10 bg-white/[0.02] backdrop-blur-sm">
                      <div className="space-y-4">
                        <div className="w-14 h-14 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-3">
                          <IconTrendingUp className="w-6 h-6 text-primary" />
                        </div>
                        <h3 className="text-lg md:text-xl font-semibold text-white">Ready for Analysis</h3>
                        <p className="text-white/70 max-w-md mx-auto leading-relaxed">
                          Start comprehensive website analysis to discover optimization opportunities and improve your digital presence.
                        </p>
                        <div className="pt-5">
                          <Button 
                            onClick={() => runAnalysis()}
                            className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-medium px-6 py-2.5 h-auto rounded-xl shadow-sm hover:shadow-md transition-all"
                            disabled={isRunning}
                            size="lg"
                          >
                            <IconTrendingUp className="w-4 h-4" />
                            Start Analysis
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {isRunning && (
                  <div className="text-center py-10 md:py-12">
                    <div className="rounded-2xl p-8 border border-white/10 bg-white/[0.02] backdrop-blur-sm">
                      <div className="space-y-4">
                        <div className="w-14 h-14 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-3">
                          <IconLoader className="w-6 h-6 text-primary animate-spin" />
                        </div>
                        <h3 className="text-lg md:text-xl font-semibold text-white">Running Analysis</h3>
                        <p className="text-white/70 max-w-md mx-auto leading-relaxed">
                          Analyzing website structure, content, and SEO optimization. This may take 1-3 minutes.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Results Display */}
              {geoResults && (
                <div className="px-4 lg:px-6 space-y-6">
                  <GeoResultsDisplay result={geoResults} />
                  
                  {/* Generate Tasks Button */}
                  <Card className="bg-white/[0.02] border-white/10 rounded-2xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-white">
                        <IconTrendingUp className="w-5 h-5 text-primary" />
                        Ready for AI‑Powered Optimization?
                      </CardTitle>
                      <CardDescription className="text-white/70">
                        Generate personalized GEO improvement tasks based on this analysis
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/10 rounded-xl">
                        <div className="space-y-1">
                          <p className="font-medium text-white">Generate AI Tasks</p>
                          <p className="text-sm text-white/70">
                            Get specific, actionable recommendations to improve your AI visibility score from {geoResults.geoScore.overall}/100
                          </p>
                        </div>
                        <Button onClick={generateTasks} className="shrink-0 h-9 rounded-xl gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
                          <IconTrendingUp className="w-4 h-4" />
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
          <span>Loading Magic Report...</span>
        </div>
      </div>
    }>
      <ReportContent />
    </Suspense>
  )
} 