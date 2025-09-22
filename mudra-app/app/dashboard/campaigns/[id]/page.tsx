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
import { Eye, Save, CheckCircle2, ListTree, Info, Clock, Copy as CopyIcon, Maximize2, Minimize2, Users, MessageSquareText, Link as LinkIcon, Search } from "lucide-react"

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

  const initialTitle = React.useMemo(() => {
    return "Product Launch Blog"
  }, [])

  const initialBody = React.useMemo(() => (
    `## Introduction\n\nWrite a friendly, confident introduction that sets context for the reader and clarifies the value of this post.\n\n## Key Benefits\n\n- Clear value proposition\n- Actionable steps for visibility\n- Real examples and citations\n\n## Steps\n\n1. Identify the right prompts and ICP\n2. Generate content aligned to search intent\n3. Add citations and publish\n\n## Conclusion\n\nWrap up with a concise CTA and links to resources.`
  ), [])

  const [title, setTitle] = React.useState(initialTitle)
  const [body, setBody] = React.useState(initialBody)

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

  // Initialize from URL params (mock data passed from create flow)
  React.useEffect(() => {
    if (prompt) setCampaignPrompt(prompt)
    if (icp) setTargetIcp(icp)
    if (kwParam) setKeyword(kwParam)
  }, [prompt, icp, kwParam])

  return (
    <SidebarProvider
      className="bg-dark-grey"
      style={{
        "--sidebar-width": "calc(var(--spacing) * 52)",
        "--header-height": "calc(var(--spacing) * 12)",
      } as React.CSSProperties}
    >
      <AppSidebar />
      <SidebarInset className="bg-dark-grey m-0 shadow-none rounded-none border-none">
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
                            <CardDescription className="text-white/70">Edit the generated content</CardDescription>
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
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 rounded-lg bg-transparent border-white/10 focus-visible:border-white/20 placeholder:text-white/50" placeholder="Post title" />
                      {preview ? (
                          <div className={`rounded-lg border border-white/10 bg-transparent p-4 prose prose-invert max-w-none ${editorExpanded ? "min-h-[80vh]" : ""}`}>
                          <h1 className="mb-2 text-xl font-bold">{title}</h1>
                          <div className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">{body}</div>
                        </div>
                      ) : (
                          <Textarea value={body} onChange={(e) => setBody(e.target.value)} className={`${editorExpanded ? "min-h-[80vh]" : "min-h-[420px]"} rounded-lg bg-transparent border border-white/10 focus-visible:border-white/20`} />
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
            </div>
          </div>
        </div>
      </SidebarInset>
      {/* Inline expand mode handled in-card; dialog removed */}
      <FloatingMudraButton siteId={typeof window !== 'undefined' ? (localStorage.getItem('mudra:siteId') || '') : ''} />
    </SidebarProvider>
  )
}


