"use client"

import { useState } from "react"
import Image from "next/image"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// Backend-ready data structure
const chartData = [
  { 
    model: "perplexity", 
    mentions: 31, 
    logo: "/images/Perplexity.png",
    displayName: "Perplexity"
  },
  { 
    model: "chatgpt", 
    mentions: 23, 
    logo: "/images/ChatGPT.png",
    displayName: "ChatGPT"
  },
  { 
    model: "claude", 
    mentions: 18, 
    logo: "/images/Claude.png",
    displayName: "Claude"
  },
  { 
    model: "gemini", 
    mentions: 15, 
    logo: "/images/Gemini AI Logo.png",
    displayName: "Gemini"
  },
]

export function AiModelPerformance() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <Card className="bg-card border-border h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-card-foreground text-lg">Performance by AI Model</CardTitle>
        <CardDescription className="text-muted-foreground text-sm">
          Your mention rates across different AI platforms
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 flex-1 flex flex-col justify-center">
        {chartData.map((item, index) => (
          <div 
            key={index} 
            className={`bg-black border border-white rounded-lg p-2 flex items-center justify-between transition-all duration-300 cursor-pointer transform ${
              hoveredIndex === index 
                ? 'scale-105 shadow-lg shadow-white/20 border-white/80' 
                : 'hover:scale-102 hover:shadow-md hover:shadow-white/10 hover:border-white/60'
            }`}
            style={{ 
              width: `${(item.mentions / 35) * 100}%`,
              minWidth: '180px'
            }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div className="flex items-center gap-2">
              <Image 
                src={item.logo} 
                alt={item.displayName} 
                width={14} 
                height={14}
                className={`rounded transition-transform duration-300 ${
                  hoveredIndex === index ? 'scale-110' : ''
                }`}
              />
              <span className={`font-medium text-xs transition-colors duration-300 ${
                hoveredIndex === index ? 'text-white' : 'text-gray-200'
              }`}>
                {item.displayName}
              </span>
            </div>
            <span className={`font-bold text-xs transition-all duration-300 ${
              hoveredIndex === index ? 'text-white text-sm' : 'text-gray-200'
            }`}>
              {item.mentions}%
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
} 