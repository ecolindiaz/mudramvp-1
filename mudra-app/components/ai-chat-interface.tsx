"use client"

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { 
  IconSend, 
  IconUser, 
  IconRobot,
  IconLoader,
  IconSparkles,
  IconX,
  IconBrain
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

  const [quickPrompts] = useState([
    "Tell me how to do this step by step",
    "What should I work on first?", 
    "Show me the detailed steps for my tasks",
    "How long will these tasks take?"
  ])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  const handleSubmit = async (e: React.FormEvent, deepThink = false) => {
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

  if (!open) return null

  return (
    <div className="fixed bottom-20 right-6 w-[480px] h-[600px] bg-background border border-border rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-primary to-primary/80 rounded-full flex items-center justify-center">
              <IconSparkles className="size-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Mudra AI</h3>
              <p className="text-sm text-muted-foreground">Your optimization assistant</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            <IconX className="size-4" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              {/* Mudra Logo */}
              <div className="w-20 h-20 mx-auto mb-6">
                <img 
                  src="/images/mudra-logo.png" 
                  alt="Mudra Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              
              <h3 className="text-xl font-semibold mb-2">Ask anything about your tasks</h3>
              <p className="text-muted-foreground mb-8 max-w-xs mx-auto">
                Get step-by-step guidance for your optimization tasks
              </p>
              
              {/* Quick Prompts */}
              <div className="space-y-3">
                {quickPrompts.slice(0, 4).map((prompt, index) => (
                  <Button
                    key={index}
                    variant="outline" 
                    className="w-full justify-start text-left h-auto py-3 px-4"
                    onClick={() => handleQuickPrompt(prompt)}
                  >
                    <span className="text-sm">{prompt}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className="flex gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.role === 'user' 
                  ? 'bg-muted' 
                  : 'bg-gradient-to-r from-primary to-primary/80'
              }`}>
                {message.role === 'user' ? (
                  <IconUser className="size-4 text-muted-foreground" />
                ) : (
                  <IconSparkles className="size-4 text-primary-foreground" />
                )}
              </div>
              <div className={`flex-1 p-3 rounded-lg ${
                message.role === 'user' 
                  ? 'bg-muted/30' 
                  : 'bg-gradient-to-r from-primary/5 to-primary/10'
              }`}>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.content}
                </div>
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
              <div className="flex-1 p-3 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10">
                <div className="flex items-center gap-2">
                  <IconLoader className="size-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">
                    {isDeepThinking ? 'Mudra AI (o3) is thinking deeply...' : 'Mudra AI is thinking...'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t border-border/20">
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
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask me anything..."
            disabled={isLoading || isDeepThinking}
            className="flex-1 h-10"
            autoFocus
          />
          <Button 
            type="button"
            onClick={handleDeepThink}
            disabled={isLoading || isDeepThinking || !input.trim()}
            variant="outline"
            className={`h-10 px-3 transition-all duration-200 ${
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
            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 h-10 px-4"
          >
            <IconSend className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}