"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { Progress } from "@/components/ui/progress"
import { 
  IconMessage,
  IconDotsVertical,
  IconPlus,
  IconGripVertical,
  IconInfoCircle,
  IconTrendingUp,
} from "@tabler/icons-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useState } from "react"

// Define types for tracked prompts
type TrackedPrompt = {
  id: number
  prompt: string
  category: string
  aiModel: string
  visibilityScore: number
  mentions: number
  lastChecked: string
  trend: "up" | "down" | "neutral"
  trendValue: number
  priority: "high" | "medium" | "low"
  status: "active" | "inactive"
  createdDate: string
  responseQuality: number
  citationRate: number
  competitorComparison: number
}

// Mock data for 25 tracked prompts
const trackedPrompts: TrackedPrompt[] = [
  {
    id: 1,
    prompt: "What are the best marketing automation tools for B2B SaaS companies?",
    category: "Product Recommendation",
    aiModel: "ChatGPT",
    visibilityScore: 85,
    mentions: 3,
    lastChecked: "2024-01-15T10:30:00Z",
    trend: "up",
    trendValue: 12,
    priority: "high",
    status: "active",
    createdDate: "2024-01-01T00:00:00Z",
    responseQuality: 78,
    citationRate: 45,
    competitorComparison: 92
  },
  {
    id: 2,
    prompt: "How to optimize customer acquisition costs for startups?",
    category: "Strategy",
    aiModel: "Claude",
    visibilityScore: 72,
    mentions: 2,
    lastChecked: "2024-01-15T09:45:00Z",
    trend: "neutral",
    trendValue: 0,
    priority: "medium",
    status: "active",
    createdDate: "2024-01-01T00:00:00Z",
    responseQuality: 85,
    citationRate: 38,
    competitorComparison: 76
  },
  {
    id: 3,
    prompt: "What CRM software works best for small businesses?",
    category: "Product Recommendation",
    aiModel: "Gemini",
    visibilityScore: 91,
    mentions: 4,
    lastChecked: "2024-01-15T11:15:00Z",
    trend: "up",
    trendValue: 8,
    priority: "high",
    status: "active",
    createdDate: "2024-01-01T00:00:00Z",
    responseQuality: 92,
    citationRate: 58,
    competitorComparison: 88
  },
  {
    id: 4,
    prompt: "How to scale a SaaS business in 2024?",
    category: "Growth",
    aiModel: "Perplexity",
    visibilityScore: 63,
    mentions: 1,
    lastChecked: "2024-01-15T08:20:00Z",
    trend: "down",
    trendValue: -15,
    priority: "medium",
    status: "active",
    createdDate: "2024-01-01T00:00:00Z",
    responseQuality: 71,
    citationRate: 22,
    competitorComparison: 54
  },
  {
    id: 5,
    prompt: "Best practices for B2B email marketing campaigns",
    category: "Marketing",
    aiModel: "ChatGPT",
    visibilityScore: 78,
    mentions: 2,
    lastChecked: "2024-01-15T10:00:00Z",
    trend: "up",
    trendValue: 5,
    priority: "medium",
    status: "active",
    createdDate: "2024-01-01T00:00:00Z",
    responseQuality: 82,
    citationRate: 34,
    competitorComparison: 71
  },
  {
    id: 6,
    prompt: "How to implement customer success strategies?",
    category: "Customer Success",
    aiModel: "Claude",
    visibilityScore: 69,
    mentions: 1,
    lastChecked: "2024-01-15T09:30:00Z",
    trend: "neutral",
    trendValue: 2,
    priority: "low",
    status: "active",
    createdDate: "2024-01-01T00:00:00Z",
    responseQuality: 75,
    citationRate: 28,
    competitorComparison: 63
  },
  {
    id: 7,
    prompt: "What are the key metrics for SaaS product management?",
    category: "Analytics",
    aiModel: "Gemini",
    visibilityScore: 84,
    mentions: 3,
    lastChecked: "2024-01-15T11:45:00Z",
    trend: "up",
    trendValue: 18,
    priority: "high",
    status: "active",
    createdDate: "2024-01-01T00:00:00Z",
    responseQuality: 89,
    citationRate: 52,
    competitorComparison: 81
  },
  {
    id: 8,
    prompt: "How to reduce churn rate for subscription businesses?",
    category: "Retention",
    aiModel: "Perplexity",
    visibilityScore: 77,
    mentions: 2,
    lastChecked: "2024-01-15T08:45:00Z",
    trend: "up",
    trendValue: 7,
    priority: "high",
    status: "active",
    createdDate: "2024-01-01T00:00:00Z",
    responseQuality: 83,
    citationRate: 41,
    competitorComparison: 74
  },
  {
    id: 9,
    prompt: "Best tools for startup financial planning and forecasting",
    category: "Finance",
    aiModel: "ChatGPT",
    visibilityScore: 58,
    mentions: 1,
    lastChecked: "2024-01-15T07:30:00Z",
    trend: "down",
    trendValue: -8,
    priority: "low",
    status: "active",
    createdDate: "2024-01-01T00:00:00Z",
    responseQuality: 68,
    citationRate: 19,
    competitorComparison: 46
  },
  {
    id: 10,
    prompt: "How to build a strong company culture in remote teams?",
    category: "HR",
    aiModel: "Claude",
    visibilityScore: 73,
    mentions: 2,
    lastChecked: "2024-01-15T09:00:00Z",
    trend: "neutral",
    trendValue: 1,
    priority: "medium",
    status: "active",
    createdDate: "2024-01-01T00:00:00Z",
    responseQuality: 79,
    citationRate: 35,
    competitorComparison: 67
  },
  {
    id: 11,
    prompt: "What are the most effective lead generation strategies?",
    category: "Sales",
    aiModel: "Gemini",
    visibilityScore: 86,
    mentions: 4,
    lastChecked: "2024-01-15T10:15:00Z",
    trend: "up",
    trendValue: 14,
    priority: "high",
    status: "active",
    createdDate: "2024-01-01T00:00:00Z",
    responseQuality: 88,
    citationRate: 49,
    competitorComparison: 85
  },
  {
    id: 12,
    prompt: "How to optimize conversion rates for SaaS landing pages?",
    category: "Conversion",
    aiModel: "Perplexity",
    visibilityScore: 65,
    mentions: 1,
    lastChecked: "2024-01-15T08:00:00Z",
    trend: "down",
    trendValue: -5,
    priority: "medium",
    status: "active",
    createdDate: "2024-01-01T00:00:00Z",
    responseQuality: 72,
    citationRate: 26,
    competitorComparison: 58
  },
  {
    id: 13,
    prompt: "Best practices for API documentation and developer experience",
    category: "Technical",
    aiModel: "ChatGPT",
    visibilityScore: 82,
    mentions: 3,
    lastChecked: "2024-01-15T11:00:00Z",
    trend: "up",
    trendValue: 11,
    priority: "medium",
    status: "active",
    createdDate: "2024-01-01T00:00:00Z",
    responseQuality: 87,
    citationRate: 46,
    competitorComparison: 78
  },
  {
    id: 14,
    prompt: "How to implement effective onboarding for B2B SaaS users?",
    category: "Onboarding",
    aiModel: "Claude",
    visibilityScore: 79,
    mentions: 2,
    lastChecked: "2024-01-15T09:15:00Z",
    trend: "up",
    trendValue: 9,
    priority: "high",
    status: "active",
    createdDate: "2024-01-01T00:00:00Z",
    responseQuality: 84,
    citationRate: 43,
    competitorComparison: 72
  },
  {
    id: 15,
    prompt: "What are the key components of a successful product launch?",
    category: "Product Launch",
    aiModel: "Gemini",
    visibilityScore: 71,
    mentions: 2,
    lastChecked: "2024-01-15T08:30:00Z",
    trend: "neutral",
    trendValue: 3,
    priority: "medium",
    status: "active",
    createdDate: "2024-01-01T00:00:00Z",
    responseQuality: 76,
    citationRate: 31,
    competitorComparison: 65
  },
  {
    id: 16,
    prompt: "How to measure and improve customer satisfaction in SaaS?",
    category: "Customer Success",
    aiModel: "Perplexity",
    visibilityScore: 68,
    mentions: 1,
    lastChecked: "2024-01-15T07:45:00Z",
    trend: "down",
    trendValue: -3,
    priority: "low",
    status: "active",
    createdDate: "2024-01-01T00:00:00Z",
    responseQuality: 73,
    citationRate: 27,
    competitorComparison: 61
  },
  {
    id: 17,
    prompt: "Best project management tools for agile development teams",
    category: "Product Management",
    aiModel: "ChatGPT",
    visibilityScore: 75,
    mentions: 2,
    lastChecked: "2024-01-15T10:45:00Z",
    trend: "up",
    trendValue: 6,
    priority: "medium",
    status: "active",
    createdDate: "2024-01-01T00:00:00Z",
    responseQuality: 81,
    citationRate: 37,
    competitorComparison: 69
  },
  {
    id: 18,
    prompt: "How to build and scale a content marketing strategy?",
    category: "Marketing",
    aiModel: "Claude",
    visibilityScore: 83,
    mentions: 3,
    lastChecked: "2024-01-15T09:45:00Z",
    trend: "up",
    trendValue: 16,
    priority: "high",
    status: "active",
    createdDate: "2024-01-01T00:00:00Z",
    responseQuality: 86,
    citationRate: 48,
    competitorComparison: 80
  },
  {
    id: 19,
    prompt: "What are the essential features for a B2B SaaS platform?",
    category: "Product Features",
    aiModel: "Gemini",
    visibilityScore: 76,
    mentions: 2,
    lastChecked: "2024-01-15T11:30:00Z",
    trend: "neutral",
    trendValue: 1,
    priority: "medium",
    status: "active",
    createdDate: "2024-01-01T00:00:00Z",
    responseQuality: 80,
    citationRate: 36,
    competitorComparison: 68
  },
  {
    id: 20,
    prompt: "How to implement effective security measures for SaaS applications?",
    category: "Security",
    aiModel: "Perplexity",
    visibilityScore: 64,
    mentions: 1,
    lastChecked: "2024-01-15T08:15:00Z",
    trend: "down",
    trendValue: -7,
    priority: "medium",
    status: "active",
    createdDate: "2024-01-01T00:00:00Z",
    responseQuality: 74,
    citationRate: 25,
    competitorComparison: 57
  },
  {
    id: 21,
    prompt: "Best practices for SaaS pricing strategy and models",
    category: "Pricing",
    aiModel: "ChatGPT",
    visibilityScore: 88,
    mentions: 4,
    lastChecked: "2024-01-15T10:30:00Z",
    trend: "up",
    trendValue: 20,
    priority: "high",
    status: "active",
    createdDate: "2024-01-01T00:00:00Z",
    responseQuality: 91,
    citationRate: 55,
    competitorComparison: 89
  },
  {
    id: 22,
    prompt: "How to optimize customer support for growing SaaS companies?",
    category: "Support",
    aiModel: "Claude",
    visibilityScore: 70,
    mentions: 2,
    lastChecked: "2024-01-15T09:30:00Z",
    trend: "neutral",
    trendValue: 2,
    priority: "medium",
    status: "active",
    createdDate: "2024-01-01T00:00:00Z",
    responseQuality: 77,
    citationRate: 33,
    competitorComparison: 64
  },
  {
    id: 23,
    prompt: "What are the key performance indicators for SaaS businesses?",
    category: "Analytics",
    aiModel: "Gemini",
    visibilityScore: 81,
    mentions: 3,
    lastChecked: "2024-01-15T11:00:00Z",
    trend: "up",
    trendValue: 10,
    priority: "high",
    status: "active",
    createdDate: "2024-01-01T00:00:00Z",
    responseQuality: 85,
    citationRate: 44,
    competitorComparison: 77
  },
  {
    id: 24,
    prompt: "How to build partnerships and integrations for SaaS platforms?",
    category: "Partnerships",
    aiModel: "Perplexity",
    visibilityScore: 62,
    mentions: 1,
    lastChecked: "2024-01-15T07:15:00Z",
    trend: "down",
    trendValue: -12,
    priority: "low",
    status: "active",
    createdDate: "2024-01-01T00:00:00Z",
    responseQuality: 69,
    citationRate: 21,
    competitorComparison: 49
  },
  {
    id: 25,
    prompt: "Best tools for monitoring and improving application performance",
    category: "Technical",
    aiModel: "ChatGPT",
    visibilityScore: 74,
    mentions: 2,
    lastChecked: "2024-01-15T10:00:00Z",
    trend: "up",
    trendValue: 4,
    priority: "medium",
    status: "active",
    createdDate: "2024-01-01T00:00:00Z",
    responseQuality: 78,
    citationRate: 29,
    competitorComparison: 66
  }
]

function DragHandle({ id }: { id: number }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-muted-foreground size-7 hover:bg-transparent"
    >
      <IconGripVertical className="text-muted-foreground size-3" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  )
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}





interface TrackedPromptsViewProps {
  prompts?: any[]
  analysis?: any
}

// Normalize prompt text for robust matching
const normalizePrompt = (text: string): string => {
  if (!text) return ''
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Normalize whitespace
}

export function TrackedPromptsView({ prompts = [], analysis }: TrackedPromptsViewProps) {
  console.log('[TrackedPromptsView] Rendering with:', {
    promptCount: prompts.length,
    hasAnalysis: !!analysis,
    analysesArray: analysis?.analyses
  })
  
  // Transform real prompts data to match TrackedPrompt interface
  const transformedPrompts: TrackedPrompt[] = prompts.map((prompt, index) => {
    // Try to find corresponding prompt test results from analysis
    let visibilityScore = 0
    let mentions = 0
    let aiModel = "ChatGPT"
    let found = false
    
    if (analysis?.analyses && Array.isArray(analysis.analyses)) {
      // Normalize the prompt text once for comparison
      const normalizedPromptText = normalizePrompt(prompt.text)
      
      // analyses is an array of provider analyses
      for (const providerAnalysis of analysis.analyses) {
        if (!providerAnalysis.promptTests) continue
        
        const promptTest = providerAnalysis.promptTests.find((pt: any) => 
          normalizePrompt(pt.prompt) === normalizedPromptText
        )
        
        if (promptTest) {
          found = true
          visibilityScore = promptTest.brandMentioned ? 80 + Math.random() * 20 : Math.random() * 40
          mentions = promptTest.mentions || 0
          aiModel = providerAnalysis.provider || "ChatGPT"
          console.log('[TrackedPromptsView] Found match for prompt:', {
            promptText: prompt.text.substring(0, 50),
            normalizedPrompt: normalizedPromptText.substring(0, 50),
            normalizedTest: normalizePrompt(promptTest.prompt).substring(0, 50),
            visibilityScore,
            mentions,
            aiModel
          })
          break
        }
      }
      
      // Debug: Show why first prompt didn't match
      if (!found && index === 0) {
        const firstProvider = analysis.analyses[0]
        const firstTest = firstProvider?.promptTests?.[0]
        console.log('[TrackedPromptsView] No match found for first prompt:', {
          promptText: prompt.text,
          normalizedPrompt: normalizedPromptText,
          firstTestPrompt: firstTest?.prompt,
          normalizedFirstTest: firstTest ? normalizePrompt(firstTest.prompt) : null,
          textsMatch: firstTest ? normalizedPromptText === normalizePrompt(firstTest.prompt) : false
        })
      }
    }
    
    return {
      id: prompt.id || index,
      prompt: prompt.text,
      category: prompt.category || "Organic",
      aiModel,
      visibilityScore: Math.round(visibilityScore),
      mentions,
      lastChecked: prompt.updatedAt || new Date().toISOString(),
      trend: visibilityScore > 60 ? "up" : visibilityScore < 40 ? "down" : "neutral",
      trendValue: Math.round((Math.random() - 0.5) * 20),
      priority: visibilityScore < 40 ? "high" : visibilityScore < 60 ? "medium" : "low",
      status: prompt.isActive ? "active" : "inactive",
      createdDate: prompt.createdAt || new Date().toISOString(),
      responseQuality: Math.round(60 + Math.random() * 40),
      citationRate: Math.round(20 + Math.random() * 50),
      competitorComparison: Math.round(50 + Math.random() * 50)
    }
  })
  
  // Use transformed prompts if available, otherwise fall back to mock data
  const displayPrompts = transformedPrompts.length > 0 ? transformedPrompts : trackedPrompts
  const activePrompts = displayPrompts.filter(prompt => prompt.status === "active")
  const highPriorityPrompts = displayPrompts.filter(prompt => prompt.priority === "high")

  return (
    <div className="flex flex-col gap-4 w-full px-4 lg:px-6 pt-4 md:pt-6">
              {/* Header Cards */}
        <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2">
          <Card 
            className="@container/card bg-card border-0 shadow-none"
            data-slot="card"
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardDescription>Total Prompts</CardDescription>
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 w-7 p-0 rounded-full hover:bg-muted/50 transition-all duration-200"
                        >
                          <IconInfoCircle className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent 
                        side="left" 
                        align="start"
                        className="max-w-72 p-4 bg-background/95 backdrop-blur-sm border border-border/50 shadow-lg"
                      >
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm text-foreground">Total Prompts</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            How many prompts Mudra tracks to optimize your brand's visibility and help you appear more often in AI responses.
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Badge variant="outline">
                    <IconTrendingUp className="size-4" />
                    Active
                  </Badge>
                </div>
              </div>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {displayPrompts.length}
              </CardTitle>
            </CardHeader>
          </Card>
          
          <Card 
            className="@container/card bg-card border-0 shadow-none"
            data-slot="card"
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardDescription>High Priority</CardDescription>
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 w-7 p-0 rounded-full hover:bg-muted/50 transition-all duration-200"
                        >
                          <IconInfoCircle className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent 
                        side="left" 
                        align="start"
                        className="max-w-72 p-4 bg-background/95 backdrop-blur-sm border border-border/50 shadow-lg"
                      >
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm text-foreground">High Priority</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Prompts you need to optimize because of low visibility in them. These require immediate attention to improve your AI presence.
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Badge variant="outline">
                    <IconTrendingUp className="size-4" />
                    Active
                  </Badge>
                </div>
              </div>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {highPriorityPrompts.length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

      {/* Main Table */}
      <div>
        <Card className="border-0 shadow-none bg-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Tracked Prompts</CardTitle>
                <CardDescription>
                  Monitor your AI visibility across different prompts and models
                </CardDescription>
              </div>
              <Button size="sm">
                View All Prompts
              </Button>
            </div>
          </CardHeader>
          <div className="overflow-hidden">
            <Table>
                                <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead className="w-12"></TableHead>
                      <TableHead className="min-w-[300px]">Prompt</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Visibility</TableHead>
                      <TableHead className="text-right">Mentions</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
              <TableBody>
                {displayPrompts.slice(0, 10).map((prompt) => (
                                      <TableRow key={prompt.id} className="hover:bg-muted/50">
                      <TableCell>
                        <DragHandle id={prompt.id} />
                      </TableCell>
                      <TableCell></TableCell>
                    <TableCell className="font-medium">
                      <div className="max-w-[300px] truncate" title={prompt.prompt}>
                        {prompt.prompt}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-muted-foreground px-1.5">
                        {prompt.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-medium">{prompt.visibilityScore}%</span>
                                                <Badge 
                          variant={prompt.visibilityScore >= 80 ? "default" : prompt.visibilityScore >= 60 ? "secondary" : "destructive"}
                          className={`px-2 py-1 text-xs font-medium ${
                            prompt.visibilityScore >= 80 
                              ? "bg-green-500/10 text-green-400 border-green-500/20" 
                              : prompt.visibilityScore >= 60 
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/20" 
                              : ""
                          }`}
                        >
                          {prompt.visibilityScore >= 80 ? "Excellent" : prompt.visibilityScore >= 60 ? "Good" : "Needs Work"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium">{prompt.mentions}</span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
                            size="icon"
                          >
                            <IconDotsVertical />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Check Now</DropdownMenuItem>
                          <DropdownMenuItem>Edit Prompt</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>Pause Tracking</DropdownMenuItem>
                          <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  )
} 