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
import { cn } from "@/lib/utils"
import { 
  IconTrendingUp,
  IconTrendingDown,
  IconTarget,
  IconLoader,
  IconCheck,
  IconUsers,
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
  change?: number
  period?: string
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
  goalText,
  change,
  period
}: MetricCardProps) {
  const StatusIcon = statusIcons[status as keyof typeof statusIcons] || IconTrendingUp
  const metricIcons = {
    users: IconUsers,
    target: IconTarget,
    loader: IconLoader,
    check: IconCheck,
    "trending-up": IconTrendingUp,
  } as const
  const MetricIcon = metricIcons[icon]
  const changeNumber = typeof change === "number" ? change : undefined
  const ChangeIcon = changeNumber != null ? (changeNumber >= 0 ? IconTrendingUp : IconTrendingDown) : null
  
  // Suppress unused variable warnings for future use
  void trend
  void icon

  return (
    <Card className={cn("@container/card bg-white/[0.02] backdrop-blur-sm rounded-2xl border border-white/[0.08] shadow-2xl", className)}>
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          {MetricIcon && (
            <span className="inline-flex items-center justify-center size-5 rounded-full bg-white/5 border border-white/10">
              <MetricIcon className="size-3.5 text-white/80" />
            </span>
          )}
          {title}
        </CardDescription>
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
      {changeNumber != null && (
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className={cn("inline-flex items-center gap-1 text-xs", changeNumber >= 0 ? "text-emerald-400" : "text-red-400")}> 
              {ChangeIcon && <ChangeIcon className="size-3" />}
              <span className="font-medium">{Math.abs(changeNumber)}%</span>
              <span className="text-white/60">{changeNumber >= 0 ? "up" : "down"} vs previous</span>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
} 