"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { AlertTriangle, TrendingDown, Target, ExternalLink, Users, Bot, MessageSquare, Search } from "lucide-react"
import type { TimeRange } from "@/components/dashboard/time-range-selector"

interface CitationGapsViewProps {
  timeRange?: TimeRange
}

// Mock data for citation gaps analysis
const citationGapsOverview = {
  totalQueries: 1250,
  missedOpportunities: 78,
  competitorAdvantage: 34,
  gapScore: 23, // Lower is better
  potentialReach: 12400,
  categoryGaps: 5
}

const competitorCitationData = [
  { name: "Your Brand", citations: 156, color: "#3b82f6" },
  { name: "Competitor A", citations: 234, color: "#ef4444" },
  { name: "Competitor B", citations: 189, color: "#f59e0b" },
  { name: "Competitor C", citations: 167, color: "#10b981" },
  { name: "Competitor D", citations: 145, color: "#8b5cf6" }
]

const categoryGapsData = [
  { category: "Best Practices", yourMentions: 12, competitorAvg: 45, gap: 73 },
  { category: "Implementation Guides", yourMentions: 28, competitorAvg: 52, gap: 46 },
  { category: "Comparison Queries", yourMentions: 8, competitorAvg: 38, gap: 79 },
  { category: "Problem Solving", yourMentions: 34, competitorAvg: 41, gap: 17 },
  { category: "Use Cases", yourMentions: 19, competitorAvg: 49, gap: 61 }
]

const missedOpportunityTypes = [
  { name: "Technical Questions", value: 35, color: "#ef4444" },
  { name: "Product Comparisons", value: 28, color: "#f59e0b" },
  { name: "Best Practices", value: 22, color: "#10b981" },
  { name: "Implementation", value: 15, color: "#8b5cf6" }
]

const criticalGaps = [
  {
    id: 1,
    query: "What are the best fintech solutions for small businesses?",
    competitorMentions: 12,
    yourMentions: 0,
    aiModels: ["ChatGPT", "Claude", "Perplexity"],
    severity: "Critical",
    potentialReach: 2340,
    suggestedAction: "Create comprehensive fintech guide",
    topCompetitor: "Competitor A"
  },
  {
    id: 2,
    query: "How to implement automated payment solutions?",
    competitorMentions: 8,
    yourMentions: 1,
    aiModels: ["ChatGPT", "Gemini"],
    severity: "High",
    potentialReach: 1890,
    suggestedAction: "Expand implementation documentation",
    topCompetitor: "Competitor B"
  },
  {
    id: 3,
    query: "Compare enterprise banking platforms",
    competitorMentions: 15,
    yourMentions: 2,
    aiModels: ["Claude", "Perplexity", "Copilot"],
    severity: "High",
    potentialReach: 3120,
    suggestedAction: "Create detailed comparison content",
    topCompetitor: "Competitor A"
  },
  {
    id: 4,
    query: "Best practices for financial compliance automation",
    competitorMentions: 6,
    yourMentions: 0,
    aiModels: ["ChatGPT", "Claude"],
    severity: "Medium",
    potentialReach: 1250,
    suggestedAction: "Develop compliance best practices guide",
    topCompetitor: "Competitor C"
  }
]

const quickWins = [
  {
    id: 1,
    title: "Update existing blog posts with competitor-mentioned keywords",
    effort: "Low",
    impact: "Medium",
    timeToImplement: "1-2 weeks",
    expectedLift: "+15%"
  },
  {
    id: 2,
    title: "Create FAQ section addressing common competitor advantages",
    effort: "Medium",
    impact: "High",
    timeToImplement: "3-4 weeks",
    expectedLift: "+28%"
  },
  {
    id: 3,
    title: "Develop case studies for underrepresented use cases",
    effort: "Medium",
    impact: "Medium",
    timeToImplement: "4-6 weeks",
    expectedLift: "+22%"
  }
]

const chartConfig = {
  citations: {
    label: "Citations",
    color: "hsl(var(--primary))",
  },
  gap: {
    label: "Gap %",
    color: "hsl(var(--destructive))",
  },
}

export function CitationGapsView({ timeRange = "7d" }: CitationGapsViewProps) {
  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Citation Gap Score</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{citationGapsOverview.gapScore}%</div>
            <div className="text-xs text-muted-foreground">Lower is better</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Missed Opportunities</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{citationGapsOverview.missedOpportunities}</div>
            <div className="text-xs text-muted-foreground">Out of {citationGapsOverview.totalQueries} queries</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Potential Reach</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{citationGapsOverview.potentialReach.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Monthly audience</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Category Gaps</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{citationGapsOverview.categoryGaps}</div>
            <div className="text-xs text-muted-foreground">Major content gaps</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Competitor Citation Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Citation Volume Comparison</CardTitle>
            <CardDescription>
              Your citations vs competitors across all AI models
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={competitorCitationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="citations" fill="var(--color-citations)" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Missed Opportunity Types */}
        <Card>
          <CardHeader>
            <CardTitle>Missed Opportunity Breakdown</CardTitle>
            <CardDescription>
              Types of queries where competitors are cited instead
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={missedOpportunityTypes}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {missedOpportunityTypes.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Category Gaps Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Category-Level Citation Gaps</CardTitle>
          <CardDescription>
            Content categories where competitors have significant advantages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categoryGapsData.map((category, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{category.category}</span>
                  <div className="flex items-center space-x-4">
                    <span className="text-xs text-muted-foreground">
                      You: {category.yourMentions} | Avg: {category.competitorAvg}
                    </span>
                    <Badge variant={category.gap > 60 ? "destructive" : category.gap > 30 ? "secondary" : "outline"}>
                      {category.gap}% gap
                    </Badge>
                  </div>
                </div>
                <Progress value={100 - category.gap} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Critical Gap Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Critical Citation Gaps</CardTitle>
          <CardDescription>
            High-impact queries where competitors dominate
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {criticalGaps.map((gap) => (
              <div
                key={gap.id}
                className="p-4 rounded-lg border space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium">{gap.query}</h4>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                      <span>Competitor mentions: {gap.competitorMentions}</span>
                      <span>Your mentions: {gap.yourMentions}</span>
                      <span>Reach: {gap.potentialReach.toLocaleString()}</span>
                    </div>
                  </div>
                  <Badge variant={
                    gap.severity === "Critical" ? "destructive" : 
                    gap.severity === "High" ? "secondary" : "outline"
                  }>
                    {gap.severity}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-muted-foreground">AI Models:</span>
                    {gap.aiModels.map((model) => (
                      <Badge key={model} variant="outline" className="text-xs">
                        {model}
                      </Badge>
                    ))}
                  </div>
                  <Button size="sm" variant="outline">
                    {gap.suggestedAction}
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
                
                <div className="text-xs text-muted-foreground">
                  Leading competitor: <span className="font-medium">{gap.topCompetitor}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Wins Section */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Wins & Action Items</CardTitle>
          <CardDescription>
            High-impact, low-effort improvements to close citation gaps
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickWins.map((win) => (
              <div key={win.id} className="p-4 rounded-lg border">
                <h4 className="text-sm font-medium mb-2">{win.title}</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Effort:</span>
                    <Badge variant={win.effort === "Low" ? "secondary" : "outline"}>
                      {win.effort}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Impact:</span>
                    <Badge variant={win.impact === "High" ? "default" : "outline"}>
                      {win.impact}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Timeline: {win.timeToImplement}
                  </div>
                  <div className="text-xs font-medium text-green-600">
                    Expected lift: {win.expectedLift}
                  </div>
                </div>
                <Button size="sm" className="w-full mt-3" variant="outline">
                  Start Implementation
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
