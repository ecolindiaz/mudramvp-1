"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
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
import { Clock, FileText } from "lucide-react"
import { useNlr } from '@/hooks/use-nlr'
import type { NlrSummaryJson } from '@/types/nlr'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()
  const [showReportHistory, setShowReportHistory] = React.useState(false)
  
  // Suppress unused variable warnings for now; wiring into real data later
  void timeRange
  void selectedModel

  // Get siteId from localStorage and fetch companyId
  const siteId = typeof window !== 'undefined' ? localStorage.getItem('mudra:siteId') : null
  const { data: companyData } = useSWR(
    siteId ? `/api/site/company?siteId=${siteId}` : null,
    async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch company')
      return res.json()
    }
  )
  
  const companyId = companyData?.data?.companyId || null
  const { report, isLoading, error, refresh } = useNlr(companyId)

  // Listen for refresh events from Generate Report button
  React.useEffect(() => {
    const handleRefresh = () => {
      if (refresh) refresh()
    }
    
    window.addEventListener('mudra:nlr-refresh', handleRefresh)
    return () => window.removeEventListener('mudra:nlr-refresh', handleRefresh)
  }, [refresh])
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

    // Technical Snapshot Narrative (70–120 words)
    const keyFindings = summaryJson.sections.technical_structure?.key_findings || []
    if (keyFindings.length > 0) {
      const lower = (s: string) => s.toLowerCase()
      const findBy = (substr: string) => keyFindings.find(k => lower(k.title).includes(substr))

      const robots = findBy('robots.txt')
      const llms = findBy('llms.txt')
      const jsonld = keyFindings.find(k => lower(k.title).includes('json-ld'))
      const faq = keyFindings.find(k => lower(k.title).includes('faq'))
      const headings = keyFindings.find(k => lower(k.title).includes('heading structure'))
      const h1 = keyFindings.find(k => lower(k.title).startsWith('h1 '))

      const jsonLdCountMatch = jsonld?.title.match(/\((\d+)\)/)
      const faqCountMatch = faq?.title.match(/\((\d+)\)/)

      const clauses: string[] = []
      if (robots) clauses.push(robots.title.toLowerCase().includes('missing') ? 'robots.txt is missing' : 'robots.txt is present')
      if (llms) clauses.push(llms.title.toLowerCase().includes('missing') ? 'llms.txt is missing' : 'llms.txt is present')
      if (jsonld) {
        if (lower(jsonld.title).includes('detected')) {
          clauses.push(jsonLdCountMatch ? `JSON-LD detected (${jsonLdCountMatch[1]})` : 'JSON-LD detected')
        } else {
          clauses.push('no JSON-LD detected')
        }
      }
      if (faq) {
        if (lower(faq.title).includes('present')) {
          clauses.push(faqCountMatch ? `FAQ content present (${faqCountMatch[1]})` : 'FAQ content present')
        } else {
          clauses.push('no FAQ content detected')
        }
      }
      if (headings) clauses.push(lower(headings.title).includes('sane') ? 'headings look sane' : 'headings may be problematic')
      if (h1) {
        if (lower(h1.title).includes('present')) {
          const m = h1.title.match(/\((\d+)\)/)
          clauses.push(m ? `H1 count ${m[1]}` : 'H1 present')
        } else {
          clauses.push('no H1 detected')
        }
      }

      const narrativeParts: string[] = []
      if (clauses.length > 0) {
        narrativeParts.push(`The crawler snapshot confirms ${clauses.join(', ')}.`)
      }
      if (jsonld || faq) {
        narrativeParts.push('Structured signals like JSON-LD and FAQs help search and AI models understand your entities and answers.')
      }
      if (headings || h1) {
        narrativeParts.push('Clear heading structure and a single primary H1 improve parsing and ranking consistency across pages.')
      }
      narrativeParts.push('Addressing gaps here increases the likelihood of being cited or summarized accurately in AI-generated answers.')

      let narrative = narrativeParts.join(' ')
      const nextTip = summaryJson.sections.risks_next_steps?.[0]
      if (nextTip) narrative += ` Next: ${nextTip}.`

      const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length
      const minWords = 70
      const maxWords = 120

      if (wordCount(narrative) < minWords) {
        const topTasks = summaryJson.sections.tasks?.top_open?.map(t => t.title).slice(0, 3) || []
        if (topTasks.length > 0) {
          narrative += ` Prioritize: ${topTasks.join('; ')}.`
        }
      }
      if (wordCount(narrative) > maxWords) {
        const words = narrative.split(/\s+/).slice(0, maxWords)
        narrative = words.join(' ').replace(/[;,]$/,'').trim() + '.'
      }

      parts.push(narrative)
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
    { domain: "scale.com", used: 16 },
  ]
  
  // Competitor rankings data (will be connected to backend)
  const competitorRankings: Array<{ name: string; visibility: number; isUser: boolean }> = [
    { name: "Scale AI", visibility: 72, isUser: true },
    { name: "Appen", visibility: 68, isUser: false },
    { name: "Labelbox", visibility: 65, isUser: false },
    { name: "Snorkel AI", visibility: 58, isUser: false },
    { name: "Datasaur", visibility: 52, isUser: false },
  ]

  // Recent chats data (will be connected to backend)
  const recentChats: Array<{ id: string; promptId: string; question: string; timestamp: string; model: string }> = [
    { id: "chat_1", promptId: "prompt_abc123", question: "What are the best AI training data platforms?", timestamp: "2h ago", model: "ChatGPT" },
    { id: "chat_2", promptId: "prompt_def456", question: "How to label data for machine learning models?", timestamp: "5h ago", model: "Claude" },
    { id: "chat_3", promptId: "prompt_ghi789", question: "What is RLHF and how does it work?", timestamp: "1d ago", model: "Perplexity" },
  ]

  const handleChatClick = (promptId: string) => {
    // Navigate to tracked prompt detail page
    router.push(`/dashboard/tracked-prompts/${promptId}`)
  }

  // Report history data (will be connected to backend)
  const reportHistory: Array<{ id: string; title: string; date: string }> = [
    { id: "report_1", title: "Nov 10 - Performance Report", date: "3 days ago" },
    { id: "report_2", title: "Nov 7 - Technical Improvements", date: "6 days ago" },
    { id: "report_3", title: "Nov 4 - Content Optimization", date: "9 days ago" },
    { id: "report_4", title: "Nov 1 - AI Traffic Report", date: "12 days ago" },
    { id: "report_5", title: "Oct 29 - Schema Deployment", date: "15 days ago" },
    { id: "report_6", title: "Oct 26 - Weekly Analysis", date: "18 days ago" },
  ]

  // Model logo mapping - using public folder
  const getModelIcon = (model: string) => {
    const modelLower = model.toLowerCase()
    
    if (modelLower.includes('claude') || modelLower.includes('anthropic')) {
      return "/claude-ai-icon.svg"
    }
    if (modelLower.includes('perplexity')) {
      return "/perplexity (2).svg"
    }
    if (modelLower.includes('gemini') || modelLower.includes('google')) {
      return "/gemini (3).svg"
    }
    if (modelLower.includes('gpt') || modelLower.includes('openai') || modelLower.includes('chatgpt')) {
      return "/openai_dark.svg"
    }
    
    // Default fallback
    return "/openai_dark.svg"
  }

  // Temporarily render with mock data for UI review
  // if (isLoading) {
  //   return (
  //     <div className={cn("rounded-lg border border-white/10 bg-transparent backdrop-blur-sm p-6", className)}>
  //       <div className="h-5 w-40 bg-white/10 animate-pulse rounded mb-3" />
  //       <div className="space-y-2">
  //         <div className="h-4 w-full bg-white/5 animate-pulse rounded" />
  //         <div className="h-4 w-11/12 bg-white/5 animate-pulse rounded" />
  //         <div className="h-4 w-10/12 bg-white/5 animate-pulse rounded" />
  //       </div>
  //     </div>
  //   )
  // }

  // if (error) {
  //   return (
  //     <div className={cn("rounded-lg border border-red-600/30 bg-red-500/10 p-6 text-sm text-red-200", className)}>
  //       Failed to load Natural Language Report. Please try again.
  //     </div>
  //   )
  // }

  // if (!report) {
  //   return (
  //     <div className={cn("rounded-lg border border-white/10 bg-transparent p-6 text-sm text-white/70", className)}>
  //       Natural Language Report is not available yet.
  //     </div>
  //   )
  // }

  return (
    <div className={cn("rounded-lg border border-white/[0.08] bg-transparent backdrop-blur-sm", className)}>
      <div className="p-6 md:p-7 lg:p-9">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-white/60">Natural Language Report</p>
            <h2 className="text-xl md:text-2xl font-semibold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">What the AI sees in your data</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-lg border border-yellow-500/20 px-2.5 py-1 text-xs text-yellow-400 bg-yellow-500/10">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <div className="rounded-lg border border-white/[0.08] bg-transparent p-5">
              <div className="mb-2 flex items-center justify-between text-sm font-medium text-white/90">
                <div className="flex items-center gap-2">
                  <IconSparkles className="size-4" />
                  Summary
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <IconInfoCircle className="size-4 text-white/60 hover:text-white/90 transition-colors cursor-default" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={8}>AI-generated summary of your visibility performance</TooltipContent>
                </Tooltip>
              </div>
              <p className="text-sm leading-relaxed text-white/85">
                {summary}
              </p>
              <div className="mt-3 flex justify-between items-center">
                <div className="rounded-md border border-white/[0.08] px-2 py-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto px-0 text-white/60 hover:text-white hover:bg-transparent text-xs font-normal"
                    onClick={() => setShowReportHistory(true)}
                  >
                    <FileText className="size-3.5 mr-1.5" /> History
                  </Button>
                </div>
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={() => {
                    window.dispatchEvent(new Event("mudra:open-chat"))
                  }}
                >
                  <IconSparkles className="size-3.5 mr-1.5" /> Ask AI
                </Button>
              </div>
            </div>

            {/* Citations list */}
            <div className="mt-5 rounded-lg border border-white/[0.08] bg-transparent overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
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
              <div className="divide-y divide-white/[0.06]">
                <div className="grid grid-cols-[1fr_auto] items-center px-4 py-2 text-xs text-white/60">
                  <span>Source</span>
                  <span>Rate of mention</span>
                </div>
                {citations.map((c, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_auto] items-center px-4 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center justify-center size-5 rounded bg-white/5 border border-white/[0.08] text-[10px] text-white/80">
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
          
          <div className="flex flex-col gap-5">
            {/* Competitor Rankings Table */}
            <div className="rounded-lg border border-white/[0.08] bg-transparent overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
                <div className="text-sm font-medium text-white/90">Competitor Rankings</div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <IconInfoCircle className="size-4 text-white/60" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={8}>Compare your AI visibility against competitors.</TooltipContent>
                </Tooltip>
              </div>
              <div className="divide-y divide-white/[0.06]">
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2.5 text-xs text-white/60">
                  <span className="w-6">#</span>
                  <span>Company</span>
                  <span>Visibility</span>
                </div>
                {competitorRankings.map((competitor, idx) => (
                  <div 
                    key={idx} 
                    className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2.5 transition-colors ${
                      competitor.isUser ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="w-6 text-sm text-white/60 tabular-nums">{idx + 1}</div>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-sm truncate ${competitor.isUser ? 'text-white font-medium' : 'text-white/85'}`}>
                        {competitor.name}
                        {competitor.isUser && (
                          <span className="ml-2 text-[10px] text-white/60">(You)</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium tabular-nums text-white/90">{competitor.visibility}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Recent Chats Widget - Horizontal Grid */}
            <div className="rounded-lg border border-white/[0.08] bg-transparent overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <svg className="size-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <div className="text-sm font-medium text-white/90">Recent Chats</div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <IconInfoCircle className="size-4 text-white/60 hover:text-white/90 transition-colors cursor-default" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Recent AI model queries and their results</TooltipContent>
                </Tooltip>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-3 gap-3">
                  {recentChats.map((chat) => (
                    <div 
                      key={chat.id} 
                      onClick={() => handleChatClick(chat.promptId)}
                      className="rounded-lg border border-white/[0.08] bg-transparent p-4 hover:bg-white/[0.02] hover:border-white/[0.12] transition-all cursor-pointer min-h-[125px] flex flex-col"
                    >
                      <div className="flex items-start gap-2.5 mb-3 flex-1">
                        <div className="flex items-center justify-center size-5 flex-shrink-0 mt-0.5">
                          <img 
                            src={getModelIcon(chat.model)} 
                            alt={chat.model}
                            className="size-5 object-contain"
                          />
                        </div>
                        <p className="text-sm text-white/90 leading-relaxed line-clamp-3 flex-1">
                          {chat.question}
                        </p>
                      </div>
                      <div className="flex items-center justify-end pt-2 mt-auto border-t border-white/[0.06]">
                        <span className="text-[10px] text-white/50">{chat.timestamp}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Report History Modal */}
      <Dialog open={showReportHistory} onOpenChange={setShowReportHistory}>
        <DialogContent className="max-w-2xl bg-dark-grey border-0 p-0 overflow-hidden">
          <DialogHeader className="p-7 pb-5 border-b border-white/[0.08]">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-semibold text-white">Report History</DialogTitle>
                <DialogDescription className="text-white/60 text-sm mt-1">
                  {reportHistory.length} reports generated
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6">
            <div className="space-y-2">
              {reportHistory.map((report, idx) => (
                <div 
                  key={report.id} 
                  className="rounded-lg border border-white/[0.08] bg-transparent p-4 hover:bg-white/[0.02] hover:border-white/[0.12] transition-all cursor-pointer group"
                  onClick={() => console.log('Open report:', report.id)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex items-center justify-center size-8 rounded-md bg-white/5 border border-white/[0.08] flex-shrink-0 group-hover:border-white/[0.12] transition-colors">
                        <FileText className="size-4 text-white/70 group-hover:text-white/90 transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-white/90 group-hover:text-white transition-colors">
                          {report.title}
                        </h3>
                        <p className="text-xs text-white/50 mt-1">{report.date}</p>
                      </div>
                    </div>
                    
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="h-8 w-8 p-0 rounded-md opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        console.log('Download report:', report.id)
                      }}
                    >
                      <IconDownload className="size-4 text-white/70" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}


