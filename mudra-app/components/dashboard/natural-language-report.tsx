"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { TimeRange } from "./time-range-selector"
import type { AIModel } from "./model-selector"
import {
  mockOverviewMetrics,
  mockAiVisibilityData,
  mockTechnicalData,
  mockContentData,
  mockExternalFootprint,
} from "@/lib/mock/data"
import { 
  IconSparkles, 
  IconTrendingUp, 
  IconTarget, 
  IconCheck, 
  IconDownload, 
  IconCopy, 
  IconChevronDown,
  IconArrowRight
} from "@tabler/icons-react"

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
  const technical = mockTechnicalData.overallScore
  const mentions = mockExternalFootprint.totalMentions
  const uniqueDomains = mockExternalFootprint.uniqueDomains

  return (
    `Your brand currently holds an AI Visibility score of ${aiVisibility}/100, with solid technical health ` +
    `(${technical}/100) and content quality at ${contentQuality}/100. In the recent period, ` +
    `${humans} users were referred by AI search engines. We tracked ${mentions} external mentions across ` +
    `${uniqueDomains} unique domains. This week you closed ${tasks} tasks against ${goals} goals. ` +
    `Focus on strengthening content breadth and citing authoritative sources to convert visibility into ` +
    `more qualified referrals.`
  )
}

export function NaturalLanguageReport({ className, timeRange, selectedModel }: NaturalLanguageReportProps) {
  // Suppress unused variable warnings for now; wiring into real data later
  void timeRange
  void selectedModel

  const summary = generateSummary()

  return (
    <div className={cn("rounded-2xl border border-white/[0.08] bg-black/40 backdrop-blur-sm", className)}>
      <div className="p-5 md:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-white/60">Natural Language Report</p>
            <h2 className="text-xl md:text-2xl font-semibold">What the AI sees in your data</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-md border border-white/10 px-2.5 py-1 text-xs text-white/80">
              <IconSparkles className="size-4" />
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

        {/* Controls inspired by dashboards */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Badge variant="outline" className="bg-white/5 border-white/15 text-xs">Visibility</Badge>
          <Badge variant="outline" className="bg-white/5 border-white/15 text-xs">Technical</Badge>
          <Badge variant="outline" className="bg-white/5 border-white/15 text-xs">Content</Badge>
          <Badge variant="outline" className="bg-white/5 border-white/15 text-xs">External</Badge>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs bg-white/5 border-white/15 text-white/80">
              Languages <IconChevronDown className="size-3 ml-1" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs bg-white/5 border-white/15 text-white/80">
              Regions <IconChevronDown className="size-3 ml-1" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs bg-white/5 border-white/15 text-white/80">
              Platforms <IconChevronDown className="size-3 ml-1" />
            </Button>
          </div>
        </div>

        {/* KPIs removed (already shown above) */}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-white/10 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <IconSparkles className="size-4" />
                Summary
              </div>
              <p className="text-sm leading-6 text-white/80">
                {summary}
              </p>
              <div className="pt-3">
                <Button size="sm" className="h-8 px-3 text-xs">
                  Generate Action Plan <IconArrowRight className="size-3.5 ml-1" />
                </Button>
              </div>
            </div>

            {/* Recommendations list */}
            <div className="mt-4 rounded-xl border border-white/10 p-4">
              <div className="mb-2 text-sm font-medium">Recommendations</div>
              <ul className="space-y-2">
                {mockTechnicalData.recommendations.slice(0,4).map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="mt-1 inline-block size-1.5 rounded-full bg-white/60" />
                    <span className="text-sm text-white/80">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="rounded-xl border border-white/10 p-4">
              <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                <IconTarget className="size-4" />
                Key Focus
              </div>
              <p className="text-sm text-white/70">
                Improve content depth where visibility is high but citations are thin.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 p-4">
              <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                <IconTrendingUp className="size-4" />
                Quick Win
              </div>
              <p className="text-sm text-white/70">
                Repurpose top performing answers into dedicated landing pages.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 p-4">
              <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                <IconCheck className="size-4" />
                Next Action
              </div>
              <p className="text-sm text-white/70">
                Address 1–2 technical issues to boost crawl consistency.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


