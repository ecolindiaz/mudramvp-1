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
import { Plus, FileText, Newspaper, Briefcase, Target, Search, Sparkles, CheckCircle2, Loader2, X, Info, ChevronLeft, ChevronRight, Lightbulb, Tag, Clock, List, BookOpen, HelpCircle, GitCompare } from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { AIOptimizedGenerator } from "@/components/content-lab/ai-optimized-generator"
 

// Format types mapping
type FormatType = "blog" | "listicle" | "howto" | "guide"

const FORMAT_OPTIONS: Record<string, { value: FormatType; label: string }[]> = {
  "Organic": [
    { value: "blog", label: "General Blog Post" },
    { value: "listicle", label: "Listicle" },
    { value: "howto", label: "How-To Guide" },
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
const INTENT_CATEGORIES = ["Organic", "Competitor", "How-to", "Brand-Specific"]

export default function CampaignsPage() {
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
  
  // Load tracked prompts from database
  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        // For now, use brandProfileId = 1 (the existing user)
        // In a real app, this would come from the user's session
        const res = await fetch('/api/campaigns/prompts?brandProfileId=1')
        const data = await res.json()
        if (data.success && data.prompts) {
          setPromptSuggestions(data.prompts)
        }
      } catch (error) {
        console.error("Failed to load prompts:", error)
        // Fallback to empty array if API fails
        setPromptSuggestions([])
      }
    }
    fetchPrompts()
  }, [])

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
          const slug = data.title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim('-');

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
                      {"Campaigns"}
                    </h1>
                      <p className="text-muted-foreground">
                        Tailored brand content for visibility improvement across channels.
                      </p>
                  </div>
                  <div className="flex items-center gap-3">
                     {/* AI-Optimized Content Generator */}
                     <AIOptimizedGenerator 
                       trackedPrompts={promptSuggestions}
                       onComplete={(campaignId) => {
                         // Refresh campaigns list
                         setStatusFilter("draft")
                       }}
                    />
             </div>
            </div>
          </div>

          {/* Clean Divider Line - Full Width */}
          <div className="h-[1px] bg-white/10"></div>

          {/* Progress Animation - Shown on main page when generating */}
          {isGenerating && (
            <div className="flex flex-col items-center justify-center min-h-[500px] px-4 lg:px-6 py-10">
              <div className="relative w-full max-w-2xl bg-transparent backdrop-blur-sm rounded-xl border border-white/[0.08] p-6 shadow-xl overflow-hidden">
                {/* Title Section */}
                <div className="text-center mb-6">
                  <div className="flex items-center justify-center mb-4">
                    <div className="flex items-center justify-center size-12 rounded-lg bg-white/[0.05] border border-white/[0.08]">
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
                <div className="bg-[#1a1a1a] rounded-lg border border-white/[0.06] p-5 space-y-3">
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
                              ? "border-white/20 ring-1 ring-white/20 bg-white/[0.02]"
                              : "border-white/[0.06] bg-transparent"
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
                    <div className="flex items-center gap-3 pt-2 mt-2 border-t border-white/[0.06]">
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
                  <div className="flex items-center gap-2.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStatusFilter("draft")}
                      className={cn(
                        "h-9 px-5 text-sm font-medium transition-all duration-200",
                        statusFilter === "draft"
                          ? "bg-white/15 border-white/25 text-white hover:bg-white/20 hover:border-white/30 shadow-sm shadow-white/5"
                          : "border-white/[0.08] bg-transparent text-white/50 hover:bg-white/5 hover:text-white/80 hover:border-white/[0.12]"
                      )}
                    >
                      Drafts
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStatusFilter("published")}
                      className={cn(
                        "h-9 px-5 text-sm font-medium transition-all duration-200",
                        statusFilter === "published"
                          ? "bg-white/15 border-white/25 text-white hover:bg-white/20 hover:border-white/30 shadow-sm shadow-white/5"
                          : "border-white/[0.08] bg-transparent text-white/50 hover:bg-white/5 hover:text-white/80 hover:border-white/[0.12]"
                      )}
                    >
                      Published
                    </Button>
                  </div>

                  {/* Campaign Table */}
                  {filteredCampaigns.length > 0 ? (
                    <div className="rounded-xl border border-white/[0.08] bg-[#1a1a1a] overflow-hidden shadow-sm">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                            <th className="text-left px-6 py-3.5 text-xs font-semibold text-white/50 uppercase tracking-wider">Title</th>
                            <th className="text-left px-6 py-3.5 text-xs font-semibold text-white/50 uppercase tracking-wider">Type</th>
                            <th className="text-left px-6 py-3.5 text-xs font-semibold text-white/50 uppercase tracking-wider">Mode</th>
                            <th className="text-left px-6 py-3.5 text-xs font-semibold text-white/50 uppercase tracking-wider">Updated</th>
                            <th className="text-left px-6 py-3.5 text-xs font-semibold text-white/50 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCampaigns.map((c) => {
                            const Icon = getCampaignIcon(c.type)
                            return (
                              <tr
                                key={c.id}
                                onClick={() => handleOpenCampaign(c)}
                                className="border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.04] active:bg-white/[0.06] transition-all duration-150 cursor-pointer group"
                              >
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center size-9 rounded-lg border bg-white/[0.05] border-white/[0.08] group-hover:bg-white/[0.08] group-hover:border-white/[0.15] transition-all duration-200 flex-shrink-0 shadow-sm group-hover:shadow">
                                      <Icon className="h-4 w-4 text-white/80 group-hover:text-white transition-colors" />
                                    </div>
                                    <span className="text-sm font-semibold text-white group-hover:text-white/90 transition-colors truncate">{c.title}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <Badge variant="outline" className="text-xs font-medium text-white/70 border-white/15 bg-white/[0.03] hover:bg-white/[0.05] transition-colors">
                                    {c.type}
                                  </Badge>
                                </td>
                                <td className="px-6 py-4">
                                  <Badge
                                    variant="outline"
                                    className={`text-xs font-medium border transition-colors ${
                                      c.mode.toUpperCase() === "GEO"
                                        ? "bg-sky-500/10 border-sky-500/25 text-sky-300 hover:bg-sky-500/15"
                                        : "bg-amber-500/10 border-amber-500/25 text-amber-300 hover:bg-amber-500/15"
                                    }`}
                                  >
                                    {c.mode}
                                  </Badge>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <Clock className="w-3.5 h-3.5 text-white/40 group-hover:text-white/50 transition-colors" />
                                    <span className="text-xs font-medium text-white/60 group-hover:text-white/70 transition-colors">{formatTimeAgo(c.updatedAt)}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    {c.status === "Published" ? (
                                      <>
                                        <div className="w-2 h-2 bg-green-500 rounded-full shadow-sm shadow-green-500/50 group-hover:shadow-green-500/70 transition-shadow"></div>
                                        <span className="text-xs font-medium text-white/80 group-hover:text-white/90 transition-colors">Published</span>
                                      </>
                                    ) : (
                                      <>
                                        <div className="w-2 h-2 bg-white/40 rounded-full group-hover:bg-white/50 transition-colors"></div>
                                        <span className="text-xs font-medium text-white/60 group-hover:text-white/70 transition-colors">Draft</span>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 px-6 rounded-xl border border-white/[0.08] bg-[#1a1a1a]">
                      <div className="text-sm text-white/50 mb-1">No {statusFilter} campaigns found</div>
                      <div className="text-xs text-white/40">Create a new campaign to get started</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      </SidebarInset>
      
      <FloatingMudraButton siteId={typeof window !== 'undefined' ? (localStorage.getItem('mudra:siteId') || '') : ''} />
    </SidebarProvider>
  )
}


