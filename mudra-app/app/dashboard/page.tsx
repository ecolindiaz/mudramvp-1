"use client"
import React from "react"
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
import { NaturalLanguageReport } from "@/components/dashboard/natural-language-report"
import AIReferralTrafficKPI from "@/components/dashboard/ai-referral-traffic-kpi"
import TrackingCodeManager from "@/components/dashboard/tracking-code-manager"
import type { TimeRange } from "@/components/dashboard/time-range-selector"
import type { AIModel } from "@/components/dashboard/model-selector"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Image from "next/image"

type PlatformFilter = "all" | AIModel

const platformOptions = [
  { value: "all" as PlatformFilter, label: "All Models", icon: null },
  { value: "chatgpt" as PlatformFilter, label: "ChatGPT", icon: "/openai_dark.svg" },
  { value: "claude" as PlatformFilter, label: "Claude", icon: "/claude-ai-icon.svg" },
  { value: "perplexity" as PlatformFilter, label: "Perplexity", icon: "/perplexity (2).svg" },
  { value: "gemini" as PlatformFilter, label: "Gemini", icon: "/gemini (3).svg" },
  { value: "google-aio" as PlatformFilter, label: "Google AIO", icon: "/google-logo.svg" },
]

function DashboardPageInner() {
  const [timeRange] = React.useState<TimeRange>("7d")
  const [selectedPlatform, setSelectedPlatform] = React.useState<PlatformFilter>("all")
  const selectedModel: AIModel = selectedPlatform === "all" ? "chatgpt" : selectedPlatform
  const [currentTime, setCurrentTime] = React.useState(new Date())

  // Update time every second
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false 
    })
  }

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
        <div className="flex flex-1 flex-col overflow-x-hidden max-w-full">
          <div className="@container/main flex flex-1 flex-col overflow-x-hidden max-w-full">
            {/* Page Header */}
            <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold tracking-tight text-white">Overview</h1>
                  <p className="text-sm text-white/60 mt-1">
                    Your brands performance across AI Search Engines
                  </p>
                </div>
                
                <div className="flex items-center gap-2.5 flex-shrink-0">
                  {/* Platform Filter */}
                  <Select value={selectedPlatform} onValueChange={(value) => setSelectedPlatform(value as PlatformFilter)}>
                    <SelectTrigger className="w-[160px] h-9 bg-white/5 hover:bg-white/10 border-white/[0.08] text-white rounded-lg transition-colors focus-visible:ring-0 focus-visible:ring-offset-0 outline-none">
                      <SelectValue placeholder="All Models" />
                    </SelectTrigger>
                    <SelectContent className="bg-dark-grey border-white/[0.08]">
                      {platformOptions.map((option) => (
                        <SelectItem 
                          key={option.value} 
                          value={option.value}
                          className="focus:bg-white/10 outline-none text-white"
                        >
                          <div className="flex items-center gap-2">
                            {option.icon && (
                              <Image 
                                src={option.icon} 
                                alt="" 
                                width={16} 
                                height={16}
                                className="shrink-0"
                              />
                            )}
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Timer */}
                  <div className="flex items-center gap-2 h-9 px-3 rounded-lg border border-white/[0.08] bg-white/5">
                    <svg className="size-3.5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path strokeLinecap="round" d="M12 6v6l4 2" />
                    </svg>
                    <span className="text-sm font-medium text-white/80 tabular-nums" suppressHydrationWarning>
                      {formatTime(currentTime)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Divider Line - Full Width */}
            <div className="h-[1px] bg-white/10"></div>
            
            <div className="flex flex-1 flex-col pt-6 pb-8">
              {/* Overview Metrics */}
              <div>
                <OverviewMetrics 
                  timeRange={timeRange}
                  selectedModel={selectedModel}
                />
              </div>

              {/* AI Referral Traffic Section */}
              <div className="px-4 lg:px-6 pt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <AIReferralTrafficKPI />
                  <TrackingCodeManager />
                </div>
              </div>

              {/* Natural Language Report */}
              <div className="px-4 lg:px-6 pt-6">
                <NaturalLanguageReport 
                  timeRange={timeRange}
                  selectedModel={selectedModel}
                />
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
      
      <FloatingMudraButton siteId={typeof window !== 'undefined' ? (localStorage.getItem('mudra:siteId') || '') : ''} />
    </SidebarProvider>
  )
}

export default function Page() {
  return (
    <BrandProfileProvider>
      <DashboardPageInner />
    </BrandProfileProvider>
  );
}
