"use client"

import { useState, useEffect } from "react"
import { TrackedPromptsView } from "@/components/tracked-prompts-view"
import { BrandProfileProvider, useBrandProfile } from "@/components/brand-profile-context"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Loader2 } from "lucide-react"

function TrackedPromptsPageInner() {
  const { profile } = useBrandProfile()
  const [prompts, setPrompts] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile.id && profile.id > 0) {
      loadData()
    }
  }, [profile.id])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Fetch prompts and latest analysis in parallel
      const [promptsRes, analysisRes] = await Promise.all([
        fetch(`/api/prompts?brandProfileId=${profile.id}`),
        fetch(`/api/analysis/latest?brandProfileId=${profile.id}`)
      ])

      if (promptsRes.ok) {
        const promptsData = await promptsRes.json()
        console.log('[Tracked Prompts] Loaded prompts:', promptsData.prompts?.length, 'prompts')
        console.log('[Tracked Prompts] Sample prompt:', promptsData.prompts?.[0])
        setPrompts(promptsData.prompts || [])
      }

      if (analysisRes.ok) {
        const analysisData = await analysisRes.json()
        console.log('[Tracked Prompts] Loaded analysis:', analysisData.analysis)
        console.log('[Tracked Prompts] Analysis structure:', {
          hasAnalyses: !!analysisData.analysis?.analyses,
          analysesCount: analysisData.analysis?.analyses?.length,
          firstAnalysis: analysisData.analysis?.analyses?.[0]
        })
        setAnalysis(analysisData.analysis)
      }
    } catch (error) {
      console.error('Error loading tracked prompts data:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SidebarProvider
      className="bg-dark-grey text-foreground"
      style={
        {
          "--sidebar-width": "16rem",
          "--header-height": "3rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset className="bg-dark-grey text-foreground m-0 shadow-none rounded-none border-none overflow-x-hidden max-w-full">
        <SiteHeader />
        <div className="flex flex-1 flex-col pb-8 md:pb-10 overflow-x-hidden max-w-full">
          <div className="@container/main flex flex-1 flex-col gap-3 md:gap-4 overflow-x-hidden max-w-full">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading prompts...</span>
              </div>
            ) : (
              <TrackedPromptsView prompts={prompts} analysis={analysis} />
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function TrackedPromptsPage() {
  return (
    <BrandProfileProvider>
      <TrackedPromptsPageInner />
    </BrandProfileProvider>
  )
}
