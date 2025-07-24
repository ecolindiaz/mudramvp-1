"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { 
  IconTrendingUp,
  IconTarget,
  IconLoader,
  IconCheck,
  IconArrowRight,
} from "@tabler/icons-react"
import { GoalWidget } from "./goal-widget"

interface MetricCardProps {
  title: string
  value: number | string
  status: string
  trend?: "up" | "down" | "neutral"
  icon?: "users" | "target" | "loader" | "check" | "trending-up"
  className?: string
  onRedirect?: () => void
  redirectLabel?: string
  showGoalWidget?: boolean
  goalText?: string
}

const statusIcons = {
  "Growing": IconTrendingUp,
  "Active": IconLoader,
  "Processing": IconLoader,
  "Done": IconCheck,
  "Improving": IconTrendingUp,
  "Optimized": IconCheck,
  "On Track": IconTarget,
}

export function MetricCard({ 
  title, 
  value, 
  status, 
  trend = "neutral",
  icon = "trending-up",
  className,
  onRedirect,
  redirectLabel = "View",
  showGoalWidget = false,
  goalText
}: MetricCardProps) {
  const StatusIcon = statusIcons[status as keyof typeof statusIcons] || IconTrendingUp
  
  // Suppress unused variable warnings for future use
  void trend
  void icon

  return (
    <Card className={cn("@container/card", className)}>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        {showGoalWidget && goalText && typeof goalText === 'string' && goalText.trim().length > 0 ? (
          <div className="pt-2">
            <GoalWidget goalText={goalText.trim()} />
          </div>
        ) : (
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {value}
          </CardTitle>
        )}
        <CardAction>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline">
              <StatusIcon className="size-4" />
              {status}
            </Badge>
            {onRedirect && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onRedirect}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {redirectLabel}
                <IconArrowRight className="ml-1 size-3" />
              </Button>
            )}
          </div>
        </CardAction>
      </CardHeader>
    </Card>
  )
} 