"use client"

import { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { FloatingMudraButton } from "@/components/floating-mudra-button"
import { TimeRangeSelector, type TimeRange } from "@/components/dashboard/time-range-selector"

type InsightView = "brand" | "tracked-prompts" | "citation-gaps"

export default function InsightsPage() {
  const [activeView, setActiveView] = useState<InsightView>("brand")
  const [timeRange, setTimeRange] = useState<TimeRange>("7d")

  const renderContent = () => {
    switch (activeView) {
      case "brand":
        return (
          <div className="min-h-[400px] flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center border border-white/10">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full"></div>
              </div>
              <p className="text-white/60 text-sm">Brand content will be implemented here</p>
            </div>
          </div>
        )
      case "tracked-prompts":
        return (
          <div className="min-h-[400px] flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center border border-white/10">
                <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-emerald-400 rounded-full"></div>
              </div>
              <p className="text-white/60 text-sm">Tracked prompts content will be implemented here</p>
            </div>
          </div>
        )
      case "citation-gaps":
        return (
          <div className="min-h-[400px] flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-full flex items-center justify-center border border-white/10">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-red-400 rounded-full"></div>
              </div>
              <p className="text-white/60 text-sm">Citation gaps content will be implemented here</p>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <SidebarProvider
      className="bg-black"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset className="bg-black m-0 shadow-none rounded-none border-none">
        <SiteHeader />
        <Separator className="w-full border-border" />
        <div className="flex flex-1 flex-col bg-black">
          <div className="@container/main flex flex-1 flex-col bg-black">
            {/* Enhanced Page Header */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent"></div>
              <div className="relative px-4 lg:px-8 pt-6 md:pt-8 pb-4 md:pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">
                      {activeView === "brand" && "Brand Insights"}
                      {activeView === "tracked-prompts" && "Tracked Prompts"}
                      {activeView === "citation-gaps" && "Citation & Competitive Gaps"}
                    </h1>
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Navigation Tabs */}
            <div className="px-4 lg:px-8 pb-8 flex items-center justify-between">
              <div className="flex items-center justify-center lg:justify-start">
                <div className="inline-flex items-center gap-1 p-1.5 bg-white/[0.03] backdrop-blur-sm rounded-xl border border-white/[0.08] shadow-2xl">
                  {[
                    { key: "brand" as const, label: "Brand" },
                    { key: "tracked-prompts" as const, label: "Tracked Prompts" },
                    { key: "citation-gaps" as const, label: "Citation & Competitive Gaps" }
                  ].map(({ key, label }) => (
                    <Button
                      key={key}
                      variant={activeView === key ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setActiveView(key)}
                      className={`relative transition-all duration-200 ${
                        activeView === key 
                          ? "bg-primary text-primary-foreground shadow-sm" 
                          : "text-white/80 hover:text-white hover:bg-muted/60"
                      }`}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex items-center">
                <TimeRangeSelector 
                  value={timeRange}
                  onValueChange={setTimeRange}
                />
              </div>
            </div>

            {/* Elegant Separator with White Dot */}
            <div className="px-4 lg:px-8 pb-8">
              <div className="relative">
                <div className="h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                <div className="absolute left-1/2 top-0 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              </div>
            </div>
            
            {/* Enhanced Content Area */}
            <div className="flex flex-col flex-1">
              <div className="px-4 lg:px-8 pb-8">
                <div className="bg-white/[0.02] backdrop-blur-sm rounded-2xl border border-white/[0.08] shadow-2xl min-h-[500px]">
                  <div className="p-6 lg:p-8">
                    {renderContent()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
      
      <FloatingMudraButton />
    </SidebarProvider>
  )
} 