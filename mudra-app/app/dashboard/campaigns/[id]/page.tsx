"use client"
import React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AppSidebar } from "@/components/app-sidebar"
import { FloatingMudraButton } from "@/components/floating-mudra-button"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Eye, Save, CheckCircle2, ListTree, Info, Clock, Copy as CopyIcon, Maximize2, Minimize2, Users, MessageSquareText, Link as LinkIcon, Search, Loader2 } from "lucide-react"

export default function CampaignCanvasPage({
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
  const [editorExpanded, setEditorExpanded] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)

  const [title, setTitle] = React.useState("")
  const [body, setBody] = React.useState("")

  const wordCount = React.useMemo(() => body.trim().split(/\s+/).filter(Boolean).length, [body])
  const readMinutes = Math.max(1, Math.round(wordCount / 200))

  const headings = React.useMemo(() => {
    return body.split("\n").filter((l) => l.startsWith("## ")).map((h) => h.replace(/^##\s+/, ""))
  }, [body])
  const outlineItems = headings.length > 0 ? headings : []

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      setSavedAt(Date.now())
    }, 700)
  }

  // Initialize from URL params and load generated content
  React.useEffect(() => {
    if (prompt) setCampaignPrompt(prompt)
    if (icp) setTargetIcp(icp)
    if (kwParam) setKeyword(kwParam)
    
    // Load generated content from localStorage with retry logic
    const storageKey = `mudra_campaign_${id}`
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
        setIsLoading(false)
      }
    }
    
    checkForContent()
  }, [id, prompt, icp, kwParam])

  return (
    <SidebarProvider
      className="bg-dark-grey"
      style={{
        "--sidebar-width": "0rem",
        "--header-height": "calc(var(--spacing) * 12)",
      } as React.CSSProperties}
    >
      <div style={{ display: 'none' }}>
        <AppSidebar />
      </div>
      <SidebarInset className="bg-dark-grey m-0 shadow-none rounded-none border-none !ml-0">
        <SiteHeader />
        <Separator className="w-full border-border" />
        <div className="flex flex-1 flex-col bg-dark-grey">
          <div className="@container/main flex flex-1 flex-col gap-4">
            <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">Campaign Canvas</h1>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => setPublished(true)} variant="outline" size="sm" className={`h-9 rounded-lg gap-2 ${published ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : ""}`}>
                    <CheckCircle2 className="size-4" />{published ? 'Published' : 'Mark as published'}
                  </Button>
                  
                  <Button onClick={handleSave} disabled={saving} variant="outline" size="sm" className="h-9 rounded-lg gap-2"><Save className="size-4" />{saving ? 'Saving…' : 'Save'}</Button>
                  <Button asChild size="sm" className="h-9 rounded-lg">
                    <Link href="/dashboard/campaigns">Back to Campaigns</Link>
                  </Button>
                </div>
              </div>
            </div>

            <div className="px-4 lg:px-6 pb-6 md:pb-8">
              {isLoading ? (
                /* Loading State */
                <div className="flex flex-col items-center justify-center min-h-[60vh]">
                  <Card className="w-full max-w-md bg-transparent backdrop-blur-sm border-white/10">
                    <CardContent className="pt-6 pb-6">
                      <div className="flex flex-col items-center gap-4 text-center">
                        <div className="relative">
                          <Loader2 className="size-16 text-primary animate-spin" />
                          <div className="absolute inset-0 blur-xl bg-primary/20 animate-pulse" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-xl font-semibold text-white">Loading Campaign Canvas</h3>
                          <p className="text-sm text-muted-foreground">
                            Preparing your AI-generated content...
                          </p>
                        </div>
                        <div className="w-full max-w-xs">
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-primary to-white/90 rounded-full animate-[shimmer_2s_ease-in-out_infinite]" 
                                 style={{ width: '70%' }} />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:gap-6">
                {/* Top Row: three cards like Tasks header */}
                <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-3">
                  {/* Outline / GEO inputs */}
                    <Card className="relative overflow-hidden min-h-[100px] py-3 bg-transparent backdrop-blur-sm rounded-lg border border-white/10">
                    <div className="pointer-events-none absolute left-3 right-3 top-0 h-[2px] rounded-full opacity-60" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.25), transparent)" }} />
                      <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center size-6 rounded bg-white/5 border border-white/10">
                          <ListTree className="size-3.5 text-white/80" />
                        </span>
                        <CardDescription className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Outline</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pt-1">
                      {mode === "geo" ? (
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded border border-white/12 bg-transparent px-2.5 py-1 text-xs text-white/85" title={targetIcp || "Not set"}>
                            <Users className="size-3.5" />
                            ICP: {targetIcp ? (targetIcp.length > 36 ? `${targetIcp.slice(0, 36)}…` : targetIcp) : "Not set"}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded border border-white/12 bg-transparent px-2.5 py-1 text-xs text-white/85" title={campaignPrompt || "Not set"}>
                            <MessageSquareText className="size-3.5" />
                            {`Prompt: ${campaignPrompt ? (campaignPrompt.length > 48 ? campaignPrompt.slice(0, 48) + "…" : campaignPrompt) : "Not set"}`}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded border border-white/12 bg-transparent px-2.5 py-1 text-xs text-white/85" title={slug || "Not set"}>
                            <LinkIcon className="size-3.5" />
                            {`Slug: ${slug ? (slug.length > 32 ? slug.slice(0, 32) + "…" : slug) : "Not set"}`}
                          </span>
                        </div>
                      ) : mode === "seo" ? (
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded border border-white/12 bg-transparent px-2.5 py-1 text-xs text-white/85" title={keyword || "Not set"}>
                            <Search className="size-3.5" />
                            {`Keyword: ${keyword ? (keyword.length > 36 ? keyword.slice(0, 36) + "…" : keyword) : "Not set"}`}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded border border-white/12 bg-transparent px-2.5 py-1 text-xs text-white/85" title={slug || "Not set"}>
                            <LinkIcon className="size-3.5" />
                            {`Slug: ${slug ? (slug.length > 32 ? slug.slice(0, 32) + "…" : slug) : "Not set"}`}
                          </span>
                        </div>
                      ) : (
                        <div className="text-sm text-white/70">No outline data yet.</div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Details */}
                    <Card className="relative overflow-hidden min-h-[100px] py-3 bg-transparent backdrop-blur-sm rounded-lg border border-white/10">
                    <div className="pointer-events-none absolute left-3 right-3 top-0 h-[2px] rounded-full opacity-60" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.25), transparent)" }} />
                      <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center size-6 rounded bg-white/5 border border-white/10">
                          <Info className="size-3.5 text-white/80" />
                        </span>
                        <CardDescription className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Details</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pt-1 text-sm text-white/80 space-y-2">
                      <div className="flex items-center justify-between"><span>Type</span><Badge variant="outline" className="capitalize">{type}</Badge></div>
                      <div className="flex items-center justify-between"><span>Mode</span><Badge variant="outline" className="uppercase">{mode}</Badge></div>
                    </CardContent>
                  </Card>

                  {/* Status */}
                    <Card className="relative overflow-hidden min-h-[100px] py-3 bg-transparent backdrop-blur-sm rounded-lg border border-white/10">
                    <div className="pointer-events-none absolute left-3 right-3 top-0 h-[2px] rounded-full opacity-60" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.25), transparent)" }} />
                      <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center size-6 rounded bg-white/5 border border-white/10">
                          <Clock className="size-3.5 text-white/80" />
                        </span>
                        <CardDescription className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pt-1 text-sm text-white/80 space-y-2">
                      <div className="flex items-center justify-between"><span>Publication</span><Badge variant="outline" className={published ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : ""}>{published ? "Published" : "Draft"}</Badge></div>
                      <div className="flex items-center justify-between"><span>Last Saved</span><span className="text-white/60">{savedAt ? new Date(savedAt).toLocaleTimeString() : "—"}</span></div>
                    </CardContent>
                  </Card>
                </div>

                {/* Editor (below) */}
                <div className="space-y-3">
                    <Card className="bg-transparent backdrop-blur-sm rounded-lg border border-white/10">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg text-white">Editor</CardTitle>
                            <CardDescription className="text-white/70">
                              {isLoading ? "Loading..." : "Edit your campaign content"}
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg gap-1.5"
                            onClick={() => setPreview((v) => !v)}
                          >
                            <Eye className="size-3.5" /> {preview ? "Hide Preview" : "Preview"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(`${title}\n\n${body}`)
                                setCopied(true)
                                setTimeout(() => setCopied(false), 1200)
                              } catch (e) {
                                // ignore copy errors
                              }
                            }}
                          >
                            <CopyIcon className="size-3.5 mr-1" /> {copied ? "Copied" : "Copy"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg"
                            onClick={() => setEditorExpanded((v) => !v)}
                          >
                            {editorExpanded ? (<><Minimize2 className="size-3.5 mr-1" /> Collapse</>) : (<><Maximize2 className="size-3.5 mr-1" /> Expand</>)}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className={`space-y-3 ${editorExpanded ? "pb-28" : ""}`}>
                        <Input 
                          value={title} 
                          onChange={(e) => setTitle(e.target.value)} 
                          disabled={isLoading}
                          className="h-11 rounded-lg bg-transparent border-white/10 focus-visible:border-white/20 placeholder:text-white/50 disabled:opacity-50" 
                          placeholder="Post title" 
                        />
                      {preview ? (
                          <div className={`rounded-lg border border-white/10 bg-transparent p-4 prose prose-invert max-w-none ${editorExpanded ? "min-h-[80vh]" : ""}`}>
                          <h1 className="mb-2 text-xl font-bold">{title}</h1>
                          <div className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">{body}</div>
                        </div>
                      ) : (
                          <Textarea 
                            value={body} 
                            onChange={(e) => setBody(e.target.value)} 
                            disabled={isLoading}
                            className={`${editorExpanded ? "min-h-[80vh]" : "min-h-[420px]"} rounded-lg bg-transparent border border-white/10 focus-visible:border-white/20 disabled:opacity-50`} 
                          />
                      )}
                    </CardContent>
                  </Card>

                  <div className="flex items-center justify-between text-xs text-white/60 px-1">
                    <div className="flex items-center gap-2">
                      {savedAt && <span>Saved {new Date(savedAt).toLocaleTimeString()}</span>}
                    </div>
                  </div>
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
      {/* Inline expand mode handled in-card; dialog removed */}
      <FloatingMudraButton siteId={typeof window !== 'undefined' ? (localStorage.getItem('mudra:siteId') || '') : ''} />
    </SidebarProvider>
  )
}


