"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, BarChart, Bar } from "recharts"
import { TrendingUp, TrendingDown, Target, Users, Star, AlertTriangle, ExternalLink, Bot } from "lucide-react"
import type { TimeRange } from "@/components/dashboard/time-range-selector"

interface BrandInsightsViewProps {
  timeRange?: TimeRange
}

// Mock data for brand insights
const brandOverviewData = {
  aiVisibilityScore: 74,
  sentimentScore: 82,
  authorityScore: 68,
  competitiveRank: 3,
  totalMentions: 156,
  weeklyChange: 12.5,
  strongestAreas: ["Technical Expertise", "Innovation", "Customer Support"],
  improvementAreas: ["Market Awareness", "Thought Leadership", "Content Distribution"]
}

const visibilityTrendData = [
  { date: "Jan", score: 62, mentions: 45 },
  { date: "Feb", score: 68, mentions: 52 },
  { date: "Mar", score: 71, mentions: 58 },
  { date: "Apr", score: 74, mentions: 61 },
  { date: "May", score: 76, mentions: 67 },
  { date: "Jun", score: 74, mentions: 63 }
]

const competitorComparisonData = [
  { name: "Your Brand", score: 74, color: "#3b82f6" },
  { name: "Competitor A", score: 82, color: "#ef4444" },
  { name: "Competitor B", score: 69, color: "#f59e0b" },
  { name: "Competitor C", score: 71, color: "#10b981" }
]

const brandAttributesData = [
  { attribute: "Authority", score: 68 },
  { attribute: "Innovation", score: 85 },
  { attribute: "Trustworthiness", score: 78 },
  { attribute: "Expertise", score: 82 },
  { attribute: "Market Presence", score: 62 },
  { attribute: "Customer Satisfaction", score: 88 }
]

const keyInsights = [
  {
    id: 1,
    type: "opportunity",
    title: "Content Gap Identified",
    description: "AI models frequently mention competitors for 'best practices' queries but rarely cite your brand.",
    impact: "High",
    action: "Create comprehensive best practices guide",
    aiModels: ["ChatGPT", "Claude", "Perplexity"]
  },
  {
    id: 2,
    type: "strength",
    title: "Strong Technical Authority",
    description: "Your brand is frequently cited for technical implementation questions.",
    impact: "Medium",
    action: "Leverage this strength in more content",
    aiModels: ["ChatGPT", "Copilot"]
  },
  {
    id: 3,
    type: "threat",
    title: "Competitor Gaining Ground",
    description: "Competitor A increased mentions by 34% this month in your key category.",
    impact: "High",
    action: "Review their content strategy",
    aiModels: ["Claude", "Perplexity", "Gemini"]
  }
]

const chartConfig = {
  score: {
    label: "Visibility Score",
    color: "hsl(var(--primary))",
  },
  mentions: {
    label: "Mentions",
    color: "hsl(var(--muted-foreground))",
  },
}

export function BrandInsightsView({ timeRange = "7d" }: BrandInsightsViewProps) {
  return (
    <div className="space-y-6">
      {/* Brand Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Visibility Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{brandOverviewData.aiVisibilityScore}%</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              +{brandOverviewData.weeklyChange}% from last week
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sentiment Score</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{brandOverviewData.sentimentScore}%</div>
            <div className="text-xs text-muted-foreground">Positive sentiment</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Competitive Rank</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">#{brandOverviewData.competitiveRank}</div>
            <div className="text-xs text-muted-foreground">In your category</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Mentions</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{brandOverviewData.totalMentions}</div>
            <div className="text-xs text-muted-foreground">This month</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visibility Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Visibility Trend</CardTitle>
            <CardDescription>
              AI visibility score and mention frequency over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={visibilityTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="var(--color-score)" 
                    strokeWidth={2}
                    dot={{ fill: "var(--color-score)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Competitor Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Competitive Position</CardTitle>
            <CardDescription>
              Your visibility score vs key competitors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={competitorComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="score" fill="var(--color-score)" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Brand Attributes Radar */}
      <Card>
        <CardHeader>
          <CardTitle>Brand Attributes Analysis</CardTitle>
          <CardDescription>
            How AI models perceive your brand across key attributes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[400px]">
            <RadarChart data={brandAttributesData}>
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <PolarAngleAxis dataKey="attribute" />
              <PolarGrid />
              <Radar
                dataKey="score"
                stroke="var(--color-score)"
                fill="var(--color-score)"
                fillOpacity={0.2}
                strokeWidth={2}
                dot={{ fill: "var(--color-score)", strokeWidth: 2, r: 4 }}
              />
            </RadarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Key Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Key Insights & Recommendations</CardTitle>
          <CardDescription>
            AI-powered analysis of your brand's performance and opportunities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {keyInsights.map((insight) => (
              <div
                key={insight.id}
                className="flex items-start space-x-4 p-4 rounded-lg border"
              >
                <div className="flex-shrink-0">
                  {insight.type === "opportunity" && (
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Target className="h-4 w-4 text-blue-600" />
                    </div>
                  )}
                  {insight.type === "strength" && (
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    </div>
                  )}
                  {insight.type === "threat" && (
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">{insight.title}</h4>
                    <Badge variant={insight.impact === "High" ? "destructive" : "secondary"}>
                      {insight.impact} Impact
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {insight.description}
                  </p>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-muted-foreground">Mentioned in:</span>
                      {insight.aiModels.map((model) => (
                        <Badge key={model} variant="outline" className="text-xs">
                          {model}
                        </Badge>
                      ))}
                    </div>
                    <Button size="sm" variant="outline">
                      {insight.action}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Strengths and Improvement Areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Strongest Areas</CardTitle>
            <CardDescription>
              Where your brand excels in AI responses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {brandOverviewData.strongestAreas.map((area, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm">{area}</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Strong
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-orange-600">Improvement Areas</CardTitle>
            <CardDescription>
              Opportunities to increase AI visibility
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {brandOverviewData.improvementAreas.map((area, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm">{area}</span>
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                    Needs Focus
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
