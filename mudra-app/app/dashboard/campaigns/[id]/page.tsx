"use client"
import React from "react"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import { CampaignEditor } from "@/components/editor/campaign-editor"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Eye, Save, CheckCircle2, ListTree, Info, Clock, Copy as CopyIcon, Maximize2, Minimize2, Users, MessageSquareText, Link as LinkIcon, Search, Loader2, Trash2, FileText, Image as ImageIcon, Code2, FileCode, Edit, Send, X, Plus } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

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
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState("copy")
  const [metaDescription, setMetaDescription] = React.useState("")
  const [editMode, setEditMode] = React.useState(false)
  const [chatMessages, setChatMessages] = React.useState<Array<{ id: string; role: 'user' | 'assistant'; content: string }>>([])
  const [chatInput, setChatInput] = React.useState("")
  const [isChatLoading, setIsChatLoading] = React.useState(false)
  const chatScrollRef = React.useRef<HTMLDivElement>(null)

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

  const headings = React.useMemo(() => {
    return body.split("\n").filter((l) => l.startsWith("## ")).map((h) => h.replace(/^##\s+/, ""))
  }, [body])
  const outlineItems = headings.length > 0 ? headings : []

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

  // Auto-scroll chat to bottom
  React.useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chatMessages, isChatLoading])

  // Handle chat submission
  const handleChatSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!chatInput.trim() || isChatLoading) return

    const userMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: chatInput.trim()
    }

    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setIsChatLoading(true)

    try {
      const siteId = typeof window !== 'undefined' ? (localStorage.getItem('mudra:siteId') || '') : ''
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages, userMessage].map(m => ({ role: m.role, content: m.content })),
          siteId: siteId,
          deepThink: false,
          context: {
            campaignId: id,
            currentTitle: title,
            currentBody: body,
            task: 'edit_content'
          }
        })
      })

      const data = await response.json()
      
      if (data.content) {
        const assistantMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant' as const,
          content: data.content
        }
        setChatMessages(prev => [...prev, assistantMessage])
        
        // If the response contains updated content, apply it
        if (data.updatedTitle) setTitle(data.updatedTitle)
        if (data.updatedBody) setBody(data.updatedBody)
      } else {
        throw new Error(data.error || 'Failed to get response')
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: 'Sorry, I encountered an error. Please try again.'
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setIsChatLoading(false)
    }
  }

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
                  <Button 
                    onClick={async () => {
                      setPublished(true)
                      // Update campaign status to published
                      try {
                        await fetch(`/api/campaigns/${id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "published" })
                        })
                        console.log("✅ Campaign published")
                      } catch (error) {
                        console.error("Failed to publish campaign:", error)
                      }
                    }} 
                    variant="outline" 
                    size="sm" 
                    className={`h-9 px-4 rounded-md gap-2 text-xs font-medium transition-all duration-200 ${published ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-white hover:bg-white/10 border-white/[0.08]"}`}
                  >
                    <CheckCircle2 className="size-3.5" />{published ? 'Published' : 'Publish'}
                  </Button>
                  
                  <Button onClick={handleSave} disabled={saving} variant="outline" size="sm" className="h-9 px-4 rounded-md bg-white/5 text-white hover:bg-white/10 border-white/[0.08] text-xs font-medium gap-2 disabled:opacity-50">
                    <Save className="size-3.5" />{saving ? 'Saving…' : 'Save'}
                  </Button>
                  
                  <Button 
                    onClick={() => setShowDeleteConfirm(true)} 
                    variant="outline" 
                    size="sm" 
                    className="h-9 px-4 rounded-md bg-white/5 text-red-400 hover:bg-red-500/10 border-red-500/20 text-xs font-medium gap-2"
                  >
                    <Trash2 className="size-3.5" />Delete
                  </Button>
                  
                  <Button asChild size="sm" className="h-9 px-4 rounded-md bg-white/5 text-white hover:bg-white/10 border-white/[0.08] text-xs font-medium">
                    <Link href="/dashboard/campaigns">Back</Link>
                  </Button>
                </div>
              </div>
            </div>

          {/* Header Divider */}
          <div className="h-[1px] bg-white/10"></div>

          <div className="px-4 lg:px-6 pb-4 md:pb-6 pt-4">
              {isLoading ? (
                /* Loading State */
                <div className="flex flex-col items-center justify-center min-h-[60vh]">
                  <Card className="w-full max-w-md rounded-xl border border-white/[0.08] bg-[#1a1a1a] shadow-sm">
                    <CardContent className="pt-6 pb-6 px-6">
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
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 items-start h-full">
                {/* Editor (left side) */}
                <div className="lg:col-span-2 space-y-2 order-1 lg:order-1 flex flex-col">
                    <Card className="rounded-xl border border-white/[0.08] bg-[#1a1a1a] overflow-hidden shadow-sm flex flex-col">
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
                            className={`h-8 px-3 rounded-md text-xs font-medium gap-1.5 ${editMode ? "bg-white text-[#0a0a0a] hover:bg-white/90 border-white" : "bg-white/5 text-white hover:bg-white/10 border-white/[0.08]"}`}
                            onClick={() => setEditMode((v) => !v)}
                          >
                            <Edit className="size-3.5" /> Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 rounded-md bg-white/5 text-white hover:bg-white/10 border-white/[0.08] text-xs font-medium gap-1.5"
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
                            <CopyIcon className="size-3.5" /> {copied ? "Copied" : "Copy"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 rounded-md bg-white/5 text-white hover:bg-white/10 border-white/[0.08] text-xs font-medium gap-1.5"
                            onClick={() => setEditorExpanded((v) => !v)}
                          >
                            {editorExpanded ? (<><Minimize2 className="size-3.5" /> Collapse</>) : (<><Maximize2 className="size-3.5" /> Expand</>)}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className={`px-5 pb-4 space-y-3 ${editorExpanded ? "pb-28" : ""}`}>
                        <Input 
                          value={title} 
                          onChange={(e) => setTitle(e.target.value)} 
                          disabled={isLoading}
                          className="h-9 rounded-lg bg-white/[0.03] border-white/[0.08] text-white/90 placeholder:text-white/50 focus-visible:border-white/[0.12] focus-visible:bg-white/[0.05] disabled:opacity-50 text-sm" 
                          placeholder="Post title" 
                        />
                      <div className={`${editorExpanded ? "h-[80vh]" : "h-[70vh]"}`}>
                        {!isLoading && contentLoaded && (
                          <CampaignEditor
                            key={`editor-${id}-${contentLoaded ? 'loaded' : 'empty'}`} // Force re-render when content is loaded
                            value={body}
                            onChange={(value) => setBody(value)}
                            placeholder="Start typing your content here..."
                            readOnly={false}
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

                {/* Right Side: Chat (Edit Mode) or Tabs (Normal Mode) */}
                <div className="order-2 lg:order-2 flex flex-col h-full self-start">
                  {editMode ? (
                    /* Chat Sidebar */
                    <Card className="rounded-xl border border-white/[0.08] bg-[#1a1a1a] overflow-hidden shadow-sm flex flex-col w-full flex-1 min-h-0">
                      {/* Chat Header */}
                      <div className="px-5 pt-4 pb-3 border-b border-white/[0.08] flex-shrink-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <img 
                              src="/images/mudra-logo.png" 
                              alt="Mudra" 
                              className="w-5 h-5 opacity-90"
                            />
                            <div className="flex flex-col">
                              <h3 className="text-sm font-semibold tracking-tight leading-none text-white">Edit Content</h3>
                              <span className="text-[10px] text-white/60 mt-0.5">Tell AI what you want changed</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setChatMessages([])}
                              className="h-7 w-7 rounded-md text-white/70 hover:text-white bg-transparent hover:bg-white/5 border-0 transition-all"
                              title="New chat"
                            >
                              <Plus className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditMode(false)}
                              className="h-7 w-7 rounded-md text-white/70 hover:text-white bg-transparent hover:bg-white/5 border-0 transition-all"
                              title="Close"
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Messages Area */}
                      <div 
                        ref={chatScrollRef}
                        className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
                      >
                        {chatMessages.length === 0 ? (
                          <div className="text-center py-8">
                            <div className="w-16 h-16 mx-auto mb-5 opacity-90">
                              <img 
                                src="/images/mudra-logo.png" 
                                alt="Mudra Logo" 
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <h3 className="text-base font-semibold mb-2 text-white">Edit your content with AI</h3>
                            <p className="text-white/60 mb-5 text-sm max-w-xs mx-auto">
                              Ask AI to rewrite, improve, or modify your campaign content
                            </p>
                            <div className="flex flex-wrap gap-2 justify-center max-w-sm mx-auto">
                              {[
                                "Make the introduction more engaging",
                                "Add a conclusion section",
                                "Improve the tone to be more professional",
                                "Shorten the content by 20%"
                              ].map((prompt, index) => (
                                <Button
                                  key={index}
                                  variant="outline"
                                  className="h-8 px-4 text-sm rounded-md border-white/[0.08] bg-transparent hover:bg-white/[0.05] text-white/80 hover:text-white"
                                  onClick={() => setChatInput(prompt)}
                                >
                                  {prompt}
                                </Button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          chatMessages.map((message) => (
                            <div
                              key={message.id}
                              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                              {message.role === 'assistant' && (
                                <div className="flex-shrink-0 w-6 h-6 rounded-md bg-white/5 border border-white/[0.08] flex items-center justify-center">
                                  <img 
                                    src="/images/mudra-logo.png" 
                                    alt="Mudra" 
                                    className="w-4 h-4 opacity-90"
                                  />
                                </div>
                              )}
                              <div
                                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                                  message.role === 'user'
                                    ? 'bg-white text-[#0a0a0a]'
                                    : 'bg-white/[0.05] text-white/90 border border-white/[0.08]'
                                }`}
                              >
                                <div className="whitespace-pre-wrap break-words">
                                  {message.content}
                                </div>
                              </div>
                              {message.role === 'user' && (
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 border border-white/[0.08] flex items-center justify-center">
                                  <Users className="size-3.5 text-white/70" />
                                </div>
                              )}
                            </div>
                          ))
                        )}
                        {isChatLoading && (
                          <div className="flex gap-3 justify-start">
                            <div className="flex-shrink-0 w-6 h-6 rounded-md bg-white/5 border border-white/[0.08] flex items-center justify-center">
                              <img 
                                src="/images/mudra-logo.png" 
                                alt="Mudra" 
                                className="w-4 h-4 opacity-90"
                              />
                            </div>
                            <div className="bg-white/[0.05] text-white/90 border border-white/[0.08] rounded-lg px-3 py-2">
                              <Loader2 className="size-4 animate-spin text-white/60" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Input Area */}
                      <div className="px-4 pb-4 pt-3 border-t border-white/[0.08] flex-shrink-0">
                        <form onSubmit={handleChatSubmit} className="flex gap-2 items-center">
                          <Textarea
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleChatSubmit()
                              }
                            }}
                            placeholder="Ask a question..."
                            disabled={isChatLoading}
                            className="flex-1 min-h-[40px] max-h-[120px] rounded-lg bg-white/[0.03] border-white/[0.08] text-white/90 placeholder:text-white/50 focus-visible:border-white/[0.12] focus-visible:bg-white/[0.05] disabled:opacity-50 text-sm resize-none"
                            rows={1}
                          />
                          <Button
                            type="submit"
                            disabled={!chatInput.trim() || isChatLoading}
                            className="h-[40px] w-[40px] rounded-lg bg-white text-[#0a0a0a] hover:bg-white/90 border-0 disabled:opacity-50 disabled:cursor-not-allowed p-0 flex-shrink-0"
                          >
                            {isChatLoading ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Send className="size-4" />
                            )}
                          </Button>
                        </form>
                      </div>
                    </Card>
                  ) : (
                    /* Normal Tabs */
                    <Card className="rounded-xl border border-white/[0.08] bg-[#1a1a1a] overflow-hidden shadow-sm flex flex-col w-full flex-1 min-h-0">
                      <CardContent className="p-0 flex flex-col flex-1 min-h-0">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-1 min-h-0">
                        <div className="px-5 pt-2 pb-3 border-b border-white/[0.08] flex-shrink-0">
                          <TabsList className="bg-white/[0.03] border border-white/[0.08] rounded-lg p-1 h-9 gap-1">
                            <TabsTrigger 
                              value="copy" 
                              className="px-4 text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-[#0a0a0a] data-[state=active]:shadow-sm border-0 data-[state=inactive]:text-white/70"
                            >
                              Copy
                            </TabsTrigger>
                            <TabsTrigger 
                              value="seo" 
                              className="px-4 text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-[#0a0a0a] data-[state=active]:shadow-sm border-0 data-[state=inactive]:text-white/70"
                            >
                              SEO Settings
                            </TabsTrigger>
                          </TabsList>
                        </div>

                        <TabsContent value="copy" className="p-5 space-y-4 mt-0 flex-1 overflow-y-auto">
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
                                <Badge variant="outline" className="capitalize bg-white/5 border-white/[0.08] text-white/90 text-xs">{type}</Badge>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-white/60 text-xs font-medium uppercase tracking-wide">Mode</span>
                                <Badge variant="outline" className="uppercase bg-white/5 border-white/[0.08] text-white/90 text-xs">{mode}</Badge>
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
                                <Badge variant="outline" className={published ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : "bg-white/5 border-white/[0.08] text-white/90"} style={{ fontSize: '11px' }}>
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
                          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 space-y-2">
                            <h3 className="text-sm font-semibold text-white">Word Count</h3>
                            <div className="space-y-1">
                              <div className="text-4xl font-bold text-white tracking-tight">
                                {countWordsInMarkdown(body || '').toLocaleString()}
                              </div>
                              <p className="text-xs text-white/60">Total words in content</p>
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="seo" className="p-5 space-y-4 mt-0 flex-1 overflow-y-auto">
                          {/* Metadata Section */}
                          <div className="space-y-3 pb-4 border-b border-white/[0.06]">
                            <h3 className="text-sm font-semibold text-white">Metadata</h3>
                            <div className="space-y-4">
                              {/* Meta Title */}
                              <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-white/70 uppercase tracking-wide">Meta title</span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(title || "")
                                    }}
                                    className="p-1.5 rounded-md hover:bg-white/[0.05] text-white/50 hover:text-white/80 transition-colors"
                                    title="Copy meta title"
                                  >
                                    <CopyIcon className="size-3.5" />
                                  </button>
                                </div>
                                <p className="text-sm text-white/90 leading-relaxed break-words">{title || "Not set"}</p>
                              </div>

                              {/* Meta Description */}
                              <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-white/70 uppercase tracking-wide">Meta description</span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(metaDescription || "")
                                    }}
                                    className="p-1.5 rounded-md hover:bg-white/[0.05] text-white/50 hover:text-white/80 transition-colors"
                                    title="Copy meta description"
                                  >
                                    <CopyIcon className="size-3.5" />
                                  </button>
                                </div>
                                <p className="text-sm text-white/90 leading-relaxed break-words">{metaDescription || "Not set"}</p>
                              </div>

                              {/* Slug */}
                              <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-white/70 uppercase tracking-wide">Slug</span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(slug || "")
                                    }}
                                    className="p-1.5 rounded-md hover:bg-white/[0.05] text-white/50 hover:text-white/80 transition-colors"
                                    title="Copy slug"
                                  >
                                    <CopyIcon className="size-3.5" />
                                  </button>
                                </div>
                                <p className="text-sm text-white/90 leading-relaxed break-words font-mono">{slug || "Not set"}</p>
                              </div>
                            </div>
                          </div>

                          {/* Schema Markup */}
                          <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                              <Code2 className="size-4 text-white/80" />
                              <h3 className="text-sm font-semibold text-white">Schema Markup</h3>
                            </div>
                            <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
                              <pre className="text-xs text-white/70 font-mono overflow-x-auto whitespace-pre-wrap break-words">
{`{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "${title || "Your article title"}",
  "author": {
    "@type": "Person",
    "name": "Editorial Team"
  }
}`}
                              </pre>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-8 rounded-md bg-white/5 text-white hover:bg-white/10 border-white/[0.08] text-xs font-medium border-0"
                              onClick={() => {
                                const schema = JSON.stringify({
                                  "@context": "https://schema.org",
                                  "@type": "BlogPosting",
                                  "headline": title || "Your article title",
                                  "author": {
                                    "@type": "Person",
                                    "name": "Editorial Team"
                                  }
                                }, null, 2)
                                navigator.clipboard.writeText(schema)
                              }}
                            >
                              <CopyIcon className="size-3.5 mr-1.5" />
                              Copy
                            </Button>
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


