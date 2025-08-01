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
import { IconLoader, IconSparkles, IconCheck } from "@tabler/icons-react"
import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import type { EnhancedGEOResult } from "@/lib/scrapers/enhanced-geo-scraper"

function ReportContent() {
  const [isRunning, setIsRunning] = useState(false)
  const [geoResults, setGeoResults] = useState<EnhancedGEOResult | null>(null)
  const [autoStarted, setAutoStarted] = useState(false)
  
  const searchParams = useSearchParams()
  const magicRun = searchParams?.get('magic') === 'true'

  const runYCombinatorAnalysis = async () => {
    const url = "https://www.ycombinator.com/"
    setIsRunning(true)
    
    try {
      toast.info("🎯 Magic Button Activated!", {
        description: `Running Enhanced GEO Analysis on Y Combinator...`
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

  // Auto-start analysis when coming from Magic Button
  useEffect(() => {
    if (magicRun && !autoStarted && !isRunning) {
      setAutoStarted(true)
      runYCombinatorAnalysis()
    }
  }, [magicRun, autoStarted, isRunning])

  return (
    <SidebarProvider
      className="dark text-foreground"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
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
                  <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <IconSparkles className="w-6 h-6 text-yellow-500" />
                    Magic Analysis Report
                  </h1>
                  <p className="text-muted-foreground">
                    Enhanced GEO analysis powered by the Magic Button
                  </p>
                </div>
                {magicRun && (
                  <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                    <IconSparkles className="w-3 h-3 mr-1" />
                    Magic Run
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex flex-col gap-4 pb-4 md:gap-6 md:pb-6">
              {/* Analysis Status Card */}
              <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6">
                <Card className="@container/card" data-slot="card">
                  <CardHeader>
                    <CardDescription>Y Combinator Analysis</CardDescription>
                    <CardTitle className="text-2xl font-semibold @[250px]/card:text-3xl">
                      https://www.ycombinator.com/
                    </CardTitle>
                    <CardAction>
                      <div className="flex flex-col items-end gap-2">
                        {isRunning ? (
                          <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20">
                            <IconLoader className="size-4 animate-spin mr-1" />
                            Analyzing...
                          </Badge>
                        ) : geoResults ? (
                          <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20">
                            <IconCheck className="size-4 mr-1" />
                            Complete
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            Ready
                          </Badge>
                        )}
                      </div>
                    </CardAction>
                  </CardHeader>
                  
                  <CardContent>
                    {isRunning && (
                      <div className="rounded-lg border bg-muted/50 p-3">
                        <div className="flex items-center gap-2">
                          <IconLoader className="size-4 text-muted-foreground animate-spin" />
                          <span className="text-sm font-medium">Running enhanced GEO analysis...</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Analyzing Y Combinator's website structure, content, and SEO optimization (1-3 minutes)
                        </p>
                      </div>
                    )}
                    
                    {!isRunning && !geoResults && (
                      <div className="text-center py-8">
                        <IconSparkles className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Ready for Magic Analysis</h3>
                        <p className="text-muted-foreground text-sm">
                          Click the Magic Button in the sidebar to analyze Y Combinator
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Results Display */}
              {geoResults && (
                <div className="px-4 lg:px-6">
                  <GeoResultsDisplay result={geoResults} />
                </div>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
      
      <FloatingMudraButton />
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