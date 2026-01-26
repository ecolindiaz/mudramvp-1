"use client"

import type React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  MoreHorizontal,
  Settings,
  TriangleAlert,
  Pin,
  Share2,
  Trash,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Info,
  type LucideIcon,
} from "lucide-react"

interface DashboardStatCardProps {
  title: string
  value: number
  delta: number
  lastValue: number
  positive: boolean
  loading?: boolean
  prefix?: string
  suffix?: string
  format?: (v: number) => string
  lastFormat?: (v: number) => string
  className?: string
  sparkline?: number[]
  periodText?: string
  ctaLabel?: string
  onCtaClick?: () => void
  accentColor?: string
  info?: string
  lastUpdated?: Date
  showLastPeriod?: boolean // If true, shows "Vs Last Period", if false shows "Last Updated"
  icon?: LucideIcon
  emptyValue?: string // Display value when value is 0 or null (e.g., "—", "N/A")
}

function defaultFormat(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
  if (n >= 1_000) return n.toLocaleString()
  return n.toString()
}

export function DashboardStatCard({
  title,
  value,
  delta,
  lastValue,
  positive,
  prefix = "",
  suffix = "",
  format,
  lastFormat,
  className,
  sparkline,
  periodText,
  ctaLabel,
  onCtaClick,
  accentColor,
  info,
  lastUpdated,
  showLastPeriod = true,
  icon: Icon,
  loading = false,
  emptyValue,
}: DashboardStatCardProps) {
  const formatValue = format ?? defaultFormat
  const formatLast = lastFormat ?? format ?? defaultFormat
  const accent = accentColor || (positive ? "rgba(16,185,129,0.9)" : "rgba(248,113,113,0.9)")
  const cardStyle = { ["--accent-color" as any]: accent } as React.CSSProperties
  const displayTime = lastUpdated || new Date()
  const showEmpty = emptyValue && value === 0

  return (
    <Card style={cardStyle} className={cn("group relative overflow-hidden bg-[#161616] rounded-xl border-0 transition-all duration-200 gap-3", className)}>


      <CardHeader className="border-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            {Icon && (
              <div className="flex items-center justify-center size-5 rounded-md bg-white/[0.05] group-hover:bg-white/[0.08] transition-all duration-200 flex-shrink-0">
                <Icon className="size-3 text-white/60 group-hover:text-white/80 transition-colors" />
              </div>
            )}
            <CardTitle className="text-muted-foreground text-sm font-medium">{title}</CardTitle>
          </div>
          <CardAction>
            {info && onCtaClick ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="-me-1.5" aria-label="About this metric" onClick={onCtaClick}>
                    <Info className="size-4 text-white/70" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={8} className="max-w-xs text-white/90">
                  {info}
                </TooltipContent>
              </Tooltip>
            ) : info ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="-me-1.5" aria-label="About this metric">
                    <Info className="size-4 text-white/70" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={8} className="max-w-xs text-white/90">
                  {info}
                </TooltipContent>
              </Tooltip>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="-me-1.5">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="bottom">
                  <DropdownMenuItem>
                    <Settings />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <TriangleAlert /> Add Alert
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Pin /> Pin to Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Share2 /> Share
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive">
                    <Trash />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </CardAction>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        <div className="flex items-center justify-between gap-2.5">
          {loading ? (
            <>
              <span className="inline-flex items-center gap-2">
                <span className="h-6 w-20 rounded bg-white/10 animate-pulse" />
              </span>
              <span className="h-5 w-14 rounded bg-white/10 animate-pulse" />
            </>
          ) : (
            <>
              <span className="text-2xl font-medium text-foreground tracking-tight">
                {showEmpty ? emptyValue : (format ? format(value) : `${prefix}${formatValue(value)}${suffix}`)}
              </span>
              {(lastValue !== 0 || delta !== 0) && !showEmpty && (
                <Badge
                  variant={positive ? "success" : "destructive"}
                  className={cn("appearance-light", positive ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : "")}
                >
                  {delta > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                  {delta}%
                </Badge>
              )}
            </>
          )}
        </div>
        {!loading && Array.isArray(sparkline) && sparkline.length > 1 && (
          <div className="overflow-hidden transition-all duration-300 ease-out max-h-0 group-hover:max-h-12">
            <div className="h-10 w-full opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
              <svg viewBox="0 0 100 20" className="w-full h-full text-white/70">
                <defs>
                  <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polyline
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.8"
                  points={sparkline
                    .map((v, i) => {
                      const x = (i / (sparkline.length - 1)) * 100
                      const min = Math.min(...sparkline)
                      const max = Math.max(...sparkline)
                      const y = 20 - ((v - min) / Math.max(1, max - min)) * 18 - 1
                      return `${x},${y}`
                    })
                    .join(" ")}
                />
                <polygon
                  fill="url(#spark)"
                  points={(() => {
                    const min = Math.min(...sparkline)
                    const max = Math.max(...sparkline)
                    const top = sparkline
                      .map((v, i) => {
                        const x = (i / (sparkline.length - 1)) * 100
                        const y = 20 - ((v - min) / Math.max(1, max - min)) * 18 - 1
                        return `${x},${y}`
                      })
                      .join(" ")
                    return `0,20 ${top} 100,20`
                  })()}
                />
              </svg>
            </div>
          </div>
        )}
        <div className="mt-2 border-t border-white/[0.06] pt-2.5 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {loading ? (
              <span className="inline-block h-3 w-32 rounded bg-white/10 animate-pulse" />
            ) : showLastPeriod ? (
              lastValue === 0 && delta === 0 ? (
                <span className="opacity-0">-</span>
              ) : (
                <>
                  Vs last period:{" "}
                  <span className="font-medium text-foreground">
                    {lastFormat ? lastFormat(lastValue) : `${prefix}${formatLast(lastValue)}${suffix}`}
                  </span>
                </>
              )
            ) : (
              <>
                Last Updated:{" "}
                <span className="font-medium text-foreground">
                  {displayTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </>
            )}
          </div>
          {onCtaClick && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-white/70 hover:text-white"
              onClick={onCtaClick}
              disabled={loading}
            >
              {ctaLabel ?? "View"}
              <ArrowRight className="ml-1 size-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}


