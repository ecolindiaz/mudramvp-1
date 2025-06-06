"use client"

import React, { useState, useEffect } from "react"
import { AIChatInput } from "@/components/ui/ai-chat-input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Bot, User, Sparkles, Zap, Brain, Target, Infinity, ExternalLink } from "lucide-react"
import { StarBorder } from "@/components/ui/star-border"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    })
  }

  // Simple loading state during hydration
  if (!isHydrated) {
    return (
      <div className="flex flex-col h-full bg-black text-white relative">
        <div className="flex-1" />
        <div className="p-6 border-t border-white/10">
          <div className="w-full max-w-3xl mx-auto h-[68px] border border-white/10 rounded-[32px] bg-black animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-black text-white relative">
      {/* Messages Area - Only show when there are messages */}
      {messages.length > 0 && (
        <>
          {/* Chat Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 rounded-full">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Mudra AI Agent</h2>
                <p className="text-sm text-gray-400">GEO Optimization Assistant</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white border border-white/10 hover:border-white/20">
              Clear Chat
            </Button>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500">
                        <Bot className="w-4 h-4 text-white" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  
                  <Card className={`max-w-[80%] border-white/10 ${
                    message.role === "user" 
                      ? "bg-gray-900" 
                      : "bg-gray-900"
                  }`}>
                    <CardContent className="p-3">
                      <p className="text-sm leading-relaxed">{message.content}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {message.role === "user" && (
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-gray-700 border border-white/10">
                        <User className="w-4 h-4 text-white" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </>
      )}

      {/* Spacer to push chat input to bottom when no messages */}
      {messages.length === 0 && <div className="flex-1" />}

      {/* Chat Input - Fixed at bottom */}
      <div className="p-6 border-t border-white/10">
        <AIChatInput />
      </div>
    </div>
  )
} 