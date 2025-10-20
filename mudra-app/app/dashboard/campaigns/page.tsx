"use client"

import { useState, useEffect, useRef } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { FloatingMudraButton } from "@/components/floating-mudra-button"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Plus, FileText, Newspaper, Briefcase, Target, Search, Sparkles, CheckCircle2, Loader2, X, Info, ChevronLeft, Lightbulb, Tag } from "lucide-react"
import { useRouter } from "next/navigation"
 
 

export default function CampaignsPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [selectedType, setSelectedType] = useState<"blog" | "newsletter" | "case">("blog")
  const [improvement, setImprovement] = useState<"geo" | "seo" | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progressIndex, setProgressIndex] = useState(0)
  const [generationComplete, setGenerationComplete] = useState(false)
  // Configuration state (mock values for now)
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null)
  const [selectedIcp, setSelectedIcp] = useState<string | null>(null)
  const [keywords, setKeywords] = useState<string[]>([])
  const [keywordInput, setKeywordInput] = useState("")

  // Mock suggestions (replace with real data later)
  const promptSuggestions = [
    "Product launch announcement",
    "Weekly update outline",
    "Case study request",
    "Thought leadership Q&A",
  ]
  const icpSuggestions = [
    "Seed‑stage startup founders",
    "GTM leads at SaaS startups",
    "AI practitioners & researchers",
    "Developers evaluating AI tools",
  ]
  const keywordSuggestions = [
    "ai visibility",
    "geo marketing",
    "prompt engineering",
    "startup go-to-market",
    "ai citations",
  ]
  const [campaigns] = useState<Array<{ id: string; title: string; type: string; mode: string; status: "Draft" | "Scheduled" | "Published"; updatedAt: number }>>([
    { id: "cmp_1", title: "Product Launch Blog", type: "Blog Post", mode: "GEO", status: "Draft", updatedAt: Date.now() - 60 * 60 * 1000 },
    { id: "cmp_2", title: "Weekly Update Newsletter", type: "Newsletter", mode: "SEO", status: "Scheduled", updatedAt: Date.now() - 24 * 60 * 60 * 1000 },
    { id: "cmp_3", title: "Case Study: Customer X", type: "Case Study", mode: "GEO", status: "Published", updatedAt: Date.now() - 3 * 24 * 60 * 60 * 1000 },
    { id: "cmp_4", title: "SEO Best Practices Update", type: "Blog Post", mode: "SEO", status: "Published", updatedAt: Date.now() - 5 * 24 * 60 * 60 * 1000 },
    { id: "cmp_5", title: "Quarterly Product Recap", type: "Newsletter", mode: "GEO", status: "Draft", updatedAt: Date.now() - 2 * 60 * 60 * 1000 },
    { id: "cmp_6", title: "Case Study: Partner Y", type: "Case Study", mode: "SEO", status: "Published", updatedAt: Date.now() - 7 * 24 * 60 * 60 * 1000 },
    { id: "cmp_7", title: "Thought Leadership Article", type: "Blog Post", mode: "GEO", status: "Draft", updatedAt: Date.now() - 30 * 60 * 1000 },
  ])
  const [statusFilter, setStatusFilter] = useState<"draft" | "published">("draft")
  const filteredCampaigns = campaigns.filter(c => c.status.toLowerCase() === statusFilter)

  // Animated indicator for filter pills
  const filterContainerRef = useRef<HTMLDivElement | null>(null)
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 })

  const updateIndicator = () => {
    const container = filterContainerRef.current
    const active = buttonRefs.current[statusFilter]
    if (!container || !active) return
    const cRect = container.getBoundingClientRect()
    const bRect = active.getBoundingClientRect()
    setIndicatorStyle({ left: bRect.left - cRect.left, width: bRect.width })
  }

  useEffect(() => {
    const rAF = requestAnimationFrame(updateIndicator)
    window.addEventListener("resize", updateIndicator)
    return () => {
      cancelAnimationFrame(rAF)
      window.removeEventListener("resize", updateIndicator)
    }
  }, [])

  useEffect(() => {
    updateIndicator()
  }, [statusFilter])
 
  const router = useRouter()

  const handleOpenCampaign = (c: { id: string; type: string; mode: string }) => {
    const typeParam = c.type.toLowerCase().includes("blog") ? "blog" : c.type.toLowerCase().includes("newsletter") ? "newsletter" : "case"
    const modeParam = c.mode.toLowerCase()
    router.push(`/dashboard/campaigns/${c.id}?type=${typeParam}&mode=${modeParam}`)
  }
  
  const geoSteps = [
    "Starting",
    "Gathering information",
    "Understanding prompts",
    "Including ICP",
    "Adding sources and citations",
    "Including statistics",
    "Drafting AI-ready content",
    "Final review",
  ]

  const seoSteps = [
    "Starting",
    "Running live queries",
    "Analyzing search intent",
    "Extracting entities & schema",
    "Auditing on-page SEO",
    "Selecting sources & citations",
    "Drafting optimized brief",
    "Final review",
  ]

  const startGeneration = () => {
    if (improvement !== "geo" && improvement !== "seo") return
    setIsGenerating(true)
    setGenerationComplete(false)
    setProgressIndex(0)
    const steps = improvement === "seo" ? seoSteps : geoSteps
    const total = steps.length
    let i = 0
    const tick = () => {
      i += 1
      setProgressIndex(i)
      if (i < total) {
        setTimeout(tick, 1200)
      } else {
        // Brief success state before navigating
        setGenerationComplete(true)
        setTimeout(() => {
          const id = `cmp_${Date.now().toString(36)}`
          const modeParam = improvement === "seo" ? "seo" : "geo"
          // pass configured mock values via query params to prefill canvas chips
          let extra = ""
          if (modeParam === "geo") {
            if (selectedPrompt) extra += `&prompt=${encodeURIComponent(selectedPrompt)}`
            if (selectedIcp) extra += `&icp=${encodeURIComponent(selectedIcp)}`
          } else if (modeParam === "seo") {
            const keywordStr = keywords.join(", ")
            if (keywordStr) extra += `&keyword=${encodeURIComponent(keywordStr)}`
          }
          router.push(`/dashboard/campaigns/${id}?type=blog&mode=${modeParam}${extra}`)
          setIsGenerating(false)
          setStep(1)
          setGenerationComplete(false)
        }, 1400)
      }
    }
    setTimeout(tick, 800)
  }

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
            {/* Page Header (match Overview/Tasks spacing) */}
            <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">
                      {"Campaigns"}
                    </h1>
                      <p className="text-muted-foreground">
                        Tailored brand content for visibility improvement across channels.
                      </p>
                  </div>
                  <div className="flex items-center">
                     <Dialog onOpenChange={(open) => { if (open) { setStep(1); setImprovement(null); setSelectedType("blog"); setSelectedPrompt(null); setSelectedIcp(null); setKeywords([]); setKeywordInput("") } }}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="h-9 rounded-lg">
                          <Plus className="size-4 mr-2" />
                          New Campaign
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-lg sm:max-w-3xl md:max-w-4xl">
                        <div className="p-5 md:p-6 lg:p-7">
                          <DialogHeader className="pb-2">
                            <DialogTitle className="text-lg md:text-xl font-semibold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">Create a Campaign</DialogTitle>
                             <DialogDescription className="text-muted-foreground/90 text-sm">
                               {step === 1
                                 ? "Choose a content type to start"
                                 : step === 2
                                   ? "Choose what to improve"
                                   : step === 3
                                     ? improvement === "geo"
                                       ? "Select the prompt and ICP"
                                       : "Add your target keywords"
                                     : "Generating your document"}
                             </DialogDescription>
                          </DialogHeader>
                          {/* Linear Stepper (lines only) */}
                          <div className="mt-2 mb-5 md:mt-3 md:mb-6">
                             <div className="relative h-[3px] bg-white/10 rounded overflow-hidden">
                               <div className={`absolute left-0 top-0 h-[3px] bg-gradient-to-r from-primary to-white/90 rounded transition-[width] duration-300 ease-out ${step <= 1 ? "w-0" : step === 2 ? "w-1/3" : step === 3 ? "w-2/3" : "w-full"}`} />
                </div>
            </div>
                          {step === 1 && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                              <Card onClick={() => { setSelectedType("blog"); setStep(2) }} className="group border-white/10 hover:border-white/20 transition-all cursor-pointer rounded-lg hover:translate-y-[-1px]">
                                <CardHeader className="items-start gap-3 pb-3">
                                  <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                                    <FileText className="size-5" />
                                  </div>
                                  <CardTitle className="text-base">Blog Post</CardTitle>
                                  <CardDescription className="text-xs">Long‑form content for visibility</CardDescription>
                                </CardHeader>
                              </Card>
                              <Card className="group border-white/10 transition-colors cursor-not-allowed opacity-75 rounded-lg ">
                                <CardHeader className="items-start gap-3 pb-3">
                                  <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                                    <Newspaper className="size-5" />
                                  </div>
                                  <CardTitle className="text-base">Newsletter</CardTitle>
                                  <CardDescription className="text-xs">Email update to your audience</CardDescription>
                                  <Badge variant="outline" className="mt-1 text-xs">Soon</Badge>
                                </CardHeader>
                              </Card>
                              <Card className="group border-white/10 transition-colors cursor-not-allowed opacity-75 rounded-lg ">
                                <CardHeader className="items-start gap-3 pb-3">
                                  <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                                    <Briefcase className="size-5" />
                                  </div>
                                  <CardTitle className="text-base">Case Study</CardTitle>
                                  <CardDescription className="text-xs">Show results and credibility</CardDescription>
                                  <Badge variant="outline" className="mt-1 text-xs">Soon</Badge>
                                </CardHeader>
                              </Card>
                            </div>
                          )}
                           {step === 2 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mt-1">
                              <Card onClick={() => { setImprovement("geo"); setSelectedPrompt(null); setSelectedIcp(null); setKeywords([]); setKeywordInput(""); setStep(3) }} className={`group border-white/10 hover:border-white/20 transition-all cursor-pointer rounded-lg  hover:translate-y-[-1px] ${improvement === "geo" ? "ring-1 ring-white/30" : ""}`}>
                                <CardHeader className="items-start gap-3 pb-3">
                                  <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                                    <Target className="size-5" />
                                  </div>
                                  <CardTitle className="text-base">GEO: Prompt + ICP</CardTitle>
                                  <CardDescription className="text-xs">Use your prompt set and audience</CardDescription>
                                </CardHeader>
                              </Card>
                              <Card onClick={() => { setImprovement("seo"); setSelectedPrompt(null); setSelectedIcp(null); setKeywords([]); setKeywordInput(""); setStep(3) }} className={`group border-white/10 hover:border-white/20 transition-all cursor-pointer rounded-lg  hover:translate-y-[-1px] ${improvement === "seo" ? "ring-1 ring-white/30" : ""}`}>
                                <CardHeader className="items-start gap-3 pb-3">
                                  <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                                    <Search className="size-5" />
                                  </div>
                                  <CardTitle className="text-base">SEO: Live Query</CardTitle>
                                  <CardDescription className="text-xs">Query live data and optimize</CardDescription>
                                </CardHeader>
                              </Card>
                            </div>
                          )}
                        {step === 3 && (
                          <div className="pt-3 md:pt-5">
                            {improvement === "geo" ? (
                              <div className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-1.5">
                                      <Label className="text-xs text-white/80">Prompt</Label>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Info className="size-3.5 text-white/50" />
                                        </TooltipTrigger>
                                        <TooltipContent>Pick a prompt template to guide the content.</TooltipContent>
                                      </Tooltip>
                                    </div>
                                    <Select value={selectedPrompt ?? undefined} onValueChange={(v) => setSelectedPrompt(v)}>
                                      <SelectTrigger className="h-9 rounded-lg bg-transparent border-white/10 text-white/90 w-full">
                                        <SelectValue placeholder="Select a prompt" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {promptSuggestions.map((p) => (
                                          <SelectItem key={p} value={p}>{p}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-1.5">
                                      <Label className="text-xs text-white/80">ICP</Label>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Info className="size-3.5 text-white/50" />
                                        </TooltipTrigger>
                                        <TooltipContent>Choose the ideal customer profile.</TooltipContent>
                                      </Tooltip>
                                    </div>
                                    <Select value={selectedIcp ?? undefined} onValueChange={(v) => setSelectedIcp(v)}>
                                      <SelectTrigger className="h-9 rounded-lg bg-transparent border-white/10 text-white/90 w-full">
                                        <SelectValue placeholder="Select an ICP" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {icpSuggestions.map((i) => (
                                          <SelectItem key={i} value={i}>{i}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between pt-1">
                                  <Button variant="outline" size="sm" className="h-9 rounded-lg" onClick={() => setStep(2)}>
                                    <ChevronLeft className="size-4 mr-1" /> Back
                                  </Button>
                                  <Button disabled={!selectedPrompt || !selectedIcp} onClick={() => setStep(4)} className="h-9 rounded-lg">
                                    Continue
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-5">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <Label className="text-xs text-white/80">Keywords</Label>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Info className="size-3.5 text-white/50" />
                                        </TooltipTrigger>
                                        <TooltipContent>Add multiple target keywords. Press Enter or comma.</TooltipContent>
                                      </Tooltip>
                                    </div>
                                    <div className="text-xs text-white/60">{keywords.length} selected</div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      value={keywordInput}
                                      onChange={(e) => setKeywordInput(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === ",") {
                                          e.preventDefault()
                                          const v = keywordInput.trim().replace(/,$/, "")
                                          if (v && !keywords.includes(v)) setKeywords((k) => [...k, v])
                                          setKeywordInput("")
                                        }
                                      }}
                                      placeholder="Type a keyword and press Enter"
                                      className="h-9 rounded-lg bg-transparent border-white/10 flex-1"
                                    />
                                    {keywords.length > 0 && (
                                      <Button variant="outline" size="sm" className="h-9 rounded-lg" onClick={() => setKeywords([])}>Clear</Button>
                                    )}
                                  </div>
                                  {keywords.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                      {keywords.map((k) => (
                                        <span key={k} className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-transparent px-2.5 py-1 text-xs text-white/80">
                                          <Tag className="size-3.5" /> {k}
                                          <button
                                            type="button"
                                            onClick={() => setKeywords((arr) => arr.filter((i) => i !== k))}
                                            className="inline-flex items-center justify-center"
                                            aria-label={`Remove ${k}`}
                                          >
                                            <X className="size-3.5 text-white/70" />
                                          </button>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="text-xs text-white/60 mb-1">Quick add</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {keywordSuggestions.map((s) => (
                                      <button key={s} type="button" onClick={() => setKeywords((arr) => (arr.includes(s) ? arr : [...arr, s]))} className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs transition-colors ${keywords.includes(s) ? "bg-primary/20 border-primary/30 text-white" : "bg-transparent border-white/10 text-white/80 hover:bg-white/10"}`}>
                                        <Tag className="size-3.5" /> {s}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between pt-1">
                                  <Button variant="outline" size="sm" className="h-9 rounded-lg" onClick={() => setStep(2)}>
                                    <ChevronLeft className="size-4 mr-1" /> Back
                                  </Button>
                                  <Button disabled={keywords.length === 0} onClick={() => setStep(4)} className="h-9 rounded-lg">
                                    Continue
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {step === 4 && (
                          <div className="pt-3 md:pt-5 space-y-4">
                            {/* Review summary */}
                            {isGenerating && improvement === "geo" ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="rounded-lg border border-white/10 bg-transparent p-3">
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center justify-center size-7 rounded-lg bg-transparent border border-white/10">
                                      <Lightbulb className="size-4 text-white/80" />
                                    </span>
                                    <div className="text-[11px] uppercase tracking-wide text-white/60">Prompt</div>
                                  </div>
                                  <div className="mt-1.5 text-sm text-white/90 truncate" title={selectedPrompt || "—"}>
                                    {selectedPrompt || "—"}
                                  </div>
                                </div>
                                <div className="rounded-lg border border-white/10 bg-transparent p-3">
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center justify-center size-7 rounded-lg bg-transparent border border-white/10">
                                      <Tag className="size-4 text-white/80" />
                                    </span>
                                    <div className="text-[11px] uppercase tracking-wide text-white/60">ICP</div>
                                  </div>
                                  <div className="mt-1.5 text-sm text-white/90 truncate" title={selectedIcp || "—"}>
                                    {selectedIcp || "—"}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <Card className="border-white/10 bg-transparent">
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-base">Review</CardTitle>
                                  <CardDescription className="text-xs">Confirm your selections before generating</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-0">
                                  {improvement === "geo" ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div className="rounded-lg border border-white/10 bg-transparent p-3">
                                        <div className="flex items-center gap-2">
                                          <span className="inline-flex items-center justify-center size-7 rounded-lg bg-transparent border border-white/10">
                                            <Lightbulb className="size-4 text-white/80" />
                                          </span>
                                          <div className="text-[11px] uppercase tracking-wide text-white/60">Prompt</div>
                                        </div>
                                        <div className="mt-1.5 text-sm text-white/90 truncate" title={selectedPrompt || "—"}>
                                          {selectedPrompt || "—"}
                                        </div>
                                      </div>
                                      <div className="rounded-lg border border-white/10 bg-transparent p-3">
                                        <div className="flex items-center gap-2">
                                          <span className="inline-flex items-center justify-center size-7 rounded-lg bg-transparent border border-white/10">
                                            <Tag className="size-4 text-white/80" />
                                          </span>
                                          <div className="text-[11px] uppercase tracking-wide text-white/60">ICP</div>
                                        </div>
                                        <div className="mt-1.5 text-sm text-white/90 truncate" title={selectedIcp || "—"}>
                                          {selectedIcp || "—"}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap gap-2">
                                      {keywords.length > 0 ? (
                                        keywords.map((k) => (
                                          <span key={k} className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-transparent px-2.5 py-1 text-xs text-white/80">
                                            <Tag className="size-3.5" /> {k}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="text-sm text-white/70">No keywords selected.</span>
                                      )}
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            )}
                            {isGenerating ? (
                              <div className="space-y-3" aria-live="polite">
                                {(improvement === "seo" ? seoSteps : geoSteps).map((label, idx) => {
                                  const done = idx < progressIndex
                                  const active = idx === progressIndex
                                  return (
                                    <div
                                      key={idx}
                                      className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-sm bg-transparent transition-all ${
                                        done
                                          ? "border-emerald-500/30"
                                          : active
                                            ? "border-white/20 ring-1 ring-white/20"
                                            : "border-white/10"
                                      }`}
                                    >
                                      <div className="w-5 h-5 flex items-center justify-center">
                                        {done ? (
                                          <CheckCircle2 className="size-5 text-emerald-400" />
                                        ) : active ? (
                                          <Loader2 className="size-4 text-white/70 animate-spin" />
                                        ) : (
                                          <div className="size-2 rounded bg-white/30" />
                                        )}
                                      </div>
                                      <div className={`text-sm ${done ? "text-white/80" : active ? "text-white" : "text-white/70"}`}>
                                        {idx + 1}. {label}
                                      </div>
                                    </div>
                                  )
                                })}
                                {generationComplete && (
                                  <div className="flex items-center gap-3 pt-1 text-[15px] text-white">
                                    <CheckCircle2 className="size-5 text-emerald-400" />
                                    <span className="text-white/90">Document is ready!</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <Button variant="outline" size="sm" className="h-10 rounded-lg" onClick={() => setStep(3)}>
                                  <ChevronLeft className="size-4 mr-1" /> Edit selections
                                </Button>
                                <Button
                                  onClick={startGeneration}
                                  disabled={(improvement === "geo" && (!selectedPrompt || !selectedIcp)) || (improvement === "seo" && keywords.length === 0)}
                                  className="h-10 px-5 rounded-lg bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:from-primary/90 hover:to-primary/70 shadow-sm gap-2"
                                >
                                  <Sparkles className="size-4" />
                                  Generate
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                        </div>
                      </DialogContent>
                    </Dialog>
              </div>
            </div>
                <div className="mt-4">
              <div className="relative">
                <div className="h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                <div className="absolute left-1/2 top-0 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              </div>
            </div>
            </div>

            
            
            {/* Content */}
            <div className="flex flex-col flex-1">
              <div className="px-4 lg:px-6 mt-4 md:mt-6 pb-6 md:pb-8">
                <Card className="pt-2 bg-transparent backdrop-blur-sm rounded-lg border border-white/[0.06]">
                  <div className="flex items-center justify-between px-4 lg:px-6 pt-2 pb-3 border-b border-white/[0.06]">
                    <div ref={filterContainerRef} className="relative inline-flex items-center gap-1 p-1.5 bg-transparent backdrop-blur-sm rounded-lg border border-white/[0.08]">
                      <span
                        className="absolute top-1.5 h-7 rounded bg-white/10 transition-[left,width] duration-300 ease-out"
                        style={{ left: `${indicatorStyle.left}px`, width: `${indicatorStyle.width}px` }}
                      />
                      {[
                        { key: "draft", label: "Drafts" },
                        { key: "published", label: "Published" },
                      ].map(({ key, label }) => (
                        <Button
                          key={key}
                          variant={statusFilter === key ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setStatusFilter(key as typeof statusFilter)}
                          ref={(el) => {
                            buttonRefs.current[key] = el
                          }}
                          className={`relative z-10 h-7 rounded transition-transform ${statusFilter === key ? "bg-primary text-primary-foreground" : "text-white/80 hover:text-white hover:bg-muted/60"} ${statusFilter === key ? "" : "hover:translate-y-[-1px]"}`}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="px-4 lg:px-6 pb-4">
                    <div className="space-y-2">
                      {filteredCampaigns.map((c) => (
                        <div key={c.id} onClick={() => handleOpenCampaign(c)} className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.06] bg-transparent px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{c.title}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-muted-foreground px-2 rounded">{c.type}</Badge>
                            <Badge
                              variant="outline"
                              className={`px-2 rounded border ${
                                c.mode.toUpperCase() === "GEO"
                                  ? "bg-sky-500/10 border-sky-500/20 text-sky-300"
                                  : "bg-amber-500/10 border-amber-500/20 text-amber-300"
                              }`}
                            >
                              {c.mode}
                            </Badge>
                          </div>
                          <div className="w-[140px] text-right">
                            <Button variant="outline" size="sm" className="h-7 min-w-[110px] px-3 rounded">{c.status}</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
      
      <FloatingMudraButton siteId={typeof window !== 'undefined' ? (localStorage.getItem('mudra:siteId') || '') : ''} />
    </SidebarProvider>
  )
}


