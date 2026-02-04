"use client"

// Force dynamic rendering for dashboard pages
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { TimeRangeSelector, type TimeRange } from "@/components/dashboard/time-range-selector"
import { ModelSelector, type AIModel } from "@/components/dashboard/model-selector"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Loader2, Play, CheckCircle, XCircle, Bot } from "lucide-react"
import { toast } from "sonner"
import { AIVisibilityProvider, useAIVisibility } from "@/contexts/ai-visibility-context"
import { BrandProfileProvider } from "@/components/brand-profile-context"
import React from "react"

interface AIVisibilityResult {
  prompt: string
  response: string
  mentioned: boolean
  position: number | null
  weight: number
}

function AIVisibilityPageContent() {
  const [timeRange, setTimeRange] = React.useState<TimeRange>("7d")
  const [selectedModel, setSelectedModel] = React.useState<AIModel>("chatgpt")
  const [companyName, setCompanyName] = useState("")
  const [selectedPrompt, setSelectedPrompt] = useState<{ index: number; result: AIVisibilityResult } | null>(null)
  const { data, calculateScore } = useAIVisibility()
  const { currentScore, isLoading, error } = data

  const handleCalculateScore = async () => {
    if (!companyName.trim()) {
      toast.error("Please enter a company name")
      return
    }

    try {
      const result = await calculateScore(companyName.trim())
      toast.success(`AI Visibility score calculated: ${result.percentage}%`)
    } catch (error) {
      console.error('Error calculating AI Visibility score:', error)
      toast.error("Failed to calculate AI Visibility score")
    }
  }

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
              <div className="flex items-center justify-end">
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
              {/* AI Visibility Charts - Temporarily Hidden */}
              {/* 
              <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2">
                <AIVisibilityLineChart />
                <AIVisibilityRank 
                  timeRange={timeRange}
                  selectedModel={selectedModel}
                />
              </div>
              */}

              {/* AI Visibility Calculator */}
              <div className="px-4 lg:px-6">
                <Card className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                      AI Visibility Score Calculator
                    </CardTitle>
                    <CardDescription className="text-muted-foreground/80">
                      Enter a company name to calculate their AI visibility score by querying 10 prompts across ChatGPT
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <Label htmlFor="companyName" className="text-sm font-medium text-muted-foreground mb-2 block">
                          Company Name
                        </Label>
                        <Input
                          id="companyName"
                          placeholder="e.g., Y Combinator, Techstars"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          disabled={isLoading}
                          className="h-10 bg-background/50 border-border/50 focus:border-primary/50"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button 
                          onClick={handleCalculateScore}
                          disabled={isLoading || !companyName.trim()}
                          className="gap-2 h-10 bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Calculating...
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4" />
                              Calculate Score
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {isLoading && (
                      <Card className="bg-muted/20 border-muted/30">
                        <CardContent className="pt-6">
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-primary" />
                              <span className="text-sm font-medium">Querying AI models...</span>
                            </div>
                            <Progress className="w-full" />
                            <p className="text-xs text-muted-foreground">
                              Processing prompts with ChatGPT...
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {currentScore && (
                      <div className="space-y-6">
                        {/* Score Summary */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {/* AI Visibility Score */}
                          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all">
                            <div className="text-[11px] text-white/50 uppercase tracking-wide mb-2">Visibility Score</div>
                            <div className="text-2xl font-semibold text-white">{currentScore.percentage}%</div>
                          </div>

                          {/* Mentions */}
                          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all">
                            <div className="text-[11px] text-white/50 uppercase tracking-wide mb-2">Mentions</div>
                            <div className="text-2xl font-semibold text-white">{currentScore.mentionCount}<span className="text-white/40 text-lg">/10</span></div>
                          </div>

                          {/* Average Position */}
                          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all">
                            <div className="text-[11px] text-white/50 uppercase tracking-wide mb-2">Avg Position</div>
                            <div className="text-2xl font-semibold text-white">
                              {currentScore.averagePosition > 0 ? `#${currentScore.averagePosition.toFixed(1)}` : '—'}
                            </div>
                          </div>

                          {/* Total Score */}
                          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all">
                            <div className="text-[11px] text-white/50 uppercase tracking-wide mb-2">Total Score</div>
                            <div className="text-2xl font-semibold text-white">{currentScore.totalScore.toFixed(1)}</div>
                          </div>
                        </div>

                        {/* Detailed Results */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-[13px] font-medium text-white/90">Prompt Results</h3>
                            <span className="text-[11px] text-white/40">{currentScore.results.length} prompts analyzed</span>
                          </div>
                          <div className="space-y-2">
                            {currentScore.results.map((result, index) => (
                              <Dialog key={index}>
                                <DialogTrigger asChild>
                                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all cursor-pointer group">
                                    <div className="flex items-start gap-3">
                                      {result.mentioned ? (
                                        <CheckCircle className="w-4 h-4 mt-0.5 text-emerald-400 flex-shrink-0" />
                                      ) : (
                                        <XCircle className="w-4 h-4 mt-0.5 text-white/30 flex-shrink-0" />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[13px] text-white/90 font-medium leading-relaxed line-clamp-1">
                                          {result.prompt}
                                        </p>
                                        <p className="text-[11px] text-white/40 mt-1 line-clamp-1">
                                          {result.response.substring(0, 80)}...
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        {result.position && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] text-white/50">
                                            #{result.position}
                                          </span>
                                        )}
                                        <span className="text-[11px] text-white/30">
                                          {result.weight.toFixed(1)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </DialogTrigger>
                                
                                <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden bg-[#0a0a0a] border-white/[0.08]">
                                  <DialogHeader className="pb-3">
                                    <div className="flex items-center gap-2 mb-2">
                                      {result.mentioned ? (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[11px]">
                                          <CheckCircle className="w-3 h-3" />
                                          Mentioned
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.05] text-white/50 text-[11px]">
                                          <XCircle className="w-3 h-3" />
                                          Not Mentioned
                                        </span>
                                      )}
                                      {result.position && (
                                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.05] text-white/50">
                                          Position #{result.position}
                                        </span>
                                      )}
                                      <span className="text-[11px] text-white/30 ml-auto">
                                        Weight: {result.weight.toFixed(1)}
                                      </span>
                                    </div>
                                    <DialogTitle className="text-[15px] font-medium text-white/90">
                                      {result.prompt}
                                    </DialogTitle>
                                    <DialogDescription className="text-white/50 text-[12px]">
                                      ChatGPT response
                                    </DialogDescription>
                                  </DialogHeader>
                                  
                                  <div className="overflow-y-auto max-h-[55vh]">
                                    <div className="bg-white/[0.02] rounded-lg p-4 border border-white/[0.06]">
                                      <div className="flex items-center gap-2 mb-3">
                                        <Bot className="w-3.5 h-3.5 text-white/50" />
                                        <span className="text-[11px] text-white/50">Response</span>
                                      </div>
                                      <p className="text-[13px] text-white/70 leading-relaxed whitespace-pre-wrap">
                                        {result.response}
                                      </p>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function AIVisibilityPage() {
  return (
    <BrandProfileProvider>
      <AIVisibilityProvider>
        <AIVisibilityPageContent />
      </AIVisibilityProvider>
    </BrandProfileProvider>
  )
}