"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { TasksView } from "@/components/tasks-view"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { DirectGeoResults } from "@/components/direct-geo-results"
import { BrandProfileProvider, useBrandProfile } from "@/components/brand-profile-context"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import type { DirectGEOResult } from "@/lib/services/direct-geo-analysis.service"


function TasksPageInner() {
  const { profile } = useBrandProfile()
  const [geoResults, setGeoResults] = useState<DirectGEOResult | null>(null)
  const [isLoadingGeo, setIsLoadingGeo] = useState(false)

  // Fetch latest GEO analysis from database
  const fetchLatestGeoAnalysis = async () => {
    if (!profile.id) return

    setIsLoadingGeo(true)
    try {
      const response = await fetch(
        `/api/analysis/geo/latest?brandProfileId=${profile.id}`
      )
      const result = await response.json()

      if (result.success && result.data) {
        setGeoResults(result.data)
      } else {
        setGeoResults(null)
      }
    } catch (error) {
      console.error('Error fetching GEO analysis:', error)
      setGeoResults(null)
    } finally {
      setIsLoadingGeo(false)
    }
  }

  // Load on mount and when profile changes
  useEffect(() => {
    fetchLatestGeoAnalysis()
  }, [profile.id])

  // Refresh when analysis completes
  useEffect(() => {
    const handleAnalysisComplete = () => {
      fetchLatestGeoAnalysis()
    }

    window.addEventListener('mudra:website-analyzed', handleAnalysisComplete)
    return () => window.removeEventListener('mudra:website-analyzed', handleAnalysisComplete)
  }, [profile.id])

  return (
    <SidebarProvider
      className="bg-dark-grey"
      style={
        {
          "--sidebar-width": "16rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <Separator className="w-full border-border" />
        <div className="flex flex-1 flex-col bg-dark-grey">
          <div className="@container/main flex flex-1 flex-col bg-dark-grey">
            {/* Page Header */}
            <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">Tasks</h1>
                  <p className="text-muted-foreground">Manage and track optimization tasks</p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    className="h-9 rounded-xl"
                    variant="outline"
                    onClick={async () => {
                      // Get latest snapshot from database and generate tasks
                      try {
                        console.log('🚀 Generating tasks from latest snapshot...')
                        
                        // Fetch latest snapshot from database
                        const siteId = typeof window !== 'undefined' ? (localStorage.getItem('mudra:siteId') || '') : ''
                        const response = await fetch(`/api/tasks?siteId=${encodeURIComponent(siteId)}`)
                        const result = await response.json()
                        
                        if (!result.success || !result.data.latestSnapshot) {
                          alert('No website data found. Please analyze a website first from the Overview page.')
                          return
                        }
                        
                        const snapshot = result.data.latestSnapshot
                        console.log('✅ Using latest snapshot for task generation')
                        
                        // Generate tasks using the latest snapshot
                        const generateResponse = await fetch('/api/tasks/generate', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ snapshot, siteId })
                        })
                        
                        if (!generateResponse.ok) {
                          throw new Error(`Task generation failed: ${generateResponse.status}`)
                        }
                        
                        const generateResult = await generateResponse.json()
                        console.log('✅ Tasks generated:', generateResult.data.tasks.length)
                        
                        // Refresh tasks list
                        window.dispatchEvent(new CustomEvent('mudra:refresh-tasks'))
                        
                      } catch (error) {
                        console.error('❌ Error generating tasks:', error)
                        alert(`Task generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
                      }
                    }}
                  >
                    Generate Tasks
                  </Button>

                </div>
              </div>
            </div>

            {/* Clean Divider Line - Full Width */}
            <div className="h-[1px] bg-white/10"></div>

            <div className="flex flex-col gap-5 md:gap-6 pb-6 md:pb-8 pt-6">
              {/* AI Visibility Analysis Results - Recommendations and Prompts */}
              {isLoadingGeo ? (
                <div className="px-4 lg:px-6">
                  <div className="flex items-center justify-center py-8 bg-white/5 rounded-lg">
                    <Loader2 className="h-5 w-5 animate-spin text-white/60 mr-2" />
                    <span className="text-white/60">Loading AI visibility analysis...</span>
                  </div>
                </div>
              ) : geoResults ? (
                <div className="px-4 lg:px-6">
                  <DirectGeoResults results={geoResults} />
                </div>
              ) : null}

              {/* Tasks List */}
              <div>
                <TasksView />
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
      
    </SidebarProvider>
  )
}

export default function TasksPage() {
  return (
    <BrandProfileProvider>
      <TasksPageInner />
    </BrandProfileProvider>
  )
}