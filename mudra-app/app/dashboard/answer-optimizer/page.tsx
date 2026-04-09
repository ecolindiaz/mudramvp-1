"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { BrandProfileProvider, useBrandProfile } from "@/components/brand-profile-context"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowRight, Plus, FileText, MessageSquare, UserCircle, Mic, Pencil, RefreshCw, PenTool, ChevronDown, ChevronRight, Search, Link, Globe, Check, Loader2, Circle, X, Play, ScanText, Crosshair, HelpCircle, ListFilter, Users, Swords, Sparkles, Clock, GitCompare, SendHorizontal, Braces, type LucideIcon } from "lucide-react"

// Types for real API data
interface BlogPost { id: string; title: string; url: string }
interface TrackedPrompt { id: string; text: string; category?: string }
interface IcpProfile { id: string; name: string; description: string }

// SSE event from /api/answer-optimizer/stream
interface OptimizerSSEEvent {
  phase: string
  status: "started" | "progress" | "completed" | "failed"
  message?: string
  data?: Record<string, any>
  stepIndex?: number
  totalSteps?: number
  /** Milliseconds since pipeline start — backend-authoritative timing */
  pipelineMs?: number
}

// Phase-to-step mapping for SSE events
const PHASE_TO_STEP: Record<string, string> = {
  "scrape-page": "scrape",
  "query-ai": "query-ai",
  "scrape-citations": "scrape-citations",
  "derive-query": "derive-query",
  "faq-research": "faq-research",
  "competitor-analysis": "competitor-analysis",
  "gap-analysis": "gap-analysis",
  "research": "research",
  "optimize": "content-optimization",
  "finalize": "finalize",
}

/** Build active pipeline steps based on which tools are enabled */
function getActiveSteps(enabledTools: Set<string>): PipelineStep[] {
  const steps: PipelineStep[] = [
    { id: "scrape", label: "Scrape Existing Page", icon: ScanText, inputLabel: "Target URL", outputLabel: "Page Content" },
  ]

  if (enabledTools.has("query-ai-models")) {
    steps.push({ id: "query-ai", label: "Query AI Models", icon: Search, inputLabel: "Article Title", outputLabel: "AI Responses & Citations" })
  }
  if (enabledTools.has("scrape-citations") && enabledTools.has("query-ai-models")) {
    steps.push({ id: "scrape-citations", label: "Scrape AI Citations", icon: ScanText, inputLabel: "Citation URLs", outputLabel: "Source Content" })
  }

  steps.push({ id: "derive-query", label: "Derive Core Search Query", icon: Crosshair, inputLabel: "Page + Prompt", outputLabel: "Search Query" })
  steps.push({ id: "faq-research", label: "FAQ & PAA Research", icon: HelpCircle, inputLabel: "Search Query", outputLabel: "FAQ Candidates" })

  if (enabledTools.has("competitor-analysis")) {
    steps.push({ id: "competitor-analysis", label: "Competitor Analysis", icon: Swords, inputLabel: "Search Query", outputLabel: "Competitive Insights" })
  }

  steps.push({ id: "gap-analysis", label: "Gap Analysis", icon: ListFilter, inputLabel: "All Sources", outputLabel: "Content Gaps" })

  if (enabledTools.has("research-stats")) {
    steps.push({ id: "research", label: "Research Enrichment", icon: Search, inputLabel: "Identified Gaps", outputLabel: "Statistics & Quotes" })
  }

  steps.push({ id: "content-optimization", label: "Content Optimization", icon: Sparkles, inputLabel: "All Inputs", outputLabel: "Optimized Content" })
  steps.push({ id: "finalize", label: "Finalize & Diff", icon: GitCompare, inputLabel: "Original + Optimized", outputLabel: "Content Diff" })

  return steps
}

// AI model logo badges — ignores parent size class, renders its own layout
function AIModelsIcon(_props: { className?: string }) {
  const models = [
    "/openai_dark.svg",
    "/claude-ai-icon.svg",
    "/perplexity (2).svg",
    "/gemini (3).svg",
  ]
  return (
    <div className="flex gap-0.5">
      {models.map((src) => (
        <span key={src} className="inline-flex items-center justify-center size-4 rounded-full bg-white/5">
          <img src={src} alt="" className="size-2.5 object-contain" />
        </span>
      ))}
    </div>
  )
}

// Firecrawl logo icon
function FirecrawlIcon({ className }: { className?: string }) {
  return <img src="/firecrawl-logo.png" alt="" className={`${className} object-contain`} />
}

const selectTriggerClass = "w-full h-12 !bg-[#1b1b1b] hover:!bg-[#1f1f1f] !border-0 text-white rounded-lg transition-all duration-200 ease-out active:scale-[0.98] focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:ring-[1.5px] data-[state=open]:ring-inset data-[state=open]:ring-blue-400 data-[state=open]:!bg-[#1f1f1f] [&>svg]:text-white/40 [&>svg]:transition-transform [&>svg]:duration-200 data-[state=open]:[&>svg]:rotate-180"

// --- Pipeline Step Types & Definitions ---
type StepStatus = "pending" | "running" | "completed" | "error"

interface ToolCall {
  name: string
  status: "success" | "error"
  duration: string
  detail?: string
}

interface PipelineStep {
  id: string
  label: string
  icon: LucideIcon
  inputLabel: string
  outputLabel: string
  inputContent?: string
  outputContent?: string
  reasoning?: string
  tools?: ToolCall[]
  duration?: number
}

const OPTIMIZATION_STEPS: PipelineStep[] = [
  {
    id: "start", label: "Start", icon: Play,
    inputLabel: "Configuration", outputLabel: "Optimization Plan",
    inputContent: "Page: /blog/best-crm-small-business\nPrompt: \"What is the best CRM for small businesses?\"\nDepth: Balanced | Tone: Professional",
    outputContent: "Plan generated — 7 optimization stages queued",
    reasoning: "Validating inputs and building execution plan. Checking page exists, prompt is tracked, and selected tools are available.",
    tools: [
      { name: "validate_inputs", status: "success", duration: "0.2s" },
      { name: "build_plan", status: "success", duration: "0.4s" },
    ],
    duration: 1800,
  },
  {
    id: "scrape", label: "Web Page Scrape", icon: ScanText,
    inputLabel: "Target URL", outputLabel: "Article Content",
    inputContent: "https://example.com/blog/best-crm-small-business",
    outputContent: "Extracted 2,847 words across 14 sections\n3 existing H2s, 8 H3s, 2 internal links",
    reasoning: "Fetching page content and parsing DOM structure. Extracting headings, paragraphs, internal links, and metadata.",
    tools: [
      { name: "fetch_url", status: "success", duration: "1.1s", detail: "200 OK — 48KB" },
      { name: "parse_html", status: "success", duration: "0.3s", detail: "14 sections extracted" },
      { name: "extract_links", status: "success", duration: "0.1s", detail: "2 internal links" },
    ],
    duration: 2400,
  },
  {
    id: "query", label: "Determine Core User Search Query", icon: Crosshair,
    inputLabel: "Article + Prompt", outputLabel: "User Search Query",
    inputContent: "Analyzing article content against target prompt to identify primary search intent...",
    outputContent: "\"best CRM for small business 2026\"\nInformational intent, high commercial modifier",
    reasoning: "Comparing article topics against the target prompt to find the search query a user would type. Adding temporal modifier for recency.",
    tools: [
      { name: "llm_analyze", status: "success", duration: "1.2s", detail: "Claude 3.5 Sonnet" },
    ],
    duration: 1600,
  },
  {
    id: "faq-research", label: "FAQ Research", icon: HelpCircle,
    inputLabel: "Search Query", outputLabel: "Related FAQs",
    inputContent: "Querying Google + Perplexity for FAQ clusters around \"best CRM small business\"",
    outputContent: "Found 23 related questions across 4 clusters:\n  Pricing (7)  Features (6)  Integrations (5)  Migration (5)",
    reasoning: "Running parallel searches across Google PAA and Perplexity to collect FAQ-style questions. Deduplicating and clustering by topic.",
    tools: [
      { name: "google_search", status: "success", duration: "0.8s", detail: "3 queries, 14 results" },
      { name: "perplexity_search", status: "success", duration: "1.0s", detail: "2 queries, 9 results" },
      { name: "deduplicate", status: "success", duration: "0.1s", detail: "23 unique" },
    ],
    duration: 2200,
  },
  {
    id: "extract-faqs", label: "Extract & Rank FAQs", icon: ListFilter,
    inputLabel: "Raw FAQs", outputLabel: "Final FAQs",
    inputContent: "23 raw FAQs from research phase — filtering by relevance and search volume...",
    outputContent: "Top 8 FAQs selected:\n1. How much does a CRM cost for small business?\n2. What features should a small business CRM have?\n3. Can I migrate from spreadsheets to a CRM?\n4. Do I need a CRM with under 10 employees?\n5. What integrations matter most?",
    reasoning: "Scoring each FAQ by relevance to the target prompt and estimated search volume. Selecting top 8 for integration.",
    tools: [
      { name: "llm_rank", status: "success", duration: "0.9s", detail: "23 → 8 selected" },
    ],
    duration: 1400,
  },
  {
    id: "people-also-ask", label: "People Also Ask", icon: Users,
    inputLabel: "Search Query", outputLabel: "PAA Questions",
    inputContent: "Extracting PAA boxes for \"best CRM for small business\"",
    outputContent: "12 PAA questions found\n5 high-relevance matches identified for content integration",
    reasoning: "Scraping Google PAA boxes for the target query and two related variations. Filtering for questions most relevant to the article scope.",
    tools: [
      { name: "google_paa", status: "success", duration: "1.2s", detail: "12 questions" },
      { name: "filter_relevant", status: "success", duration: "0.3s", detail: "5 matched" },
    ],
    duration: 2000,
  },
  {
    id: "competitor-analysis", label: "Competitor Analysis", icon: Swords,
    inputLabel: "Search Query + URL", outputLabel: "Competitive Insights",
    inputContent: "Analyzing top 5 ranking pages for target query...",
    outputContent: "Gap analysis complete:\n  Missing: comparison table, pricing section, integration checklist\n  Avg competitor word count: 3,200\n  Content depth score: 72/100",
    reasoning: "Fetching top 5 SERP results, extracting structure and content depth. Comparing against our article to identify content gaps.",
    tools: [
      { name: "google_search", status: "success", duration: "0.6s", detail: "Top 5 results" },
      { name: "fetch_url", status: "success", duration: "1.2s", detail: "5 pages scraped" },
      { name: "gap_analysis", status: "success", duration: "0.5s", detail: "3 gaps found" },
    ],
    duration: 2600,
  },
  {
    id: "content-optimization", label: "Content Optimization", icon: Sparkles,
    inputLabel: "All Inputs", outputLabel: "Optimized Content",
    inputContent: "Combining article, FAQs, PAA, competitor insights — applying Balanced rewrite depth...",
    outputContent: "Optimization complete\n  3,412 words (+565 added)\n  6 new sections\n  8 FAQs integrated\n  Schema markup generated",
    reasoning: "Merging all research into the article. Adding FAQ sections, filling content gaps from competitor analysis, generating schema markup. Preserving original structure per Balanced depth setting.",
    tools: [
      { name: "llm_rewrite", status: "success", duration: "2.1s", detail: "Claude 3.5 Sonnet" },
      { name: "generate_schema", status: "success", duration: "0.4s", detail: "FAQ + Article schema" },
      { name: "validate_output", status: "success", duration: "0.2s", detail: "3,412 words" },
    ],
    duration: 3000,
  },
]

// --- Elapsed time formatter ---
function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}

// --- Step Detail Popup ---
function StepDetailPopup({ step, onClose }: { step: PipelineStep; onClose: () => void }) {
  const [tab, setTab] = useState<"trace" | "io">("trace")
  const StepIcon = step.icon

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40 rounded-2xl" onClick={(e) => { e.stopPropagation(); onClose() }} />
      <div className="relative w-full max-w-[420px] rounded-2xl bg-[#2a2a2a] shadow-2xl shadow-black/50 p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <StepIcon className="size-4 text-white/40" />
            <p className="text-sm font-medium text-white">{step.label}</p>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose() }}
            className="text-white/30 hover:text-white/60 transition-colors cursor-pointer outline-none"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex gap-1 mb-4 p-0.5 rounded-lg bg-white/[0.04]">
          {(["trace", "io"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 text-xs py-1.5 rounded-md transition-colors cursor-pointer outline-none ${
                tab === t ? "bg-white/[0.08] text-white font-medium" : "text-white/40 hover:text-white/60"
              }`}
            >
              {t === "trace" ? "Trace" : "Input / Output"}
            </button>
          ))}
        </div>

        <div className="max-h-[300px] overflow-y-auto scrollbar-thin">
          {tab === "trace" ? (
            <div className="space-y-4">
              {step.reasoning && (
                <div>
                  <p className="text-xs font-medium text-white/50 mb-1.5">Reasoning</p>
                  <p className="text-[13px] text-white/40 leading-relaxed">{step.reasoning}</p>
                </div>
              )}
              {step.tools && step.tools.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-white/50 mb-2">Tool calls</p>
                  <div className="space-y-1">
                    {step.tools.map((tool, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.02]">
                        <div className={`size-1.5 rounded-full shrink-0 ${tool.status === "success" ? "bg-emerald-400" : "bg-red-400"}`} />
                        <span className="text-[13px] text-white/60 font-mono flex-1 truncate">{tool.name}</span>
                        {tool.detail && <span className="text-[11px] text-white/25 shrink-0">{tool.detail}</span>}
                        <span className="text-[11px] text-white/20 font-mono tabular-nums shrink-0">{tool.duration}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-white/50 mb-1.5">Input</p>
                <p className="text-[13px] text-white/40 leading-relaxed whitespace-pre-wrap">{step.inputContent || step.inputLabel}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-white/50 mb-1.5">Output</p>
                <p className="text-[13px] text-white/40 leading-relaxed whitespace-pre-wrap">{step.outputContent || "Complete"}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Content Diff View (inline word-level diff) ---
type DiffSpan = { type: "added" | "removed" | "text"; content: string }
type DiffSection = {
  heading?: string
  isNew?: boolean
  paragraphs: DiffSpan[][]
}

const MOCK_SECTIONS: DiffSection[] = [
  {
    heading: "How to Choose the Best CRM for Small Business",
    paragraphs: [
      [
        { type: "text", content: "Finding the right CRM can make or break your small business operations. " },
        { type: "removed", content: "There are many CRM options available today. " },
        { type: "added", content: "In 2026, small businesses have access to over 400 CRM platforms — but only a handful are purpose-built for teams under 50 employees. " },
        { type: "text", content: "In this guide, we break down what matters most." },
      ],
    ],
  },
  {
    heading: "Key Features to Look For",
    paragraphs: [
      [
        { type: "added", content: "Before comparing tools, define your must-haves. The most cited features by small business owners are contact management, pipeline tracking, and email integration." },
      ],
      [
        { type: "removed", content: "Look for a CRM with good features." },
        { type: "added", content: "Prioritize CRMs that offer native integrations with your existing stack — especially your email provider, calendar, and invoicing tool." },
      ],
    ],
  },
  {
    heading: "How much does a CRM cost for small business?",
    isNew: true,
    paragraphs: [
      [
        { type: "added", content: "Most small business CRMs range from $12–$65/user/month. Free tiers exist but typically cap at 2–3 users with limited pipeline features. Enterprise plans with advanced automation start around $99/user/month." },
      ],
    ],
  },
  {
    heading: "Making Your Decision",
    paragraphs: [
      [
        { type: "text", content: "Once you've narrowed your options, " },
        { type: "removed", content: "just pick one." },
        { type: "added", content: "run a 14-day trial with real data. Import a sample of your contacts and test your three most common workflows." },
      ],
    ],
  },
  {
    heading: "Can I migrate from spreadsheets to a CRM?",
    isNew: true,
    paragraphs: [
      [
        { type: "added", content: "Yes — most modern CRMs offer CSV import and guided migration wizards. The average migration takes 2–4 hours for under 5,000 contacts. Larger datasets may benefit from a dedicated onboarding specialist." },
      ],
    ],
  },
  {
    heading: "Conclusion",
    paragraphs: [
      [
        { type: "removed", content: "Choose the best CRM for your needs." },
        { type: "added", content: "The best CRM is the one your team will actually use. Start with a free trial, import a sample of your contacts, and test your core workflows before committing." },
      ],
    ],
  },
]

function ContentDiffView({ onBack, onClose, onApply, isApplying, sections: sectionsProp }: { onBack: () => void; onClose: () => void; onApply?: () => void; isApplying?: boolean; sections?: DiffSection[] }) {
  const displaySections = sectionsProp || MOCK_SECTIONS
  const stats = displaySections.reduce((acc, s) => {
    s.paragraphs.forEach(p => p.forEach(span => {
      if (span.type === "added") acc.added += span.content.split(/\s+/).length
      if (span.type === "removed") acc.removed += span.content.split(/\s+/).length
    }))
    return acc
  }, { added: 0, removed: 0 })
  const newSections = displaySections.filter(s => s.isNew).length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="text-white/30 hover:text-white/60 transition-colors cursor-pointer outline-none"
            >
              <ArrowRight className="size-4 rotate-180" />
            </button>
            <div>
              <h3 className="text-lg font-semibold text-white">Content Diff</h3>
              <p className="text-xs text-white/40 mt-0.5">Review changes before applying</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/[0.03]">
              <span className="text-xs text-emerald-400/70 tabular-nums">+{stats.added}w</span>
              <span className="text-xs text-white/10">|</span>
              <span className="text-xs text-red-400/70 tabular-nums">-{stats.removed}w</span>
              <span className="text-xs text-white/10">|</span>
              <span className="text-xs text-white/40 tabular-nums">{newSections} new</span>
            </div>
          </div>
        </div>
      </div>

      <div className="h-px bg-white/[0.04]" />

      {/* Diff content — flowing readable paragraphs */}
      <div className="flex-1 overflow-y-auto pt-5 pb-4 scrollbar-thin space-y-6">
        {displaySections.map((section, si) => (
          <div key={si}>
            {/* Section heading */}
            {section.heading && (
              <div className="flex items-center gap-2 mb-2">
                {section.isNew && (
                  <span className="text-[10px] font-medium text-emerald-400/60 bg-emerald-500/10 px-1.5 py-0.5 rounded">NEW</span>
                )}
                <h4 className={`text-sm font-semibold ${section.isNew ? "text-white/70" : "text-white/50"}`}>
                  {section.heading}
                </h4>
              </div>
            )}

            {/* Paragraphs with inline spans */}
            <div className="space-y-3">
              {section.paragraphs.map((spans, pi) => (
                <p key={pi} className="text-[13px] leading-[1.8] text-white/35">
                  {spans.map((span, i) => {
                    if (span.type === "removed") {
                      return (
                        <span key={i} className="bg-red-500/10 text-red-300/50 line-through decoration-red-400/30 rounded-sm px-0.5">
                          {span.content}
                        </span>
                      )
                    }
                    if (span.type === "added") {
                      return (
                        <span key={i} className="bg-emerald-500/10 text-emerald-300/60 rounded-sm px-0.5">
                          {span.content}
                        </span>
                      )
                    }
                    return <span key={i}>{span.content}</span>
                  })}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-white/[0.04] flex items-center justify-between">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/[0.03]">
          <GitCompare className="size-3 text-white/25" />
          <span className="text-xs text-white/40">{displaySections.length} sections</span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-9 px-4 rounded-full text-sm text-white/50 hover:text-white hover:bg-white/[0.04]"
          >
            Discard
          </Button>
          <Button
            onClick={onApply}
            disabled={isApplying}
            className="h-9 px-5 rounded-full bg-white text-[#0a0a0a] hover:bg-white/90 hover:text-[#0a0a0a] text-sm font-medium shadow-sm hover:shadow-md transition-all border-0 gap-2 disabled:opacity-50"
          >
            {isApplying ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Apply Changes
                <ArrowRight className="size-3.5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// --- Pipeline Step Card ---
function PipelineStepRow({ step, status, isLast, elapsed, stepRef, isOpen, onToggle }: {
  step: PipelineStep
  status: StepStatus
  isLast: boolean
  elapsed?: number
  stepRef?: React.RefObject<HTMLDivElement | null>
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div className="relative">
      {/* Spacer + dotted connector between cards */}
      <div className="flex justify-center h-3">
        {!isLast && (
          <div
            className="h-full transition-colors duration-500"
            style={{
              borderLeft: "1px dashed",
              borderColor: status === "completed" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
            }}
          />
        )}
      </div>

      <div className="relative">
        <div
          ref={status === "running" ? stepRef : undefined}
          onClick={status === "completed" ? onToggle : undefined}
          className={`rounded-xl border px-4 py-3.5 transition-all duration-500 ${
            status === "completed" ? "cursor-pointer" : ""
          } ${
            isOpen
              ? "bg-blue-400/[0.04] border-blue-400/25"
              : status === "running"
              ? "bg-blue-400/[0.03] border-blue-400/20"
              : status === "completed"
              ? "bg-blue-400/[0.02] border-blue-400/10 hover:border-blue-400/20"
              : status === "error"
              ? "bg-red-500/[0.03] border-red-500/20"
              : "bg-white/[0.01] border-white/[0.03] opacity-[0.4]"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`size-7 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-300 ${
              status === "completed" ? "bg-white/[0.04]" :
              status === "running" ? "bg-blue-400/10" :
              status === "error" ? "bg-red-500/10" :
              "bg-white/[0.02]"
            }`}>
              <step.icon className={`size-3.5 transition-colors duration-300 ${
                status === "completed" ? "text-white/40" :
                status === "running" ? "text-blue-400" :
                status === "error" ? "text-red-400" :
                "text-white/15"
              }`} />
            </div>
            <p className={`text-[13px] font-medium flex-1 transition-colors duration-300 ${
              status === "completed" ? "text-white/80" :
              status === "running" ? "text-white" :
              status === "error" ? "text-red-400" :
              "text-white/30"
            }`}>
              {step.label}
            </p>

            {status === "completed" ? (
              <div className="flex items-center gap-2.5 shrink-0">
                {elapsed != null && (
                  <span className="text-[10px] text-white/20 font-mono tabular-nums">{formatElapsed(elapsed)}</span>
                )}
                <div className="size-6 rounded-full bg-blue-400/15 flex items-center justify-center">
                  <Check className="size-3.5 text-blue-400/70" />
                </div>
              </div>
            ) : status === "running" ? (
              <div className="size-6 rounded-full bg-blue-400/15 flex items-center justify-center shrink-0">
                <Loader2 className="size-3.5 text-blue-400 animate-spin" />
              </div>
            ) : status === "error" ? (
              <div className="size-6 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                <X className="size-3.5 text-red-400" />
              </div>
            ) : (
              <div className="size-6 rounded-full bg-white/[0.03] flex items-center justify-center shrink-0">
                <Circle className="size-3 text-white/10" />
              </div>
            )}
          </div>

          {status === "running" && (
            <div className="mt-3 space-y-1.5">
              <div className="h-1.5 w-4/5 rounded-full bg-white/[0.04] animate-pulse" />
              <div className="h-1.5 w-3/5 rounded-full bg-white/[0.03] animate-pulse" />
            </div>
          )}

          {status === "completed" && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.02] border border-white/[0.03]">
                <ChevronRight className="size-2.5 text-white/15" />
                <span className="text-[11px] text-white/30">Input</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.02] border border-white/[0.03]">
                <span className="text-[11px] text-white/40 font-medium">{step.outputLabel}</span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// --- Optimization Process View ---
function OptimizationProcessView({ onClose, onCancel, onViewDiff, requestBody, activeSteps, onResult, onPipelineData }: { onClose: () => void; onCancel: () => void; onViewDiff: () => void; requestBody?: Record<string, any>; activeSteps: PipelineStep[]; onResult?: (data: any) => void; onPipelineData?: (steps: { id: string; label: string; status: string; elapsed: number }[], totalElapsed: number) => void }) {
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({})
  const [stepElapsed, setStepElapsed] = useState<Record<string, number>>({})
  const stepElapsedRef = useRef<Record<string, number>>({})
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [isCancelled, setIsCancelled] = useState(false)
  const [totalElapsed, setTotalElapsed] = useState(0)
  const [openStep, setOpenStep] = useState<string | null>(null)
  const startTimeRef = useRef(Date.now())
  const stepStartRef = useRef(Date.now())
  const stepIndexRef = useRef(0)
  const timersRef = useRef<NodeJS.Timeout[]>([])
  const activeStepRef = useRef<HTMLDivElement | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  /** Backend pipelineMs when the current step started — used for accurate elapsed */
  const stepStartMsRef = useRef<number>(0)

  // Stable refs for callbacks to avoid re-triggering the SSE effect
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult
  const onPipelineDataRef = useRef(onPipelineData)
  onPipelineDataRef.current = onPipelineData

  const completedCount = Object.values(stepStatuses).filter(s => s === "completed").length
  const progressPercent = Math.round((completedCount / activeSteps.length) * 100)

  // Auto-scroll to active step
  useEffect(() => {
    if (activeStepRef.current && scrollContainerRef.current) {
      activeStepRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [currentStepIndex])

  // Tick total elapsed every second
  useEffect(() => {
    if (isComplete || isCancelled) return
    const interval = setInterval(() => {
      setTotalElapsed(Date.now() - startTimeRef.current)
    }, 1000)
    return () => clearInterval(interval)
  }, [isComplete, isCancelled])

  const handleCancel = () => {
    abortRef.current?.abort()
    setIsCancelled(true)
    setTotalElapsed(Date.now() - startTimeRef.current)
  }

  // SSE-driven pipeline
  useEffect(() => {
    if (!requestBody) return

    setStepStatuses({ [activeSteps[0].id]: "running" })
    startTimeRef.current = Date.now()
    stepStartRef.current = Date.now()

    const controller = new AbortController()
    abortRef.current = controller

    ;(async () => {
      try {
        const response = await fetch("/api/answer-optimizer/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        })

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (reader) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event: OptimizerSSEEvent = JSON.parse(line.slice(6))
                const stepId = PHASE_TO_STEP[event.phase]

                if (event.phase === "complete") {
                  // Mark all remaining as completed
                  setIsComplete(true)
                  // Use backend pipeline duration if available for accuracy
                  const finalElapsed = event.pipelineMs ?? (Date.now() - startTimeRef.current)
                  setTotalElapsed(finalElapsed)
                  onResultRef.current?.(event.data)
                  // Emit pipeline step data for persistence
                  onPipelineDataRef.current?.(
                    activeSteps.map(s => ({ id: s.id, label: s.label, status: "completed", elapsed: stepElapsedRef.current[s.id] || 0 })),
                    finalElapsed,
                  )
                } else if (event.phase === "error") {
                  setIsCancelled(true)
                  setTotalElapsed(Date.now() - startTimeRef.current)
                } else if (stepId) {
                  if (event.status === "started") {
                    setStepStatuses(s => ({ ...s, [stepId]: "running" }))
                    const idx = activeSteps.findIndex(st => st.id === stepId)
                    if (idx >= 0) {
                      setCurrentStepIndex(idx)
                      // Use backend timestamp if available, fall back to local clock
                      stepStartMsRef.current = event.pipelineMs ?? (Date.now() - startTimeRef.current)
                      stepStartRef.current = Date.now()
                    }
                  } else if (event.status === "completed") {
                    // Use backend-authoritative timing to avoid SSE buffering skew
                    const elapsed = event.pipelineMs != null
                      ? event.pipelineMs - stepStartMsRef.current
                      : Date.now() - stepStartRef.current
                    setStepStatuses(s => ({ ...s, [stepId]: "completed" }))
                    setStepElapsed(e => ({ ...e, [stepId]: elapsed }))
                    stepElapsedRef.current[stepId] = elapsed
                  } else if (event.status === "failed") {
                    setStepStatuses(s => ({ ...s, [stepId]: "error" }))
                  }
                }
              } catch { /* skip unparseable lines */ }
            }
          }
        }
      } catch (e: any) {
        if (e.name !== "AbortError") {
          setIsCancelled(true)
          setTotalElapsed(Date.now() - startTimeRef.current)
        }
      }
    })()

    return () => controller.abort()
  }, [requestBody, activeSteps])

  const runningStep = !isComplete && !isCancelled ? activeSteps[currentStepIndex] : null

  const openStepData = openStep ? activeSteps.find(s => s.id === openStep) : null

  return (
    <div className="relative flex flex-col h-full">
      {/* Step detail popup — rendered at root level, never clipped */}
      {openStepData && (
        <StepDetailPopup step={openStepData} onClose={() => setOpenStep(null)} />
      )}

      {/* Header */}
      <div className="pb-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {isCancelled ? "Optimization Cancelled" : isComplete ? "Optimization Complete" : "Optimizing..."}
            </h3>
            {runningStep && (
              <div className="flex items-center gap-2 mt-1">
                <Loader2 className="size-3 text-blue-400 animate-spin" />
                <span className="text-xs text-white/40">Running: {runningStep.label}</span>
              </div>
            )}
          </div>
          {!isComplete && !isCancelled && (
            <button
              type="button"
              onClick={handleCancel}
              className="text-xs text-white/30 hover:text-white/60 transition-colors cursor-pointer outline-none px-3 py-1.5 rounded-full hover:bg-white/[0.04]"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out bg-white/80"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/[0.04]" />

      {/* Steps */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto pt-4 pb-4 pr-1 -mr-1 scrollbar-thin space-y-1">
        {activeSteps.map((step, i) => (
          <PipelineStepRow
            key={step.id}
            step={step}
            status={stepStatuses[step.id] || "pending"}
            isLast={i === activeSteps.length - 1}
            elapsed={stepElapsed[step.id]}
            stepRef={activeStepRef}
            isOpen={openStep === step.id}
            onToggle={() => setOpenStep(prev => prev === step.id ? null : step.id)}
          />
        ))}
      </div>

      {/* Footer */}
      {(isComplete || isCancelled) && (
        <div className="pt-4 mt-auto border-t border-white/[0.04] flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/[0.03]">
            <Clock className="size-3 text-white/25" />
            <span className="text-xs text-white/40 font-mono tabular-nums">{formatElapsed(totalElapsed)}</span>
            <span className="text-xs text-white/15">|</span>
            <span className="text-xs text-white/40 tabular-nums">{completedCount}/{activeSteps.length}</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={isCancelled ? onCancel : onClose}
              className="h-9 px-4 rounded-full text-sm text-white/50 hover:text-white hover:bg-white/[0.04]"
            >
              Close
            </Button>
            {isComplete && (
              <Button
                onClick={onViewDiff}
                className="h-9 px-5 rounded-full bg-white text-[#0a0a0a] hover:bg-white/90 hover:text-[#0a0a0a] text-sm font-medium shadow-sm hover:shadow-md transition-all border-0 gap-2"
              >
                View Diff
                <GitCompare className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function NewOptimizationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { brandProfile, selectedCountry } = useBrandProfile()
  const brandProfileId = brandProfile?.id

  const [selectedPost, setSelectedPost] = useState("")
  const [selectedPrompt, setSelectedPrompt] = useState("")
  const [selectedIcp, setSelectedIcp] = useState("")
  const [selectedTone, setSelectedTone] = useState("")
  const [selectedDepth, setSelectedDepth] = useState("")
  const [openSelect, setOpenSelect] = useState<string | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [enabledTools, setEnabledTools] = useState<Set<string>>(new Set(["query-ai-models", "scrape-citations", "research-stats"]))
  const [view, setView] = useState<"form" | "process" | "diff">("form")

  // Real data from APIs
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([])
  const [prompts, setPrompts] = useState<TrackedPrompt[]>([])
  const [icps, setIcps] = useState<IcpProfile[]>([])
  const [loadingData, setLoadingData] = useState(false)

  // SSE state
  const [requestBody, setRequestBody] = useState<Record<string, any> | null>(null)
  const [optimizationResult, setOptimizationResult] = useState<any>(null)
  const [pipelineStepsData, setPipelineStepsData] = useState<{ steps: { id: string; label: string; status: string; elapsed: number }[]; totalElapsed: number } | null>(null)
  const [isApplying, setIsApplying] = useState(false)
  const router = useRouter()

  // Fetch form data when dialog opens
  useEffect(() => {
    if (!open || !brandProfileId) return
    setLoadingData(true)

    const countryParam = selectedCountry ? `&country=${selectedCountry}` : ''
    Promise.all([
      fetch(`/api/answer-optimizer/blog-posts?brandProfileId=${brandProfileId}`).then(r => r.json()),
      fetch(`/api/answer-optimizer/prompts?brandProfileId=${brandProfileId}${countryParam}`).then(r => r.json()),
      fetch(`/api/answer-optimizer/icps?brandProfileId=${brandProfileId}`).then(r => r.json()),
    ]).then(([postsRes, promptsRes, icpsRes]) => {
      setBlogPosts((postsRes.pages || []).map((p: any) => ({
        id: p.id,
        title: p.page_url.split("/").filter(Boolean).pop()?.replace(/-/g, " ") || p.page_url,
        url: p.page_url,
      })))
      setPrompts((promptsRes.prompts || []).map((p: any) => ({
        id: String(p.id),
        text: p.text,
        category: p.category,
      })))
      setIcps(icpsRes.icps || [])
      setLoadingData(false)
    }).catch(() => setLoadingData(false))
  }, [open, brandProfileId, selectedCountry])

  const activeSteps = useMemo(() => getActiveSteps(enabledTools), [enabledTools])

  const resetForm = () => {
    setSelectedPost(""); setSelectedPrompt(""); setSelectedIcp(""); setSelectedTone("")
    setSelectedDepth("")
    setView("form")
    setRequestBody(null)
    setOptimizationResult(null)
  }

  const handleApplyChanges = async () => {
    if (!optimizationResult) return
    setIsApplying(true)

    try {
      const post = blogPosts.find(p => p.id === selectedPost)
      const prompt = prompts.find(p => p.id === selectedPrompt)
      const icpInfo = icps.find(i => i.id === selectedIcp)

      // Build slug from page URL
      const pageSlug = post?.url?.split("/").filter(Boolean).pop() || ""

      // Convert optimizer schema to contentLabSchema format if schema tool was enabled
      let contentLabSchema = null
      let schemaStatus = "none"
      if (optimizationResult.schemaMarkup?.length > 0) {
        const combined = optimizationResult.schemaMarkup
          .map((s: { type: string; jsonLd: string }) => s.jsonLd)
          .join("\n\n")
        contentLabSchema = {
          schemaType: "BlogPosting",
          scriptTag: `<script type="application/ld+json">\n${combined}\n</script>`,
          generatedAt: new Date().toISOString(),
          confidence: 0.85,
          sourceHash: "",
        }
        schemaStatus = "ready"
      }

      const response = await fetch("/api/campaigns/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: optimizationResult.metadata?.title || post?.title || "Optimized Content",
          body: optimizationResult.optimizedContent,
          type: "blog",
          mode: "optimizer",
          status: "draft",
          slug: pageSlug,
          prompt: prompt?.text || "",
          icp: icpInfo?.description || "",
          metadata: {
            metaDescription: optimizationResult.metadata?.metaDescription || "",
            sources: optimizationResult.metadata?.sources || [],
            contentLabSchema,
            schemaStatus,
            originalContent: optimizationResult.originalContent || "",
            optimizerSource: {
              originalUrl: post?.url || "",
              promptText: prompt?.text || "",
              promptCategory: prompt?.category || "",
              icpName: icpInfo?.name || "",
              icpDescription: icpInfo?.description || "",
              voiceTone: selectedTone || "professional",
              depthLevel: selectedDepth || "moderate",
              enabledTools: Array.from(enabledTools),
              originalWordCount: optimizationResult.metadata?.originalWordCount || 0,
              optimizedWordCount: optimizationResult.metadata?.wordCount || 0,
              diffStats: optimizationResult.diffStats || {},
              pipelineSteps: pipelineStepsData?.steps || [],
              pipelineTotalElapsed: pipelineStepsData?.totalElapsed || 0,
            },
          },
        }),
      })

      const data = await response.json()
      if (data.success && data.campaign?.id) {
        handleClose(false)
        router.push(`/dashboard/answer-optimizer/${data.campaign.id}`)
      } else {
        console.error("Failed to save optimized content:", data.error || 'Unknown error')
        // Show error inline since toast may not be available
        alert('Failed to save optimization. Please try again.')
      }
    } catch (error) {
      console.error("Failed to save optimized content:", error)
      alert('Failed to save optimization. Please try again.')
    } finally {
      setIsApplying(false)
    }
  }

  const handleClose = (v: boolean) => {
    onOpenChange(v)
    if (!v) resetForm()
  }

  const canOptimize = selectedPost && selectedPrompt

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[720px] max-h-[85vh] bg-[#141414] border-white/[0.08] text-white !flex !flex-col overflow-hidden">
        {/* Crossfade wrapper */}
        <div className="relative flex flex-col overflow-hidden min-w-0">
          {/* Process view */}
          <div className={`transition-all duration-300 ease-out ${
            view === "process"
              ? "opacity-100 translate-y-0 flex flex-col h-[min(65vh,620px)] overflow-hidden"
              : "opacity-0 translate-y-2 pointer-events-none absolute inset-0"
          }`}>
            {view === "process" && (
              <OptimizationProcessView
                onClose={() => handleClose(false)}
                onCancel={() => handleClose(false)}
                onViewDiff={() => setView("diff")}
                requestBody={requestBody || undefined}
                activeSteps={activeSteps}
                onResult={(data) => setOptimizationResult(data)}
                onPipelineData={(steps, totalElapsed) => setPipelineStepsData({ steps, totalElapsed })}
              />
            )}
          </div>

          {/* Diff view */}
          <div className={`transition-all duration-300 ease-out ${
            view === "diff"
              ? "opacity-100 translate-y-0 flex flex-col h-[min(65vh,620px)] overflow-hidden"
              : "opacity-0 translate-y-2 pointer-events-none absolute inset-0"
          }`}>
            {view === "diff" && (
              <ContentDiffView
                onBack={() => setView("process")}
                onClose={() => handleClose(false)}
                onApply={handleApplyChanges}
                isApplying={isApplying}
                sections={optimizationResult?.diffSections}
              />
            )}
          </div>

          {/* Form view */}
          <div className={`transition-all duration-300 ease-out min-w-0 ${
            view === "form"
              ? "opacity-100 translate-y-0 flex flex-col overflow-hidden"
              : "opacity-0 -translate-y-2 pointer-events-none absolute inset-0"
          }`}>
            {view === "form" && (
              <>
                <div className="min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin pb-4">
                <DialogHeader>
                  <DialogTitle className="text-white">New Optimization</DialogTitle>
                  <DialogDescription className="text-white/50">
                    Select a blog post and the prompt you want to optimize it for.
                  </DialogDescription>

                  {/* Page to optimize */}
                  <div className="pt-5 space-y-1.5">
                    <span className="text-xs font-medium text-white/50">Page to optimize</span>
                    <Select value={selectedPost} onValueChange={setSelectedPost} open={openSelect === "post"} onOpenChange={(v) => setOpenSelect(v ? "post" : null)}>
                      <SelectTrigger className={selectTriggerClass}>
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="size-4 text-white/30 shrink-0" />
                          <SelectValue placeholder="Select a blog post">
                            {selectedPost && (() => {
                              const post = blogPosts.find(p => p.id === selectedPost)
                              return post ? <span className="truncate">{post.title}</span> : null
                            })()}
                          </SelectValue>
                        </div>
                      </SelectTrigger>
                      <SelectContent className="bg-[#1b1b1b] border-0 rounded-lg" viewportClassName="max-h-[280px]">
                        {blogPosts.length === 0 ? (
                          <div className="px-3 py-6 text-center">
                            <p className="text-sm text-white/40">No blog posts available</p>
                            <p className="text-xs text-white/25 mt-1">Create content in Content Lab first</p>
                          </div>
                        ) : (
                          blogPosts.map((post) => (
                            <SelectItem key={post.id} value={post.id}>
                              <div className="flex flex-col">
                                <span className="text-sm">{post.title}</span>
                                <span className="text-xs text-white/40">{post.url}</span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Prompt to optimize for */}
                  <div className="pt-3 space-y-1.5">
                    <span className="text-xs font-medium text-white/50">Prompt to optimize for</span>
                    <Select value={selectedPrompt} onValueChange={setSelectedPrompt} open={openSelect === "prompt"} onOpenChange={(v) => setOpenSelect(v ? "prompt" : null)}>
                      <SelectTrigger className={selectTriggerClass}>
                        <div className="flex items-center gap-2 truncate">
                          <MessageSquare className="size-4 text-white/30 shrink-0" />
                          <SelectValue placeholder="Select a target prompt">
                            {selectedPrompt && (() => {
                              const prompt = prompts.find(p => p.id === selectedPrompt)
                              return prompt ? <span className="truncate">{prompt.text}</span> : null
                            })()}
                          </SelectValue>
                        </div>
                      </SelectTrigger>
                      <SelectContent className="bg-[#1b1b1b] border-0 rounded-lg" viewportClassName="max-h-[280px]">
                        {prompts.length === 0 ? (
                          <div className="px-3 py-6 text-center">
                            <p className="text-sm text-white/40">No tracked prompts available</p>
                            <p className="text-xs text-white/25 mt-1">Add prompts in Tracked Prompts first</p>
                          </div>
                        ) : (
                          prompts.map((prompt) => (
                            <SelectItem key={prompt.id} value={prompt.id}>
                              <div className="flex flex-col">
                                <span className="text-sm">{prompt.text}</span>
                                <span className="text-xs text-white/40">{prompt.category}</span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Customer Profile + Voice & Tone */}
                  <div className="pt-2 grid grid-cols-2 gap-3">
                    <Select value={selectedIcp} onValueChange={setSelectedIcp} open={openSelect === "icp"} onOpenChange={(v) => setOpenSelect(v ? "icp" : null)}>
                      <SelectTrigger className={selectTriggerClass}>
                        <div className="flex items-center gap-2 truncate">
                          <UserCircle className="size-4 text-white/30 shrink-0" />
                          <SelectValue placeholder="Customer profile">
                            {selectedIcp && (() => {
                              const icp = icps.find(p => p.id === selectedIcp)
                              return icp ? <span className="truncate">{icp.name}</span> : null
                            })()}
                          </SelectValue>
                        </div>
                      </SelectTrigger>
                      <SelectContent className="bg-[#1b1b1b] border-0 rounded-lg" viewportClassName="max-h-[280px]">
                        {icps.length === 0 ? (
                          <div className="px-3 py-6 text-center">
                            <p className="text-sm text-white/40">No profiles available</p>
                            <p className="text-xs text-white/25 mt-1">Create in Brand Profile</p>
                          </div>
                        ) : (
                          icps.map((icp) => (
                            <SelectItem key={icp.id} value={icp.id}>
                              <div className="flex flex-col">
                                <span className="text-sm">{icp.name}</span>
                                <span className="text-xs text-white/40">{icp.description}</span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>

                    <Select value={selectedTone} onValueChange={setSelectedTone} open={openSelect === "tone"} onOpenChange={(v) => setOpenSelect(v ? "tone" : null)}>
                      <SelectTrigger className={selectTriggerClass}>
                        <div className="flex items-center gap-2">
                          <Mic className="size-4 text-white/30 shrink-0" />
                          <SelectValue placeholder="Voice & tone" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="bg-[#1b1b1b] border-0 rounded-lg">
                        <SelectItem value="professional">Professional & Authoritative</SelectItem>
                        <SelectItem value="conversational">Conversational & Friendly</SelectItem>
                        <SelectItem value="technical">Technical & Precise</SelectItem>
                        <SelectItem value="educational">Educational & Informative</SelectItem>
                        <SelectItem value="persuasive">Persuasive & Compelling</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Optimization Depth — Card Selector */}
                  <div className="pt-4 space-y-1.5">
                    <span className="text-xs font-medium text-white/50">Optimization depth</span>
                    <div className="grid grid-cols-3 gap-3">
                      {([
                        { value: "light", label: "Light Touch", desc: "Small tweaks, keep your structure", icon: Pencil, recommended: false },
                        { value: "moderate", label: "Smart Rewrite", desc: "Rewrite key sections for AI engines", icon: RefreshCw, recommended: true },
                        { value: "deep", label: "Deep Overhaul", desc: "Rebuild from scratch for max citations", icon: PenTool, recommended: false },
                      ] as const).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setSelectedDepth(opt.value)}
                          className={`relative flex flex-col items-start gap-2 rounded-lg p-4 text-left transition-all duration-200 ease-out active:scale-[0.97] cursor-pointer ${
                            selectedDepth === opt.value
                              ? "bg-white/[0.06] ring-[1.5px] ring-inset ring-blue-400"
                              : "bg-[#1b1b1b] hover:bg-[#1f1f1f] ring-1 ring-white/[0.04]"
                          }`}
                        >
                          <opt.icon className={`size-4 ${selectedDepth === opt.value ? "text-blue-400" : "text-white/30"} transition-colors`} />
                          {opt.recommended && (
                            <span className="absolute top-2 right-2 text-[9px] font-medium text-blue-400 bg-blue-400/10 px-1.5 py-px rounded-full">Recommended</span>
                          )}
                          <div>
                            <p className={`text-sm font-medium ${selectedDepth === opt.value ? "text-white" : "text-white/70"} transition-colors`}>{opt.label}</p>
                            <p className="text-xs text-white/35 mt-0.5 leading-relaxed">{opt.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* AI Agent Tools */}
                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={() => setAdvancedOpen(!advancedOpen)}
                      className="flex items-center gap-2 text-sm text-white/40 hover:text-white/60 transition-colors cursor-pointer outline-none"
                    >
                      <ChevronDown className={`size-3.5 transition-transform duration-200 ${advancedOpen ? "rotate-0" : "-rotate-90"}`} />
                      <span>AI Agent Tools</span>
                      <span className="text-[11px] text-white/30 bg-white/[0.06] px-2 py-0.5 rounded-full">{enabledTools.size} enabled</span>
                    </button>

                    <div className={`grid transition-all duration-300 ease-out ${advancedOpen ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0 mt-0"}`}>
                      <div className="overflow-hidden p-[3px] -m-[3px]">
                    <div className="grid grid-cols-3 gap-3">
                      {([
                        { id: "query-ai-models", name: "Query AI Models", desc: "Ask ChatGPT, Claude, Perplexity & Gemini what they cite", icon: AIModelsIcon },
                        { id: "scrape-citations", name: "Scrape Citations", desc: "Crawl URLs that AI models cite as authoritative", icon: ScanText },
                        { id: "research-stats", name: "Fresh Research", desc: "Find current stats, data & expert quotes — powered by Firecrawl", icon: FirecrawlIcon },
                        { id: "competitor-analysis", name: "Competitor Analysis", desc: "Analyze top-ranking pages to find content gaps", icon: Swords },
                        { id: "internal-links", name: "Internal Links", desc: "Scan your sitemap for linking opportunities", icon: Link },
                        { id: "schema-markup", name: "Schema Markup", desc: "Auto-generate FAQ, Article & HowTo schema", icon: Braces },
                      ] as const).map((tool) => {
                        const enabled = enabledTools.has(tool.id)
                        // scrape-citations requires query-ai-models
                        const isDisabled = tool.id === "scrape-citations" && !enabledTools.has("query-ai-models")
                        return (
                          <button
                            key={tool.id}
                            type="button"
                            onClick={() => {
                              if (isDisabled) return
                              const next = new Set(enabledTools)
                              if (tool.id === "query-ai-models" && next.has(tool.id)) {
                                next.delete("query-ai-models")
                                next.delete("scrape-citations")
                              } else {
                                next.has(tool.id) ? next.delete(tool.id) : next.add(tool.id)
                              }
                              setEnabledTools(next)
                            }}
                            className={`relative flex flex-col items-start gap-3 rounded-lg p-4 text-left transition-all duration-200 ease-out active:scale-[0.97] cursor-pointer outline-none ${
                              isDisabled
                                ? "bg-[#1b1b1b] ring-1 ring-white/[0.04] opacity-40 cursor-not-allowed"
                                : enabled
                                ? "bg-white/[0.06] ring-[1.5px] ring-inset ring-blue-400"
                                : "bg-[#1b1b1b] hover:bg-[#1f1f1f] ring-1 ring-white/[0.04]"
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <tool.icon className={`size-4 ${isDisabled ? "text-white/15" : enabled ? "text-blue-400" : "text-white/30"} transition-colors`} />
                              <div className={`size-4 rounded-full border-2 flex items-center justify-center transition-all ${
                                isDisabled ? "border-white/10" : enabled ? "border-blue-400 bg-blue-400" : "border-white/20"
                              }`}>
                                {enabled && (
                                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 5L4.5 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                )}
                              </div>
                            </div>
                            <div>
                              <p className={`text-sm font-medium ${enabled ? "text-white" : "text-white/60"} transition-colors`}>{tool.name}</p>
                              <p className="text-[11px] text-white/30 mt-0.5 leading-relaxed">{tool.desc}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                      </div>
                    </div>
                  </div>
                </DialogHeader>

                <div className="flex items-center justify-between pt-4 shrink-0 border-t border-white/[0.04] mt-3">
                  {!canOptimize && (
                    <p className="text-[11px] text-white/25">Select a page and prompt to continue</p>
                  )}
                  <div className={!canOptimize ? "" : "ml-auto"}>
                    <Button
                      onClick={() => {
                        const post = blogPosts.find(p => p.id === selectedPost)
                        const prompt = prompts.find(p => p.id === selectedPrompt)
                        setRequestBody({
                          pageUrl: post?.url || '',
                          promptText: prompt?.text || '',
                          promptId: parseInt(selectedPrompt),
                          brandProfileId,
                          depthLevel: selectedDepth || 'moderate',
                          voiceTone: selectedTone || 'professional',
                          icpDescription: icps.find(i => i.id === selectedIcp)?.description || '',
                          enabledTools: {
                            queryAiModels: enabledTools.has('query-ai-models'),
                            scrapeCitations: enabledTools.has('scrape-citations'),
                            freshResearch: enabledTools.has('research-stats'),
                            competitorAnalysis: enabledTools.has('competitor-analysis'),
                            internalLinks: enabledTools.has('internal-links'),
                            schemaMarkup: enabledTools.has('schema-markup'),
                          },
                          brandContext: {
                            brandName: brandProfile?.companyName || '',
                            brandWebsite: brandProfile?.companyWebsite || '',
                            brandDescription: brandProfile?.companyDescription || '',
                            brandIndustry: brandProfile?.companyIndustry || '',
                            competitors: brandProfile?.competitors || [],
                            userName: brandProfile?.userName || '',
                            userRole: brandProfile?.userRole || '',
                          },
                        })
                        setView("process")
                      }}
                      disabled={!canOptimize}
                      className="h-9 px-5 rounded-full bg-white text-[#0a0a0a] hover:bg-white/90 hover:text-[#0a0a0a] text-sm font-medium shadow-sm hover:shadow-md transition-all border-0 gap-2 disabled:opacity-50"
                    >
                      Optimize
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface OptimizationRow {
  id: string
  title: string
  status: string
  sourceUrl: string
  promptText: string
  depthLevel: string
  voiceTone: string
  enabledTools: string[]
  originalWordCount: number
  optimizedWordCount: number
  createdAt: number
  pipelineSteps: { id: string; label: string; status: string; elapsed: number }[]
  pipelineTotalElapsed: number
}

function formatTimeAgo(timestamp: number) {
  const diffInSeconds = Math.floor((Date.now() - timestamp) / 1000)
  if (diffInSeconds < 60) return "Just now"
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  const days = Math.floor(diffInSeconds / 86400)
  return days === 1 ? "1d ago" : `${days}d ago`
}

const DEPTH_LABELS: Record<string, string> = {
  light: "Light Touch",
  moderate: "Smart Rewrite",
  deep: "Deep Overhaul",
}

function AnswerOptimizerPageInner() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [optimizations, setOptimizations] = useState<OptimizationRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchOptimizations = async () => {
      setIsLoading(true)
      try {
        const res = await fetch("/api/campaigns/save?status=all")
        const data = await res.json()
        if (data.success && data.campaigns) {
          const optimizerCampaigns = data.campaigns
            .filter((c: any) => c.mode === "optimizer")
            .map((c: any) => {
              const meta = typeof c.metadata === "object" && c.metadata ? c.metadata : {}
              const src = meta.optimizerSource || {}
              return {
                id: c.id,
                title: c.title,
                status: c.status === "draft" ? "Draft" : "Published",
                sourceUrl: src.originalUrl || "",
                promptText: src.promptText || c.prompt || "",
                depthLevel: src.depthLevel || "moderate",
                voiceTone: src.voiceTone || "professional",
                enabledTools: src.enabledTools || [],
                originalWordCount: src.originalWordCount || 0,
                optimizedWordCount: src.optimizedWordCount || 0,
                createdAt: new Date(c.createdAt).getTime(),
                pipelineSteps: src.pipelineSteps || [],
                pipelineTotalElapsed: src.pipelineTotalElapsed || 0,
              }
            })
          setOptimizations(optimizerCampaigns)
        }
      } catch (error) {
        console.error("Failed to load optimizations:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchOptimizations()
  }, [dialogOpen])

  return (
    <SidebarProvider
      className="bg-dark-grey"
      style={
        {
          "--sidebar-width": "16rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <Separator className="w-full border-border" />
        <div className="flex flex-1 flex-col bg-dark-grey">
          <div className="@container/main flex flex-1 flex-col bg-dark-grey">
            {/* Page Header */}
            <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">Answer Optimizer</h1>
                  <p className="text-sm text-white/60">Optimize your brand's answers across AI-powered search engines</p>
                </div>
                <Button
                  onClick={() => setDialogOpen(true)}
                  className="h-9 px-4 rounded-full bg-white text-[#0a0a0a] hover:bg-white/90 hover:text-[#0a0a0a] text-sm font-medium shadow-sm hover:shadow-md transition-all border-0 gap-2"
                >
                  <Plus className="size-4" />
                  New Optimization
                </Button>
              </div>
            </div>

            {/* Divider */}
            <div className="h-[0.25px] bg-white/10"></div>

            <div className="flex-1 px-4 lg:px-6 py-6">
              {isLoading ? (
                /* Loading skeleton */
                <div className="rounded-xl border border-white/[0.04] bg-[#111111] overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.02]">
                        <TableHead className="text-white/35 font-medium h-10 text-[11px] uppercase tracking-wider pl-4">Title</TableHead>
                        <TableHead className="text-white/35 font-medium h-10 text-[11px] uppercase tracking-wider">Source</TableHead>
                        <TableHead className="text-white/35 font-medium h-10 text-[11px] uppercase tracking-wider">Depth</TableHead>
                        <TableHead className="text-white/35 font-medium h-10 text-[11px] uppercase tracking-wider">Status</TableHead>
                        <TableHead className="text-white/35 font-medium h-10 text-[11px] uppercase tracking-wider">Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i} className={i === 0 ? "border-0" : "border-white/[0.04]"}>
                          <TableCell className="py-3.5 pl-4">
                            <div className="flex items-center gap-3">
                              <Skeleton className="size-2 rounded-full bg-blue-400/20" />
                              <Skeleton className="h-4 w-48 bg-white/[0.06] rounded" />
                            </div>
                          </TableCell>
                          <TableCell className="py-3.5"><Skeleton className="h-3 w-32 bg-white/[0.04] rounded" /></TableCell>
                          <TableCell className="py-3.5"><Skeleton className="h-5 w-20 bg-white/[0.04] rounded-md" /></TableCell>
                          <TableCell className="py-3.5"><Skeleton className="h-5 w-16 bg-white/[0.04] rounded-md" /></TableCell>
                          <TableCell className="py-3.5"><Skeleton className="h-3 w-10 bg-white/[0.03] rounded" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : optimizations.length === 0 ? (
                /* Empty State */
                <div className="flex flex-col items-center justify-center py-20 px-6 rounded-lg border border-white/[0.04] bg-[#0f0f0f]/50">
                  <div aria-hidden="true" className="w-20 space-y-2.5 rounded-lg p-2.5 shadow-lg shadow-black/20 ring-1 ring-white/[0.08] bg-white/[0.04] mb-5">
                    <div className="flex items-center gap-1.5">
                      <div className="size-3 rounded-full bg-white/[0.12]" />
                      <div className="h-1 w-5 rounded-full bg-white/[0.12]" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <div className="h-1 w-3 rounded-full bg-white/[0.10]" />
                        <div className="h-1 w-8 rounded-full bg-white/[0.10]" />
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-1 w-3 rounded-full bg-white/[0.10]" />
                        <div className="h-1 w-8 rounded-full bg-white/[0.10]" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-1 w-full rounded-full bg-white/[0.10]" />
                      <div className="flex items-center gap-1">
                        <div className="h-1 w-2/3 rounded-full bg-white/[0.10]" />
                        <div className="h-1 w-1/3 rounded-full bg-white/[0.10]" />
                      </div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto size-3 text-white/25">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                  <div className="text-sm font-medium text-white/70 mb-1">No optimizations yet</div>
                  <div className="text-xs text-white/40 mb-5">
                    Analyze AI answers about your brand and get actionable suggestions to improve visibility.
                  </div>
                  <Button
                    onClick={() => setDialogOpen(true)}
                    className="h-8 px-4 rounded-full bg-white text-[#0a0a0a] hover:bg-white/90 hover:text-[#0a0a0a] text-xs font-medium shadow-sm hover:shadow-md transition-all border-0 gap-2"
                  >
                    Get Started
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              ) : (
                /* Optimizations Table */
                <div className="rounded-xl border border-white/[0.04] bg-[#111111] overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.02]">
                        <TableHead className="text-white/35 font-medium h-10 text-[11px] uppercase tracking-wider pl-4">Title</TableHead>
                        <TableHead className="text-white/35 font-medium h-10 text-[11px] uppercase tracking-wider">Source</TableHead>
                        <TableHead className="text-white/35 font-medium h-10 text-[11px] uppercase tracking-wider">Depth</TableHead>
                        <TableHead className="text-white/35 font-medium h-10 text-[11px] uppercase tracking-wider">Status</TableHead>
                        <TableHead className="text-white/35 font-medium h-10 text-[11px] uppercase tracking-wider">Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {optimizations.map((o, idx) => {
                        const sourcePath = o.sourceUrl ? (() => { try { return new URL(o.sourceUrl).pathname } catch { return o.sourceUrl } })() : null

                        return (
                          <TableRow
                            key={o.id}
                            onClick={() => router.push(`/dashboard/answer-optimizer/${o.id}`)}
                            className={`hover:bg-white/[0.03] cursor-pointer group transition-colors ${idx === 0 ? "border-0" : "border-white/[0.04]"}`}
                          >
                            <TableCell className="py-3.5 pl-4 max-w-md">
                              <div className="flex items-center gap-3">
                                <div className="relative shrink-0 flex items-center justify-center size-4">
                                  <span className="absolute inset-0 rounded-full bg-blue-400/10 animate-pulse" />
                                  <span className="relative size-1.5 rounded-full bg-blue-400/70" />
                                </div>
                                <span className="text-[13px] font-medium text-white/85 truncate group-hover:text-white transition-colors">
                                  {o.title}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="py-3.5 max-w-[180px]">
                              <span className="text-[12px] text-white/30 font-mono truncate block">{sourcePath || "—"}</span>
                            </TableCell>
                            <TableCell className="py-3.5">
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.05]">
                                <div className={`w-1.5 h-1.5 rounded-full ${o.depthLevel === "deep" ? "bg-violet-400" : o.depthLevel === "light" ? "bg-blue-400" : "bg-violet-400/60"}`} />
                                <span className="text-[11px] text-white/50 font-medium">{DEPTH_LABELS[o.depthLevel] || o.depthLevel}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-3.5">
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.05]">
                                <div className={`w-1.5 h-1.5 rounded-full ${o.status === "Published" ? "bg-emerald-400" : "bg-white/30"}`} />
                                <span className="text-[11px] text-white/50 font-medium">{o.status}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-3.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-white/30 tabular-nums">{formatTimeAgo(o.createdAt)}</span>
                                <ChevronRight className="size-3.5 text-white/10 group-hover:text-white/35 transition-colors shrink-0" />
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>

      <NewOptimizationDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </SidebarProvider>
  )
}

export default function AnswerOptimizerPage() {
  return (
    <BrandProfileProvider>
      <AnswerOptimizerPageInner />
    </BrandProfileProvider>
  )
}
