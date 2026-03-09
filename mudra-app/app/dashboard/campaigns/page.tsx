"use client"

import { useState, useEffect, useRef } from "react"
import { BrandProfileProvider, useBrandProfile } from "@/components/brand-profile-context"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Plus, FileText, Newspaper, Briefcase, Target, Search, Sparkles, CheckCircle2, Loader2, X, Info, ChevronLeft, ChevronRight, Lightbulb, Tag, Clock, List, BookOpen, HelpCircle, GitCompare, MoreHorizontal, FileEdit, CircleCheck } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { AIOptimizedGenerator, type GeneratingContent } from "@/components/content-lab/ai-optimized-generator"
import { BlogSetupDialog } from "@/components/content-lab/blog-setup-dialog"
 

// Format types mapping
type FormatType = "blog" | "listicle" | "howto" | "guide"

const FORMAT_OPTIONS: Record<string, { value: FormatType; label: string }[]> = {
  "Organic": [
    { value: "blog", label: "General Blog Post" },
    { value: "listicle", label: "Listicle" },
    { value: "howto", label: "How-To Guide" },
    { value: "guide", label: "Comprehensive Guide" },
  ],
  "Generic": [
    { value: "blog", label: "General Blog Post" },
    { value: "listicle", label: "Listicle" },
    { value: "guide", label: "Comprehensive Guide" },
  ],
  "Competitor": [
    { value: "blog", label: "General Blog Post" },
    { value: "guide", label: "Comprehensive Guide" },
  ],
  "How-to Guides": [
    { value: "blog", label: "General Blog Post" },
    { value: "listicle", label: "Listicle (X Steps to...)" },
    { value: "howto", label: "How-To Guide" },
    { value: "guide", label: "Comprehensive Guide" },
  ],
  "How-to Guide": [ // Also support singular form
    { value: "blog", label: "General Blog Post" },
    { value: "listicle", label: "Listicle (X Steps to...)" },
    { value: "howto", label: "How-To Guide" },
    { value: "guide", label: "Comprehensive Guide" },
  ],
  "Brand-Specific": [
    { value: "blog", label: "General Blog Post" },
    { value: "listicle", label: "Listicle" },
    { value: "guide", label: "Comprehensive Guide" },
  ],
}

// Get available formats for a prompt category
const getAvailableFormats = (category: string | null | undefined): { value: FormatType; label: string }[] => {
  if (!category) return FORMAT_OPTIONS["Organic"] // Default to Organic if no category
  // Try exact match first, then fallback to Organic
  return FORMAT_OPTIONS[category] || FORMAT_OPTIONS["Organic"]
}

// Content types
type ContentType = "blog" | "listicle" | "guide" | "howto" | "comparison"

const CONTENT_TYPES: Array<{ value: ContentType; label: string; description: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: "blog", label: "Blog Post", description: "Long-form content optimized for AI visibility", icon: FileText },
  { value: "listicle", label: "Listicle", description: "List-based content format (X Steps to...)", icon: List },
  { value: "guide", label: "Comprehensive Guide", description: "In-depth comprehensive guides", icon: BookOpen },
  { value: "howto", label: "How To", description: "Step-by-step instructional content", icon: HelpCircle },
  { value: "comparison", label: "Comparison", description: "Compare products, tools, or approaches", icon: GitCompare },
]

// Intent categories
const INTENT_CATEGORIES = ["Organic", "Generic", "Competitor", "How-to", "Brand-Specific", "FAQ"]

function CampaignsPageInner() {
  const { profile } = useBrandProfile()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1) // 1=Content Type, 2=Intent & Prompt, 3=ICP, 4=Review & Generate
  const [selectedContentType, setSelectedContentType] = useState<ContentType | null>(null)
  const [selectedIntent, setSelectedIntent] = useState<string | null>(null)
  const [selectedPrompt, setSelectedPrompt] = useState<{id: string, text: string, category: string} | null>(null)
  const [selectedIcp, setSelectedIcp] = useState<string | null>(null)
  const [improvement] = useState<"geo">("geo")
  const [isGenerating, setIsGenerating] = useState(false)
  const [progressIndex, setProgressIndex] = useState(0)
  const [generationComplete, setGenerationComplete] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Tracked prompts from database
  const [promptSuggestions, setPromptSuggestions] = useState<Array<{id: string, text: string, category: string}>>([])
  const [filteredPrompts, setFilteredPrompts] = useState<Array<{id: string, text: string, category: string}>>([])
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
  const [campaigns, setCampaigns] = useState<Array<{ id: string; title: string; type: string; mode: string; status: string; updatedAt: number }>>([])
  const [statusFilter, setStatusFilter] = useState<"draft" | "published">("draft")
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true)

  // Track content being generated (for showing in table when dialog is closed)
  const [generatingContent, setGeneratingContent] = useState<GeneratingContent | null>(null)
  const [generatorDialogOpen, setGeneratorDialogOpen] = useState(false)

  // Blog setup status
  const [blogSetupStatus, setBlogSetupStatus] = useState<{
    canPublish: boolean
    setupStatus: 'not_started' | 'pr_open' | 'ready'
    message: string
    actionRequired?: string
    prUrl?: string
  } | null>(null)
  const [blogSetupDialogOpen, setBlogSetupDialogOpen] = useState(false)
  const [blogStatusLoading, setBlogStatusLoading] = useState(true)

  // Fetch blog setup status
  useEffect(() => {
    const fetchBlogStatus = async () => {
      try {
        const res = await fetch('/api/content-lab/blog-status')
        if (res.ok) {
          const data = await res.json()
          if (data.success) {
            setBlogSetupStatus({
              canPublish: data.canPublish,
              setupStatus: data.setupStatus,
              message: data.message,
              actionRequired: data.actionRequired,
              prUrl: data.prUrl,
            })
          }
        }
      } catch (error) {
        console.error('Failed to fetch blog status:', error)
      } finally {
        setBlogStatusLoading(false)
      }
    }
    fetchBlogStatus()
  }, [])

  // Restore generating content from localStorage on mount (for page refresh)
  useEffect(() => {
    const STORAGE_KEY = 'mudra_generating_content'
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Check if not expired (10 minutes)
        if (Date.now() - parsed.startedAt < 10 * 60 * 1000) {
          setGeneratingContent({
            workflowRunId: parsed.workflowRunId,
            title: `Generating: ${parsed.promptText?.substring(0, 50) || 'Content'}...`,
            promptText: parsed.promptText || '',
            status: 'generating',
            currentStep: 3, // Show middle step
          })
        }
      }
    } catch (e) {
      // Ignore localStorage errors
    }
  }, [])

  // Load tracked prompts from database
  useEffect(() => {
    if (!profile?.id) return
    
    const fetchPrompts = async () => {
      try {
        const res = await fetch(`/api/campaigns/prompts?brandProfileId=${profile.id}`)
        const data = await res.json()
        if (data.success && data.prompts) {
          setPromptSuggestions(data.prompts)
        }
      } catch (error) {
        console.error("Failed to load prompts:", error)
        setPromptSuggestions([])
      }
    }
    fetchPrompts()
  }, [profile?.id])

  // Filter prompts by selected intent
  useEffect(() => {
    if (selectedIntent) {
      // Normalize category matching - handle variations like "How-to" vs "How-to Guide"
      const normalizedIntent = selectedIntent.toLowerCase().replace(/\s+/g, '-')
      const filtered = promptSuggestions.filter(p => {
        const normalizedCategory = (p.category || '').toLowerCase().replace(/\s+/g, '-')
        return normalizedCategory.includes(normalizedIntent) || normalizedIntent.includes(normalizedCategory)
      })
      console.log('Filtering prompts:', { selectedIntent, filteredCount: filtered.length, totalPrompts: promptSuggestions.length })
      setFilteredPrompts(filtered)
    } else {
      setFilteredPrompts([])
    }
  }, [selectedIntent, promptSuggestions])

  // Load campaigns from database
  useEffect(() => {
    const fetchCampaigns = async () => {
      setIsLoadingCampaigns(true)
      try {
        const res = await fetch(`/api/campaigns/save?status=${statusFilter}`)
        const data = await res.json()
        if (data.success && data.campaigns) {
          setCampaigns(data.campaigns.map((c: any) => ({
            id: c.id,
            title: c.title,
            type: c.type,
            mode: c.mode,
            status: c.status === "draft" ? "Draft" : "Published",
            updatedAt: new Date(c.updatedAt).getTime()
          })))
        }
      } catch (error) {
        console.error("Failed to load campaigns:", error)
      } finally {
        setIsLoadingCampaigns(false)
      }
    }
    fetchCampaigns()
  }, [statusFilter, isGenerating]) // Reload when status filter changes or generation completes
  const filteredCampaigns = campaigns.filter(c => c.status.toLowerCase() === statusFilter)

  // Format time ago
  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now()
    const diffInSeconds = Math.floor((now - timestamp) / 1000)
    
    if (diffInSeconds < 60) {
      return "Just now"
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60)
      return `${minutes}m ago`
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600)
      return `${hours}h ago`
    } else {
      const days = Math.floor(diffInSeconds / 86400)
      return `${days}d ago`
    }
  }

  // Get icon for campaign type
  const getCampaignIcon = (type: string) => {
    const lowerType = type.toLowerCase()
    if (lowerType.includes("blog")) return FileText
    if (lowerType.includes("newsletter")) return Newspaper
    if (lowerType.includes("case")) return Briefcase
    return FileText
  }
 
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


  const startGeneration = async () => {
    if (!selectedPrompt || !selectedIcp || !selectedContentType) return
    
    // Close the dialog immediately
    setDialogOpen(false)
    
    setIsGenerating(true)
    setGenerationComplete(false)
    setProgressIndex(0)
    const steps = geoSteps
    const total = steps.length
    let i = 0
    
    // Start generating content in parallel with the animation
    const id = `cmp_${Date.now().toString(36)}`
    const modeParam = "geo"
    
    const contentPromise = fetch("/api/campaigns/generate-content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: selectedContentType,
        mode: modeParam,
        prompt: selectedPrompt?.text || selectedPrompt,
        icp: selectedIcp,
      }),
    }).then(res => res.json()).catch(err => {
      console.error("Generation failed:", err)
      return null
    })
    
    const tick = async () => {
      i += 1
      setProgressIndex(i)
      
      // If we're at the second-to-last step (before "Final review"), wait for content generation
      if (i === total - 1) {
        // Wait for content generation to complete before moving to final step
        const data = await contentPromise
        
        // Store generated content in localStorage and database
        if (data && data.success) {
          const campaignData = {
            title: data.title,
            body: data.body,
            generated: true
          };
          localStorage.setItem(`mudra_campaign_${id}`, JSON.stringify(campaignData));
          
          // Generate slug from title
          const rawSlug = data.title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim('-');

          // Enforce descriptive slug criteria: 2–5 words, ~20–60 chars
          const segments = rawSlug.split('-').filter(Boolean);
          const trimmedSegments =
            segments.length > 5 ? segments.slice(0, 5) : segments;
          let slug = trimmedSegments.join('-');

          // Clamp length to ~20–60 characters
          if (slug.length > 60) slug = slug.slice(0, 60).replace(/-+$/g, '');
          if (slug.length < 20 && trimmedSegments.length >= 2) {
            // if too short, keep as-is (assumed already concise)
            slug = slug;
          }

          // Save to database
          fetch("/api/campaigns/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id,
              title: data.title,
              body: data.body,
              type: CONTENT_TYPES.find(ct => ct.value === selectedContentType)?.label || "Blog Post",
              mode: modeParam,
              status: "draft",
              slug: slug,
              prompt: selectedPrompt?.text || selectedPrompt,
              icp: selectedIcp,
              metadata: {
                contentType: selectedContentType,
                promptCategory: selectedPrompt?.category,
                intent: selectedIntent
              }
            })
          })
          .then(res => res.json())
          .then(result => {
            if (result.success) {
              console.log("✅ Campaign saved to database successfully:", result);
            } else {
              console.error("❌ Campaign save failed:", result);
            }
          })
          .catch(err => {
            console.error("❌ Failed to save campaign to database:", err);
          });
        }
        
        // Now proceed to final step and navigate immediately
        setTimeout(() => {
          i += 1
          setProgressIndex(i)
          setGenerationComplete(true) // Mark as complete to show "Loading Campaign Canvas"
          
          // Navigate immediately - keep animation visible during navigation
          setTimeout(() => {
            let extra = ""
            if (selectedPrompt) extra += `&prompt=${encodeURIComponent(selectedPrompt.text)}`
            if (selectedIcp) extra += `&icp=${encodeURIComponent(selectedIcp)}`
            // Don't set isGenerating to false - let it stay visible during navigation
            router.push(`/dashboard/campaigns/${id}?type=${selectedContentType}&mode=${modeParam}${extra}`)
            // Reset states will happen when component unmounts
          }, 500)
        }, 800)
        
      } else if (i < total - 1) {
        // Regular steps - slower timing (1.8 seconds per step)
        setTimeout(tick, 1800)
      }
    }
    
    // Start with initial delay
    setTimeout(tick, 1000)
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
          <div className="container-type-inline-size container-name-main flex flex-1 flex-col bg-dark-grey">
            {/* Page Header (match Overview/Tasks spacing) */}
            <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">
                      {"Content Lab"}
                    </h1>
                      <p className="text-muted-foreground">
                        Multi‑agent Orchestrated Content for AI Search Ranking
                      </p>
                  </div>
                  <div className="flex items-center gap-3">
                     {/* AI-Optimized Content Generator */}
                     <AIOptimizedGenerator
                       trackedPrompts={promptSuggestions}
                       brandProfileId={profile?.id}
                       onComplete={(campaignId) => {
                         // Clear generating content and refresh campaigns list
                         setGeneratingContent(null)
                         setStatusFilter("draft")
                       }}
                       onGenerationStart={(content) => {
                         setGeneratingContent(content)
                       }}
                       onGenerationUpdate={(content) => {
                         setGeneratingContent(content)
                         if (content.status === 'completed' || content.status === 'failed') {
                           // Refresh campaigns when done
                           setStatusFilter("draft")
                         }
                       }}
                       activeGeneration={generatingContent}
                       externalOpen={generatorDialogOpen}
                       onOpenChange={setGeneratorDialogOpen}
                    />
             </div>
            </div>
          </div>

          {/* Clean Divider Line - Full Width */}
          <div className="h-[0.25px] bg-white/10"></div>

          {/* Blog Setup Banner */}
          {!blogStatusLoading && blogSetupStatus && !blogSetupStatus.canPublish && (
            <div className="px-4 lg:px-6 pt-4">
              <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center size-8 rounded-md bg-amber-500/10 border border-amber-500/20 flex-shrink-0">
                    <FileText className="size-4 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {blogSetupStatus.setupStatus === 'pr_open'
                        ? 'Blog setup PR ready — merge to start publishing'
                        : 'Blog not configured — set up to start publishing'}
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">
                      {blogSetupStatus.setupStatus === 'pr_open'
                        ? 'Merge the Pull Request and all your content can go live.'
                        : 'Our AI agent will create blog infrastructure on your website.'}
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {blogSetupStatus.setupStatus === 'pr_open' && blogSetupStatus.prUrl ? (
                    <a
                      href={blogSetupStatus.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs font-medium transition-colors border border-amber-500/20"
                    >
                      View PR
                    </a>
                  ) : (
                    <button
                      onClick={() => setBlogSetupDialogOpen(true)}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-white/10 text-white hover:bg-white/15 text-xs font-medium transition-colors border border-white/[0.06]"
                    >
                      Set Up Blog
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Blog Setup Dialog */}
          <BlogSetupDialog
            open={blogSetupDialogOpen}
            onOpenChange={setBlogSetupDialogOpen}
            onStatusChange={(status) => {
              setBlogSetupStatus(status)
            }}
          />

          {/* Progress Animation - Shown on main page when generating */}
          {isGenerating && (
            <div className="flex flex-col items-center justify-center min-h-[500px] px-4 lg:px-6 py-10">
              <div className="relative w-full max-w-2xl bg-transparent backdrop-blur-sm rounded-xl border border-white/[0.03] p-6 shadow-xl overflow-hidden">
                {/* Title Section */}
                <div className="text-center mb-6">
                  <div className="flex items-center justify-center mb-4">
                    <div className="flex items-center justify-center size-12 rounded-lg bg-white/[0.05] border border-white/[0.03]">
                      <Loader2 className="h-6 w-6 text-primary animate-spin" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-white tracking-tight mb-2">
                    {generationComplete ? "Loading Campaign Canvas" : `Generating ${CONTENT_TYPES.find(ct => ct.value === selectedContentType)?.label || "Campaign"}`}
                  </h3>
                  <p className="text-sm text-white/60 leading-relaxed">
                    {generationComplete ? "Preparing your AI-generated content..." : "Optimizing for Generative Engine"}
                  </p>
                </div>
                
                {/* Progress Steps */}
                <div className="bg-[#1a1a1a] rounded-lg border border-white/[0.04] p-5 space-y-3">
                  {geoSteps.map((label, idx) => {
                    const done = idx < progressIndex
                    const active = idx === progressIndex
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-all ${
                          done
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : active
                              ? "border-white/15 ring-1 ring-white/15 bg-white/[0.02]"
                              : "border-white/[0.04] bg-transparent"
                        }`}
                      >
                        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                          {done ? (
                            <CheckCircle2 className="size-5 text-emerald-400" />
                          ) : active ? (
                            <Loader2 className="size-4 text-primary animate-spin" />
                          ) : (
                            <div className="size-2 rounded-full bg-white/30" />
                          )}
                        </div>
                        <div className={`text-sm font-medium ${done ? "text-white/90" : active ? "text-white" : "text-white/60"}`}>
                          {idx + 1}. {label}
                        </div>
                      </div>
                    )
                  })}
                  
                  {generationComplete && (
                    <div className="flex items-center gap-3 pt-2 mt-2 border-t border-white/[0.04]">
                      <CheckCircle2 className="size-5 text-emerald-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-white/90">Document is ready! Redirecting...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

            
            
            {/* Content - Hide when generating */}
            {!isGenerating && (
            <div className="flex flex-col flex-1">
              <div className="px-4 lg:px-6 pt-6 pb-6 md:pb-8">
                <div className="space-y-4">
                  {/* Filter Toggle */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setStatusFilter("draft")}
                      className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors ${
                        statusFilter === "draft"
                          ? "bg-white/[0.08] text-white"
                          : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
                      }`}
                    >
                      <FileEdit className="w-3.5 h-3.5 opacity-70" />
                      Drafts
                    </button>
                    <button
                      onClick={() => setStatusFilter("published")}
                      className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors ${
                        statusFilter === "published"
                          ? "bg-white/[0.08] text-white"
                          : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
                      }`}
                    >
                      <CircleCheck className="w-3.5 h-3.5 opacity-70" />
                      Published
                    </button>
                  </div>

                  {/* Campaign Table */}
                  {isLoadingCampaigns ? (
                    <div className="rounded-lg border border-white/[0.04] bg-[#0f0f0f]/50 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-white/[0.04] bg-white/[0.03] hover:bg-white/[0.03]">
                            <TableHead className="text-white/50 font-medium h-11 text-[13px]">Content</TableHead>
                            <TableHead className="text-white/50 font-medium h-11 text-[13px]">Type</TableHead>
                            <TableHead className="text-white/50 font-medium h-11 text-[13px]">Mode</TableHead>
                            <TableHead className="text-white/50 font-medium h-11 text-[13px]">Updated</TableHead>
                            <TableHead className="text-white/50 font-medium h-11 text-[13px]">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={`skeleton-${i}`} className="border-white/[0.04]">
                              {/* Content */}
                              <TableCell className="py-3">
                                <div className="flex items-center gap-2.5">
                                  <Skeleton className="size-7 rounded bg-white/[0.06]" />
                                  <Skeleton className="h-4 w-48 bg-white/[0.06]" />
                                </div>
                              </TableCell>
                              {/* Type */}
                              <TableCell className="py-3">
                                <Skeleton className="h-4 w-16 bg-white/[0.06]" />
                              </TableCell>
                              {/* Mode */}
                              <TableCell className="py-3">
                                <Skeleton className="h-6 w-14 rounded-md bg-white/[0.06]" />
                              </TableCell>
                              {/* Updated */}
                              <TableCell className="py-3">
                                <Skeleton className="h-4 w-12 bg-white/[0.06]" />
                              </TableCell>
                              {/* Status */}
                              <TableCell className="py-3">
                                <Skeleton className="h-6 w-16 rounded-md bg-white/[0.06]" />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (filteredCampaigns.length > 0 || (generatingContent && generatingContent.status === 'generating' && statusFilter === 'draft')) ? (
                    <div className="rounded-lg border border-white/[0.04] bg-[#0f0f0f]/50 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-white/[0.04] bg-white/[0.03] hover:bg-white/[0.03]">
                            <TableHead className="text-white/50 font-medium h-11 text-[13px]">Content</TableHead>
                            <TableHead className="text-white/50 font-medium h-11 text-[13px]">Type</TableHead>
                            <TableHead className="text-white/50 font-medium h-11 text-[13px]">Mode</TableHead>
                            <TableHead className="text-white/50 font-medium h-11 text-[13px]">Updated</TableHead>
                            <TableHead className="text-white/50 font-medium h-11 text-[13px]">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {/* Show generating content at the top */}
                          {generatingContent && generatingContent.status === 'generating' && statusFilter === 'draft' && (
                            <TableRow
                              onClick={() => setGeneratorDialogOpen(true)}
                              className="border-white/[0.04] hover:bg-white/[0.03] cursor-pointer group bg-white/[0.02]"
                            >
                              <TableCell className="max-w-md py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="flex items-center justify-center size-7 rounded bg-white/[0.04] border border-white/[0.04] flex-shrink-0">
                                    <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                                  </div>
                                  <span className="text-[13px] font-medium text-white/70 truncate">
                                    {generatingContent.title}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="py-3">
                                <span className="text-xs text-white/50">Blog Post</span>
                              </TableCell>
                              <TableCell className="py-3">
                                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/[0.02] border border-white/[0.03]">
                                  <div className="w-1.5 h-1.5 rounded-full bg-sky-400"></div>
                                  <span className="text-xs text-white/70 font-medium">GEO</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-3">
                                <span className="text-xs text-white/50">Generating...</span>
                              </TableCell>
                              <TableCell className="py-3">
                                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/[0.02] border border-white/[0.03]">
                                  <Loader2 className="w-3 h-3 text-primary animate-spin" />
                                  <span className="text-xs text-white/70 font-medium">Generating</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                          {filteredCampaigns.map((c) => {
                            const Icon = getCampaignIcon(c.type)
                            return (
                              <TableRow
                                key={c.id}
                                onClick={() => handleOpenCampaign(c)}
                                className="border-white/[0.04] hover:bg-white/[0.03] cursor-pointer group"
                              >
                                <TableCell className="max-w-md py-3">
                                  <div className="flex items-center gap-2.5">
                                    <div className="flex items-center justify-center size-7 rounded bg-white/[0.04] border border-white/[0.04] group-hover:bg-white/[0.06] transition-colors flex-shrink-0">
                                      <Icon className="h-3.5 w-3.5 text-white/60 group-hover:text-white/80 transition-colors" />
                                    </div>
                                    <span className="text-[13px] font-medium text-white truncate group-hover:text-white/90 transition-colors">
                                      {c.title}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-3">
                                  <span className="text-xs text-white/50">{c.type}</span>
                                </TableCell>
                                <TableCell className="py-3">
                                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/[0.02] border border-white/[0.03]">
                                    <div className={cn(
                                      "w-1.5 h-1.5 rounded-full",
                                      c.mode.toUpperCase() === "GEO" ? "bg-sky-400" : "bg-amber-400"
                                    )}></div>
                                    <span className="text-xs text-white/70 font-medium">{c.mode.toUpperCase()}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-3">
                                  <span className="text-xs text-white/50">
                                    {formatTimeAgo(c.updatedAt)}
                                  </span>
                                </TableCell>
                                <TableCell className="py-3">
                                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/[0.02] border border-white/[0.03]">
                                    <div className={cn(
                                      "w-1.5 h-1.5 rounded-full",
                                      c.status === "Published" ? "bg-green-500" : "bg-white/40"
                                    )}></div>
                                    <span className="text-xs text-white/70 font-medium">{c.status}</span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 px-6 rounded-lg border border-white/[0.04] bg-[#0f0f0f]/50">
                      <div className="flex items-center justify-center size-12 rounded-lg bg-white/[0.04] border border-white/[0.04] mb-4">
                        <FileText className="h-5 w-5 text-white/40" />
                      </div>
                      <div className="text-sm font-medium text-white/60 mb-1">
                        No {statusFilter} content yet
                      </div>
                      <div className="text-xs text-white/40">
                        Generate AI-optimized content to get started
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function CampaignsPage() {
  return (
    <BrandProfileProvider>
      <CampaignsPageInner />
    </BrandProfileProvider>
  )
}


