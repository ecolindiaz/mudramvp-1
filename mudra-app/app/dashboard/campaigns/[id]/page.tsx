"use client"
import React from "react"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import { BrandProfileProvider } from "@/components/brand-profile-context"
import { CampaignEditor } from "@/components/editor/campaign-editor"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Eye, Save, CheckCircle2, ListTree, Info, Clock, Copy as CopyIcon, Check, MessageSquareText, Link as LinkIcon, Loader2, Trash2, FileText, Image as ImageIcon, FileCode, Edit, ChevronDown } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { BlogSetupDialog } from "@/components/content-lab/blog-setup-dialog"
import { computeContentLabSchemaSourceHash } from "@/lib/content-lab/schema-hash"

// Helper function to accurately count words in markdown content
function countWordsInMarkdown(content: string): number {
  if (!content || content.trim().length === 0) return 0
  
  // Remove code blocks (```code```)
  let text = content.replace(/```[\s\S]*?```/g, '')
  
  // Remove inline code (`code`)
  text = text.replace(/`[^`]+`/g, '')
  
  // Remove markdown links [text](url) but keep the text
  text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
  
  // Remove markdown images ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '')
  
  // Remove markdown headers (# ## ### etc.)
  text = text.replace(/^#{1,6}\s+/gm, '')
  
  // Remove markdown bold/italic markers
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1')
  text = text.replace(/\*([^*]+)\*/g, '$1')
  text = text.replace(/__([^_]+)__/g, '$1')
  text = text.replace(/_([^_]+)_/g, '$1')
  
  // Remove markdown list markers
  text = text.replace(/^[\s]*[-*+]\s+/gm, '')
  text = text.replace(/^[\s]*\d+\.\s+/gm, '')
  
  // Remove markdown blockquotes
  text = text.replace(/^>\s+/gm, '')
  
  // Remove markdown horizontal rules
  text = text.replace(/^---$/gm, '')
  text = text.replace(/^\*\*\*$/gm, '')
  
  // Remove HTML tags if any
  text = text.replace(/<[^>]+>/g, '')
  
  // Remove URLs
  text = text.replace(/https?:\/\/[^\s]+/g, '')
  
  // Remove email addresses
  text = text.replace(/[^\s]+@[^\s]+/g, '')
  
  // Remove extra whitespace and normalize
  text = text.replace(/\s+/g, ' ').trim()
  
  // Split by whitespace and filter out empty strings and pure punctuation
  const words = text.split(/\s+/).filter(word => {
    // Remove punctuation from start/end but keep the word if it has letters/numbers
    const cleaned = word.replace(/^[^\w]+|[^\w]+$/g, '')
    return cleaned.length > 0
  })
  
  return words.length
}

type SchemaStatus = "ready" | "failed" | "stale" | "none"
type BlogSchemaType = "BlogPosting" | "TechArticle" | "HowTo"

interface ContentLabSchemaMetadata {
  schemaType: BlogSchemaType
  scriptTag: string
  generatedAt: string
  confidence: number
  sourceHash: string
  optionalFieldsIncluded?: string[]
}

function isContentLabSchemaMetadata(value: unknown): value is ContentLabSchemaMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.schemaType === "string" && typeof candidate.scriptTag === "string"
}

function CampaignCanvasPageInner({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ type?: string; mode?: string; prompt?: string; icp?: string; keyword?: string }>
}) {
  const { id } = React.use(params)
  const { type = "blog", mode = "geo", prompt, icp, keyword: kwParam } = React.use(searchParams)
  const [preview, setPreview] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [savedAt, setSavedAt] = React.useState<number | null>(null)
  const [published, setPublished] = React.useState(false)
  const [targetIcp, setTargetIcp] = React.useState("")
  const [campaignPrompt, setCampaignPrompt] = React.useState("")
  const [slug, setSlug] = React.useState("")
  const [keyword, setKeyword] = React.useState("")
  const [copied, setCopied] = React.useState(false)
  const [showCopyMenu, setShowCopyMenu] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState("copy")
  const [metaDescription, setMetaDescription] = React.useState("")
  const [contentLabSchema, setContentLabSchema] = React.useState<ContentLabSchemaMetadata | null>(null)
  const [schemaStatus, setSchemaStatus] = React.useState<SchemaStatus>("none")
  const [schemaError, setSchemaError] = React.useState("")
  const [schemaRegenerating, setSchemaRegenerating] = React.useState(false)
  const [titleCopied, setTitleCopied] = React.useState(false)
  const [descCopied, setDescCopied] = React.useState(false)
  const [slugCopied, setSlugCopied] = React.useState(false)
  const [schemaCopied, setSchemaCopied] = React.useState(false)
  const [schemaExpanded, setSchemaExpanded] = React.useState(false)
  const [editMode, setEditMode] = React.useState(false)
  
  // Blog setup status
  const [blogSetupStatus, setBlogSetupStatus] = React.useState<{
    canPublish: boolean
    setupStatus: 'not_started' | 'pr_open' | 'ready'
    message: string
    actionRequired?: string
    prUrl?: string
  } | null>(null)
  const [publishing, setPublishing] = React.useState(false)
  const [blogSetupDialogOpen, setBlogSetupDialogOpen] = React.useState(false)
  const [publishResult, setPublishResult] = React.useState<{
    success: boolean
    prUrl?: string
    message?: string
    error?: string
  } | null>(null)

  const [title, setTitle] = React.useState("")
  const [body, setBody] = React.useState("")
  const [contentLoaded, setContentLoaded] = React.useState(false)

  const wordCount = React.useMemo(() => body.trim().split(/\s+/).filter(Boolean).length, [body])
  const readMinutes = Math.max(1, Math.round(wordCount / 200))

  // Debug: Log current field values
  React.useEffect(() => {
    console.log('🔍 Current field values:', JSON.stringify({
      targetIcp: targetIcp || 'empty',
      campaignPrompt: campaignPrompt || 'empty',
      slug: slug || 'empty',
      keyword: keyword || 'empty'
    }, null, 2))
  }, [targetIcp, campaignPrompt, slug, keyword])

  // Close copy menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (showCopyMenu && !target.closest('.copy-menu-container')) {
        setShowCopyMenu(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showCopyMenu])

  const headings = React.useMemo(() => {
    return body.split("\n").filter((l) => l.startsWith("## ")).map((h) => h.replace(/^##\s+/, ""))
  }, [body])
  const outlineItems = headings.length > 0 ? headings : []

  const currentSchemaSourceHash = React.useMemo(() => {
    const normalizedSlug =
      slug && slug.trim().length > 0 ? slug.trim() : (title || "").trim()
    return computeContentLabSchemaSourceHash({
      title: title || "",
      body: body || "",
      slug: normalizedSlug,
    })
  }, [title, body, slug])

  const isSchemaStale = React.useMemo(() => {
    if (!contentLabSchema?.sourceHash) return false
    return contentLabSchema.sourceHash !== currentSchemaSourceHash
  }, [contentLabSchema, currentSchemaSourceHash])

  const effectiveSchemaStatus = React.useMemo<SchemaStatus>(() => {
    if (schemaStatus === "failed") return "failed"
    if (schemaStatus === "stale") return "stale"
    if (isSchemaStale) return "stale"
    if (contentLabSchema) return "ready"
    return "none"
  }, [schemaStatus, isSchemaStale, contentLabSchema])

  const handleRegenerateSchema = async () => {
    setSchemaRegenerating(true)

    setSchemaError("")
    try {
      const response = await fetch("/api/content-lab/schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: id }),
      })
      const data = await response.json()
      if (!response.ok || !data.success || !isContentLabSchemaMetadata(data.schema)) {
        const errorMessage = data?.error || "Failed to regenerate schema"
        setSchemaStatus("failed")
        setSchemaError(errorMessage)

        return
      }

      setContentLabSchema(data.schema)
      setSchemaStatus("ready")
      setSchemaError("")
    } catch (error) {
      console.error("Failed to regenerate schema:", error)
      const message = "Failed to regenerate schema"
      setSchemaStatus("failed")
      setSchemaError(message)
    } finally {
      setSchemaRegenerating(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch("/api/campaigns/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          title,
          body,
          type,
          mode,
          status: published ? "published" : "draft",
          slug,
          prompt: campaignPrompt,
          icp: targetIcp,
          keyword: keyword
        })
      })
      
      if (response.ok) {
        setSavedAt(Date.now())
        console.log("✅ Campaign saved successfully")
      }
    } catch (error) {
      console.error("Failed to save campaign:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/campaigns/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      })
      
      if (response.ok) {
        console.log("✅ Campaign deleted successfully")
        // Redirect to campaigns list
        window.location.href = "/dashboard/campaigns"
      } else {
        console.error("Failed to delete campaign")
      }
    } catch (error) {
      console.error("Failed to delete campaign:", error)
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  // Initialize from URL params and load generated content
  React.useEffect(() => {
    // Fetch blog setup status
    const fetchBlogStatus = async () => {
      try {
        const response = await fetch('/api/content-lab/blog-status')
        if (response.ok) {
          const data = await response.json()
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
      }
    }
    fetchBlogStatus()
  }, [])

  // Load campaign content
  React.useEffect(() => {
    const loadContent = async () => {
      setIsLoading(true)
      
      // Always try to load from database first
      try {
        const response = await fetch(`/api/campaigns/${id}`)
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.campaign) {
            const campaign = data.campaign
            setTitle(campaign.title || "Untitled Campaign")
            setBody(campaign.body || "## Welcome to Campaign Canvas\n\nStart editing your content here.")
            setPublished(campaign.status === "published")
            setSlug(campaign.slug || "")
            setCampaignPrompt(campaign.prompt || "")
            setTargetIcp(campaign.icp || "")
            setKeyword(campaign.keyword || "")
            
            // Load metaDescription from metadata (Prisma Json type is already parsed)
            try {
              const metadata = campaign.metadata && typeof campaign.metadata === 'object'
                ? campaign.metadata
                : (typeof campaign.metadata === 'string' ? JSON.parse(campaign.metadata) : {})
              const metaDesc = (metadata as any).metaDescription || ""
              const schemaFromMetadata = (metadata as any).contentLabSchema
              const metadataSchemaStatus = (metadata as any).schemaStatus
              const metadataSchemaError = (metadata as any).schemaError
              console.log('📋 Metadata loaded:', { metadata, metaDescription: metaDesc })
              setMetaDescription(metaDesc)
              if (isContentLabSchemaMetadata(schemaFromMetadata)) {
                setContentLabSchema(schemaFromMetadata)
              } else {
                setContentLabSchema(null)
              }
              if (metadataSchemaStatus === "ready" || metadataSchemaStatus === "failed" || metadataSchemaStatus === "stale") {
                setSchemaStatus(metadataSchemaStatus)
              } else {
                setSchemaStatus(isContentLabSchemaMetadata(schemaFromMetadata) ? "ready" : "none")
              }
              setSchemaError(typeof metadataSchemaError === "string" ? metadataSchemaError : "")
            } catch (e) {
              console.warn('Failed to parse campaign metadata:', e)
              setContentLabSchema(null)
              setSchemaStatus("none")
              setSchemaError("")
            }
            
            setContentLoaded(true)
            setIsLoading(false)
            
            // Log immediately after setting
            console.log('🔧 Fields set to:', JSON.stringify({
              slug: campaign.slug || "",
              prompt: campaign.prompt || "",
              icp: campaign.icp || "",
              keyword: campaign.keyword || ""
            }, null, 2))
            console.log('✅ Loaded campaign from database')
            console.log('📝 Database field values:', JSON.stringify({
              slug: campaign.slug,
              prompt: campaign.prompt,
              icp: campaign.icp,
              keyword: campaign.keyword
            }, null, 2))
            return
          }
        }
      } catch (error) {
        console.error('Failed to load campaign from database:', error)
      }
      
      // Fallback to localStorage for newly generated campaigns
      const storageKey = `mudra_campaign_${id}`
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        try {
          const data = JSON.parse(stored)
          if (data.generated && data.title && data.body) {
            setTitle(data.title)
            setBody(data.body)
            // Set fields from URL parameters if they exist
            if (prompt) setCampaignPrompt(prompt)
            if (icp) setTargetIcp(icp)
            if (kwParam) setKeyword(kwParam)
            setContentLoaded(true)
            setIsLoading(false)
            console.log('✅ Loaded generated content from storage')
            console.log('📝 Field values set:', JSON.stringify({ 
              prompt: prompt || 'undefined', 
              icp: icp || 'undefined', 
              kwParam: kwParam || 'undefined' 
            }, null, 2))
            return
          }
        } catch (e) {
          console.error('Failed to parse stored content:', e)
        }
      }
      
      // If we have URL params but no content yet, wait for generation
      if (prompt || icp || kwParam) {
        let attempts = 0
        const maxAttempts = 30 // 30 seconds max wait
        
        const checkForContent = () => {
          const stored = localStorage.getItem(storageKey)
          
          if (stored) {
            try {
              const data = JSON.parse(stored)
              if (data.generated && data.title && data.body) {
                setTitle(data.title)
                setBody(data.body)
                setContentLoaded(true)
                setIsLoading(false)
                console.log('✅ Loaded generated content from storage')
                return
              }
            } catch (e) {
              console.error('Failed to parse stored content:', e)
            }
          }
          
          attempts++
          if (attempts < maxAttempts) {
            // Check more frequently initially (every 200ms for first 5 seconds, then every second)
            const delay = attempts < 25 ? 200 : 1000
            setTimeout(checkForContent, delay)
          } else {
            // Timeout - show placeholder
            setTitle("Content Generation Timed Out")
            setBody("The content generation is taking longer than expected. Please try again or contact support.")
            setContentLoaded(true)
            setIsLoading(false)
          }
        }
        
        checkForContent()
      } else {
        // No content found anywhere - show placeholder
        setTitle("Campaign Not Found")
        setBody("## Welcome to Campaign Canvas\n\nThis campaign could not be loaded. Start editing your content here.\n\n## Content Structure\n\nAdd your sections, headings, and content below.")
        setContentLoaded(true)
        setIsLoading(false)
      }
    }
    
    loadContent()
  }, [id, prompt, icp, kwParam])

  return (
    <SidebarProvider
      className="bg-dark-grey"
      style={{
        "--sidebar-width": "16rem",
        "--header-height": "calc(var(--spacing) * 12)",
      } as React.CSSProperties}
    >
      <AppSidebar />
      <SidebarInset className="bg-dark-grey m-0 shadow-none rounded-none border-none">
        <SiteHeader />
        <Separator className="w-full border-border" />
        <div className="flex flex-1 flex-col bg-dark-grey">
          <div className="px-4 lg:px-6 pt-3 md:pt-4 pb-3 md:pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">Campaign Canvas</h1>
                </div>
                <div className="flex items-center gap-2">
                  {/* Publish Button - Only enabled when blog setup is complete */}
                  <Button 
                    onClick={async () => {
                      if (!blogSetupStatus?.canPublish) {
                        // Open blog setup dialog instead of alert
                        setBlogSetupDialogOpen(true)
                        return
                      }
                      
                      setPublishing(true)
                      setPublishResult(null)
                      
                      try {
                        const response = await fetch('/api/content-lab/publish', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ campaignId: id })
                        })
                        
                        const data = await response.json()
                        
                        if (data.success) {
                          setPublished(true)
                          setPublishResult({
                            success: true,
                            prUrl: data.prUrl,
                            message: data.message
                          })
                        } else {
                          setPublishResult({
                            success: false,
                            error: data.error || 'Failed to publish'
                          })
                        }
                      } catch (error) {
                        console.error('Failed to publish:', error)
                        setPublishResult({
                          success: false,
                          error: 'Failed to publish campaign'
                        })
                      } finally {
                        setPublishing(false)
                      }
                    }}
                    disabled={publishing || published || !blogSetupStatus?.canPublish}
                    variant="outline" 
                    size="sm" 
                    title={blogSetupStatus?.canPublish ? 'Publish to your website' : blogSetupStatus?.actionRequired || 'Set up blog first'}
                    className={`h-9 px-4 rounded-full gap-2 text-xs font-medium transition-all duration-200 ${
                      published 
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" 
                        : blogSetupStatus?.canPublish
                          ? "bg-white/5 text-white hover:bg-white/10 border-white/[0.04]"
                          : "bg-white/5 text-white/50 border-white/[0.04] cursor-not-allowed opacity-60"
                    }`}
                  >
                    {publishing ? (
                      <><Loader2 className="size-3.5 animate-spin" />Publishing...</>
                    ) : published ? (
                      <><CheckCircle2 className="size-3.5" />Published</>
                    ) : blogSetupStatus?.canPublish ? (
                      <><CheckCircle2 className="size-3.5" />Publish</>
                    ) : (
                      <><CheckCircle2 className="size-3.5" />Publish (Setup Required)</>
                    )}
                  </Button>
                  
                  {/* Show publish result message */}
                  {publishResult && (
                    <div className={`text-xs ${publishResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                      {publishResult.success ? (
                        publishResult.prUrl ? (
                          <a href={publishResult.prUrl} target="_blank" rel="noopener noreferrer" className="underline">
                            PR Created →
                          </a>
                        ) : publishResult.message
                      ) : publishResult.error}
                    </div>
                  )}
                  
                  <Button onClick={handleSave} disabled={saving} variant="outline" size="sm" className="h-9 px-4 rounded-full bg-white/5 text-white hover:bg-white/10 border-white/[0.04] text-xs font-medium gap-2 disabled:opacity-50">
                    <Save className="size-3.5" />{saving ? 'Saving…' : 'Save'}
                  </Button>
                  
                  <Button 
                    onClick={() => setShowDeleteConfirm(true)} 
                    variant="outline" 
                    size="sm" 
                    className="h-9 px-4 rounded-full bg-white/5 text-red-400 hover:bg-red-500/10 border-red-500/20 text-xs font-medium gap-2"
                  >
                    <Trash2 className="size-3.5" />Delete
                  </Button>
                  
                  <Button asChild size="sm" className="h-9 px-4 rounded-full bg-white/5 text-white hover:bg-white/10 border-white/[0.04] text-xs font-medium">
                    <Link href="/dashboard/campaigns">Back</Link>
                  </Button>
                </div>
              </div>
            </div>

          {/* Blog Setup Dialog */}
          <BlogSetupDialog
            open={blogSetupDialogOpen}
            onOpenChange={setBlogSetupDialogOpen}
            onStatusChange={(status) => {
              setBlogSetupStatus({
                canPublish: status.canPublish,
                setupStatus: status.setupStatus,
                message: status.message,
                actionRequired: status.actionRequired,
                prUrl: status.prUrl,
              })
            }}
          />

          {/* Header Divider */}
          <div className="h-[0.25px] bg-white/10"></div>

          <div className="px-4 lg:px-6 pb-4 md:pb-6 pt-4">
              {isLoading ? (
                /* Droid-lab style loading card */
                <div className="flex flex-col items-center justify-center min-h-[60vh]">
                  <Card className="w-full max-w-md rounded-2xl border border-white/[0.04] bg-[#121212] shadow-md">
                    <CardContent className="pt-6 pb-6 px-6 relative overflow-hidden">
                      <div className="pointer-events-none absolute inset-0">
                        <div className="absolute -bottom-20 -left-12 w-48 h-48 bg-primary/10 blur-3xl rounded-full" />
                      </div>
                      <div className="flex flex-col items-center gap-4 text-center relative">
                        <div className="relative flex items-center justify-center">
                          <div className="absolute inset-[-12px] rounded-full border border-white/[0.04] animate-[spin_6s_linear_infinite]" />
                          <div className="absolute inset-[-20px] rounded-full border border-dashed border-white/[0.06] animate-[spin_10s_linear_infinite]" />
                          <div className="flex items-center justify-center w-12 h-12 rounded-lg border border-white/[0.12] bg-white/[0.04]">
                            <Loader2 className="size-6 text-white/90 animate-spin" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-lg font-semibold text-white">Loading Campaign Canvas</h3>
                          <p className="text-sm text-white/60">
                            Preparing your AI-generated content...
                          </p>
                        </div>
                        <div className="w-full max-w-xs">
                          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                            <div className="h-full w-2/5 bg-white/50 animate-[shimmer_1.4s_ease-in-out_infinite] rounded-full" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 items-start h-full">
                {/* Editor (left side) */}
                <div className="lg:col-span-2 space-y-2 order-1 lg:order-1 flex flex-col">
                    <Card className="rounded-2xl border border-white/[0.04] bg-[#1a1a1a] overflow-hidden shadow-sm flex flex-col">
                    <CardHeader className="pb-2 px-5 pt-4 flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base font-semibold text-white">Editor</CardTitle>
                            <CardDescription className="text-white/60 text-xs mt-0.5">
                              {isLoading ? "Loading..." : "Edit your campaign content"}
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className={`h-8 px-3 rounded-full text-xs font-medium gap-1.5 ${editMode ? "bg-primary text-white hover:bg-primary/90 border-primary" : "bg-white/5 text-white hover:bg-white/10 border-white/[0.04]"}`}
                            onClick={() => setEditMode((v) => !v)}
                          >
                            <Edit className="size-3.5" /> {editMode ? "Editing" : "Edit"}
                          </Button>
                          <div className="relative copy-menu-container">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 rounded-full bg-white/5 text-white hover:bg-white/10 border-white/[0.04] text-xs font-medium gap-1.5"
                              onClick={(e) => {
                                e.stopPropagation()
                                setShowCopyMenu((v) => !v)
                              }}
                            >
                              <CopyIcon className="size-3.5" /> {copied ? "Copied!" : "Copy"}
                            </Button>
                            {showCopyMenu && (
                              <div className="absolute top-full right-0 mt-1 bg-[#1a1a1a] border border-white/[0.12] rounded-lg shadow-xl z-50 py-1 min-w-[160px]">
                                <button
                                  className="w-full px-3 py-2 text-left text-xs text-white/90 hover:bg-white/[0.08] flex items-center gap-2"
                                  onClick={async () => {
                                    try {
                                      const markdownContent = `# ${title}\n\n${body}`
                                      await navigator.clipboard.writeText(markdownContent)
                                      setCopied(true)
                                      setShowCopyMenu(false)
                                      setTimeout(() => setCopied(false), 1200)
                                    } catch (e) {}
                                  }}
                                >
                                  <FileCode className="size-3.5 text-white/60" />
                                  Copy as Markdown
                                </button>
                                <button
                                  className="w-full px-3 py-2 text-left text-xs text-white/90 hover:bg-white/[0.08] flex items-center gap-2"
                                  onClick={async () => {
                                    try {
                                      // Convert markdown to plain text
                                      let plainText = body
                                        .replace(/#{1,6}\s+/g, '') // Remove headers
                                        .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
                                        .replace(/\*([^*]+)\*/g, '$1') // Remove italic
                                        .replace(/__([^_]+)__/g, '$1')
                                        .replace(/_([^_]+)_/g, '$1')
                                        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Links to text
                                        .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '') // Remove images
                                        .replace(/^[\s]*[-*+]\s+/gm, '• ') // Bullet points
                                        .replace(/^[\s]*\d+\.\s+/gm, '') // Numbered lists
                                        .replace(/^>\s+/gm, '') // Blockquotes
                                        .replace(/`([^`]+)`/g, '$1') // Inline code
                                        .replace(/```[\s\S]*?```/g, '') // Code blocks
                                      await navigator.clipboard.writeText(`${title}\n\n${plainText}`)
                                      setCopied(true)
                                      setShowCopyMenu(false)
                                      setTimeout(() => setCopied(false), 1200)
                                    } catch (e) {}
                                  }}
                                >
                                  <FileText className="size-3.5 text-white/60" />
                                  Copy as Plain Text
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="px-5 pb-4 space-y-3">
                        <Input 
                          value={title} 
                          onChange={(e) => setTitle(e.target.value)} 
                          disabled={isLoading || !editMode}
                          className="h-9 rounded-full bg-white/[0.03] border-white/[0.04] text-white/90 placeholder:text-white/50 focus-visible:border-white/[0.12] focus-visible:bg-white/[0.05] disabled:opacity-50 text-sm" 
                          placeholder="Post title" 
                        />
                      <div className="h-[70vh]">
                        {!isLoading && contentLoaded && (
                          <CampaignEditor
                            key={`editor-${id}-${contentLoaded ? 'loaded' : 'empty'}`} // Force re-render when content is loaded
                            value={body}
                            onChange={(value) => setBody(value)}
                            placeholder="Start typing your content here..."
                            readOnly={!editMode}
                            showToolbar={editMode}
                          />
                        )}
                        {!isLoading && !contentLoaded && (
                          <div className="flex items-center justify-center h-full text-white/60">
                            Loading content...
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {savedAt && (
                    <div className="flex items-center text-xs text-white/60 px-1">
                      <span>Saved {new Date(savedAt).toLocaleTimeString()}</span>
                    </div>
                  )}
                </div>

                {/* Right Side: Coming Soon (Edit Mode) or Tabs (Normal Mode) */}
                <div className="order-2 lg:order-2 flex flex-col h-full self-start">
                  {editMode ? (
                    /* AI Edit - Coming Soon */
                    <div className="rounded-2xl bg-[#1a1a1a] overflow-hidden flex flex-col w-full">
                      <div className="p-6 flex flex-col items-center text-center">
                        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                          <img 
                            src="/images/mudra-logo.png" 
                            alt="Mudra" 
                            className="w-7 h-7 object-contain opacity-90"
                          />
                        </div>
                        <Badge className="mb-3 bg-primary/10 text-primary border-0 text-xs px-3 py-1">
                          Coming Soon
                        </Badge>
                        <h3 className="text-base font-semibold mb-2 text-white">AI-Powered Editing</h3>
                        <p className="text-white/60 text-sm max-w-xs mx-auto leading-relaxed">
                          Soon you'll be able to edit your content with natural language commands
                        </p>
                        <p className="text-xs text-white/40 mt-4">
                          For now, edit directly in the editor
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Normal Tabs */
                    <Card className="rounded-2xl border border-white/[0.04] bg-[#1a1a1a] overflow-hidden shadow-sm flex flex-col w-full flex-1 min-h-0">
                      <CardContent className="p-0 flex flex-col flex-1 min-h-0">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-1 min-h-0">
                        <div className="px-5 pt-4 pb-3 border-b border-white/[0.04] flex-shrink-0">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setActiveTab("copy")}
                              className={`flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium transition-colors ${
                                activeTab === "copy"
                                  ? "bg-white/[0.08] text-white"
                                  : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
                              }`}
                            >
                              <Info className="w-3.5 h-3.5 opacity-70" />
                              Overview
                            </button>
                            <button
                              onClick={() => setActiveTab("seo")}
                              className={`flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium transition-colors ${
                                activeTab === "seo"
                                  ? "bg-white/[0.08] text-white"
                                  : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
                              }`}
                            >
                              <FileCode className="w-3.5 h-3.5 opacity-70" />
                              Technical
                            </button>
                            <button
                              onClick={() => setActiveTab("backlinks")}
                              className={`flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium transition-colors ${
                                activeTab === "backlinks"
                                  ? "bg-white/[0.08] text-white"
                                  : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
                              }`}
                            >
                              <LinkIcon className="w-3.5 h-3.5 opacity-70" />
                              Backlinks
                            </button>
                          </div>
                        </div>

                        <TabsContent value="copy" className="p-5 space-y-4 mt-0 overflow-y-auto">
                          {/* Outline Section */}
                          <div className="space-y-2.5 pb-4 border-b border-white/[0.06]">
                            <div className="flex items-center gap-2">
                              <ListTree className="size-4 text-white/80" />
                              <h3 className="text-sm font-semibold text-white">Outline</h3>
                            </div>
                            <div className="space-y-2.5 pl-5">
                              {mode === "geo" ? (
                                <>
                                  <div className="flex items-start justify-between gap-4">
                                    <span className="text-white/60 text-xs font-medium uppercase tracking-wide min-w-[60px]">ICP</span>
                                    <span className="text-white/90 text-sm truncate text-right flex-1" title={targetIcp || "Not set"}>
                                      {targetIcp || "Not set"}
                                    </span>
                                  </div>
                                  <div className="flex items-start justify-between gap-4">
                                    <span className="text-white/60 text-xs font-medium uppercase tracking-wide min-w-[60px]">Prompt</span>
                                    <span className="text-white/90 text-sm truncate text-right flex-1" title={campaignPrompt || "Not set"}>
                                      {campaignPrompt || "Not set"}
                                    </span>
                                  </div>
                                  <div className="flex items-start justify-between gap-4">
                                    <span className="text-white/60 text-xs font-medium uppercase tracking-wide min-w-[60px]">Slug</span>
                                    <span className="text-white/90 text-sm truncate text-right flex-1" title={slug || "Not set"}>
                                      {slug || "Not set"}
                                    </span>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="flex items-start justify-between gap-4">
                                    <span className="text-white/60 text-xs font-medium uppercase tracking-wide min-w-[60px]">Keyword</span>
                                    <span className="text-white/90 text-sm truncate text-right flex-1" title={keyword || "Not set"}>
                                      {keyword || "Not set"}
                                    </span>
                                  </div>
                                  <div className="flex items-start justify-between gap-4">
                                    <span className="text-white/60 text-xs font-medium uppercase tracking-wide min-w-[60px]">Slug</span>
                                    <span className="text-white/90 text-sm truncate text-right flex-1" title={slug || "Not set"}>
                                      {slug || "Not set"}
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Details Section */}
                          <div className="space-y-2.5 pb-4 border-b border-white/[0.06]">
                            <div className="flex items-center gap-2">
                              <Info className="size-4 text-white/80" />
                              <h3 className="text-sm font-semibold text-white">Details</h3>
                            </div>
                            <div className="space-y-2.5 pl-5">
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-white/60 text-xs font-medium uppercase tracking-wide">Type</span>
                                <Badge variant="outline" className="capitalize bg-white/5 border-white/[0.04] text-white/90 text-xs">{type}</Badge>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-white/60 text-xs font-medium uppercase tracking-wide">Mode</span>
                                <Badge variant="outline" className="uppercase bg-white/5 border-white/[0.04] text-white/90 text-xs">{mode}</Badge>
                              </div>
                            </div>
                          </div>

                          {/* Status Section */}
                          <div className="space-y-2.5 pb-4 border-b border-white/[0.06]">
                            <div className="flex items-center gap-2">
                              <Clock className="size-4 text-white/80" />
                              <h3 className="text-sm font-semibold text-white">Status</h3>
                            </div>
                            <div className="space-y-2.5 pl-5">
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-white/60 text-xs font-medium uppercase tracking-wide">Publication</span>
                                <Badge variant="outline" className={published ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : "bg-white/5 border-white/[0.04] text-white/90"} style={{ fontSize: '11px' }}>
                                  {published ? "Published" : "Draft"}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-white/60 text-xs font-medium uppercase tracking-wide">Last Saved</span>
                                <span className="text-white/60 text-xs">{savedAt ? new Date(savedAt).toLocaleTimeString() : "—"}</span>
                              </div>
                            </div>
                          </div>

                          {/* Word Count Section */}
                          <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-4 space-y-2">
                            <h3 className="text-sm font-semibold text-white">Word Count</h3>
                            <div className="space-y-1">
                              <div className="text-4xl font-bold text-white tracking-tight">
                                {countWordsInMarkdown(body || '').toLocaleString()}
                              </div>
                              <p className="text-xs text-white/60">Total words in content</p>
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="seo" className="px-5 pt-5 pb-3 space-y-4 mt-0 overflow-y-auto">
                          {/* Metadata Section */}
                          <div className="space-y-3 pb-4 border-b border-white/[0.06]">
                            <h3 className="text-sm font-semibold text-white">Metadata</h3>
                            <div className="space-y-4">
                              {/* Meta Title */}
                              <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-white/70 uppercase tracking-wide">Meta title</span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(title || "")
                                      setTitleCopied(true)
                                      setTimeout(() => setTitleCopied(false), 2000)
                                    }}
                                    className="p-1.5 rounded-full hover:bg-white/[0.05] text-white/50 hover:text-white/80 transition-colors"
                                    title="Copy meta title"
                                  >
                                    {titleCopied ? (
                                      <Check className="size-3.5 text-emerald-400" />
                                    ) : (
                                      <CopyIcon className="size-3.5" />
                                    )}
                                  </button>
                                </div>
                                <p className="text-sm text-white/90 leading-relaxed break-words">{title || "Not set"}</p>
                              </div>

                              {/* Meta Description */}
                              <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-white/70 uppercase tracking-wide">Meta description</span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(metaDescription || "")
                                      setDescCopied(true)
                                      setTimeout(() => setDescCopied(false), 2000)
                                    }}
                                    className="p-1.5 rounded-full hover:bg-white/[0.05] text-white/50 hover:text-white/80 transition-colors"
                                    title="Copy meta description"
                                  >
                                    {descCopied ? (
                                      <Check className="size-3.5 text-emerald-400" />
                                    ) : (
                                      <CopyIcon className="size-3.5" />
                                    )}
                                  </button>
                                </div>
                                <p className="text-sm text-white/90 leading-relaxed break-words">{metaDescription || "Not set"}</p>
                              </div>

                              {/* Slug */}
                              <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-white/70 uppercase tracking-wide">Slug</span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(slug || "")
                                      setSlugCopied(true)
                                      setTimeout(() => setSlugCopied(false), 2000)
                                    }}
                                    className="p-1.5 rounded-full hover:bg-white/[0.05] text-white/50 hover:text-white/80 transition-colors"
                                    title="Copy slug"
                                  >
                                    {slugCopied ? (
                                      <Check className="size-3.5 text-emerald-400" />
                                    ) : (
                                      <CopyIcon className="size-3.5" />
                                    )}
                                  </button>
                                </div>
                                <p className="text-sm text-white/90 leading-relaxed break-words font-mono">{slug || "Not set"}</p>
                              </div>
                            </div>
                          </div>

                          {/* Structured Data Section */}
                          <div>
                            <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-2.5 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 text-xs font-medium text-white/70 uppercase tracking-wide">
                                  <FileCode className="size-3.5" />
                                  Structured Data (JSON-LD)
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={handleRegenerateSchema}
                                    disabled={schemaRegenerating}
                                    className="h-7 px-2.5 rounded-full text-white/50 hover:text-white/70 hover:bg-white/[0.04] text-[11px] font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    title="Regenerate schema with GPT 5.2"
                                  >
                                    {schemaRegenerating ? (
                                      <span className="inline-flex items-center gap-1">
                                        <Loader2 className="size-3 animate-spin" />
                                        Regenerating
                                      </span>
                                    ) : "Regenerate"}
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (!contentLabSchema?.scriptTag) return
                                      navigator.clipboard.writeText(contentLabSchema.scriptTag)
                                      setSchemaCopied(true)
                                      setTimeout(() => setSchemaCopied(false), 2000)
                                    }}
                                    disabled={!contentLabSchema?.scriptTag}
                                    className="p-1.5 rounded-full hover:bg-white/[0.05] text-white/50 hover:text-white/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Copy schema script tag"
                                  >
                                    {schemaCopied ? (
                                      <Check className="size-3.5 text-emerald-400" />
                                    ) : (
                                      <CopyIcon className="size-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              {contentLabSchema?.scriptTag ? (
                                <div className="relative">
                                  <pre
                                    className={`text-[11px] leading-5 text-white/85 bg-black/25 border border-white/[0.06] rounded-full p-3 overflow-x-auto whitespace-pre-wrap break-all transition-all ${schemaExpanded ? 'max-h-none overflow-y-auto' : 'overflow-hidden'}`}
                                    style={schemaExpanded ? undefined : { maxHeight: 'calc(100vh - 710px)', minHeight: '100px' }}
                                  >
                                    {contentLabSchema.scriptTag}
                                  </pre>
                                  {!schemaExpanded && (
                                    <div className="absolute bottom-6 left-0 right-0 h-10 bg-gradient-to-t from-black/40 to-transparent rounded-b-md pointer-events-none" />
                                  )}
                                  <button
                                    onClick={() => setSchemaExpanded(!schemaExpanded)}
                                    className="flex items-center justify-center gap-1 w-full pt-1 text-[11px] text-white/30 hover:text-white/50 transition-colors"
                                  >
                                    <span>{schemaExpanded ? "Show less" : "Show more"}</span>
                                    <ChevronDown className={`size-3 transition-transform ${schemaExpanded ? "rotate-180" : ""}`} />
                                  </button>
                                </div>
                              ) : (
                                <p className="text-xs text-white/50">
                                  Schema has not been generated yet. Use regenerate to create JSON-LD for this post.
                                </p>
                              )}

                            </div>
                          </div>

                        </TabsContent>

                        <TabsContent value="backlinks" className="p-5 space-y-4 mt-0 overflow-y-auto">
                          <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-4">
                            {(() => {
                              // Extract links from body content
                              const linkRegex = /\[([^\]]+)\]\(([^\)]+)\)/g
                              const matches = [...(body || '').matchAll(linkRegex)]

                              if (matches.length === 0) {
                                return (
                                  <p className="text-xs text-white/50 text-center py-2">
                                    No backlinks found in the content yet.
                                    <br />
                                    <span className="text-white/40">Links added to your article will appear here.</span>
                                  </p>
                                )
                              }

                              return (
                                <div className="space-y-2">
                                  {matches.map((match, index) => (
                                    <div key={index} className="flex items-start gap-2 p-2 rounded-full bg-white/[0.03] border border-white/[0.06]">
                                      <LinkIcon className="size-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-white/90 truncate">{match[1]}</p>
                                        <a
                                          href={match[2]}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-blue-400 hover:text-blue-300 truncate block"
                                        >
                                          {match[2]}
                                        </a>
                                      </div>
                                    </div>
                                  ))}
                                  <p className="text-xs text-white/40 pt-1">
                                    {matches.length} backlink{matches.length !== 1 ? 's' : ''} found
                                  </p>
                                </div>
                              )
                            })()}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                  )}
                </div>
              </div>
              )}
          </div>
        </div>
      </SidebarInset>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-grey border border-white/10 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Campaign</h3>
            <p className="text-white/70 mb-4">
              Are you sure you want to delete this campaign? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => setShowDeleteConfirm(false)}
                variant="outline"
                size="sm"
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                variant="destructive"
                size="sm"
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleting ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="size-4 mr-2" />
                    Delete
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </SidebarProvider>
  )
}

export default function CampaignCanvasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ type?: string; mode?: string; prompt?: string; icp?: string; keyword?: string }>
}) {
  return (
    <BrandProfileProvider>
      <CampaignCanvasPageInner params={params} searchParams={searchParams} />
    </BrandProfileProvider>
  )
}
