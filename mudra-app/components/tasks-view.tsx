"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { MetricCard } from "@/components/dashboard/metric-card"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { 
  IconCircleCheckFilled,
  IconLoader,
  IconGripVertical,
  IconDotsVertical,
  IconTrendingUp,
  IconPlus,
  IconTarget,
  IconClock,
  IconExternalLink,
  IconCheck,
} from "@tabler/icons-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useState } from "react"

import { dashboardData } from "@/app/dashboard/data"

// Define types
type DashboardItem = typeof dashboardData[0]

type TaskItem = DashboardItem & {
  progress: number
  priority: string
  dueDate: string
  description: string
  actionItems: string[]
  detailedSteps: DetailedStep[]
  resources: Resource[]
  estimatedTime: string
  difficulty: string
}

type DetailedStep = {
  id: number
  title: string
  description: string
  completed: boolean
  estimatedTime: string
}

type Resource = {
  title: string
  url: string
  type: "documentation" | "tool" | "guide"
}

// Transform dashboard data into task format
const transformToTasks = (data: typeof dashboardData): TaskItem[] => {
  return data.map(item => ({
    ...item,
    progress: Math.round((parseInt(item.target) / parseInt(item.limit)) * 100),
    priority: item.status === "In Process" ? "high" : "medium",
    dueDate: item.status === "In Process" ? "2024-01-15" : "2024-01-30",
    description: getTaskDescription(item.header, item.type),
    actionItems: getActionItems(item.header, item.status),
    detailedSteps: getDetailedSteps(item.header, item.status),
    resources: getResources(item.header),
    estimatedTime: getEstimatedTime(item.header),
    difficulty: getDifficulty(item.header)
  }))
}

const getTaskDescription = (header: string, type: string): string => {
  const descriptions: Record<string, string> = {
    "AI Visibility Score": "Improve how often AI models mention your brand in responses",
    "Claude Performance": "Optimize content for better Claude AI recognition",
    "ChatGPT Performance": "Enhance visibility in ChatGPT responses",
    "Perplexity Performance": "Increase mentions in Perplexity search results",
    "Gemini Performance": "Improve Google AI model recognition",
    "Competitive Share": "Analyze and improve competitive positioning",
    "Crawler Health Score": "Ensure AI bots can access and index your content",
    "Content Quality Score": "Enhance content credibility and expertise signals",
    "External Footprint": "Expand brand presence across the web",
    "Brand Mentions": "Increase quality brand mentions and citations",
    "Query Performance": "Optimize response to industry-relevant queries",
    "Technical Structure": "Improve website technical SEO for AI crawlers",
    "Competitor Analysis": "Monitor and outperform competitor strategies",
    "AI Model Trends": "Track and adapt to AI model behavior changes"
  }
  return descriptions[header] || `Optimize ${header.toLowerCase()} metrics`
}

const getActionItems = (header: string, status: string): string[] => {
  if (status === "Done") return []
  
  const actions: Record<string, string[]> = {
    "Perplexity Performance": [
      "Add structured data markup",
      "Create FAQ sections",
      "Optimize for question-based queries"
    ],
    "Gemini Performance": [
      "Improve E-A-T signals",
      "Add author bios",
      "Create comprehensive guides"
    ],
    "Competitive Share": [
      "Research competitor content gaps",
      "Create superior content",
      "Build authority backlinks"
    ],
    "External Footprint": [
      "Submit to industry directories",
      "Guest post on authority sites",
      "Engage in relevant forums"
    ],
    "Technical Structure": [
      "Fix crawl errors",
      "Optimize page speed",
      "Implement schema markup"
    ],
    "Competitor Analysis": [
      "Set up competitor monitoring",
      "Analyze their content strategy",
      "Identify opportunity gaps"
    ]
  }
  return actions[header] || ["Review and optimize", "Monitor progress", "Update strategy"]
}

const getDetailedSteps = (header: string, status: string): DetailedStep[] => {
  if (status === "Done") return []

  const steps: Record<string, DetailedStep[]> = {
    "Perplexity Performance": [
      {
        id: 1,
        title: "Implement Schema.org Markup",
        description: "Add structured data to your website's key pages to help AI models understand your content better. Focus on Organization, Product, and FAQ schemas.",
        completed: false,
        estimatedTime: "2-3 hours"
      },
      {
        id: 2,
        title: "Create Comprehensive FAQ Section",
        description: "Develop a detailed FAQ page that answers common questions about your industry and products. Use natural language that matches how people ask questions.",
        completed: false,
        estimatedTime: "4-6 hours"
      },
      {
        id: 3,
        title: "Optimize Content for Question-Based Queries",
        description: "Rewrite existing content to directly answer questions. Use headers that mirror common search queries and provide clear, concise answers.",
        completed: false,
        estimatedTime: "6-8 hours"
      }
    ],
    "Gemini Performance": [
      {
        id: 1,
        title: "Enhance E-A-T Signals",
        description: "Improve Expertise, Authoritativeness, and Trustworthiness by adding author credentials, certifications, and trust indicators throughout your site.",
        completed: false,
        estimatedTime: "3-4 hours"
      },
      {
        id: 2,
        title: "Add Detailed Author Bios",
        description: "Create comprehensive author biography pages with credentials, experience, and social proof to establish authority in your field.",
        completed: false,
        estimatedTime: "2-3 hours"
      },
      {
        id: 3,
        title: "Develop Comprehensive Resource Guides",
        description: "Create in-depth, authoritative guides that cover your industry topics comprehensively. Include data, examples, and actionable insights.",
        completed: false,
        estimatedTime: "8-12 hours"
      }
    ],
    "Technical Structure": [
      {
        id: 1,
        title: "Audit and Fix Crawl Errors",
        description: "Use Google Search Console to identify and fix 404 errors, redirect chains, and other crawl issues that prevent AI bots from accessing your content.",
        completed: false,
        estimatedTime: "2-4 hours"
      },
      {
        id: 2,
        title: "Optimize Page Loading Speed",
        description: "Improve Core Web Vitals by optimizing images, minifying CSS/JS, and implementing caching. Target sub-3 second load times.",
        completed: false,
        estimatedTime: "4-6 hours"
      },
      {
        id: 3,
        title: "Implement Advanced Schema Markup",
        description: "Add JSON-LD structured data for all content types including articles, products, events, and local business information.",
        completed: false,
        estimatedTime: "3-5 hours"
      }
    ]
  }
  
  return steps[header] || [
    {
      id: 1,
      title: "Analyze Current Performance",
      description: "Review current metrics and identify areas for improvement",
      completed: false,
      estimatedTime: "1-2 hours"
    },
    {
      id: 2,
      title: "Implement Optimization Strategy",
      description: "Execute the recommended optimization techniques",
      completed: false,
      estimatedTime: "3-5 hours"
    },
    {
      id: 3,
      title: "Monitor and Adjust",
      description: "Track progress and make necessary adjustments",
      completed: false,
      estimatedTime: "1-2 hours"
    }
  ]
}

const getResources = (header: string): Resource[] => {
  const resources: Record<string, Resource[]> = {
    "Perplexity Performance": [
      { title: "Schema.org Documentation", url: "https://schema.org", type: "documentation" },
      { title: "Google Structured Data Testing Tool", url: "https://search.google.com/test/rich-results", type: "tool" },
      { title: "FAQ Schema Implementation Guide", url: "#", type: "guide" }
    ],
    "Gemini Performance": [
      { title: "Google E-A-T Guidelines", url: "#", type: "documentation" },
      { title: "Author Authority Best Practices", url: "#", type: "guide" },
      { title: "Content Quality Assessment Tool", url: "#", type: "tool" }
    ],
    "Technical Structure": [
      { title: "Google Search Console", url: "https://search.google.com/search-console", type: "tool" },
      { title: "PageSpeed Insights", url: "https://pagespeed.web.dev", type: "tool" },
      { title: "Technical SEO Checklist", url: "#", type: "guide" }
    ]
  }
  
  return resources[header] || [
    { title: "General Optimization Guide", url: "#", type: "guide" },
    { title: "Performance Monitoring Tool", url: "#", type: "tool" }
  ]
}

const getEstimatedTime = (header: string): string => {
  const times: Record<string, string> = {
    "Perplexity Performance": "12-17 hours",
    "Gemini Performance": "13-19 hours",
    "Technical Structure": "9-15 hours",
    "Competitive Share": "8-12 hours",
    "External Footprint": "6-10 hours",
    "Competitor Analysis": "4-8 hours"
  }
  return times[header] || "4-8 hours"
}

const getDifficulty = (header: string): string => {
  const difficulty: Record<string, string> = {
    "Perplexity Performance": "Medium",
    "Gemini Performance": "Medium",
    "Technical Structure": "Hard",
    "Competitive Share": "Medium",
    "External Footprint": "Easy",
    "Competitor Analysis": "Easy"
  }
  return difficulty[header] || "Medium"
}

const tasks = transformToTasks(dashboardData)

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

function TaskDetailModal({ task }: { task: TaskItem }) {
  const [stepStates, setStepStates] = useState<Record<number, boolean>>({})

  const toggleStep = (stepId: number) => {
    setStepStates(prev => ({
      ...prev,
      [stepId]: !prev[stepId]
    }))
  }

  const completedSteps = Object.values(stepStates).filter(Boolean).length
  const totalSteps = task.detailedSteps.length
  const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0

  return (
    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <IconTarget className="size-5" />
          {task.header}
        </DialogTitle>
        <DialogDescription>
          {task.description}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6">
        {/* Task Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Progress</CardDescription>
              <CardTitle className="text-2xl">{task.progress}%</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Estimated Time</CardDescription>
              <CardTitle className="text-lg">{task.estimatedTime}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Difficulty</CardDescription>
              <CardTitle className="text-lg">{task.difficulty}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Steps Progress */}
        {task.detailedSteps.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Step Progress</CardTitle>
              <CardDescription>
                {completedSteps} of {totalSteps} steps completed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={progressPercentage} className="h-2" />
            </CardContent>
          </Card>
        )}

        {/* Detailed Steps */}
        {task.detailedSteps.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>What You Need to Do</CardTitle>
              <CardDescription>
                Follow these steps to complete the task
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {task.detailedSteps.map((step, index) => (
                  <div key={step.id} className="flex gap-4 p-4 border rounded-lg">
                    <div className="flex-shrink-0 mt-1">
                      <Checkbox
                        checked={stepStates[step.id] || false}
                        onCheckedChange={() => toggleStep(step.id)}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">
                          Step {index + 1}: {step.title}
                        </h4>
                        <Badge variant="outline" className="text-xs">
                          <IconClock className="size-3 mr-1" />
                          {step.estimatedTime}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resources */}
        {task.resources.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Helpful Resources</CardTitle>
              <CardDescription>
                Tools and guides to help you complete this task
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {task.resources.map((resource, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50">
                    <IconExternalLink className="size-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{resource.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{resource.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button className="flex-1">
            <IconCheck className="size-4 mr-2" />
            Mark as Complete
          </Button>
          <Button variant="outline">
            <IconClock className="size-4 mr-2" />
            Start Timer
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}

export function TasksView() {
  const inProgressTasks = tasks.filter(task => task.status === "In Process")
  const completedTasks = tasks.filter(task => task.status === "Done")

  return (
    <div className="@container/main flex flex-1 flex-col gap-2 bg-black">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        {/* Header Cards */}
        <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-3">
          <MetricCard
            title="Total Tasks"
            value={tasks.length}
            status="Active"
            trend="up"
            icon="target"
          />
          <MetricCard
            title="In Progress"
            value={inProgressTasks.length}
            status="Processing"
            trend="neutral"
            icon="loader"
          />
          <MetricCard
            title="Completed"
            value={completedTasks.length}
            status="Done"
            trend="up"
            icon="check"
          />
        </div>

        {/* Main Table */}
        <div className="px-4 lg:px-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>AI Optimization Recommendations</CardTitle>
                  <CardDescription>
                    Manage and track your GEO optimization tasks
                  </CardDescription>
                </div>
                <Button size="sm">
                  <IconPlus className="size-4" />
                  Add Task
                </Button>
              </div>
            </CardHeader>
            <div className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="w-12">
                      <div className="flex items-center justify-center">
                        <Checkbox aria-label="Select all" />
                      </div>
                    </TableHead>
                    <TableHead>Header</TableHead>
                    <TableHead>Section Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Target</TableHead>
                    <TableHead className="text-right">Limit</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <Dialog key={task.id}>
                      <DialogTrigger asChild>
                        <TableRow className="cursor-pointer hover:bg-muted/50">
                          <TableCell>
                            <DragHandle id={task.id} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center">
                              <Checkbox aria-label="Select row" />
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {task.header}
                          </TableCell>
                          <TableCell>
                            <div className="w-32">
                              <Badge variant="outline" className="text-muted-foreground px-1.5">
                                {task.type}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-muted-foreground px-1.5">
                              {task.status === "Done" ? (
                                <IconCircleCheckFilled className="fill-green-500 dark:fill-green-400" />
                              ) : (
                                <IconLoader />
                              )}
                              {task.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Label htmlFor={`${task.id}-target`} className="sr-only">
                              Target
                            </Label>
                            <Input
                              className="hover:bg-input/30 focus-visible:bg-background dark:hover:bg-input/30 dark:focus-visible:bg-input/30 h-8 w-16 border-transparent bg-transparent text-right shadow-none focus-visible:border dark:bg-transparent"
                              defaultValue={task.target}
                              id={`${task.id}-target`}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Label htmlFor={`${task.id}-limit`} className="sr-only">
                              Limit
                            </Label>
                            <Input
                              className="hover:bg-input/30 focus-visible:bg-background dark:hover:bg-input/30 dark:focus-visible:bg-input/30 h-8 w-16 border-transparent bg-transparent text-right shadow-none focus-visible:border dark:bg-transparent"
                              defaultValue={task.limit}
                              id={`${task.id}-limit`}
                            />
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
                                <DropdownMenuItem>Edit</DropdownMenuItem>
                                <DropdownMenuItem>View Details</DropdownMenuItem>
                                <DropdownMenuItem>Duplicate</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      </DialogTrigger>
                      <TaskDetailModal task={task} />
                    </Dialog>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
} 