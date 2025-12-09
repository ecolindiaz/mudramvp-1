"use client"

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { 
  IconSend, 
  IconUser, 
  IconRobot,
  IconLoader,
  IconSparkles,
  IconX,
  IconBrain,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconMicrophone,
  IconPlus,
  IconCopy,
  IconCheck,
  IconExternalLink,
  IconFileText,
} from "@tabler/icons-react"
import { SidebarOverviewIcon, SidebarTasksIcon, SidebarCampaignsIcon } from "@/components/icons"

interface Citation {
  title: string
  path: string
  chunk_index: number
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
}

interface TaskContext {
  id: number
  header: string
  type: string
  status: string
  description: string
  detailedSteps: {
    id: number
    title: string
    description: string
    completed: boolean
    estimatedTime: string
  }[]
  resources: {
    title: string
    url: string
    type: string
  }[]
  estimatedTime: string
  difficulty: string
}

interface AIChatInterfaceProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  siteId: string
  taskContext?: TaskContext[]
}

// Helper function to get page context
const getPageContext = (pathname: string | null) => {
  if (!pathname) return { icon: SidebarOverviewIcon, name: "Dashboard", color: "text-blue-400" }
  if (pathname === "/dashboard") return { icon: SidebarOverviewIcon, name: "Overview", color: "text-blue-400" }
  if (pathname === "/dashboard/campaigns") return { icon: SidebarCampaignsIcon, name: "Campaigns", color: "text-green-400" }
  if (pathname === "/dashboard/tasks") return { icon: SidebarTasksIcon, name: "Tasks", color: "text-orange-400" }
  if (pathname === "/dashboard/brand-profile") return { icon: IconUser, name: "Brand Profile", color: "text-purple-400" }
  if (pathname.startsWith("/dashboard/campaigns/")) return { icon: SidebarCampaignsIcon, name: "Campaign Canvas", color: "text-green-400" }
  return { icon: SidebarOverviewIcon, name: "Dashboard", color: "text-blue-400" }
}

export function AIChatInterface({ open, onOpenChange, siteId, taskContext }: AIChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isDeepThinking, setIsDeepThinking] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [micEnabled, setMicEnabled] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const pathname = usePathname()
  const pageContext = getPageContext(pathname || '/')

  const [quickPrompts] = useState([
    "What should I work on first?",
    "Explain my recent score changes", 
    "How can I improve my AI search visibility?",
    "Show me my open tasks",
    "Best practices for SEO optimization",
    "How to implement schema markup"
  ])

  // Allow other components to open chat with a prefilled message
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { initialMessage?: string } | undefined
      if (detail?.initialMessage) {
        setInput(detail.initialMessage)
      }
    }
    window.addEventListener('mudra:open-chat', handler)
    return () => window.removeEventListener('mudra:open-chat', handler)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }

  const handleSubmit = async (e: React.FormEvent | KeyboardEvent, deepThink = false) => {
    e.preventDefault()
    if (!input.trim() || isLoading || isDeepThinking) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    
    if (deepThink) {
      setIsDeepThinking(true)
    } else {
      setIsLoading(true)
    }

    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          siteId: siteId,
          deepThink: deepThink
        })
      })

      const data = await response.json()
      
      if (data.content) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.content,
          citations: []
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        throw new Error(data.error || 'Failed to get response')
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      setIsDeepThinking(false)
    }
  }

  const handleDeepThink = (e: React.MouseEvent) => {
    if (!input.trim() || isLoading || isDeepThinking) return
    handleSubmit(e as any, true)
  }

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  useEffect(() => {
    // auto-scroll on new messages
    scrollRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' })
  }, [messages, isLoading, isDeepThinking])

  const handleCopy = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1200)
    } catch (err) {
      console.error('Copy failed', err)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-transparent z-[999]"
        onClick={() => onOpenChange(false)}
      />
      <div
        className={`fixed ${expanded ? 'right-6 bottom-8 w-[720px] h-[80vh]' : 'right-6 bottom-20 w-[440px] h-[560px]'} bg-dark-grey backdrop-blur-xl border border-white/[0.08] rounded-lg shadow-2xl z-[1000] flex flex-col overflow-hidden transition-all duration-300 ease-out`}
      >
      {/* Header */}
      <div className="p-4 border-b border-white/[0.08] bg-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img 
              src="/images/MudraMainLogo.png"
              alt="Mudra" 
              className="w-5 h-5 opacity-90"
            />
            <div className="flex flex-col">
              <h3 className="text-sm font-semibold tracking-tight leading-none text-white">Mudra Chat</h3>
              <span className="text-[10px] text-white/60 mt-0.5">{pageContext.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpanded((v) => !v)}
              className="h-7 w-7 rounded-md text-white/70 hover:text-white bg-transparent hover:bg-white/5 border-0 transition-all"
              title={expanded ? 'Minimize' : 'Expand'}
            >
              {expanded ? <IconArrowsMinimize className="size-3.5" /> : <IconArrowsMaximize className="size-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMessages([])}
              className="h-7 w-7 rounded-md text-white/70 hover:text-white bg-transparent hover:bg-white/5 border-0 transition-all"
              title="New chat"
            >
              <IconPlus className="size-3.5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-7 w-7 rounded-md text-white/70 hover:text-white bg-transparent hover:bg-white/5 border-0 transition-all"
              title="Close"
            >
              <IconX className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              {/* Mudra Logo */}
              <div className="w-16 h-16 mx-auto mb-6 opacity-90">
                <img 
                  src="/images/MudraMainLogo.png"
                  alt="Mudra Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              
              <h3 className="text-lg font-semibold mb-1 text-white">Ask anything about your data</h3>
              <p className="text-white/60 mb-6 max-w-xs mx-auto text-sm">
                Get insights and answers from your platform data
              </p>
              
              {/* Quick Prompts */}
              <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
                {quickPrompts.slice(0, 6).map((prompt, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="h-8 px-3 text-xs rounded-md border-white/[0.08] bg-transparent hover:bg-white/[0.05] text-white/80 hover:text-white"
                    onClick={() => handleQuickPrompt(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                message.role === 'user' 
                  ? 'bg-white/10 border border-white/[0.08]' 
                  : 'bg-white/10 border border-white/[0.08]'
              }`}>
                {message.role === 'user' ? (
                  <IconUser className="size-3.5 text-white/80" />
                ) : (
                  <IconSparkles className="size-3.5 text-white/80" />
                )}
              </div>
              <div className={`group relative max-w-[75%] md:max-w-[70%] px-4 py-3 rounded-lg border ${
                message.role === 'user' 
                  ? 'bg-white/[0.03] border-white/[0.08] backdrop-blur-sm' 
                  : 'bg-white/[0.03] border-white/[0.08] backdrop-blur-sm'
              }`}>
                <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white/90">
                  {message.content}
                </div>
                
                {/* Citations */}
                {message.role === 'assistant' && message.citations && message.citations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/[0.08]">
                    <div className="flex items-center gap-1.5 mb-2">
                      <IconFileText className="size-3 text-white/60" />
                      <span className="text-xs text-white/60">Sources</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {message.citations.map((citation, index) => (
                        <button
                          key={index}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] text-white/80 hover:text-white transition-all"
                          title={`${citation.title} - ${citation.path}`}
                        >
                          <IconExternalLink className="size-2.5" />
                          <span className="truncate max-w-24">{citation.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Copy button on hover */}
                <button
                  type="button"
                  onClick={() => handleCopy(message.content, message.id)}
                  className="absolute -top-2 -right-2 hidden group-hover:flex items-center justify-center w-6 h-6 rounded-md border border-white/[0.08] bg-dark-grey hover:bg-white/10 backdrop-blur-sm transition-all"
                  title="Copy"
                >
                  {copiedId === message.id ? (
                    <IconCheck className="size-3 text-emerald-400" />
                  ) : (
                    <IconCopy className="size-3 text-white/70 hover:text-white" />
                  )}
                </button>
              </div>
            </div>
          ))}

          {(isLoading || isDeepThinking) && (
            <div className="flex gap-3">
              <div className="w-7 h-7 bg-white/10 border border-white/[0.08] rounded-md flex items-center justify-center flex-shrink-0">
                <IconLoader className="size-3.5 text-white/80 animate-spin" />
              </div>
              <div className="flex-1 p-3 rounded-lg border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <span className="inline-flex gap-1">
                    <span className="block w-1.5 h-1.5 rounded bg-white/60 animate-bounce [animation-delay:-200ms]"></span>
                    <span className="block w-1.5 h-1.5 rounded bg-white/60 animate-bounce [animation-delay:-100ms]"></span>
                    <span className="block w-1.5 h-1.5 rounded bg-white/60 animate-bounce"></span>
                  </span>
                  <span className="text-sm text-white/80">
                    {isDeepThinking ? 'Thinking deeply…' : 'Thinking…'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t border-white/[0.08] bg-transparent">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={handleInputChange}
            placeholder="Ask me anything..."
            disabled={isLoading || isDeepThinking}
            className="flex-1 min-h-[40px] max-h-28 h-10 resize-none rounded-lg border border-white/[0.08] bg-white/[0.02] focus-visible:border-white/[0.12] focus-visible:bg-white/[0.05] placeholder:text-white/40 transition-all text-white/90"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                if (input.trim()) handleSubmit(e as any)
                return
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (input.trim()) handleSubmit(e as any)
              }
            }}
            autoFocus
          />
          <Button 
            type="submit" 
            disabled={isLoading || isDeepThinking || !input.trim()}
            className="bg-white text-black hover:bg-white/90 h-10 px-4 rounded-lg border-0 shadow-sm hover:shadow transition-all"
          >
            <IconSend className="size-4" />
          </Button>
        </form>
      </div>
      </div>
    </>
  )
}