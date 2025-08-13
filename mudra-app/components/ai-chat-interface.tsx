"use client"

import { useEffect, useRef, useState } from 'react'
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
} from "@tabler/icons-react"

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
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
  taskContext?: TaskContext[]
}

export function AIChatInterface({ open, onOpenChange, taskContext }: AIChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isDeepThinking, setIsDeepThinking] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [micEnabled, setMicEnabled] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [quickPrompts] = useState([
    "Tell me how to do this step by step",
    "What should I work on first?", 
    "Show me the detailed steps for my tasks",
    "How long will these tasks take?"
  ])

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
          taskContext: taskContext || [],
          deepThink: deepThink
        })
      })

      const data = await response.json()
      
      if (data.content) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.content
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
        className={`fixed ${expanded ? 'right-6 bottom-8 w-[720px] h-[80vh]' : 'right-6 bottom-20 w-[440px] h-[560px]'} bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl shadow-none ring-1 ring-white/5 z-[1000] flex flex-col overflow-hidden transition-all duration-200`}
      >
      {/* Header */}
      <div className="p-3.5 md:p-4 border-b border-white/10 bg-black/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-primary to-primary/80 rounded-full flex items-center justify-center shadow-inner ring-1 ring-white/20">
              <IconSparkles className="size-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Mudra AI</h3>
              <p className="text-xs text-muted-foreground">Ask anything about your GEO data</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-full text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10"
              title={expanded ? 'Minimize' : 'Expand'}
            >
              {expanded ? <IconArrowsMinimize className="size-4" /> : <IconArrowsMaximize className="size-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMicEnabled((v) => !v)}
              className={`rounded-full text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 ${micEnabled ? 'text-primary' : ''}`}
              title="Voice input (placeholder)"
            >
              <IconMicrophone className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMessages([])}
              className="rounded-full text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10"
              title="New chat"
            >
              <IconPlus className="size-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => onOpenChange(false)}
              className="rounded-full text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10"
              title="Close"
            >
              <IconX className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4 md:p-5" ref={scrollRef as any}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              {/* Mudra Logo */}
              <div className="w-16 h-16 mx-auto mb-6 opacity-90">
                <img 
                  src="/images/mudra-logo.png" 
                  alt="Mudra Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              
              <h3 className="text-lg font-semibold mb-1">Ask anything about your data</h3>
              <p className="text-muted-foreground mb-6 max-w-xs mx-auto text-sm">
                Ask to do or show anything using natural language
              </p>
              
              {/* Quick Prompts */}
              <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
                {quickPrompts.slice(0, 6).map((prompt, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="h-8 px-3 text-xs"
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
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.role === 'user' 
                  ? 'bg-white/10' 
                  : 'bg-gradient-to-r from-primary to-primary/80'
              }`}>
                {message.role === 'user' ? (
                  <IconUser className="size-4 text-muted-foreground" />
                ) : (
                  <IconSparkles className="size-4 text-primary-foreground" />
                )}
              </div>
              <div className={`group relative max-w-[80%] p-3 rounded-2xl border ${
                message.role === 'user' 
                  ? 'bg-white/5 border-white/10' 
                  : 'bg-gradient-to-r from-primary/5 to-primary/10 border-white/10'
              }`}>
                <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {message.content}
                </div>
                {/* Copy button on hover */}
                <button
                  type="button"
                  onClick={() => handleCopy(message.content, message.id)}
                  className={`absolute -top-2 -right-2 hidden group-hover:flex items-center justify-center w-6 h-6 rounded-full border border-white/10 bg-black/40 hover:bg-black/60 transition ${message.role === 'user' ? 'opacity-70' : ''}`}
                  title="Copy"
                >
                  {copiedId === message.id ? (
                    <IconCheck className="size-3.5 text-green-400" />
                  ) : (
                    <IconCopy className="size-3.5 text-white/70" />
                  )}
                </button>
              </div>
            </div>
          ))}

          {(isLoading || isDeepThinking) && (
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-primary to-primary/80 rounded-full flex items-center justify-center flex-shrink-0">
                {isDeepThinking ? (
                  <IconBrain className="size-4 text-primary-foreground" />
                ) : (
                  <IconSparkles className="size-4 text-primary-foreground" />
                )}
              </div>
              <div className="flex-1 p-3 rounded-2xl border border-white/10 bg-gradient-to-r from-primary/5 to-primary/10">
                <div className="flex items-center gap-2">
                  <span className="inline-flex gap-1">
                    <span className="block w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-200ms]"></span>
                    <span className="block w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-100ms]"></span>
                    <span className="block w-1.5 h-1.5 rounded-full bg-primary animate-bounce"></span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {isDeepThinking ? 'Thinking deeply…' : 'Thinking…'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-3.5 md:p-4 border-t border-white/10 bg-black/30">
        {isDeepThinking && (
          <div className="mb-3 p-3 bg-gradient-to-t from-primary/5 to-card border border-border/20 rounded-xl shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-gradient-to-r from-primary to-primary/80 rounded-full flex items-center justify-center">
                  <IconBrain className="size-3.5 text-primary-foreground" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">Deep Think Mode</span>
                  <span className="text-xs text-muted-foreground">Powered by advanced reasoning</span>
                </div>
              </div>
              <Badge variant="outline" className="text-xs font-medium">
                o3 Ready
              </Badge>
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={handleInputChange}
            placeholder="Ask me anything..."
            disabled={isLoading || isDeepThinking}
            className="flex-1 min-h-[40px] max-h-28 h-10 resize-none rounded-xl bg-white/5 border border-white/10 focus-visible:border-white/20"
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
            type="button"
            onClick={handleDeepThink}
            disabled={isLoading || isDeepThinking || !input.trim()}
            variant="outline"
            className={`h-10 px-3 rounded-xl border-white/15 transition-all duration-200 ${
              !input.trim() 
                ? 'opacity-50 cursor-not-allowed' 
                : 'hover:bg-gradient-to-t hover:from-primary/5 hover:to-card hover:border-primary/20 hover:shadow-xs'
            }`}
            title={!input.trim() ? "Type a message first to use deep thinking" : "Deep Think (o3) - Advanced reasoning with OpenAI's most powerful model"}
          >
            <IconBrain className={`size-4 ${isDeepThinking ? 'text-primary' : ''}`} />
          </Button>
          <Button 
            type="submit" 
            disabled={isLoading || isDeepThinking || !input.trim()}
            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 h-10 px-4 rounded-xl"
          >
            <IconSend className="size-4" />
          </Button>
        </form>
      </div>
      </div>
    </>
  )
}