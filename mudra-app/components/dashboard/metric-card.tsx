"use client"

import { Badge } from "@/components/ui/badge"
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
  IconTrendingDown,
  IconMinus,
  IconUsers,
  IconTarget,
  IconLoader,
  IconCheck,
} from "@tabler/icons-react"

interface MetricCardProps {
  title: string
  value: number | string
  status: string
  trend?: "up" | "down" | "neutral"
  icon?: "users" | "target" | "loader" | "check" | "trending-up"
  className?: string
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

const metricIcons = {
  "users": IconUsers,
  "target": IconTarget,
  "loader": IconLoader,
  "check": IconCheck,
  "trending-up": IconTrendingUp,
}

export function MetricCard({ 
  title, 
  value, 
  status, 
  trend = "neutral",
  icon = "trending-up",
  className 
}: MetricCardProps) {
  const StatusIcon = statusIcons[status as keyof typeof statusIcons] || IconTrendingUp
  const MetricIcon = metricIcons[icon]

  return (
    <Card className={cn("@container/card", className)}>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {value}
        </CardTitle>
        <CardAction>
          <Badge variant="outline">
            <StatusIcon className="size-4" />
            {status}
          </Badge>
        </CardAction>
      </CardHeader>
    </Card>
  )
} 