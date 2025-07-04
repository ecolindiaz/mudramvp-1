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
import { mockContentData } from "@/lib/mock/data"
import { 
  IconLoader,
  IconArrowRight,
  IconTrendingUp
} from "@tabler/icons-react"
import type { TimeRange } from "./time-range-selector"
import type { AIModel } from "./model-selector"

interface ContentQualityScoreProps {
  timeRange: TimeRange
  selectedModel: AIModel
}

// Mock tasks related to content quality
const contentTasks = [
  {
    id: "content-1",
    name: "Improve E-A-T Signals",
    status: "In Process" as const,
    priority: "High",
    taskId: "content-quality-score"
  },
  {
    id: "content-2",
    name: "Add Author Bios", 
    status: "In Process" as const,
    priority: "Medium",
    taskId: "content-quality-score"
  },
  {
    id: "content-3",
    name: "Create FAQ Sections",
    status: "Done" as const,
    priority: "Medium",
    taskId: "content-quality-score"
  }
]

export function ContentQualityScore({ timeRange, selectedModel }: ContentQualityScoreProps) {
  const { overallScore } = mockContentData
  
  // Filter to only show tasks that are in process
  const inProcessTasks = contentTasks.filter(task => task.status === "In Process")

  // Suppress unused variable warnings for future use
  void timeRange
  void selectedModel

  return (
    <Card 
      className="@container/card bg-gradient-to-t from-primary/5 to-card dark:bg-card shadow-xs"
      data-slot="card"
    >
      <CardHeader className="pb-2">
        <CardDescription className="text-muted-foreground">Content Quality Score</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {overallScore}%
        </CardTitle>
        <CardAction>
          <Badge variant="outline" className="gap-1">
            <IconTrendingUp className="size-4" />
            Improving
          </Badge>
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