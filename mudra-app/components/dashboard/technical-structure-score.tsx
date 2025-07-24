"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { mockTechnicalData } from "@/lib/mock/data"
import { 
  IconLoader,
  IconArrowRight,
  IconCheck,
  IconInfoCircle
} from "@tabler/icons-react"
import {
  RiArrowDownSFill,
  RiArrowRightSFill,
  RiArrowUpSFill,
} from '@remixicon/react'
import type { TimeRange } from "./time-range-selector"
import type { AIModel } from "./model-selector"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface TechnicalStructureScoreProps {
  timeRange: TimeRange
  selectedModel: AIModel
}

// Mock tasks related to technical structure
const technicalTasks = [
  {
    id: "tech-1",
    name: "Fix Crawl Errors",
    status: "In Process" as const,
    priority: "High",
    taskId: "technical-structure"
  },
  {
    id: "tech-2", 
    name: "Implement Schema Markup",
    status: "In Process" as const,
    priority: "Medium",
    taskId: "technical-structure"
  },
  {
    id: "tech-3",
    name: "Optimize Page Speed",
    status: "Done" as const,
    priority: "Medium", 
    taskId: "technical-structure"
  }
]

export function TechnicalStructureScore({ timeRange, selectedModel }: TechnicalStructureScoreProps) {
  const { overallScore } = mockTechnicalData
  
  // Filter to only show tasks that are in process
  const inProcessTasks = technicalTasks.filter(task => task.status === "In Process")

  // Mock trend data - replace with backend data later
  const trendChange = 2.3 // This will come from backend
  const changePercent = Math.abs(trendChange).toFixed(1)
  
  const getTrendIndicator = () => {
    if (trendChange > 0) {
      return (
        <span className="inline-flex items-center gap-x-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20 backdrop-blur-sm">
          <RiArrowUpSFill className="size-3.5" aria-hidden={true} />
          +{changePercent}%
        </span>
      )
    } else if (trendChange < 0) {
      return (
        <span className="inline-flex items-center gap-x-1.5 rounded-full bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 ring-1 ring-red-500/20 backdrop-blur-sm">
          <RiArrowDownSFill className="size-3.5" aria-hidden={true} />
          -{changePercent}%
        </span>
      )
    } else {
      return (
        <span className="inline-flex items-center gap-x-1.5 rounded-full bg-gray-500/10 px-3 py-1.5 text-xs font-medium text-gray-400 ring-1 ring-gray-500/20 backdrop-blur-sm">
          <RiArrowRightSFill className="size-3.5" aria-hidden={true} />
          {changePercent}%
        </span>
      )
    }
  }

  // Suppress unused variable warnings for future use
  void timeRange
  void selectedModel

  return (
    <Card 
      className="@container/card bg-gradient-to-t from-primary/5 to-card dark:bg-card shadow-xs"
      data-slot="card"
    >
      <CardHeader className="pb-2">
        <CardDescription className="text-muted-foreground">Technical Structure Score</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {overallScore}%
        </CardTitle>
        <CardAction className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <IconCheck className="size-4" />
              Optimized
            </Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 w-7 p-0 rounded-full hover:bg-muted/50 transition-all duration-200"
                  >
                    <IconInfoCircle className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent 
                  side="left" 
                  align="start"
                  className="max-w-72 p-4 bg-background/95 backdrop-blur-sm border border-border/50 shadow-lg"
                >
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-foreground">Technical Structure Score</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      How well is the technical backend of your website optimized for crawlability and retrieval from AI Bots.
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {getTrendIndicator()}
        </CardAction>
      </CardHeader>
      
      <div className="px-6">
        <Separator />
      </div>
      
      <CardContent className="pt-3 pb-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground">Priority Tasks</h4>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View All
              <IconArrowRight className="ml-1 size-3" />
            </Button>
          </div>
          
          <div className="space-y-1">
            {inProcessTasks.map((task) => (
              <div 
                key={task.id} 
                className="group flex items-center text-sm py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer border border-transparent hover:border-border/50 transition-all duration-200"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    <IconLoader className="size-4 text-muted-foreground animate-spin" />
                  </div>
                  <span className="truncate font-medium text-foreground group-hover:text-foreground transition-colors">
                    {task.name}
                  </span>
                </div>
                <Badge 
                  variant="outline" 
                  className="text-xs px-2 py-0.5 flex-shrink-0 text-muted-foreground bg-background/50 mr-2"
                >
                  {task.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 