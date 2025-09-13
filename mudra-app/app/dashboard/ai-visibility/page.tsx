"use client"

import { useState } from 'react'
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { FloatingMudraButton } from "@/components/floating-mudra-button"
import { TimeRangeSelector, type TimeRange } from "@/components/dashboard/time-range-selector"
import { ModelSelector, type AIModel } from "@/components/dashboard/model-selector"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Loader2, Play, CheckCircle, XCircle, Clock, MessageSquare, Bot } from "lucide-react"
import { toast } from "sonner"
import { AIVisibilityProvider, useAIVisibility } from "@/contexts/ai-visibility-context"
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
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {/* AI Visibility Score - Primary Metric */}
                          <Card className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-primary/10">
                            <CardContent className="pt-6 pb-4">
                              <div className="text-center space-y-3">
                                <div className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                                  {currentScore.percentage}%
                                </div>
                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  AI Visibility Score
                                </div>
                                <div className="w-12 h-1 bg-gradient-to-r from-primary to-primary/50 rounded-full mx-auto"></div>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Mentions */}
                          <Card className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs">
                            <CardContent className="pt-6 pb-4">
                              <div className="text-center space-y-3">
                                <div className="text-3xl font-bold text-foreground">
                                  {currentScore.mentionCount}/10
                                </div>
                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  Mentions
                                </div>
                                <div className="w-8 h-0.5 bg-muted-foreground/30 rounded-full mx-auto"></div>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Average Position */}
                          <Card className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs">
                            <CardContent className="pt-6 pb-4">
                              <div className="text-center space-y-3">
                                <div className="text-3xl font-bold text-foreground">
                                  {currentScore.averagePosition.toFixed(1)}
                                </div>
                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  Avg Position
                                </div>
                                <div className="w-8 h-0.5 bg-muted-foreground/30 rounded-full mx-auto"></div>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Total Score */}
                          <Card className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs">
                            <CardContent className="pt-6 pb-4">
                              <div className="text-center space-y-3">
                                <div className="text-3xl font-bold text-foreground">
                                  {currentScore.totalScore.toFixed(1)}
                                </div>
                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  Total Score
                                </div>
                                <div className="w-8 h-0.5 bg-muted-foreground/30 rounded-full mx-auto"></div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Detailed Results */}
                        <Card className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs">
                          <CardHeader className="pb-4">
                            <CardTitle className="text-lg font-semibold">
                              Detailed Results
                            </CardTitle>
                            <CardDescription className="text-muted-foreground/80">
                              Analysis of each prompt and response
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {currentScore.results.map((result, index) => (
                                <Dialog key={index}>
                                  <DialogTrigger asChild>
                                    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs border border-border/30 rounded-lg bg-gradient-to-r from-background/50 to-background/30 hover:from-background/60 hover:to-background/40 transition-all duration-200 cursor-pointer group">
                                      <div className="flex items-start justify-between gap-4 p-4">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-3">
                                            <Badge variant="outline" className="text-xs font-medium bg-background/50 border-border/50">
                                              Prompt {index + 1}
                                            </Badge>
                                            {result.mentioned ? (
                                              <Badge variant="default" className="gap-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                                <CheckCircle className="w-3 h-3" />
                                                Mentioned
                                              </Badge>
                                            ) : (
                                              <Badge variant="secondary" className="gap-1 bg-muted/50 text-muted-foreground border-muted/30">
                                                <XCircle className="w-3 h-3" />
                                                Not Mentioned
                                              </Badge>
                                            )}
                                            {result.position && (
                                              <Badge variant="outline" className="text-xs bg-background/50 border-border/50">
                                                Position {result.position}
                                              </Badge>
                                            )}
                                          </div>
                                          <p className="text-sm font-semibold mb-2 text-foreground/90 group-hover:text-foreground transition-colors">
                                            {result.prompt}
                                          </p>
                                          <div className="flex items-center gap-2">
                                            <p className="text-xs text-muted-foreground/80 line-clamp-1 leading-relaxed">
                                              {result.response.substring(0, 100)}...
                                            </p>
                                            <div className="flex items-center gap-1">
                                              <MessageSquare className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                            </div>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                                            {result.weight.toFixed(1)}
                                          </div>
                                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                            Weight
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </DialogTrigger>
                                  
                                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
                                    <DialogHeader className="pb-4">
                                      <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="text-xs font-medium bg-background/50 border-border/50">
                                            Prompt {index + 1}
                                          </Badge>
                                          {result.mentioned ? (
                                            <Badge variant="default" className="gap-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                              <CheckCircle className="w-3 h-3" />
                                              Mentioned
                                            </Badge>
                                          ) : (
                                            <Badge variant="secondary" className="gap-1 bg-muted/50 text-muted-foreground border-muted/30">
                                              <XCircle className="w-3 h-3" />
                                              Not Mentioned
                                            </Badge>
                                          )}
                                          {result.position && (
                                            <Badge variant="outline" className="text-xs bg-background/50 border-border/50">
                                              Position {result.position}
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="ml-auto">
                                          <div className="text-lg font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                                            {result.weight.toFixed(1)} Weight
                                          </div>
                                        </div>
                                      </div>
                                      <DialogTitle className="text-lg font-semibold text-foreground/90 pt-2">
                                        {result.prompt}
                                      </DialogTitle>
                                      <DialogDescription className="text-muted-foreground/80">
                                        ChatGPT response analysis
                                      </DialogDescription>
                                    </DialogHeader>
                                    
                                    <div className="space-y-4 overflow-y-auto max-h-[60vh]">
                                      <div className="bg-gradient-to-br from-primary/5 via-primary/3 to-primary/5 rounded-lg p-4 border border-primary/20">
                                        <div className="flex items-center gap-2 mb-3">
                                          <Bot className="w-4 h-4 text-primary" />
                                          <span className="text-sm font-semibold text-foreground/90">ChatGPT Response</span>
                                          <Badge variant="outline" className="text-xs bg-background/50 border-border/50">
                                            AI Model
                                          </Badge>
                                        </div>
                                        <div className="bg-background/50 rounded-lg p-4 border border-border/20 backdrop-blur-sm">
                                          <p className="text-sm text-muted-foreground/90 leading-relaxed whitespace-pre-wrap">
                                            {result.response}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
      
      <FloatingMudraButton siteId={typeof window !== 'undefined' ? (localStorage.getItem('mudra:siteId') || '') : ''} />
    </SidebarProvider>
  )
}

export default function AIVisibilityPage() {
  return (
    <AIVisibilityProvider>
      <AIVisibilityPageContent />
    </AIVisibilityProvider>
  )
}