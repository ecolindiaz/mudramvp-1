"use client"

import React from "react"
import Link from "next/link"
import { BrandProfileProvider } from "@/components/brand-profile-context"
import { CampaignEditor } from "@/components/editor/campaign-editor"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Save, Clock, Copy as CopyIcon, Check, Link as LinkIcon, Loader2,
  FileText, Edit, ChevronDown, Sparkles, Globe, ScanText, Search,
  Swords, Braces, ArrowLeft, Crosshair, HelpCircle, ListFilter,
  GitCompare, type LucideIcon,
} from "lucide-react"

// --- Pipeline step icon & description lookups ---
const STEP_ICON_MAP: Record<string, LucideIcon> = {
  "scrape": ScanText,
  "query-ai": Search,
  "scrape-citations": ScanText,
  "derive-query": Crosshair,
  "faq-research": HelpCircle,
  "competitor-analysis": Swords,
  "gap-analysis": ListFilter,
  "research": Search,
  "content-optimization": Sparkles,
  "finalize": GitCompare,
}

const STEP_DESCRIPTION_MAP: Record<string, string> = {
  "scrape": "Fetching and parsing target page content",
  "query-ai": "Querying AI models for current answers",
  "scrape-citations": "Scraping cited sources from AI responses",
  "derive-query": "Identifying the core search query",
  "faq-research": "Researching FAQ & People Also Ask",
  "competitor-analysis": "Analyzing top-ranking competitors",
  "gap-analysis": "Identifying content gaps to fill",
  "research": "Enriching with statistics & quotes",
  "content-optimization": "Rewriting and optimizing content",
  "finalize": "Computing diffs and generating schema",
}

const DEPTH_LABELS: Record<string, string> = {
  light: "Light Touch",
  moderate: "Smart Rewrite",
  deep: "Deep Overhaul",
}

const TOOL_DEFS = [
  { id: "query-ai-models", label: "AI Models", icon: Search },
  { id: "scrape-citations", label: "Citations", icon: ScanText },
  { id: "research-stats", label: "Research", icon: Globe },
  { id: "competitor-analysis", label: "Competitors", icon: Swords },
  { id: "internal-links", label: "Links", icon: LinkIcon },
  { id: "schema-markup", label: "Schema", icon: Braces },
] as const

function formatPipelineElapsed(ms: number): string {
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}m ${secs}s`
}

function countWordsInMarkdown(content: string): number {
  if (!content || content.trim().length === 0) return 0
  let text = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/!\[([^\]]*)\]\([^\)]+\)/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^[\s]*[-*+]\s+/gm, "")
    .replace(/^[\s]*\d+\.\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return text.split(/\s+/).filter((w) => w.replace(/^[^\w]+|[^\w]+$/g, "").length > 0).length
}

interface OptimizerSource {
  originalUrl: string
  promptText: string
  promptCategory: string
  icpName: string
  icpDescription: string
  voiceTone: string
  depthLevel: string
  enabledTools: string[]
  originalWordCount: number
  optimizedWordCount: number
  diffStats: { added?: number; removed?: number; newSections?: number }
  pipelineSteps?: { id: string; label: string; status: string; elapsed: number }[]
  pipelineTotalElapsed?: number
}

// ─── Main Page Component ─────────────────────────────────────────────

function OptimizerDetailPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
  const [title, setTitle] = React.useState("Untitled")
  const [body, setBody] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(true)
  const [contentLoaded, setContentLoaded] = React.useState(false)
  const [editMode, setEditMode] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [savedAt, setSavedAt] = React.useState<number | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<"overview" | "workflow">("overview")
  const [optimizerSource, setOptimizerSource] = React.useState<OptimizerSource | null>(null)
  const [expandedStep, setExpandedStep] = React.useState<string | null>(null)

  // Load campaign content
  React.useEffect(() => {
    const loadContent = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/campaigns/${id}`)
        if (!response.ok) return
        const data = await response.json()
        if (!data.success || !data.campaign) return

        const campaign = data.campaign
        setTitle(campaign.title || "Untitled")
        setBody(campaign.body || "")
        setSavedAt(campaign.updatedAt ? new Date(campaign.updatedAt).getTime() : null)

        // Parse optimizer source from metadata
        const metadata =
          campaign.metadata && typeof campaign.metadata === "object"
            ? campaign.metadata
            : {}
        const optSource = (metadata as any).optimizerSource
        if (optSource && typeof optSource === "object") {
          setOptimizerSource(optSource)
        }

        setContentLoaded(true)
      } catch (error) {
        console.error("Failed to load optimization:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadContent()
  }, [id])

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch("/api/campaigns/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title, body, type: "blog", mode: "optimizer", status: "draft" }),
      })
      if (response.ok) setSavedAt(Date.now())
    } catch (error) {
      console.error("Failed to save:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(body)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const steps = optimizerSource?.pipelineSteps || []
  const totalElapsed = optimizerSource?.pipelineTotalElapsed || 0

  return (
    <SidebarProvider className="bg-dark-grey" style={{ "--sidebar-width": "16rem" } as React.CSSProperties}>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <Separator className="w-full border-border" />
        <div className="flex flex-1 flex-col bg-dark-grey">
          <div className="@container/main flex flex-1 flex-col bg-dark-grey">
            {/* Header */}
            <div className="px-4 lg:px-6 pt-4 pb-3">
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard/answer-optimizer"
                  className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
                >
                  <ArrowLeft className="size-3.5" />
                  Back
                </Link>
                <Separator orientation="vertical" className="h-4 bg-white/10" />
                <h1 className="text-sm font-medium text-white truncate">{title}</h1>
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 rounded-full bg-white/5 text-white hover:bg-white/10 border-white/[0.04] text-xs font-medium gap-1.5"
                    onClick={handleCopy}
                  >
                    {copied ? <Check className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-8 px-3 rounded-full text-xs font-medium gap-1.5 ${editMode ? "bg-primary text-white hover:bg-primary/90 border-primary" : "bg-white/5 text-white hover:bg-white/10 border-white/[0.04]"}`}
                    onClick={() => setEditMode((v) => !v)}
                  >
                    <Edit className="size-3.5" /> {editMode ? "Editing" : "Edit"}
                  </Button>
                  {editMode && (
                    <Button
                      size="sm"
                      className="h-8 px-4 rounded-full bg-white text-[#0a0a0a] hover:bg-white/90 hover:text-[#0a0a0a] text-xs font-medium gap-1.5 border-0"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                      Save
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="h-[0.25px] bg-white/10" />

            {/* Content Area */}
            <div className="flex-1 px-4 lg:px-6 py-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="size-6 text-white/30 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start h-full">
                  {/* Editor (left 2 cols) */}
                  <div className="lg:col-span-2 flex flex-col">
                    <Card className="rounded-2xl border border-white/[0.04] bg-[#1a1a1a] overflow-hidden shadow-sm flex flex-col">
                      <CardHeader className="pb-2 px-5 pt-4 flex-shrink-0">
                        <CardTitle className="text-base font-semibold text-white">Content</CardTitle>
                        <CardDescription className="text-white/60 text-xs mt-0.5">
                          Optimized content preview{editMode ? " — editing" : ""}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1 px-0 py-0 min-h-[400px] max-h-[calc(100vh-260px)] overflow-y-auto">
                        {contentLoaded && (
                          <CampaignEditor
                            value={body}
                            onChange={setBody}
                            readOnly={!editMode}
                            showToolbar={editMode}
                          />
                        )}
                      </CardContent>
                    </Card>
                    {savedAt && (
                      <div className="flex items-center text-xs text-white/60 px-1 mt-2">
                        <span>Saved {new Date(savedAt).toLocaleTimeString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Right Sidebar */}
                  <div className="flex flex-col h-full self-start">
                    <Card className="rounded-2xl border border-white/[0.04] bg-[#1a1a1a] overflow-hidden shadow-sm flex flex-col w-full flex-1 min-h-0">
                      <CardContent className="p-0 flex flex-col flex-1 min-h-0">
                        {/* Tab bar */}
                        <div className="px-5 pt-4 pb-3 border-b border-white/[0.04] flex-shrink-0">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setActiveTab("overview")}
                              className={`flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium transition-colors ${
                                activeTab === "overview"
                                  ? "bg-white/[0.08] text-white"
                                  : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
                              }`}
                            >
                              <FileText className="w-3.5 h-3.5 opacity-70" />
                              Overview
                            </button>
                            <button
                              onClick={() => setActiveTab("workflow")}
                              className={`flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium transition-colors ${
                                activeTab === "workflow"
                                  ? "bg-white/[0.08] text-white"
                                  : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
                              }`}
                            >
                              <Sparkles className="w-3.5 h-3.5 opacity-70" />
                              Workflow
                            </button>
                          </div>
                        </div>

                        {/* Tab content */}
                        <div className="flex-1 overflow-y-auto">
                          {activeTab === "overview" ? (
                            <div className="p-5 space-y-4">
                              {/* Source */}
                              {optimizerSource && (
                                <>
                                  <div className="space-y-2.5 pb-4 border-b border-white/[0.06]">
                                    <h3 className="text-sm font-semibold text-white">Optimization</h3>
                                    <div className="space-y-2.5">
                                      <div className="flex items-start justify-between gap-4">
                                        <span className="text-white/60 text-xs font-medium uppercase tracking-wide min-w-[60px]">Source</span>
                                        <span className="text-white/90 text-sm truncate text-right flex-1 font-mono" title={optimizerSource.originalUrl}>
                                          {optimizerSource.originalUrl ? (() => { try { return new URL(optimizerSource.originalUrl).pathname } catch { return optimizerSource.originalUrl } })() : "—"}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between gap-4">
                                        <span className="text-white/60 text-xs font-medium uppercase tracking-wide">Depth</span>
                                        <Badge variant="outline" className="capitalize bg-white/5 border-white/[0.04] text-white/90 text-xs">
                                          {DEPTH_LABELS[optimizerSource.depthLevel] || optimizerSource.depthLevel}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center justify-between gap-4">
                                        <span className="text-white/60 text-xs font-medium uppercase tracking-wide">Voice</span>
                                        <Badge variant="outline" className="capitalize bg-white/5 border-white/[0.04] text-white/90 text-xs">
                                          {optimizerSource.voiceTone || "Professional"}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center justify-between gap-4">
                                        <span className="text-white/60 text-xs font-medium uppercase tracking-wide">Words</span>
                                        <span className="text-white/90 text-sm tabular-nums">
                                          {optimizerSource.originalWordCount.toLocaleString()}
                                          <span className="text-white/30 mx-1">&rarr;</span>
                                          {optimizerSource.optimizedWordCount.toLocaleString()}
                                          {optimizerSource.optimizedWordCount > optimizerSource.originalWordCount && (
                                            <span className="text-emerald-400/70 ml-1 text-xs">
                                              +{(optimizerSource.optimizedWordCount - optimizerSource.originalWordCount).toLocaleString()}
                                            </span>
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Tools Used */}
                                  <div className="space-y-2.5 pb-4 border-b border-white/[0.06]">
                                    <h3 className="text-sm font-semibold text-white">Tools</h3>
                                    <div className="flex flex-wrap gap-1.5">
                                      {TOOL_DEFS.map((tool) => {
                                        const enabled = optimizerSource.enabledTools.includes(tool.id)
                                        if (!enabled) return null
                                        return (
                                          <div
                                            key={tool.id}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-violet-500/10 text-violet-300/80 border border-violet-500/20"
                                          >
                                            <tool.icon className="size-3" />
                                            {tool.label}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                </>
                              )}

                              {/* Word Count */}
                              <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-4 space-y-2">
                                <h3 className="text-sm font-semibold text-white">Word Count</h3>
                                <div className="text-4xl font-bold text-white tracking-tight">
                                  {countWordsInMarkdown(body).toLocaleString()}
                                </div>
                                <p className="text-xs text-white/60">Total words in content</p>
                              </div>
                            </div>
                          ) : (
                            /* Workflow Tab */
                            <div className="p-5 space-y-0.5">
                              {/* Summary */}
                              {optimizerSource && (
                                <div className="mb-4 pb-4 border-b border-white/[0.06]">
                                  <div className="flex items-center gap-3 text-xs">
                                    <div className="flex items-center gap-1.5 text-white/50">
                                      <ScanText className="size-3" />
                                      <span className="font-mono truncate">
                                        {optimizerSource.originalUrl ? (() => { try { return new URL(optimizerSource.originalUrl).pathname } catch { return optimizerSource.originalUrl } })() : "—"}
                                      </span>
                                    </div>
                                    {totalElapsed > 0 && (
                                      <>
                                        <span className="text-white/20 shrink-0">|</span>
                                        <span className="text-white/40 font-mono tabular-nums shrink-0">{formatPipelineElapsed(totalElapsed)}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Steps */}
                              {steps.length > 0 ? (
                                steps.map((step, i) => {
                                  const StepIcon = STEP_ICON_MAP[step.id] || Sparkles
                                  const isExpanded = expandedStep === step.id
                                  const description = STEP_DESCRIPTION_MAP[step.id] || ""

                                  return (
                                    <div key={step.id}>
                                      {i > 0 && (
                                        <div className="flex justify-start pl-[15px] h-4">
                                          <div className="w-px h-full border-l border-dashed border-white/[0.08]" />
                                        </div>
                                      )}

                                      <button
                                        onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                                        className="w-full text-left rounded-xl border px-4 py-3 transition-all bg-white/[0.02] border-white/[0.05] hover:border-white/[0.10] hover:bg-white/[0.03]"
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className="size-7 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                                            <StepIcon className="size-3.5 text-white/40" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-medium text-white/80 truncate">{step.label}</p>
                                            {description && !isExpanded && (
                                              <p className="text-[11px] text-white/30 truncate mt-0.5">{description}</p>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2.5 shrink-0">
                                            {step.elapsed > 0 && (
                                              <span className="text-[10px] text-white/20 font-mono tabular-nums">
                                                {formatPipelineElapsed(step.elapsed)}
                                              </span>
                                            )}
                                            <div className="size-5 rounded-full bg-emerald-500/15 flex items-center justify-center">
                                              <Check className="size-3 text-emerald-400/70" />
                                            </div>
                                            <ChevronDown className={`size-3.5 text-white/20 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                                          </div>
                                        </div>

                                        {isExpanded && description && (
                                          <div className="mt-3 pt-3 border-t border-white/[0.04]">
                                            <p className="text-[12px] text-white/40 leading-relaxed">{description}</p>
                                          </div>
                                        )}
                                      </button>
                                    </div>
                                  )
                                })
                              ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                  <div className="size-10 rounded-xl bg-white/[0.04] flex items-center justify-center mb-3">
                                    <Sparkles className="size-5 text-white/20" />
                                  </div>
                                  <p className="text-sm text-white/40">No step data available</p>
                                  <p className="text-xs text-white/25 mt-1">Pipeline timing is recorded for new optimizations</p>
                                </div>
                              )}

                              {/* Footer */}
                              {totalElapsed > 0 && (
                                <div className="pt-4 mt-4 border-t border-white/[0.06]">
                                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/[0.04]">
                                    <Clock className="size-3 text-white/25" />
                                    <span className="text-xs text-white/40 font-mono tabular-nums">{formatPipelineElapsed(totalElapsed)}</span>
                                    <span className="text-xs text-white/15">|</span>
                                    <span className="text-xs text-white/40 tabular-nums">{steps.length} steps</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function OptimizerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <BrandProfileProvider>
      <OptimizerDetailPageInner params={params} />
    </BrandProfileProvider>
  )
}
