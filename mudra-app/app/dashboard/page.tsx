"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { FloatingMudraButton } from "@/components/floating-mudra-button"
import { OverviewMetrics } from "@/components/dashboard/overview-metrics"
import { NaturalLanguageReport } from "@/components/dashboard/natural-language-report"
import { Button } from "@/components/ui/button"
import { CountdownBadge } from "@/components/dashboard/countdown-badge"
import type { TimeRange } from "@/components/dashboard/time-range-selector"
import type { AIModel } from "@/components/dashboard/model-selector"
import React from "react"

export default function Page() {
  const [timeRange, setTimeRange] = React.useState<TimeRange>("7d")
  const [selectedModel, setSelectedModel] = React.useState<AIModel>("chatgpt")

  return (
    <SidebarProvider
      className="bg-dark-grey text-foreground"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 52)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset className="bg-dark-grey text-foreground m-0 shadow-none rounded-none border-none">
        <SiteHeader />
        <Separator className="w-full border-border" />
        <div className="flex flex-1 flex-col pb-8 md:pb-10">
          <div className="@container/main flex flex-1 flex-col gap-3 md:gap-4">
            {/* Page Header */}
            <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
                  <p className="text-muted-foreground">
                    Your brands performance across AI Search Engines
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <CountdownBadge />
                  <Button
                    variant="dashed"
                    className="h-9 rounded-lg bg-white text-black hover:bg-white/90 border-transparent"
                  >
                    Run Analysis
                  </Button>
                </div>
              </div>
              {/* Elegant Separator with White Dot (mirrors Insights) */}
              <div className="mt-4">
                <div className="relative">
                  <div className="h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                  <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-5 md:gap-6 pb-6 md:pb-8">
              {/* Overview Metrics */}
              <OverviewMetrics 
                timeRange={timeRange}
                selectedModel={selectedModel}
              />

              {/* Natural Language Report below the 3 main cards */}
              <div className="px-4 lg:px-6 mt-1 md:mt-2">
                <NaturalLanguageReport 
                  timeRange={timeRange}
                  selectedModel={selectedModel}
                />
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
      
      <FloatingMudraButton />
    </SidebarProvider>
  )
}
