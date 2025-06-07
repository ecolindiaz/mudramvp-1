"use client"

import { useState } from "react"
import { IconClock, IconRobot, IconTrendingUp, IconActivity } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { mockCrawlerData } from "@/lib/mock/data"

// Company logo mapping for bots
const botLogos: Record<string, string> = {
  "GPTBot": "/images/ChatGPT.png",
  "ClaudeBot": "/images/Claude.png", 
  "PerplexityBot": "/images/Perplexity.png",
  "Google-Extended": "/images/Gemini AI Logo.png",
  "Googlebot": "/images/Gemini AI Logo.png"
}

// Company mapping for bots
const botCompanies: Record<string, string> = {
  "GPTBot": "OpenAI",
  "ClaudeBot": "Anthropic",
  "PerplexityBot": "Perplexity", 
  "Google-Extended": "Google",
  "Googlebot": "Google"
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
  
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`
  } else if (diffInMinutes < 1440) {
    return `${Math.floor(diffInMinutes / 60)}h ago`
  } else {
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }
}

export function BotActivity() {
  const [selectedPeriod, setSelectedPeriod] = useState("24h")
  
  // Use real mock data
  const { botActivity, totalBotVisits, uniqueBots } = mockCrawlerData
  
  // Calculate average crawling time from active bots
  const activeBots = botActivity.filter(bot => bot.status === "active")
  const avgTime = activeBots.reduce((acc, bot) => acc + bot.avgCrawlTime, 0) / activeBots.length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Average Crawling Time Metric */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardDescription className="flex items-center gap-2">
                  <IconClock className="w-4 h-4" />
                  Average Crawling Time
                </CardDescription>
                <CardTitle className="text-3xl font-semibold tabular-nums mt-2">
                  {avgTime.toFixed(1)}s
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-sm">
                <IconTrendingUp className="w-3 h-3" />
                +12% efficiency
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-sm text-muted-foreground">
              Optimal crawling performance across {activeBots.length} active sessions
            </div>
          </CardContent>
        </Card>

        {/* Total Bot Visits */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardDescription className="flex items-center gap-2">
                  <IconActivity className="w-4 h-4" />
                  Bot Visits Today
                </CardDescription>
                <CardTitle className="text-3xl font-semibold tabular-nums mt-2">
                  {totalBotVisits.toLocaleString()}
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-sm">
                <IconRobot className="w-3 h-3" />
                {uniqueBots} unique bots
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-sm text-muted-foreground">
              Active crawler sessions from major AI companies
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Crawler Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <IconRobot className="w-5 h-5" />
                Recent Crawler Activity
              </CardTitle>
              <CardDescription className="mt-1">
                Real-time tracking of AI bot visits to your website
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {botActivity.map((bot, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 border border-border rounded-lg bg-card/50 hover:bg-card/80 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={botLogos[bot.botName]} alt={botCompanies[bot.botName]} />
                    <AvatarFallback>
                      {botCompanies[bot.botName]?.substring(0, 2).toUpperCase() || "AI"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-sm">
                      {bot.botName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {botCompanies[bot.botName] || "AI Company"}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <div className="font-medium">{bot.avgCrawlTime}s</div>
                    <div className="text-xs text-muted-foreground">Avg Time</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">{bot.pagesAccessed}</div>
                    <div className="text-xs text-muted-foreground">Pages</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">{bot.visits}</div>
                    <div className="text-xs text-muted-foreground">Total Visits</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">{formatTimeAgo(bot.lastSeen)}</div>
                    <div className="text-xs text-muted-foreground">Last Visit</div>
                  </div>
                  <Badge 
                    variant={bot.status === "active" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {bot.status === "active" ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 