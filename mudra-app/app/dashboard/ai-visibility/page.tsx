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
import { AIVisibilityLineChart } from "@/components/dashboard/ai-visibility-line-chart"
import { AIVisibilityRank } from "@/components/dashboard/ai-visibility-rank"
import { TimeRangeSelector, type TimeRange } from "@/components/dashboard/time-range-selector"
import { ModelSelector, type AIModel } from "@/components/dashboard/model-selector"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Loader2, Play, CheckCircle, XCircle, Clock } from "lucide-react"
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
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">AI Visibility Metric</h1>
                  <p className="text-muted-foreground">
                    Calculate your brand's visibility across AI search engines
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
              {/* AI Visibility Charts */}
              <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2">
                <AIVisibilityLineChart />
                <AIVisibilityRank 
                  timeRange={timeRange}
                  selectedModel={selectedModel}
                />
              </div>

              {/* AI Visibility Calculator */}
              <div className="px-4 lg:px-6">
                <Card>
                  <CardHeader>
                    <CardTitle>AI Visibility Score Calculator</CardTitle>
                    <CardDescription>
                      Enter a company name to calculate their AI visibility score by querying 10 prompts across ChatGPT
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <Label htmlFor="companyName">Company Name</Label>
                        <Input
                          id="companyName"
                          placeholder="e.g., Y Combinator, Techstars"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          disabled={isLoading}
                        />
                      </div>
                      <div className="flex items-end">
                        <Button 
                          onClick={handleCalculateScore}
                          disabled={isLoading || !companyName.trim()}
                          className="gap-2"
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
                      <Card className="bg-muted/50">
                        <CardContent className="pt-6">
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
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
                        <Card className="bg-primary/5 border-primary/20">
                          <CardContent className="pt-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="text-center">
                                <div className="text-2xl font-bold text-primary">{currentScore.percentage}%</div>
                                <div className="text-xs text-muted-foreground">AI Visibility Score</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold">{currentScore.mentionCount}/10</div>
                                <div className="text-xs text-muted-foreground">Mentions</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold">{currentScore.averagePosition.toFixed(1)}</div>
                                <div className="text-xs text-muted-foreground">Avg Position</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold">{currentScore.totalScore.toFixed(1)}</div>
                                <div className="text-xs text-muted-foreground">Total Score</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Detailed Results */}
                        <Card>
                          <CardHeader>
                            <CardTitle>Detailed Results</CardTitle>
                            <CardDescription>
                              Analysis of each prompt and response
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              {currentScore.results.map((result, index) => (
                                <div key={index} className="border rounded-lg p-4 space-y-3">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Badge variant="outline">Prompt {index + 1}</Badge>
                                        {result.mentioned ? (
                                          <Badge variant="default" className="gap-1">
                                            <CheckCircle className="w-3 h-3" />
                                            Mentioned
                                          </Badge>
                                        ) : (
                                          <Badge variant="secondary" className="gap-1">
                                            <XCircle className="w-3 h-3" />
                                            Not Mentioned
                                          </Badge>
                                        )}
                                        {result.position && (
                                          <Badge variant="outline">
                                            Position {result.position}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-sm font-medium mb-2">{result.prompt}</p>
                                      <p className="text-xs text-muted-foreground line-clamp-3">
                                        {result.response}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-lg font-bold">{result.weight.toFixed(1)}</div>
                                      <div className="text-xs text-muted-foreground">Weight</div>
                                    </div>
                                  </div>
                                </div>
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
      
      <FloatingMudraButton />
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