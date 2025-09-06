"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { TimeRange } from "./time-range-selector"
import type { AIModel } from "./model-selector"
import {
  mockOverviewMetrics,
  mockAiVisibilityData,
  mockDashboardMetrics,
} from "@/lib/mock/data"
import { 
  IconSparkles, 
  IconTrendingUp, 
  IconTarget, 
  IconCheck, 
  IconDownload, 
  IconCopy, 
  IconInfoCircle
} from "@tabler/icons-react"
import { useNlr } from '@/hooks/use-nlr'
import type { NlrSummaryJson } from '@/types/nlr'

interface NaturalLanguageReportProps {
  className?: string
  timeRange: TimeRange
  selectedModel: AIModel
}

function generateSummary(): string {
  const humans = mockOverviewMetrics.humansReferredFromLLMs.current
  const tasks = mockOverviewMetrics.weeklyTasksCompleted.current
  const goals = mockOverviewMetrics.thisWeekGoals.current

  const aiVisibility = mockAiVisibilityData.overallScore
  const contentQuality = mockOverviewMetrics.contentQualityScore.current
  const technical = mockDashboardMetrics.technicalScore.current
  const visibilityChange = mockOverviewMetrics.aiVisibilityRank.change
  const topModels = mockAiVisibilityData.byModel.slice(0, 2).map(m => m.model).join(" and ")

  return (
    `Your brand currently holds an AI Visibility score of ${aiVisibility}/100, with solid technical health ` +
    `(${technical}/100) and content quality at ${contentQuality}/100. In the recent period, ` +
    `${humans} users were referred by AI search engines. Visibility improved ${visibilityChange}% vs the ` +
    `previous period with strongest model coverage from ${topModels}. This week you closed ${tasks} tasks ` +
    `against ${goals} goals. Focus on strengthening content breadth and citing authoritative sources to ` +
    `convert visibility into more qualified referrals.`
  )
}

export function NaturalLanguageReport({ className, timeRange, selectedModel }: NaturalLanguageReportProps) {
  // Suppress unused variable warnings for now; wiring into real data later
  void timeRange
  void selectedModel

  // TODO: Replace with real org/company context
  const companyId = typeof window !== 'undefined' ? ((window as any).__companyId || 'cmf04t2tf0001ptr88pdwhpwi') : 'cmf04t2tf0001ptr88pdwhpwi'
  const { report, isLoading, error } = useNlr(companyId)
  const summaryJson = (report?.summaryJson || null) as NlrSummaryJson | null
  const summaryFromModel = (report?.summaryMarkdown || '')
    .replace(/^```(md|markdown)?/gi, '')
    .replace(/```$/g, '')
    .trim()
  const whatsChanged = summaryJson?.sections?.whats_changed ?? []
  const highlights = summaryJson?.sections?.highlights ?? []

  function buildDigestibleSummary(): string {
    if (!summaryJson) return summaryFromModel || generateSummary()
    const parts: string[] = []

    // Use highlights or whats_changed to make it conversational
    const bullets = (highlights?.length ? highlights : whatsChanged.map(w => w.label)).slice(0, 4)
    if (bullets.length > 0) {
      parts.push(bullets.join(' '))
    }

    const tech = summaryJson.sections.technical_structure?.overall_change
    if (tech && tech.direction) {
      if (tech.direction === 'up') parts.push(`Technical health improved ${Math.round(((tech.relative || 0) * 100))}%`)
      if (tech.direction === 'down') parts.push(`Technical health dipped ${Math.round(((tech.relative || 0) * 100))}%`)
      if (tech.direction === 'flat') parts.push('Technical health stayed about the same')
    }

    const tasks = summaryJson.sections.tasks
    if (tasks) {
      if (tasks.opened_this_week != null || tasks.completed_this_week != null) {
        parts.push(`This week you opened ${tasks.opened_this_week ?? 0} tasks and completed ${tasks.completed_this_week ?? 0}.`)
      }
    }

    const next = summaryJson.sections.risks_next_steps?.[0]
    if (next) parts.push(`Next: ${next}.`)

    const text = parts.filter(Boolean).join(' ').trim()
    return text || summaryFromModel || generateSummary()
  }

  const summary = buildDigestibleSummary()
  const citations: Array<{ domain: string; used: number }> = [
    { domain: "aimultiple.com", used: 20 },
    { domain: "medium.com", used: 20 },
    { domain: "appen.com", used: 18 },
    { domain: "geeksforgeeks.org", used: 18 },
  ]
  const lifetimeGeoTasks = 124
  const lifetimeTechnicalTasks = 98
  const lifetimeContentCreated = 36

  if (isLoading) {
    return (
      <div className={cn("rounded-lg border border-white/10 bg-transparent backdrop-blur-sm p-6", className)}>
        <div className="h-5 w-40 bg-white/10 animate-pulse rounded mb-3" />
        <div className="space-y-2">
          <div className="h-4 w-full bg-white/5 animate-pulse rounded" />
          <div className="h-4 w-11/12 bg-white/5 animate-pulse rounded" />
          <div className="h-4 w-10/12 bg-white/5 animate-pulse rounded" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn("rounded-lg border border-red-600/30 bg-red-500/10 p-6 text-sm text-red-200", className)}>
        Failed to load Natural Language Report. Please try again.
      </div>
    )
  }

  if (!report) {
    return (
      <div className={cn("rounded-lg border border-white/10 bg-transparent p-6 text-sm text-white/70", className)}>
        Natural Language Report is not available yet.
      </div>
    )
  }

  return (
    <div className={cn("rounded-lg border border-white/10 bg-transparent backdrop-blur-sm", className)}>
      <div className="p-5 md:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-white/60">Natural Language Report</p>
            <h2 className="text-xl md:text-2xl font-semibold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">What the AI sees in your data</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-xl border border-yellow-500/20 px-2.5 py-1 text-xs text-yellow-400 bg-yellow-500/10">
              <IconSparkles className="size-4 text-yellow-400" />
              AI Summary
            </div>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-white/80 hover:text-white">
              <IconCopy className="size-3.5 mr-1" /> Copy
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-white/80 hover:text-white">
              <IconDownload className="size-3.5 mr-1" /> Download
            </Button>
          </div>
        </div>

        {/* Controls removed per design update to keep section minimal under the title */}

        {/* KPIs removed (already shown above) */}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="rounded-lg border border-white/10 bg-transparent p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white/90">
                <IconSparkles className="size-4" />
                Summary
              </div>
              <p className="text-sm leading-relaxed text-white/85">
                {summary}
              </p>
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    window.dispatchEvent(new Event("mudra:open-chat"))
                  }}
                >
                  <IconSparkles className="size-3.5 mr-1" /> Ask AI
                </Button>
              </div>
            </div>

            {/* Citations list */}
            <div className="mt-4 rounded-lg border border-white/10 bg-transparent overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div>
                  <div className="text-sm font-medium text-white/90">Citations</div>
                  <div className="text-xs text-white/60">Sources across active models</div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <IconInfoCircle className="size-4 text-white/60" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={8}>Top sources AI cites from your industry.</TooltipContent>
                </Tooltip>
              </div>
              <div className="divide-y divide-white/8">
                <div className="grid grid-cols-[1fr_auto] items-center px-4 py-2 text-xs text-white/60">
                  <span>Source</span>
                  <span>Rate of mention</span>
                </div>
                {citations.map((c, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_auto] items-center px-4 py-3 hover:bg-transparent transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center justify-center size-5 rounded bg-white/5 border border-white/10 text-[10px] text-white/80">
                        {c.domain[0].toUpperCase()}
                      </span>
                      <span className="truncate text-sm text-white/85">{c.domain}</span>
                    </div>
                    <div className="text-sm tabular-nums text-white/80">{c.used}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="rounded-lg border border-white/[0.08] bg-transparent p-4 min-h-[120px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="inline-flex items-center justify-center size-5 rounded bg-white/5 border border-white/10">
                    <IconCheck className="size-3.5 text-white/80" />
                  </span>
                  GEO tasks completed
                </div>
                <span className="text-[10px] uppercase tracking-wide text-white/60">All‑time</span>
              </div>
              <div className="mt-4 border-t border-white/10 pt-4 flex items-center justify-start">
                <span className="inline-flex items-center rounded border border-white/12 bg-white/5 px-3.5 py-1.5 text-base font-semibold tabular-nums text-white/90">
                  {lifetimeGeoTasks}
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-white/[0.08] bg-transparent p-4 min-h-[120px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="inline-flex items-center justify-center size-5 rounded bg-white/5 border border-white/10">
                    <IconCheck className="size-3.5 text-white/80" />
                  </span>
                  Technical Structure tasks completed
                </div>
                <span className="text-[10px] uppercase tracking-wide text-white/60">All‑time</span>
              </div>
              <div className="mt-4 border-t border-white/10 pt-4 flex items-center justify-start">
                <span className="inline-flex items-center rounded border border-white/12 bg-white/5 px-3.5 py-1.5 text-base font-semibold tabular-nums text-white/90">
                  {lifetimeTechnicalTasks}
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-white/[0.08] bg-transparent p-4 min-h-[120px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="inline-flex items-center justify-center size-5 rounded bg-white/5 border border-white/10">
                    <IconSparkles className="size-3.5 text-white/80" />
                  </span>
                  Content created
                </div>
                <span className="text-[10px] uppercase tracking-wide text-white/60">All‑time</span>
              </div>
              <div className="mt-4 border-t border-white/10 pt-4 flex items-center justify-start">
                <span className="inline-flex items-center rounded border border-white/12 bg-white/5 px-3.5 py-1.5 text-base font-semibold tabular-nums text-white/90">
                  {lifetimeContentCreated}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


