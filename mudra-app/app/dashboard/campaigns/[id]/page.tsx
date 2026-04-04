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
import { Save, CheckCircle2, Info, Copy as CopyIcon, Check, Link as LinkIcon, Loader2, Trash2, FileText, FileCode, Edit, ChevronDown, ArrowLeft } from "lucide-react"
import { BlogSetupDialog } from "@/components/content-lab/blog-setup-dialog"
import { computeContentLabSchemaSourceHash } from "@/lib/content-lab/schema-hash"
import { hasFootnoteCitations, convertFootnotesToInlineLinks, hasOrphanFootnoteRefs, cleanOrphanFootnoteRefs } from "@/lib/utils/convert-footnotes"
import { trackEvent } from "@/lib/analytics/posthog-events"
import { countWordsInMarkdown } from "@/lib/utils/count-words"

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
  const [optimizerSource, setOptimizerSource] = React.useState<{
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
  } | null>(null)

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
      trackEvent.featureUsed('schema_regenerated', { campaignId: id })
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
        trackEvent.featureUsed('campaign_saved', { campaignId: id, type, mode })
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
        trackEvent.featureUsed('campaign_deleted', { campaignId: id })
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
            const rawBody = campaign.body || "## Welcome to Campaign Canvas\n\nStart editing your content here."
            // Convert footnote citations to inline links (safety net for content generated before this fix)
            const campaignMetadata = campaign.metadata && typeof campaign.metadata === 'object'
              ? campaign.metadata as Record<string, unknown>
              : {}
            const metaSources = Array.isArray((campaignMetadata as any).sources)
              ? (campaignMetadata as any).sources as { title: string; url: string }[]
              : undefined
            {
              let processedBody = rawBody
              if (hasFootnoteCitations(processedBody)) {
                processedBody = convertFootnotesToInlineLinks(processedBody, metaSources)
              }
              if (hasOrphanFootnoteRefs(processedBody)) {
                processedBody = cleanOrphanFootnoteRefs(processedBody, metaSources)
              }
              setBody(processedBody)
            }
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
              // Load optimizer source if present
              const optSource = (metadata as any).optimizerSource
              if (optSource && typeof optSource === "object") {
                setOptimizerSource(optSource)
              }
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
            {
                let pb = data.body
                if (hasFootnoteCitations(pb)) pb = convertFootnotesToInlineLinks(pb)
                if (hasOrphanFootnoteRefs(pb)) pb = cleanOrphanFootnoteRefs(pb)
                setBody(pb)
              }
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
                {
                let pb = data.body
                if (hasFootnoteCitations(pb)) pb = convertFootnotesToInlineLinks(pb)
                if (hasOrphanFootnoteRefs(pb)) pb = cleanOrphanFootnoteRefs(pb)
                setBody(pb)
              }
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

  const handlePublish = async () => {
    if (!blogSetupStatus?.canPublish) {
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
        setPublishResult({ success: true, prUrl: data.prUrl, message: data.message })
      } else {
        setPublishResult({ success: false, error: data.error || 'Failed to publish' })
      }
    } catch (error) {
      console.error('Failed to publish:', error)
      setPublishResult({ success: false, error: 'Failed to publish campaign' })
    } finally {
      setPublishing(false)
    }
  }

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(`# ${title}\n\n${body}`)
      setCopied(true)
      setShowCopyMenu(false)
      setTimeout(() => setCopied(false), 1200)
    } catch (e) {}
  }

  const handleCopyPlainText = async () => {
    try {
      let plainText = body
        .replace(/#{1,6}\s+/g, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
        .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '')
        .replace(/^[\s]*[-*+]\s+/gm, '• ')
        .replace(/^[\s]*\d+\.\s+/gm, '')
        .replace(/^>\s+/gm, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/```[\s\S]*?```/g, '')
      await navigator.clipboard.writeText(`${title}\n\n${plainText}`)
      setCopied(true)
      setShowCopyMenu(false)
      setTimeout(() => setCopied(false), 1200)
    } catch (e) {}
  }

  return (
    <SidebarProvider className="bg-[#0e0e0e]" style={{ "--sidebar-width": "16rem" } as React.CSSProperties}>
      <AppSidebar />
      <SidebarInset className="bg-[#0e0e0e] m-0 shadow-none rounded-none border-none h-dvh !overflow-hidden flex flex-col">
        <SiteHeader />

        {/* Canvas toolbar */}
        <div className="h-11 px-4 lg:px-5 flex items-center gap-3 border-b border-white/[0.06] bg-[#0e0e0e] shrink-0">
          <Link
            href="/dashboard/campaigns"
            className="flex items-center gap-1.5 text-[13px] text-white/50 hover:text-white/80 transition-colors shrink-0"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </Link>
          <div className="h-4 w-px bg-white/[0.10]" />
          <span className="text-[13px] text-white/80 truncate">{title}</span>
          {saving && (
            <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium text-white/40">
              <Loader2 className="size-3 animate-spin" />
              Saving…
            </span>
          )}
          {publishResult?.success && publishResult.prUrl && (
            <a href={publishResult.prUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-emerald-400 underline shrink-0">
              PR Created
            </a>
          )}
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <div className="relative copy-menu-container">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-white/50 hover:text-white hover:bg-white/[0.06] text-xs font-medium gap-1.5"
                onClick={(e) => { e.stopPropagation(); setShowCopyMenu((v) => !v) }}
              >
                {copied ? <Check className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </Button>
              {showCopyMenu && (
                <div className="absolute top-full right-0 mt-1 bg-[#1a1a1a] border border-white/[0.12] rounded-lg shadow-xl z-50 py-1 min-w-[160px]">
                  <button className="w-full px-3 py-2 text-left text-xs text-white/90 hover:bg-white/[0.08] flex items-center gap-2" onClick={handleCopyMarkdown}>
                    <FileCode className="size-3.5 text-white/60" />
                    Copy as Markdown
                  </button>
                  <button className="w-full px-3 py-2 text-left text-xs text-white/90 hover:bg-white/[0.08] flex items-center gap-2" onClick={handleCopyPlainText}>
                    <FileText className="size-3.5 text-white/60" />
                    Copy as Plain Text
                  </button>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 px-2.5 text-xs font-medium gap-1.5 ${editMode ? "text-white bg-white/[0.08]" : "text-white/50 hover:text-white hover:bg-white/[0.06]"}`}
              onClick={() => setEditMode((v) => !v)}
            >
              <Edit className="size-3.5" /> Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-white/50 hover:text-white hover:bg-white/[0.06] text-xs font-medium gap-1.5"
              onClick={handlePublish}
              disabled={publishing || published}
            >
              {publishing ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
              {published ? "Published" : "Publish"}
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
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 text-xs font-medium gap-1.5"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="size-3.5" />
            </Button>
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
                <div className="h-7 w-20 rounded-md bg-white/[0.04]" />
              </div>
              <div className="space-y-3 pt-2">
                <div className="h-4 w-20 rounded bg-white/[0.05]" />
                <div className="space-y-2.5">
                  <div className="flex justify-between"><div className="h-3 w-10 rounded bg-white/[0.04]" /><div className="h-3 w-28 rounded bg-white/[0.04]" /></div>
                  <div className="flex justify-between"><div className="h-3 w-12 rounded bg-white/[0.04]" /><div className="h-3 w-24 rounded bg-white/[0.04]" /></div>
                  <div className="flex justify-between"><div className="h-3 w-10 rounded bg-white/[0.04]" /><div className="h-3 w-20 rounded bg-white/[0.04]" /></div>
                </div>
              </div>
              <div className="h-px bg-white/[0.04]" />
              <div className="space-y-3">
                <div className="h-4 w-16 rounded bg-white/[0.05]" />
                <div className="space-y-2.5">
                  <div className="flex justify-between"><div className="h-3 w-10 rounded bg-white/[0.04]" /><div className="h-5 w-16 rounded-full bg-white/[0.04]" /></div>
                  <div className="flex justify-between"><div className="h-3 w-10 rounded bg-white/[0.04]" /><div className="h-5 w-14 rounded-full bg-white/[0.04]" /></div>
                  <div className="flex justify-between"><div className="h-3 w-12 rounded bg-white/[0.04]" /><div className="h-5 w-16 rounded-full bg-white/[0.04]" /></div>
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
            {/* Editor */}
            <div className="flex-1 min-w-0 overflow-y-auto">
              <div className="max-w-[940px] mx-auto px-8 lg:px-12 pt-10 pb-16">
                {contentLoaded && (
                  <CampaignEditor
                    key={`editor-${id}-${contentLoaded ? 'loaded' : 'empty'}`}
                    value={body}
                    onChange={(value) => setBody(value)}
                    placeholder="Start typing your content here..."
                    readOnly={!editMode}
                    showToolbar={editMode}
                  />
                )}
              </div>
            </div>

            {/* Right sidebar */}
            <div className="hidden lg:flex w-[340px] shrink-0 border-l border-white/[0.06] flex-col overflow-y-auto bg-[#111111]">
              {/* Tab bar */}
              <div className="px-5 py-3 border-b border-white/[0.04] shrink-0">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveTab("copy")}
                    className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors ${
                      activeTab === "copy"
                        ? "bg-white/[0.08] text-white"
                        : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                    }`}
                  >
                    <Info className="w-3.5 h-3.5" />
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab("seo")}
                    className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors ${
                      activeTab === "seo"
                        ? "bg-white/[0.08] text-white"
                        : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    Technical
                  </button>
                  <button
                    onClick={() => setActiveTab("backlinks")}
                    className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors ${
                      activeTab === "backlinks"
                        ? "bg-white/[0.08] text-white"
                        : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                    }`}
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    Backlinks
                  </button>
                </div>
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto">
                {activeTab === "copy" && (
                  <div className="p-5 space-y-5">
                    {/* Outline */}
                    <div className="space-y-3">
                      <h3 className="text-[13px] font-semibold text-white/90 tracking-tight">Outline</h3>
                      <div className="space-y-3">
                        {mode === "geo" ? (
                          <>
                            <div className="flex items-start justify-between gap-3">
                              <span className="text-white/40 text-xs font-medium uppercase tracking-wider">ICP</span>
                              <span className="text-white/80 text-[13px] truncate text-right flex-1">{targetIcp || "Not set"}</span>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <span className="text-white/40 text-xs font-medium uppercase tracking-wider">Prompt</span>
                              <span className="text-white/80 text-[13px] truncate text-right flex-1">{campaignPrompt || "Not set"}</span>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <span className="text-white/40 text-xs font-medium uppercase tracking-wider">Slug</span>
                              <span className="text-white/80 text-[13px] truncate text-right flex-1">{slug || "Not set"}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-3">
                              <span className="text-white/40 text-xs font-medium uppercase tracking-wider">Keyword</span>
                              <span className="text-white/80 text-[13px] truncate text-right flex-1">{keyword || "Not set"}</span>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <span className="text-white/40 text-xs font-medium uppercase tracking-wider">Slug</span>
                              <span className="text-white/80 text-[13px] truncate text-right flex-1">{slug || "Not set"}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="h-px bg-white/[0.06]" />

                    {/* Details */}
                    <div className="space-y-3">
                      <h3 className="text-[13px] font-semibold text-white/90 tracking-tight">Details</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-white/40 text-xs font-medium uppercase tracking-wider">Type</span>
                          <Badge variant="outline" className="capitalize bg-white/[0.05] border-0 text-white/80 text-xs h-6 rounded-full">{type}</Badge>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-white/40 text-xs font-medium uppercase tracking-wider">Mode</span>
                          <Badge variant="outline" className="uppercase bg-white/[0.05] border-0 text-white/80 text-xs h-6 rounded-full">{mode}</Badge>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-white/40 text-xs font-medium uppercase tracking-wider">Status</span>
                          <Badge variant="outline" className={`text-xs h-6 rounded-full border-0 ${published ? "bg-emerald-500/10 text-emerald-400" : "bg-white/[0.05] text-white/80"}`}>
                            {published ? "Published" : "Draft"}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Optimizer source section (if present) */}
                    {optimizerSource && (
                      <>
                        <div className="h-px bg-white/[0.06]" />
                        <div className="space-y-3">
                          <h3 className="text-[13px] font-semibold text-white/90 tracking-tight">Optimization</h3>
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <span className="text-white/40 text-xs font-medium uppercase tracking-wider">Source</span>
                              <span className="text-white/80 text-[13px] truncate text-right flex-1 font-mono">
                                {optimizerSource.originalUrl ? (() => { try { return new URL(optimizerSource.originalUrl, "https://x").pathname } catch { return optimizerSource.originalUrl } })() : "—"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-white/40 text-xs font-medium uppercase tracking-wider">Depth</span>
                              <Badge variant="outline" className="capitalize bg-white/[0.05] border-0 text-white/80 text-xs h-6 rounded-full">
                                {optimizerSource.depthLevel === "light" ? "Light Touch" : optimizerSource.depthLevel === "deep" ? "Deep Overhaul" : "Smart Rewrite"}
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
                      </>
                    )}

                    <div className="h-px bg-white/[0.06]" />

                    {/* Word Count */}
                    <div className="space-y-2">
                      <h3 className="text-[13px] font-semibold text-white/90 tracking-tight">Word Count</h3>
                      <div className="text-3xl font-bold text-white tracking-tight tabular-nums">
                        {countWordsInMarkdown(body || '').toLocaleString()}
                      </div>
                      <p className="text-[11px] text-white/40">Total words in content</p>
                    </div>
                  </div>
                )}

                {activeTab === "seo" && (
                  <div className="p-5 space-y-5">
                    {/* Metadata */}
                    <div className="space-y-3">
                      <h3 className="text-[13px] font-semibold text-white/90 tracking-tight">Metadata</h3>
                      <div className="space-y-3">
                        <div className="rounded-lg bg-white/[0.03] p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider">Meta title</span>
                            <button onClick={() => { navigator.clipboard.writeText(title || ""); setTitleCopied(true); setTimeout(() => setTitleCopied(false), 2000) }} className="p-1 rounded hover:bg-white/[0.05] text-white/40 hover:text-white/70 transition-colors">
                              {titleCopied ? <Check className="size-3 text-emerald-400" /> : <CopyIcon className="size-3" />}
                            </button>
                          </div>
                          <p className="text-[13px] text-white/80 leading-relaxed break-words">{title || "Not set"}</p>
                        </div>
                        <div className="rounded-lg bg-white/[0.03] p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider">Meta description</span>
                            <button onClick={() => { navigator.clipboard.writeText(metaDescription || ""); setDescCopied(true); setTimeout(() => setDescCopied(false), 2000) }} className="p-1 rounded hover:bg-white/[0.05] text-white/40 hover:text-white/70 transition-colors">
                              {descCopied ? <Check className="size-3 text-emerald-400" /> : <CopyIcon className="size-3" />}
                            </button>
                          </div>
                          <p className="text-[13px] text-white/80 leading-relaxed break-words">{metaDescription || "Not set"}</p>
                        </div>
                        <div className="rounded-lg bg-white/[0.03] p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider">Slug</span>
                            <button onClick={() => { navigator.clipboard.writeText(slug || ""); setSlugCopied(true); setTimeout(() => setSlugCopied(false), 2000) }} className="p-1 rounded hover:bg-white/[0.05] text-white/40 hover:text-white/70 transition-colors">
                              {slugCopied ? <Check className="size-3 text-emerald-400" /> : <CopyIcon className="size-3" />}
                            </button>
                          </div>
                          <p className="text-[13px] text-white/80 leading-relaxed break-words font-mono">{slug || "Not set"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-white/[0.06]" />

                    {/* Structured Data */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[13px] font-semibold text-white/90 tracking-tight flex items-center gap-1.5">
                          <FileCode className="size-3.5" />
                          Structured Data
                        </h3>
                        <div className="flex items-center gap-1">
                          <button onClick={handleRegenerateSchema} disabled={schemaRegenerating} className="h-6 px-2 rounded text-white/40 hover:text-white/70 hover:bg-white/[0.04] text-[11px] font-medium transition-colors disabled:opacity-50">
                            {schemaRegenerating ? <Loader2 className="size-3 animate-spin" /> : "Regenerate"}
                          </button>
                          <button
                            onClick={() => { if (!contentLabSchema?.scriptTag) return; navigator.clipboard.writeText(contentLabSchema.scriptTag); setSchemaCopied(true); setTimeout(() => setSchemaCopied(false), 2000) }}
                            disabled={!contentLabSchema?.scriptTag}
                            className="p-1 rounded hover:bg-white/[0.05] text-white/40 hover:text-white/70 transition-colors disabled:opacity-40"
                          >
                            {schemaCopied ? <Check className="size-3 text-emerald-400" /> : <CopyIcon className="size-3" />}
                          </button>
                        </div>
                      </div>
                      {contentLabSchema?.scriptTag ? (
                        <div className="relative">
                          <pre
                            className={`text-[11px] leading-5 text-white/80 bg-black/20 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all transition-all ${schemaExpanded ? 'max-h-none' : 'max-h-[200px] overflow-hidden'}`}
                          >
                            {contentLabSchema.scriptTag}
                          </pre>
                          <button onClick={() => setSchemaExpanded(!schemaExpanded)} className="flex items-center justify-center gap-1 w-full pt-1.5 text-[11px] text-white/25 hover:text-white/50 transition-colors">
                            <span>{schemaExpanded ? "Show less" : "Show more"}</span>
                            <ChevronDown className={`size-3 transition-transform ${schemaExpanded ? "rotate-180" : ""}`} />
                          </button>
                        </div>
                      ) : (
                        <p className="text-[12px] text-white/35">No schema generated yet. Use regenerate to create JSON-LD.</p>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "backlinks" && (
                  <div className="p-5 space-y-4">
                    {(() => {
                      const linkRegex = /\[([^\]]+)\]\(([^\)]+)\)/g
                      const matches = [...(body || '').matchAll(linkRegex)]
                      if (matches.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="size-9 rounded-lg bg-white/[0.04] flex items-center justify-center mb-3">
                              <LinkIcon className="size-4 text-white/20" />
                            </div>
                            <p className="text-[13px] text-white/35">No backlinks found</p>
                            <p className="text-[11px] text-white/20 mt-1">Links in your content will appear here</p>
                          </div>
                        )
                      }
                      return (
                        <div className="space-y-2">
                          <p className="text-[11px] text-white/35">{matches.length} backlink{matches.length !== 1 ? 's' : ''}</p>
                          {matches.map((match, index) => (
                            <div key={index} className="flex items-start gap-2 p-2.5 rounded-lg bg-white/[0.03]">
                              <LinkIcon className="size-3 text-blue-400/70 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-medium text-white/80 truncate">{match[1]}</p>
                                <a href={match[2]} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-400/60 hover:text-blue-400 truncate block">
                                  {match[2]}
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </SidebarInset>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#141414] border border-white/[0.08] rounded-xl p-6 max-w-md w-full mx-4">
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
