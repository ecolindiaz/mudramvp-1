"use client"

import React from "react"
import Link from "next/link"
import { BrandProfileProvider } from "@/components/brand-profile-context"
import { CampaignEditor } from "@/components/editor/campaign-editor"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { computeContentDiff } from "@/lib/utils/compute-content-diff"
import { countWordsInMarkdown } from "@/lib/utils/count-words"
import { hasFootnoteCitations, convertFootnotesToInlineLinks, hasOrphanFootnoteRefs, cleanOrphanFootnoteRefs } from "@/lib/utils/convert-footnotes"
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
  const [activeTab, setActiveTab] = React.useState<"overview" | "workflow" | "diffs">("overview")
  const [optimizerSource, setOptimizerSource] = React.useState<OptimizerSource | null>(null)
  const [expandedStep, setExpandedStep] = React.useState<string | null>(null)
  const [originalContent, setOriginalContent] = React.useState<string>("")
  const [contentLabSchema, setContentLabSchema] = React.useState<any>(null)
  const [schemaCopied, setSchemaCopied] = React.useState(false)

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
        // Parse optimizer source from metadata
        const metadata =
          campaign.metadata && typeof campaign.metadata === "object"
            ? campaign.metadata
            : {}
        const metaSources = Array.isArray((metadata as any).sources)
          ? (metadata as any).sources as { title: string; url: string }[]
          : undefined
        {
          let rawBody = campaign.body || ""
          if (hasFootnoteCitations(rawBody)) rawBody = convertFootnotesToInlineLinks(rawBody, metaSources)
          if (hasOrphanFootnoteRefs(rawBody)) rawBody = cleanOrphanFootnoteRefs(rawBody, metaSources)
          setBody(rawBody)
        }
        setSavedAt(campaign.updatedAt ? new Date(campaign.updatedAt).getTime() : null)
        const optSource = (metadata as any).optimizerSource
        if (optSource && typeof optSource === "object") {
          setOptimizerSource(optSource)
        }
        if (typeof (metadata as any).originalContent === "string") {
          setOriginalContent((metadata as any).originalContent)
        }
        if ((metadata as any).contentLabSchema) {
          setContentLabSchema((metadata as any).contentLabSchema)
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

  const sourceUrl = optimizerSource?.originalUrl
    ? (() => { try { return new URL(optimizerSource.originalUrl).pathname } catch { return optimizerSource.originalUrl } })()
    : null

  const diffSections = React.useMemo(() => {
    if (!originalContent || !body) return []
    return computeContentDiff(originalContent, body)
  }, [originalContent, body])

  const diffStats = React.useMemo(() => {
    return diffSections.reduce((acc, s) => {
      s.paragraphs.forEach(p => p.forEach(span => {
        if (span.type === "added") acc.added += span.content.split(/\s+/).filter(Boolean).length
        if (span.type === "removed") acc.removed += span.content.split(/\s+/).filter(Boolean).length
      }))
      return acc
    }, { added: 0, removed: 0, newSections: diffSections.filter(s => s.isNew).length })
  }, [diffSections])

  return (
    <SidebarProvider className="bg-[#0e0e0e]" style={{ "--sidebar-width": "16rem" } as React.CSSProperties}>
      <AppSidebar />
      <SidebarInset className="bg-[#0e0e0e] m-0 shadow-none rounded-none border-none h-dvh !overflow-hidden flex flex-col">
        <SiteHeader />

        {/* Canvas toolbar */}
        <div className="h-11 px-4 lg:px-5 flex items-center gap-3 border-b border-white/[0.06] bg-[#0e0e0e] shrink-0">
          <Link
            href="/dashboard/answer-optimizer"
            className="flex items-center gap-1.5 text-[13px] text-white/50 hover:text-white/80 transition-colors shrink-0"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </Link>
          <div className="h-4 w-px bg-white/[0.10]" />
          {sourceUrl && (
            <span className="text-[13px] text-white/80 font-mono truncate">{sourceUrl}</span>
          )}
          {saving && (
            <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium text-white/40">
              <Loader2 className="size-3 animate-spin" />
              Saving…
            </span>
          )}
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-white/50 hover:text-white hover:bg-white/[0.06] text-xs font-medium gap-1.5"
              onClick={handleCopy}
            >
              {copied ? <Check className="size-3.5" /> : <CopyIcon className="size-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 px-2.5 text-xs font-medium gap-1.5 ${editMode ? "text-white bg-white/[0.08]" : "text-white/50 hover:text-white hover:bg-white/[0.06]"}`}
              onClick={() => setEditMode((v) => !v)}
            >
              <Edit className="size-3.5" /> Edit
            </Button>
            {editMode && (
              <Button
                size="sm"
                className="h-7 px-3 rounded-md bg-white text-[#0a0a0a] hover:bg-white/90 hover:text-[#0a0a0a] text-xs font-medium gap-1.5 border-0"
                onClick={handleSave}
                disabled={saving}
              >
                <Save className="size-3.5" />
                Save
              </Button>
            )}
          </div>
        </div>

        {/* Main content */}
        {isLoading ? (
          <div className="flex flex-1 overflow-hidden animate-pulse">
            {/* Editor skeleton */}
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="max-w-[940px] mx-auto px-8 lg:px-12 pt-10 pb-16">
                <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-8 space-y-6">
                  <div className="h-8 w-3/4 rounded bg-white/[0.06]" />
                  <div className="space-y-3 pt-2">
                    <div className="h-4 w-full rounded bg-white/[0.04]" />
                    <div className="h-4 w-5/6 rounded bg-white/[0.04]" />
                    <div className="h-4 w-full rounded bg-white/[0.04]" />
                  </div>
                  <div className="space-y-3 pt-4">
                    <div className="h-4 w-full rounded bg-white/[0.03]" />
                    <div className="h-4 w-4/5 rounded bg-white/[0.03]" />
                    <div className="h-4 w-full rounded bg-white/[0.03]" />
                    <div className="h-4 w-3/4 rounded bg-white/[0.03]" />
                  </div>
                  <div className="pt-4">
                    <div className="h-6 w-2/5 rounded bg-white/[0.05]" />
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 w-full rounded bg-white/[0.03]" />
                    <div className="h-4 w-5/6 rounded bg-white/[0.03]" />
                    <div className="h-4 w-full rounded bg-white/[0.03]" />
                    <div className="h-4 w-2/3 rounded bg-white/[0.03]" />
                  </div>
                </div>
              </div>
            </div>
            {/* Sidebar skeleton */}
            <div className="hidden lg:flex w-[340px] shrink-0 border-l border-white/[0.06] flex-col bg-[#111111] p-5 space-y-5">
              <div className="flex items-center gap-1">
                <div className="h-7 w-20 rounded-md bg-white/[0.06]" />
                <div className="h-7 w-20 rounded-md bg-white/[0.04]" />
                <div className="h-7 w-16 rounded-md bg-white/[0.04]" />
              </div>
              <div className="space-y-3 pt-2">
                <div className="h-4 w-24 rounded bg-white/[0.05]" />
                <div className="space-y-2.5">
                  <div className="flex justify-between"><div className="h-3 w-12 rounded bg-white/[0.04]" /><div className="h-3 w-32 rounded bg-white/[0.04]" /></div>
                  <div className="flex justify-between"><div className="h-3 w-10 rounded bg-white/[0.04]" /><div className="h-5 w-24 rounded-full bg-white/[0.04]" /></div>
                  <div className="flex justify-between"><div className="h-3 w-10 rounded bg-white/[0.04]" /><div className="h-5 w-20 rounded-full bg-white/[0.04]" /></div>
                  <div className="flex justify-between"><div className="h-3 w-10 rounded bg-white/[0.04]" /><div className="h-3 w-28 rounded bg-white/[0.04]" /></div>
                </div>
              </div>
              <div className="h-px bg-white/[0.04]" />
              <div className="space-y-3">
                <div className="h-4 w-16 rounded bg-white/[0.05]" />
                <div className="flex gap-1.5">
                  <div className="h-6 w-20 rounded-full bg-white/[0.04]" />
                  <div className="h-6 w-18 rounded-full bg-white/[0.04]" />
                  <div className="h-6 w-16 rounded-full bg-white/[0.04]" />
                </div>
              </div>
              <div className="h-px bg-white/[0.04]" />
              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-white/[0.05]" />
                <div className="h-10 w-28 rounded bg-white/[0.04]" />
                <div className="h-3 w-32 rounded bg-white/[0.03]" />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Editor / Diff view */}
            <div className="flex-1 min-w-0 overflow-y-auto">
              {activeTab === "diffs" ? (
                <div className="max-w-[940px] mx-auto px-8 lg:px-12 pt-10 pb-16">
                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-12 py-6">
                  {/* Diff stats bar */}
                  <div className="flex items-center gap-3 mb-8">
                    <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.04]">
                      <span className="text-[12px] text-emerald-400/80 tabular-nums font-medium">+{diffStats.added} words</span>
                      <span className="text-white/10">|</span>
                      <span className="text-[12px] text-red-400/80 tabular-nums font-medium">-{diffStats.removed} words</span>
                      {diffStats.newSections > 0 && (
                        <>
                          <span className="text-white/10">|</span>
                          <span className="text-[12px] text-white/40 tabular-nums">{diffStats.newSections} new sections</span>
                        </>
                      )}
                    </div>
                  </div>

                  {diffSections.length > 0 ? (
                    <div className="space-y-8">
                      {diffSections.map((section, si) => (
                        <div key={si}>
                          {section.heading && (
                            <div className="flex items-center gap-2.5 mb-3">
                              {section.isNew && (
                                <span className="text-[10px] font-semibold text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">New</span>
                              )}
                              <h3 className={`text-[19px] font-semibold tracking-tight ${section.isNew ? "text-white/80" : "text-white/60"}`}>
                                {section.heading}
                              </h3>
                            </div>
                          )}
                          <div className="space-y-4">
                            {section.paragraphs.map((spans, pi) => (
                              <p key={pi} className="text-[15px] leading-[1.8] text-white/50">
                                {spans.map((span, i) => {
                                  if (span.type === "removed") {
                                    return (
                                      <span key={i} className="bg-red-500/[0.08] text-red-300/60 line-through decoration-red-400/30 rounded-sm px-0.5">
                                        {span.content}
                                      </span>
                                    )
                                  }
                                  if (span.type === "added") {
                                    return (
                                      <span key={i} className="bg-emerald-500/[0.08] text-emerald-300/70 rounded-sm px-0.5">
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
                  ) : (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                      <div className="size-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-4">
                        <GitCompare className="size-5 text-white/20" />
                      </div>
                      <p className="text-[15px] text-white/40">No diff data available</p>
                      <p className="text-[13px] text-white/20 mt-1">Original content is needed to compute diffs</p>
                    </div>
                  )}
                  </div>
                </div>
              ) : (
                <div className="max-w-[940px] mx-auto px-8 lg:px-12 pt-10 pb-16">
                  {contentLoaded && (
                    <CampaignEditor
                      key={`editor-${id}-${contentLoaded ? 'loaded' : 'empty'}`}
                      value={body}
                      onChange={setBody}
                      readOnly={!editMode}
                      showToolbar={editMode}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Right sidebar */}
            <div className="hidden lg:flex w-[340px] shrink-0 border-l border-white/[0.06] flex-col overflow-y-auto bg-[#111111]">
              {/* Tab bar */}
              <div className="px-5 py-3 border-b border-white/[0.04] shrink-0">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveTab("overview")}
                    className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors ${
                      activeTab === "overview"
                        ? "bg-white/[0.08] text-white"
                        : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab("workflow")}
                    className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors ${
                      activeTab === "workflow"
                        ? "bg-white/[0.08] text-white"
                        : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Workflow
                  </button>
                  <button
                    onClick={() => setActiveTab("diffs")}
                    className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors ${
                      activeTab === "diffs"
                        ? "bg-white/[0.08] text-white"
                        : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                    }`}
                  >
                    <GitCompare className="w-3.5 h-3.5" />
                    Diffs
                  </button>
                </div>
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto">
                {activeTab === "overview" && (
                  <div className="p-5 space-y-5">
                    {optimizerSource && (
                      <>
                        <div className="space-y-3">
                          <h3 className="text-[13px] font-semibold text-white/90 tracking-tight">Optimization</h3>
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <span className="text-white/40 text-xs font-medium uppercase tracking-wider">Source</span>
                              <span className="text-white/80 text-[13px] truncate text-right flex-1 font-mono" title={optimizerSource.originalUrl}>
                                {sourceUrl || "—"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-white/40 text-xs font-medium uppercase tracking-wider">Depth</span>
                              <Badge variant="outline" className="capitalize bg-white/[0.05] border-0 text-white/80 text-xs h-6 rounded-full">
                                {DEPTH_LABELS[optimizerSource.depthLevel] || optimizerSource.depthLevel}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-white/40 text-xs font-medium uppercase tracking-wider">Voice</span>
                              <Badge variant="outline" className="capitalize bg-white/[0.05] border-0 text-white/80 text-xs h-6 rounded-full">
                                {optimizerSource.voiceTone || "Professional"}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-white/40 text-xs font-medium uppercase tracking-wider">Words</span>
                              <span className="text-white/80 text-[13px] tabular-nums">
                                {optimizerSource.originalWordCount.toLocaleString()}
                                <span className="text-white/20 mx-1.5">&rarr;</span>
                                {optimizerSource.optimizedWordCount.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="h-px bg-white/[0.06]" />

                        <div className="space-y-3">
                          <h3 className="text-[13px] font-semibold text-white/90 tracking-tight">Tools</h3>
                          <div className="flex flex-wrap gap-1.5">
                            {TOOL_DEFS.map((tool) => {
                              const enabled = optimizerSource.enabledTools.includes(tool.id)
                              if (!enabled) return null
                              return (
                                <div
                                  key={tool.id}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-violet-500/10 text-violet-300/80 border border-violet-500/15"
                                >
                                  <tool.icon className="size-3" />
                                  {tool.label}
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {contentLabSchema && contentLabSchema.scriptTag && (
                          <>
                            <div className="h-px bg-white/[0.06]" />
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h3 className="text-[13px] font-semibold text-white/90 tracking-tight">Schema Markup</h3>
                                <Badge variant="outline" className={`text-[10px] h-5 rounded-full border-0 ${
                                  contentLabSchema.schemaStatus === 'stale' ? 'bg-orange-500/10 text-orange-400' : 'bg-emerald-500/10 text-emerald-400'
                                }`}>
                                  {contentLabSchema.schemaStatus === 'stale' ? 'Stale' : 'Ready'}
                                </Badge>
                              </div>
                              <div className="relative">
                                <pre className="text-[11px] text-white/50 bg-white/[0.02] rounded-lg p-3 overflow-x-auto max-h-[200px] overflow-y-auto scrollbar-thin font-mono leading-relaxed">
                                  {contentLabSchema.scriptTag}
                                </pre>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await navigator.clipboard.writeText(contentLabSchema.scriptTag)
                                    setSchemaCopied(true)
                                    setTimeout(() => setSchemaCopied(false), 2000)
                                  }}
                                  className="absolute top-2 right-2 text-[10px] text-white/30 hover:text-white/60 bg-white/[0.05] hover:bg-white/[0.08] px-2 py-1 rounded transition-colors cursor-pointer"
                                >
                                  {schemaCopied ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                            </div>
                          </>
                        )}

                        <div className="h-px bg-white/[0.06]" />
                      </>
                    )}

                    <div className="space-y-2">
                      <h3 className="text-[13px] font-semibold text-white/90 tracking-tight">Word Count</h3>
                      <div className="text-3xl font-bold text-white tracking-tight tabular-nums">
                        {countWordsInMarkdown(body).toLocaleString()}
                      </div>
                      <p className="text-[11px] text-white/40">Total words in content</p>
                    </div>
                  </div>
                )}

                {activeTab === "workflow" && (
                  <div className="p-5 space-y-0.5">
                    {optimizerSource && (
                      <div className="mb-4 pb-4 border-b border-white/[0.06]">
                        <div className="flex items-center gap-3 text-xs">
                          <div className="flex items-center gap-1.5 text-white/40">
                            <ScanText className="size-3" />
                            <span className="font-mono truncate">{sourceUrl || "—"}</span>
                          </div>
                          {totalElapsed > 0 && (
                            <>
                              <span className="text-white/15 shrink-0">|</span>
                              <span className="text-white/35 font-mono tabular-nums shrink-0">{formatPipelineElapsed(totalElapsed)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {steps.length > 0 ? (
                      steps.map((step, i) => {
                        const StepIcon = STEP_ICON_MAP[step.id] || Sparkles
                        const isExpanded = expandedStep === step.id
                        const description = STEP_DESCRIPTION_MAP[step.id] || ""

                        return (
                          <div key={step.id}>
                            {i > 0 && (
                              <div className="flex justify-start pl-[15px] h-3.5">
                                <div className="w-px h-full border-l border-dashed border-white/[0.06]" />
                              </div>
                            )}
                            <button
                              onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                              className="w-full text-left rounded-lg border px-3.5 py-2.5 transition-all bg-white/[0.02] border-white/[0.04] hover:border-white/[0.08] hover:bg-white/[0.03]"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="size-6 rounded-md bg-white/[0.04] flex items-center justify-center shrink-0">
                                  <StepIcon className="size-3 text-white/35" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[12px] font-medium text-white/75 truncate">{step.label}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {step.elapsed > 0 && (
                                    <span className="text-[10px] text-white/20 font-mono tabular-nums">
                                      {formatPipelineElapsed(step.elapsed)}
                                    </span>
                                  )}
                                  <div className="size-4 rounded-full bg-emerald-500/15 flex items-center justify-center">
                                    <Check className="size-2.5 text-emerald-400/70" />
                                  </div>
                                  <ChevronDown className={`size-3 text-white/15 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                                </div>
                              </div>
                              {isExpanded && description && (
                                <div className="mt-2.5 pt-2.5 border-t border-white/[0.04]">
                                  <p className="text-[11px] text-white/35 leading-relaxed">{description}</p>
                                </div>
                              )}
                            </button>
                          </div>
                        )
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="size-9 rounded-lg bg-white/[0.04] flex items-center justify-center mb-3">
                          <Sparkles className="size-4 text-white/20" />
                        </div>
                        <p className="text-[13px] text-white/35">No step data available</p>
                        <p className="text-[11px] text-white/20 mt-1">Pipeline timing is recorded for new optimizations</p>
                      </div>
                    )}

                    {totalElapsed > 0 && (
                      <div className="pt-4 mt-4 border-t border-white/[0.06]">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-white/[0.02] border border-white/[0.04]">
                          <Clock className="size-3 text-white/20" />
                          <span className="text-[11px] text-white/35 font-mono tabular-nums">{formatPipelineElapsed(totalElapsed)}</span>
                          <span className="text-[11px] text-white/10">|</span>
                          <span className="text-[11px] text-white/35 tabular-nums">{steps.length} steps</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "diffs" && (
                  <div className="p-5 space-y-5">
                    {/* Summary stats */}
                    <div className="space-y-3">
                      <h3 className="text-[13px] font-semibold text-white/90 tracking-tight">Changes</h3>
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-white/40 text-xs font-medium uppercase tracking-wider">Added</span>
                          <span className="text-[13px] text-emerald-400/80 tabular-nums font-medium">+{diffStats.added} words</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-white/40 text-xs font-medium uppercase tracking-wider">Removed</span>
                          <span className="text-[13px] text-red-400/80 tabular-nums font-medium">-{diffStats.removed} words</span>
                        </div>
                        {diffStats.newSections > 0 && (
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-white/40 text-xs font-medium uppercase tracking-wider">New sections</span>
                            <span className="text-[13px] text-white/60 tabular-nums">{diffStats.newSections}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-white/40 text-xs font-medium uppercase tracking-wider">Sections</span>
                          <span className="text-[13px] text-white/50 tabular-nums">{diffSections.length}</span>
                        </div>
                      </div>
                    </div>

                    {diffSections.length === 0 && (
                      <>
                        <div className="h-px bg-white/[0.06]" />
                        <p className="text-[12px] text-white/25">Original content is needed to compute diffs. New optimizations will include diff data automatically.</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
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
