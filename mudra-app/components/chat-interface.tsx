"use client"

import React, { useState } from "react"
import { AIChatInput } from "@/components/ui/ai-chat-input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Bot, User, Sparkles, Zap, Brain, Target } from "lucide-react"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    })
  }

  return (
    <div className="flex flex-col h-full bg-black text-white relative">
      {/* Empty State / Welcome Message */}
      {messages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-12 px-4">
          {/* Enhanced Welcome Section */}
          <div className="flex flex-col items-center space-y-8">
            {/* Main Avatar with Animated Elements */}
            <div className="relative">
              {/* Animated rings */}
              <div className="absolute inset-0 rounded-full border-2 border-white/10 animate-pulse"></div>
              <div className="absolute -inset-4 rounded-full border border-white/5 animate-ping"></div>
              
              {/* Main avatar */}
              <div className="relative flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 rounded-full shadow-2xl">
                <Sparkles className="w-10 h-10 text-white" />
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-400 rounded-full flex items-center justify-center shadow-lg">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>
            
            {/* Welcome Message with Enhanced Styling */}
            <div className="relative max-w-lg">
              <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-3xl px-8 py-6 text-center border border-white/10 shadow-2xl backdrop-blur-sm">
                <h3 className="text-xl font-semibold text-white mb-2">Ready to get started?</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Your AI-powered GEO optimization assistant is ready to help you dominate search results
                </p>
              </div>
              {/* Enhanced chat bubble arrow */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[12px] border-l-transparent border-r-transparent border-t-gray-800"></div>
            </div>

            {/* Feature Icons */}
            <div className="flex items-center gap-8 mt-8">
              <div className="flex flex-col items-center gap-2 group cursor-pointer">
                <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center border border-white/10 group-hover:border-white/20 transition-all">
                  <Brain className="w-6 h-6 text-purple-400" />
                </div>
                <span className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">AI Analysis</span>
              </div>
              <div className="flex flex-col items-center gap-2 group cursor-pointer">
                <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center border border-white/10 group-hover:border-white/20 transition-all">
                  <Target className="w-6 h-6 text-blue-400" />
                </div>
                <span className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">GEO Targeting</span>
              </div>
              <div className="flex flex-col items-center gap-2 group cursor-pointer">
                <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center border border-white/10 group-hover:border-white/20 transition-all">
                  <Zap className="w-6 h-6 text-yellow-400" />
                </div>
                <span className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">Optimization</span>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Chat Input - Fixed at bottom */}
      <div className="p-6 border-t border-white/10">
        <AIChatInput />
      </div>
    </div>
  )
} 