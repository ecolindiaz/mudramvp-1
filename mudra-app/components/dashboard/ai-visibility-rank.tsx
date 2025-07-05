"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { IconInfoCircle } from "@tabler/icons-react"
import type { TimeRange } from "./time-range-selector"
import type { AIModel } from "./model-selector"

interface AIVisibilityRankProps {
  timeRange: TimeRange
  selectedModel: AIModel
}

// Company logo components with actual brand styling
const CompanyLogo = ({ company }: { company: string }) => {
  switch (company) {
    case "Y Combinator":
      return (
        <div className="w-6 h-6 rounded-md bg-[#FF6600] flex items-center justify-center text-white text-xs font-bold">
          Y
        </div>
      )
    case "500 Global":
      return (
        <div className="w-6 h-6 rounded-md bg-[#00D4AA] flex items-center justify-center text-white text-[10px] font-bold">
          500
        </div>
      )
    case "Sequoia Capital":
      return (
        <div className="w-6 h-6 rounded-md bg-[#2B5A3F] flex items-center justify-center text-white text-xs font-bold">
          🌲
        </div>
      )
    case "First Round Capital":
      return (
        <div className="w-6 h-6 rounded-md bg-[#6B73FF] flex items-center justify-center text-white text-[9px] font-bold">
          1R
        </div>
      )
    case "Andreessen Horowitz":
      return (
        <div className="w-6 h-6 rounded-md bg-[#1E3A8A] flex items-center justify-center text-white text-[8px] font-bold">
          a16z
        </div>
      )
    default:
      return (
        <div className="w-6 h-6 rounded-md bg-gray-500 flex items-center justify-center text-white text-xs font-bold">
          ?
        </div>
      )
  }
}

// Updated ranking data with Y Combinator as #1 and selected
const rankingData = [
  {
    rank: 1,
    company: "Y Combinator",
    score: 44.6,
    trend: 0.3,
    isSelected: true
  },
  {
    rank: 2,
    company: "500 Global",
    score: 34.5,
    trend: -1.2,
    isSelected: false
  },
  {
    rank: 3,
    company: "Sequoia Capital",
    score: 33.1,
    trend: 2.4,
    isSelected: false
  },
  {
    rank: 4,
    company: "First Round Capital",
    score: 32.4,
    trend: -4.1,
    isSelected: false
  },
  {
    rank: 5,
    company: "Andreessen Horowitz",
    score: 28.9,
    trend: -1.3,
    isSelected: false
  }
]

const userRank = 1

export function AIVisibilityRank({ timeRange, selectedModel }: AIVisibilityRankProps) {
  // Suppress unused variable warnings for future use
  void timeRange
  void selectedModel

  const getTrendIndicator = (trend: number) => {
    const trendPercent = Math.abs(trend).toFixed(1)
    
    if (trend > 0) {
      return <span className="text-xs font-medium text-emerald-500">+{trendPercent}%</span>
    } else if (trend < 0) {
      return <span className="text-xs font-medium text-red-500">-{trendPercent}%</span>
    } else {
      return <span className="text-xs font-medium text-gray-500">{trendPercent}%</span>
    }
  }

  return (
    <Card className="bg-muted/50 dark:bg-muted/20">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardDescription className="text-sm text-muted-foreground">
            Visibility Score Rank
          </CardDescription>
          <CardTitle className="text-3xl font-bold">
            #{userRank}
            <span className="text-muted-foreground font-normal"> -</span>
          </CardTitle>
        </div>
        <div className="flex items-center gap-2">
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
                  <h4 className="font-medium text-sm text-foreground">AI Visibility Rank</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Your ranking compared to similar companies based on AI visibility scores. 
                    Lower numbers indicate better performance.
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 px-3 text-xs"
          >
            Expand
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm text-muted-foreground font-medium pb-2">
          <span>Asset</span>
          <span>Visibility Score</span>
        </div>
        
        <Separator />
        
        <div className="space-y-3">
          {rankingData.map((item) => (
            <div 
              key={item.rank} 
              className={`flex items-center justify-between py-2 px-3 rounded-lg transition-all duration-200 ${
                item.isSelected 
                  ? 'bg-primary/5 border border-primary/20' 
                  : 'hover:bg-muted/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground min-w-[12px]">
                  {item.rank}.
                </span>
                <div className="flex items-center gap-2.5">
                  <CompanyLogo company={item.company} />
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {item.company}
                    </span>
                    {item.isSelected && (
                      <Badge variant="secondary" className="text-xs px-2 py-0.5">
                        Selected
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-foreground">
                  {item.score}%
                </span>
                {getTrendIndicator(item.trend)}
              </div>
            </div>
          ))}
        </div>

      </CardContent>
    </Card>
  )
} 