
"use client"
import { BrandProfileProvider } from "@/components/brand-profile-context"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { FloatingMudraButton } from "@/components/floating-mudra-button"
import { OverviewMetrics } from "@/components/dashboard/overview-metrics"
import { OverviewContainers } from "@/components/dashboard/overview-containers"
import { TimeRangeSelector, type TimeRange } from "@/components/dashboard/time-range-selector"
import { ModelSelector, type AIModel } from "@/components/dashboard/model-selector"
import { useState } from "react"

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d")
  const [selectedModel, setSelectedModel] = useState<AIModel>("chatgpt")

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
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
                  <p className="text-muted-foreground">
                    Your brands performance across AI Search Engines
                  </p>
                </div>
                <div className="flex items-center">
                  <TimeRangeSelector 
                    value={timeRange}
                    onValueChange={setTimeRange}
                  />
                  <ModelSelector
                    value={selectedModel}
                    onValueChange={setSelectedModel}
                  />
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-4 pb-4 md:gap-6 md:pb-6">
              {/* Overview Metrics */}
              <OverviewMetrics 
                timeRange={timeRange}
                selectedModel={selectedModel}
              />
              
              {/* AI Visibility Containers */}
              <OverviewContainers 
                timeRange={timeRange}
                selectedModel={selectedModel}
              />
            </div>
          </div>
        </SidebarInset>
        <FloatingMudraButton />
      </SidebarProvider>
    </BrandProfileProvider>
  )
}
