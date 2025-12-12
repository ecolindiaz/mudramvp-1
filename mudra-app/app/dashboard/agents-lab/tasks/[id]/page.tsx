"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  ChevronLeft,
  AlertCircle,
  Github,
  GitBranch,
  Bot,
  Home,
  User,
  Terminal,
  FileText,
  Loader2,
  XCircle,
  Linkedin,
  Calendar,
  MessageSquare,
  Sparkles,
  ExternalLink,
  ThumbsDown,
  CheckCircle,
  type LucideProps,
} from "lucide-react"
import Image from "next/image"
import { FloatingMudraButton } from "@/components/floating-mudra-button"
import { cn } from "@/lib/utils"

// Custom Reddit icon (not available in Lucide)
const RedditIcon = (props: LucideProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M14.5 17c-1.5 1-3.5 1-5 0" />
    <circle cx="8.5" cy="12" r="1.5" fill="currentColor" />
    <circle cx="15.5" cy="12" r="1.5" fill="currentColor" />
    <path d="M18 8.5c0-.8-.7-1.5-1.5-1.5s-1.5.7-1.5 1.5c0 .4.2.8.5 1" />
    <path d="M6 8.5c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5c0 .4-.2.8-.5 1" />
    <path d="M12 7V3l3 2" />
  </svg>
)

type PropertyGroup = {
  label: string
  items: {
    text: string
    icon?: React.ComponentType<{ className?: string }>
    variant?: "default" | "destructive"
  }[]
}

export default function TaskDeepViewPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const taskTitle = searchParams?.get("title") || `Task ${params?.id}`
  const taskDescription = searchParams?.get("desc") || "No description provided."
  const [showFullDescription, setShowFullDescription] = useState(false)
  const [selectedTab, setSelectedTab] = useState<"logs" | "summary">("logs")
  const [isViewAllOpen, setIsViewAllOpen] = useState(false)
  
  // Conversation Radar opportunity params
  const dbId = searchParams?.get("dbId")
  const platform = searchParams?.get("platform") as "Reddit" | "LinkedIn" | null
  const url = searchParams?.get("url") || ""
  const engagement = searchParams?.get("engagement") || ""
  const postedAt = searchParams?.get("postedAt") || ""
  const promptOrigin = searchParams?.get("promptOrigin") as "search" | "tracked" | null
  const trackedPrompt = searchParams?.get("trackedPrompt") || ""
  
  // Detect if this is a Conversation Radar opportunity
  const isOpportunity = Boolean(platform)
  
  // State for fetched opportunity data
  const [opportunityData, setOpportunityData] = useState<{
    conversationSnapshot?: string | null
    whyThisMatters?: string[] | null
    suggestedAngle?: string | null
    relevanceScore?: number | null
    isPromotionalOpportunity?: boolean | null
    promotionalReason?: string | null
  } | null>(null)
  const [isLoadingOpportunity, setIsLoadingOpportunity] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [opportunityStatus, setOpportunityStatus] = useState<'new' | 'engaged' | 'dismissed'>('new')
  
  // Handler for marking opportunity as done (engaged)
  const handleMarkAsDone = async () => {
    if (!dbId) return
    setIsUpdatingStatus(true)
    try {
      const response = await fetch('/api/conversation-radar/opportunities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: parseInt(dbId), status: 'engaged' }),
      })
      const result = await response.json()
      if (result.success) {
        setOpportunityStatus('engaged')
        // Navigate back after a short delay
        setTimeout(() => handleBack(), 500)
      }
    } catch (error) {
      console.error('Failed to mark as done:', error)
    } finally {
      setIsUpdatingStatus(false)
    }
  }
  
  // Handler for marking opportunity as not relevant (dismissed)
  const handleNotRelevant = async () => {
    if (!dbId) return
    setIsUpdatingStatus(true)
    try {
      const response = await fetch('/api/conversation-radar/opportunities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: parseInt(dbId), status: 'dismissed' }),
      })
      const result = await response.json()
      if (result.success) {
        setOpportunityStatus('dismissed')
        // Navigate back after a short delay
        setTimeout(() => handleBack(), 500)
      }
    } catch (error) {
      console.error('Failed to mark as not relevant:', error)
    } finally {
      setIsUpdatingStatus(false)
    }
  }
  
  // Fetch full opportunity data from API
  useEffect(() => {
    const fetchOpportunityData = async () => {
      if (!isOpportunity || !dbId) return
      
      setIsLoadingOpportunity(true)
      try {
        const response = await fetch(`/api/conversation-radar/opportunities?opportunityId=${dbId}`)
        const result = await response.json()
        
        if (result.success && result.data) {
          setOpportunityData({
            conversationSnapshot: result.data.conversationSnapshot,
            whyThisMatters: result.data.whyThisMatters,
            suggestedAngle: result.data.suggestedAngle,
            relevanceScore: result.data.relevanceScore,
            isPromotionalOpportunity: result.data.isPromotionalOpportunity,
            promotionalReason: result.data.promotionalReason,
          })
        }
      } catch (error) {
        console.error('Failed to fetch opportunity data:', error)
      } finally {
        setIsLoadingOpportunity(false)
      }
    }
    
    fetchOpportunityData()
  }, [isOpportunity, dbId])
  
  // Calculate age string from postedAt
  const getAgeString = (isoDate: string) => {
    if (!isoDate) return "Unknown"
    const posted = new Date(isoDate)
    const now = new Date()
    const diffMs = now.getTime() - posted.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffWeeks = Math.floor(diffDays / 7)
    const diffMonths = Math.floor(diffDays / 30)
    
    if (diffMins < 60) return `Posted ${diffMins}m ago`
    if (diffHours < 24) return `Posted ${diffHours}h ago`
    if (diffDays < 7) return `Posted ${diffDays} day${diffDays > 1 ? "s" : ""} ago`
    if (diffWeeks < 4) return `Posted ${diffWeeks} week${diffWeeks > 1 ? "s" : ""} ago`
    return `Posted ${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`
  }
  
  // Task status - will be connected to backend
  // Possible values: "queued" | "in_progress" | "completed" | "failed"
  const taskStatus: "queued" | "in_progress" | "completed" | "failed" = 
    (searchParams?.get("status") as "queued" | "in_progress" | "completed" | "failed") || "queued"
  
  // Mock data - will be replaced with backend data
  const taskLogs = taskStatus === "completed" ? [
    "[INFO] Task started at 2024-01-15 10:30:00",
    "[INFO] Initializing LLMs.txt indexer...",
    "[INFO] Connecting to repository: mudramvp",
    "[INFO] Branch: main",
    "[SUCCESS] Index file generated successfully",
    "[INFO] Task completed at 2024-01-15 10:32:15"
  ] : []
  
  // Mock AI-generated summary content - will be replaced with backend data
  // The summary will be in natural language with markdown-like formatting
  const taskSummary = taskStatus === "completed" ? {
    content: `## Task Execution Summary

Successfully generated LLMs.txt index file for repository mudramvp on branch main. The task completed without errors and all required files were processed.

### Key Achievements

• Generated comprehensive LLMs.txt index file
• Processed 12 files across the repository
• Validated all AI-facing instructions and controls
• Ensured proper formatting and structure

### Files Processed

1. **Configuration Files**
• llms.txt (main index file)
• robots.txt (crawler instructions)

2. **Documentation Files**
• README.md
• API documentation files

3. **Code Files**
• Core application files
• Utility modules

### Performance Metrics

• **Duration:** 2m 15s
• **Files Processed:** 12
• **Status:** Success
• **Error Rate:** 0%

### Next Steps

The LLMs.txt index file is now available and ready for AI crawlers to discover and process. The file includes all necessary metadata and instructions for proper AI interaction with the repository.`
  } : null

  // Opportunity content - use fetched data or fallback to reasonable defaults
  const opportunityContent = isOpportunity ? {
    conversationSnapshot: opportunityData?.conversationSnapshot || 
      (isLoadingOpportunity 
        ? "Loading conversation analysis..." 
        : taskDescription),
    whyThisMatters: opportunityData?.whyThisMatters || 
      (isLoadingOpportunity 
        ? ["Loading insights..."] 
        : [
      trackedPrompt 
              ? `This conversation relates to: "${trackedPrompt}"`
              : "This conversation is relevant to your brand.",
            "Run LLM analysis to get detailed insights.",
          ]),
    suggestedResponseAngle: opportunityData?.suggestedAngle || 
      (isLoadingOpportunity 
        ? "Analyzing conversation for response angle..." 
        : "Run LLM analysis to get a suggested response angle."),
    relevanceScore: opportunityData?.relevanceScore,
  } : null

  // Function to render markdown-like content with support for titles, bullets, numbers, and bold text
  const renderSummaryContent = (content: string) => {
    const lines = content.split('\n')
    const elements: React.ReactElement[] = []
    let listType: 'ul' | 'ol' | null = null
    let listItems: Array<{ text: string; isSubItem: boolean }> = []

    const renderBoldText = (text: string) => {
      const parts = text.split(/(\*\*[^*]+\*\*)/g)
      return parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={idx} className="font-semibold text-white">{part.slice(2, -2)}</strong>
        }
        return <span key={idx}>{part}</span>
      })
    }

    const flushList = () => {
      if (listItems.length > 0 && listType) {
        const ListComponent = listType === 'ul' ? 'ul' : 'ol'
        elements.push(
          <ListComponent key={`list-${elements.length}`} className={cn(
            "space-y-1.5 my-3 ml-4",
            listType === 'ul' ? "list-disc" : "list-decimal"
          )}>
            {listItems.map((item, idx) => {
              const itemText = item.text.replace(/^[•\-\*]\s*/, '').replace(/^\d+\.\s*/, '')
              return (
                <li key={idx} className={cn(
                  "text-sm text-white/70 leading-relaxed",
                  item.isSubItem && "ml-4 list-[circle]"
                )}>
                  {renderBoldText(itemText)}
                </li>
              )
            })}
          </ListComponent>
        )
        listItems = []
        listType = null
      }
    }

    lines.forEach((line, index) => {
      const trimmed = line.trim()
      const isIndented = line.startsWith('   ') || line.startsWith('\t')
      
      // Empty line
      if (!trimmed) {
        flushList()
        return
      }

      // H2 (##)
      if (trimmed.startsWith('## ')) {
        flushList()
        elements.push(
          <h2 key={`h2-${index}`} className="text-lg font-semibold text-white mt-6 mb-3 first:mt-0">
            {trimmed.replace(/^##\s+/, '')}
          </h2>
        )
        return
      }

      // H3 (###)
      if (trimmed.startsWith('### ')) {
        flushList()
        elements.push(
          <h3 key={`h3-${index}`} className="text-base font-semibold text-white mt-4 mb-2">
            {trimmed.replace(/^###\s+/, '')}
          </h3>
        )
        return
      }

      // Bullet point (•, -, *) - can be nested
      if (/^[•\-\*]\s/.test(trimmed)) {
        if (listType !== 'ul') {
          flushList()
          listType = 'ul'
        }
        listItems.push({ text: trimmed, isSubItem: isIndented })
        return
      }

      // Numbered list (1., 2., etc.) - can have nested bullets
      if (/^\d+\.\s/.test(trimmed)) {
        if (listType !== 'ol') {
          flushList()
          listType = 'ol'
        }
        listItems.push({ text: trimmed, isSubItem: false })
        return
      }

      // Regular paragraph
      flushList()
      elements.push(
        <p key={`p-${index}`} className="text-sm text-white/70 leading-relaxed mb-3">
          {renderBoldText(trimmed)}
        </p>
      )
    })

    flushList() // Flush any remaining list items

    return <div className="space-y-2">{elements}</div>
  }

  // Get return agent ID for back navigation
  const returnAgentId = searchParams?.get("returnAgentId")

  const handleBack = () => {
    // Navigate back to the agent detail view
    if (returnAgentId) {
      router.push(`/dashboard/agents-lab?agent=${encodeURIComponent(returnAgentId)}`)
    } else {
      // Fallback: go to agents-lab main page
      router.push("/dashboard/agents-lab")
    }
  }

  // Property groups - different for opportunities vs regular tasks
  const propertyGroups: PropertyGroup[] = isOpportunity
    ? [
        {
          label: "Platform",
          items: [
            { text: platform || "Unknown", icon: platform === "Reddit" ? RedditIcon : Linkedin },
          ],
        },
        {
          label: "Age",
          items: [
            { text: getAgeString(postedAt), icon: Calendar },
          ],
        },
        {
          label: "Engagement",
          items: [
            { text: engagement || "No engagement data", icon: MessageSquare },
          ],
        },
        {
          label: "Prompt",
          items: [
            { 
              text: promptOrigin === "tracked" ? trackedPrompt || "Tracked" : "Search", 
              icon: Sparkles 
            },
          ],
        },
      ]
    : [
        {
          label: "Properties",
          items: [
            ...(taskStatus === "failed" 
              ? [{ text: "Failed", icon: AlertCircle, variant: "destructive" as const }]
              : taskStatus === "completed"
              ? [{ text: "Completed", icon: Bot, variant: "default" as const }]
              : []
            ),
            { text: "Emiliano Rivero", icon: User },
          ],
        },
        {
          label: "Repository",
          items: [
            { text: "mudramvp", icon: Github },
            { text: "main", icon: GitBranch },
          ],
        },
        {
          label: "Agent",
          items: [{ text: "Claude Code: Sonnet 4.5", icon: Bot }],
        },
        {
          label: "Origin",
          items: [{ text: "Dashboard", icon: Home }],
        },
      ]

  const canExpandDescription = taskDescription.length > 140

  return (
    <SidebarProvider
      className="bg-dark-grey"
      style={
        {
          "--sidebar-width": "16rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <Separator className="w-full border-border" />

        <div className="flex flex-1 flex-col bg-dark-grey">
          <div className="@container/main flex flex-1 flex-col bg-dark-grey">
            {/* Page Header */}
            <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="flex items-center h-[50px]">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBack}
                      className="h-9 px-4 text-sm font-medium transition-all duration-200 bg-white/15 border-white/25 text-white hover:bg-white/20 hover:border-white/30 shadow-sm shadow-white/5 gap-2"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {isOpportunity ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleMarkAsDone}
                      disabled={isUpdatingStatus || opportunityStatus !== 'new'}
                      className="h-9 px-4 text-sm font-medium transition-all duration-200 bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20 hover:border-green-500/40 gap-2 disabled:opacity-50"
                    >
                      {isUpdatingStatus ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : opportunityStatus === 'engaged' ? (
                      <CheckCircle className="w-4 h-4" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      {opportunityStatus === 'engaged' ? 'Done!' : 'Mark as Done'}
                    </Button>
                  ) : (
                    <div className="text-right">
                      <p className="text-xs text-white/50">Task ID</p>
                      <p className="text-sm text-white/80">{params?.id}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Header Divider */}
            <div className="h-[1px] bg-white/10"></div>

            {/* No KPIs here; vertical sections connect directly below header divider */}

            {/* Bottom Section with Vertical Divisions (3 columns, 2 vertical lines) */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left Section */}
              <div className="flex-[0.62] flex flex-col border-r border-white/10">
                <div className="px-4 lg:px-6 py-6">
                  {/* Intentionally left blank for now */}
                </div>
              </div>

              {/* Middle Section */}
              <div className="flex-[1.35] flex flex-col border-r border-white/10">
                <div className="px-4 lg:px-6 py-6 space-y-6">
                  {/* Task Title and Description */}
                  <div className="space-y-1.5">
                    <div className="flex flex-col gap-3">
                      <h2 className="text-xl font-semibold tracking-tight text-white">
                        {taskTitle}
                      </h2>
                    </div>
                    <div>
                      <p
                        className={cn(
                          "text-sm text-white/60 leading-relaxed",
                          !showFullDescription && canExpandDescription && "line-clamp-3"
                        )}
                      >
                        {taskDescription}
                      </p>
                      {canExpandDescription && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowFullDescription((prev) => !prev)}
                          className="h-7 px-0 text-xs text-white/60 hover:text-white/80 mt-1.5 transition-colors"
                        >
                          {showFullDescription ? "Show less" : "Show more"}
                        </Button>
                      )}
                    </div>
                    {isOpportunity && (
                      <div className="flex flex-col gap-3 pt-3">
                        {platform && (
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-white/50 min-w-[96px] font-medium uppercase tracking-wide">Platform</span>
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white">
                              <span className="size-2 rounded-full bg-orange-400" />
                              {platform}
                            </span>
                          </div>
                        )}
                        {postedAt && (
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-white/50 min-w-[96px] font-medium uppercase tracking-wide">Age</span>
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white/80">
                              <Calendar className="w-3.5 h-3.5" />
                              {getAgeString(postedAt)}
                            </span>
                          </div>
                        )}
                        {engagement && (
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-white/50 min-w-[96px] font-medium uppercase tracking-wide">Engagement</span>
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white/80">
                              <MessageSquare className="w-3.5 h-3.5" />
                              {engagement}
                            </span>
                          </div>
                        )}
                        {promptOrigin && (
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-white/50 min-w-[96px] font-medium uppercase tracking-wide">Prompt</span>
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white/80">
                              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                              {promptOrigin === "tracked" ? (trackedPrompt || "Tracked prompt") : "Search"}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Properties Section - hide for opportunities to avoid duplication */}
                  {!isOpportunity && (
                    <div className="space-y-3.5">
                      {propertyGroups.map((group) => (
                        <div key={group.label} className="flex items-center gap-3">
                          <span className="text-xs text-white/50 min-w-[90px] font-medium uppercase tracking-wide">{group.label}</span>
                          <div className="flex items-center gap-2 flex-wrap">
                            {group.items.map((item, idx) => {
                              const Icon = item.icon
                              const isRepo = group.label === "Repository" && item.text === "mudramvp"
                              const isBranch = group.label === "Repository" && item.text === "main"
                              const isClaude = group.label === "Agent" && item.text.includes("Claude")
                              
                              // Special widget for Repository
                              if (isRepo) {
                                return (
                                  <div key={`${group.label}-${idx}`} className="flex items-center gap-2">
                                    <div className="h-8 px-3 rounded-md bg-white/5 text-white border-0 text-xs font-medium gap-1.5 flex items-center">
                                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                                      </svg>
                                      <span>{item.text}</span>
                                    </div>
                                    {group.items[idx + 1]?.text === "main" && (
                                      <span className="text-white/20">/</span>
                                    )}
                                  </div>
                                )
                              }
                              
                              // Special widget for Branch
                              if (isBranch) {
                                return (
                                  <div
                                    key={`${group.label}-${idx}`}
                                    className="h-8 px-3 gap-2 rounded-md bg-white/5 text-white border border-white/[0.08] text-xs font-medium flex items-center"
                                  >
                                    <GitBranch className="w-3.5 h-3.5 text-white/60 shrink-0" />
                                    <span>{item.text}</span>
                                  </div>
                                )
                              }
                              
                              // Default widget with special handling for Claude
                              return (
                                <div
                                  key={`${group.label}-${idx}`}
                                  className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                                    item.variant === "destructive"
                                      ? "bg-red-500/10 border border-red-500/20 text-red-300"
                                      : "bg-white/[0.02] border border-white/[0.05] text-white/70 hover:bg-white/[0.03] hover:border-white/[0.08]"
                                  )}
                                >
                                  {isClaude ? (
                                    <Image 
                                      src="/claude-ai-icon.svg" 
                                      alt="Claude" 
                                      width={14} 
                                      height={14} 
                                      className="w-3.5 h-3.5"
                                    />
                                  ) : Icon ? (
                                    <Icon className="w-3.5 h-3.5" />
                                  ) : null}
                                  <span>{item.text}</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Content separator */}
                  <div className="h-[1px] bg-white/10"></div>

                  {/* Tab Selector - Only for regular tasks */}
                  {!isOpportunity && (
                    <div className="flex items-center gap-2.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedTab("logs")}
                        className={cn(
                          "h-9 px-5 text-sm font-medium transition-all duration-200",
                          selectedTab === "logs"
                            ? "bg-white/15 border-white/25 text-white hover:bg-white/20 hover:border-white/30 shadow-sm shadow-white/5"
                            : "border-white/[0.08] bg-transparent text-white/50 hover:bg-white/5 hover:text-white/80 hover:border-white/[0.12]"
                        )}
                      >
                        Agent Logs
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedTab("summary")}
                        className={cn(
                          "h-9 px-5 text-sm font-medium transition-all duration-200",
                          selectedTab === "summary"
                            ? "bg-white/15 border-white/25 text-white hover:bg-white/20 hover:border-white/30 shadow-sm shadow-white/5"
                            : "border-white/[0.08] bg-transparent text-white/50 hover:bg-white/5 hover:text-white/80 hover:border-white/[0.12]"
                        )}
                      >
                        Agent Summary
                      </Button>
                    </div>
                  )}

                  {/* Content Container - Different for opportunities vs tasks */}
                  {isOpportunity && opportunityContent ? (
                    <div className="space-y-4">
                      {/* Relevance Score Badge + Promotional Indicator */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {opportunityContent.relevanceScore && (
                          <div className={cn(
                            "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium",
                            opportunityContent.relevanceScore >= 70 
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                              : opportunityContent.relevanceScore >= 40
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                              : "bg-white/5 border-white/10 text-white/60"
                          )}>
                            <Sparkles className="w-3.5 h-3.5" />
                            Relevance: {Math.round(opportunityContent.relevanceScore)}/100
                          </div>
                        )}
                        {/* Promotional Opportunity Badge */}
                        {opportunityData?.isPromotionalOpportunity && (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium bg-orange-500/10 border-orange-500/30 text-orange-400"
                            title={opportunityData.promotionalReason || "Good opportunity to mention your brand"}
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                            </svg>
                            Promotional Opportunity
                          </div>
                        )}
                        {isLoadingOpportunity && (
                          <div className="flex items-center gap-2 text-xs text-white/50">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Loading analysis...
                          </div>
                        )}
                      </div>
                      
                      {/* Loading State when no data yet */}
                      {isLoadingOpportunity && !opportunityContent.relevanceScore && (
                        <div className="flex items-center gap-2 text-sm text-white/50">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading AI analysis...
                        </div>
                      )}
                      
                      {/* Conversation Snapshot */}
                      <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
                        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between gap-3">
                          <h3 className="text-sm font-semibold text-white">Conversation Snapshot</h3>
                          {url ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 border-white/15 text-white hover:bg-white/10"
                              onClick={() => window.open(url, "_blank", "noopener")}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Open
                            </Button>
                          ) : null}
                        </div>
                        <div className="p-5">
                          <p className="text-sm text-white/70 leading-relaxed">
                            {opportunityContent.conversationSnapshot}
                          </p>
                        </div>
                      </div>

                      {/* Why This Matters */}
                      <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
                        <div className="px-5 py-3 border-b border-white/10">
                          <h3 className="text-sm font-semibold text-white">Why this matters</h3>
                        </div>
                        <div className="p-5">
                          <ul className="space-y-2.5">
                            {opportunityContent.whyThisMatters.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2.5 text-sm text-white/80 leading-relaxed">
                                <span className="mt-2 inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
                                <span className="flex-1">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Response Angle */}
                      <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
                        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-white">Response angle</h3>
                          {opportunityData?.isPromotionalOpportunity && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-500/10 border border-orange-500/20 text-xs text-orange-400">
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                              </svg>
                              Brand mention recommended
                            </span>
                          )}
                        </div>
                        <div className="p-5 space-y-3">
                          {opportunityData?.isPromotionalOpportunity && opportunityData?.promotionalReason && (
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                              <svg className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M12 16v-4"/>
                                <path d="M12 8h.01"/>
                              </svg>
                              <p className="text-xs text-orange-300/80 leading-relaxed">
                                <span className="font-medium text-orange-300">Why promote here:</span> {opportunityData.promotionalReason}
                              </p>
                            </div>
                          )}
                          <p className="text-sm text-white/70 leading-relaxed">
                            {opportunityContent.suggestedResponseAngle}
                          </p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleNotRelevant}
                          disabled={isUpdatingStatus || opportunityStatus !== 'new'}
                          className="h-9 px-4 border-white/15 text-white hover:bg-white/10 disabled:opacity-50"
                        >
                          {isUpdatingStatus ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                          <ThumbsDown className="w-4 h-4" />
                          )}
                          {opportunityStatus === 'dismissed' ? 'Dismissed' : 'Not Relevant'}
                        </Button>
                        <Button
                          size="sm"
                          className="h-9 flex-1 bg-white text-black hover:bg-white/90"
                          onClick={() => url && window.open(url, "_blank", "noopener")}
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open Post
                        </Button>
                      </div>
                    </div>
                  ) : (
                  <div className="rounded-xl border border-white/[0.08] bg-[#1a1a1a] overflow-hidden shadow-sm flex flex-col h-[500px]">
                    <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.01] flex-shrink-0">
                      <h3 className="text-sm font-semibold text-white">
                        {selectedTab === "logs" ? "Agent Logs" : "Agent Summary"}
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsViewAllOpen(true)}
                        className="h-7 px-3 text-xs text-white/60 hover:text-white/80 hover:bg-white/[0.05] transition-colors"
                      >
                        View all
                      </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6">
                      {taskStatus === "completed" ? (
                        // Show actual content when completed
                        <div className="rounded-lg bg-dark-grey border border-white/[0.05] w-full">
                          {selectedTab === "logs" ? (
                            // Logs Content
                            <div className="p-4 space-y-2 font-mono text-xs">
                              {taskLogs.map((log, idx) => (
                                <div key={idx} className="text-white/70 flex items-start gap-2">
                                  <span className="text-white/40 shrink-0">
                                    {log.includes("[INFO]") ? "[INFO]" : log.includes("[SUCCESS]") ? "[SUCCESS]" : ""}
                                  </span>
                                  <span>{log.replace(/\[(INFO|SUCCESS)\]\s*/, "")}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            // Summary Content - AI-generated rich text
                            <div className="p-4">
                              {taskSummary && taskSummary.content ? (
                                <div className="prose prose-invert max-w-none">
                                  {renderSummaryContent(taskSummary.content)}
                                </div>
                              ) : (
                                <p className="text-sm text-white/60">No summary available.</p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : taskStatus === "failed" ? (
                        // Failed State
                        <div className="flex flex-col items-center justify-center py-8">
                          <div className="relative w-full max-w-md bg-transparent backdrop-blur-sm rounded-xl border border-red-500/20 p-6 shadow-xl overflow-hidden">
                            {/* Title Section */}
                            <div className="text-center mb-5">
                              <div className="flex items-center justify-center mb-4">
                                <div className="flex items-center justify-center size-12 rounded-full bg-red-500/10 border border-red-500/20">
                                  <XCircle className="h-6 w-6 text-red-400" />
                                </div>
                              </div>
                              <h3 className="text-xl font-semibold text-white tracking-tight mb-2">
                                {selectedTab === "logs" ? "Task Failed" : "Task Failed"}
                              </h3>
                              <p className="text-sm text-white/60 leading-relaxed">
                                {selectedTab === "logs" 
                                  ? "The task encountered an error and could not complete successfully."
                                  : "The task failed before a summary could be generated."}
                              </p>
                            </div>
                            
                            {/* Failed Preview - Different for Logs vs Summary */}
                            <div className="mb-5">
                              {selectedTab === "logs" ? (
                                // Failed Logs - Error terminal preview
                                <div className="bg-[#1a1a1a] rounded-lg border border-red-500/20 p-4 space-y-3">
                                  {/* Terminal Header with Error Indicator */}
                                  <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
                                    <div className="flex items-center justify-center size-8 rounded bg-red-500/10 border border-red-500/20">
                                      <AlertCircle className="h-4 w-4 text-red-400" />
                                    </div>
                                    <div className="flex-1 space-y-1.5">
                                      <div className="h-1.5 bg-red-500/20 rounded-full w-2/3"></div>
                                      <div className="h-1 bg-red-500/20 rounded-full w-1/2"></div>
                                    </div>
                                  </div>
                                  
                                  {/* Error Log Lines */}
                                  <div className="space-y-2 font-mono text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="text-white/40">$</span>
                                      <div className="h-1.5 bg-white/10 rounded-full w-2/3"></div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-red-400">[ERROR]</span>
                                      <div className="h-1.5 bg-red-500/20 rounded-full w-3/4"></div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-white/40">&gt;</span>
                                      <div className="h-1.5 bg-white/10 rounded-full w-2/3"></div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-red-400">[ERROR]</span>
                                      <div className="h-1.5 bg-red-500/20 rounded-full w-5/6"></div>
                                    </div>
                                  </div>
                                  
                                  {/* Failed Status Indicator */}
                                  <div className="flex items-center gap-2 pt-3 border-t border-white/[0.06]">
                                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                                    <div className="h-1.5 bg-red-500/20 rounded-full flex-1"></div>
                                  </div>
                                </div>
                              ) : (
                                // Failed Summary - Error document preview
                                <div className="bg-[#1a1a1a] rounded-lg border border-red-500/20 p-4 space-y-3">
                                  {/* Document Header with Error Indicator */}
                                  <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
                                    <div className="flex items-center justify-center size-8 rounded bg-red-500/10 border border-red-500/20">
                                      <XCircle className="h-4 w-4 text-red-400" />
                                    </div>
                                    <div className="flex-1 space-y-1.5">
                                      <div className="h-2 bg-red-500/20 rounded-full w-3/4"></div>
                                      <div className="h-1.5 bg-red-500/20 rounded-full w-1/2"></div>
                                    </div>
                                  </div>
                                  
                                  {/* Error Message */}
                                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/[0.06]">
                                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                                    <span className="text-xs text-red-400/80 font-medium">Task failed before completion</span>
                                  </div>
                                  
                                  {/* Error Content Lines */}
                                  <div className="space-y-2">
                                    <div className="h-1.5 bg-red-500/20 rounded-full w-full"></div>
                                    <div className="h-1.5 bg-red-500/20 rounded-full w-5/6"></div>
                                    <div className="h-1.5 bg-white/10 rounded-full w-4/5"></div>
                                    <div className="h-1.5 bg-red-500/20 rounded-full w-full"></div>
                                  </div>
                                  
                                  {/* Error Stats */}
                                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/[0.06]">
                                    <div className="bg-red-500/5 rounded border border-red-500/20 p-2 space-y-1.5">
                                      <div className="h-1 bg-red-500/20 rounded-full w-1/2"></div>
                                      <div className="h-2 bg-red-500/20 rounded-full w-2/3"></div>
                                    </div>
                                    <div className="bg-white/[0.03] rounded border border-white/[0.06] p-2 space-y-1.5">
                                      <div className="h-1 bg-white/10 rounded-full w-1/2"></div>
                                      <div className="h-2 bg-white/10 rounded-full w-2/3"></div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Empty State with Animations for Queued/In Progress
                        <div className="flex flex-col items-center justify-center py-8">
                          <div className="relative w-full max-w-md bg-transparent backdrop-blur-sm rounded-xl border border-white/[0.08] p-6 shadow-xl overflow-hidden">
                            {/* Title Section */}
                            <div className="text-center mb-5">
                              <h3 className="text-xl font-semibold text-white tracking-tight mb-2">
                                {taskStatus === "in_progress" 
                                  ? (selectedTab === "logs" ? "Processing Logs..." : "Generating Summary...")
                                  : (selectedTab === "logs" ? "No Logs Available" : "No Summary Available")}
                              </h3>
                              <p className="text-sm text-white/60 leading-relaxed">
                                {taskStatus === "in_progress"
                                  ? "Task is currently running, content will appear shortly"
                                  : taskStatus === "queued"
                                  ? "Task is queued and will start soon"
                                  : selectedTab === "logs" 
                                  ? "Logs will appear here once a task starts"
                                  : "Summary will appear here once a task completes"}
                              </p>
                            </div>
                            
                            {/* Preview Section with Animations */}
                            <div className="mb-5">
                              {taskStatus === "in_progress" ? (
                                // In Progress - Active streaming animation
                                selectedTab === "logs" ? (
                                  // Logs - Streaming terminal animation
                                  <div className="bg-[#1a1a1a] rounded-lg border border-orange-500/20 p-4 space-y-3">
                                    {/* Terminal Header with Active Indicator */}
                                    <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
                                      <div className="flex items-center justify-center size-8 rounded bg-orange-500/10 border border-orange-500/20">
                                        <Loader2 className="h-4 w-4 text-orange-500 animate-spin" />
                                      </div>
                                      <div className="flex-1 space-y-1.5">
                                        <div className="h-1.5 bg-orange-500/20 rounded-full w-1/3 animate-pulse"></div>
                                        <div className="h-1 bg-orange-500/20 rounded-full w-1/4 animate-pulse"></div>
                                      </div>
                                    </div>
                                    
                                    {/* Streaming Log Lines */}
                                    <div className="space-y-2 font-mono text-xs">
                                      <div className="flex items-center gap-2">
                                        <span className="text-orange-500/60">$</span>
                                        <div className="h-1.5 bg-white/10 rounded-full w-2/3"></div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Loader2 className="w-3 h-3 text-orange-500 animate-spin shrink-0" />
                                        <div className="h-1.5 bg-orange-500/20 rounded-full w-1/2 animate-pulse"></div>
                                        <span className="text-orange-500/60 text-[10px] ml-auto">streaming...</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-white/40">&gt;</span>
                                        <div className="h-1.5 bg-white/10 rounded-full w-1/2"></div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-orange-500/60">[INFO]</span>
                                        <div className="h-1.5 bg-white/10 rounded-full w-3/4"></div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Loader2 className="w-3 h-3 text-orange-500 animate-spin shrink-0" />
                                        <div className="h-1.5 bg-orange-500/20 rounded-full w-2/3 animate-pulse"></div>
                                      </div>
                                    </div>
                                    
                                    {/* Active Progress Indicator */}
                                    <div className="flex items-center gap-2 pt-3 border-t border-white/[0.06]">
                                      <Loader2 className="w-3.5 h-3.5 text-orange-500 animate-spin" />
                                      <div className="h-1.5 bg-orange-500/20 rounded-full flex-1 relative overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/40 to-transparent rounded-full animate-pulse" style={{ animationDuration: '1.5s' }}></div>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  // Summary - Active generation animation
                                  <div className="bg-[#1a1a1a] rounded-lg border border-orange-500/20 p-4 space-y-3">
                                    {/* Document Header with Active Indicator */}
                                    <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
                                      <div className="flex items-center justify-center size-8 rounded bg-orange-500/10 border border-orange-500/20">
                                        <Loader2 className="h-4 w-4 text-orange-500 animate-spin" />
                                      </div>
                                      <div className="flex-1 space-y-1.5">
                                        <div className="h-2 bg-orange-500/20 rounded-full w-3/4 animate-pulse"></div>
                                        <div className="h-1.5 bg-orange-500/20 rounded-full w-1/2 animate-pulse"></div>
                                      </div>
                                    </div>
                                    
                                    {/* Active Generation Indicator */}
                                    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/[0.06]">
                                      <Loader2 className="w-3.5 h-3.5 text-orange-500 animate-spin" />
                                      <span className="text-xs text-orange-500/80 font-medium">Generating summary...</span>
                                      <div className="ml-auto flex gap-1">
                                        <div className="w-1 h-1 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-1 h-1 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-1 h-1 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                                      </div>
                                    </div>
                                    
                                    {/* Summary Content Lines with Active Animation */}
                                    <div className="space-y-2">
                                      <div className="h-1.5 bg-orange-500/20 rounded-full w-full animate-pulse"></div>
                                      <div className="h-1.5 bg-orange-500/20 rounded-full w-5/6 animate-pulse" style={{ animationDelay: '100ms' }}></div>
                                      <div className="h-1.5 bg-white/10 rounded-full w-4/5"></div>
                                      <div className="h-1.5 bg-orange-500/20 rounded-full w-full animate-pulse" style={{ animationDelay: '200ms' }}></div>
                                      <div className="h-1.5 bg-white/10 rounded-full w-3/4"></div>
                                    </div>
                                    
                                    {/* Summary Stats with Active Animation */}
                                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/[0.06]">
                                      <div className="bg-orange-500/5 rounded border border-orange-500/20 p-2 space-y-1.5">
                                        <div className="h-1 bg-orange-500/20 rounded-full w-1/2 animate-pulse"></div>
                                        <div className="h-2 bg-orange-500/20 rounded-full w-2/3 animate-pulse"></div>
                                      </div>
                                      <div className="bg-white/[0.03] rounded border border-white/[0.06] p-2 space-y-1.5">
                                        <div className="h-1 bg-white/10 rounded-full w-1/2"></div>
                                        <div className="h-2 bg-white/10 rounded-full w-2/3"></div>
                                      </div>
                                    </div>
                                  </div>
                                )
                              ) : selectedTab === "logs" ? (
                                // Queued - Static terminal preview
                                <div className="bg-[#1a1a1a] rounded-lg border border-white/[0.06] p-4 space-y-3">
                                  {/* Terminal Header */}
                                  <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
                                    <div className="flex items-center justify-center size-8 rounded bg-white/[0.05] border border-white/[0.08]">
                                      <Terminal className="h-4 w-4 text-white/60" />
                                    </div>
                                    <div className="flex-1 space-y-1.5">
                                      <div className="h-1.5 bg-white/10 rounded-full w-1/3"></div>
                                      <div className="h-1 bg-white/10 rounded-full w-1/4"></div>
                                    </div>
                                  </div>
                                  
                                  {/* Log Lines */}
                                  <div className="space-y-2 font-mono text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="text-white/40">$</span>
                                      <div className="h-1.5 bg-white/10 rounded-full w-2/3"></div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-white/40">&gt;</span>
                                      <div className="h-1.5 bg-white/10 rounded-full w-1/2"></div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-white/40">[INFO]</span>
                                      <div className="h-1.5 bg-white/10 rounded-full w-3/4"></div>
                                    </div>
                                  </div>
                                  
                                  {/* Queued Status Indicator */}
                                  <div className="flex items-center gap-2 pt-3 border-t border-white/[0.06]">
                                    <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"></div>
                                    <div className="h-1.5 bg-white/10 rounded-full flex-1"></div>
                                  </div>
                                </div>
                              ) : (
                                // Queued - Static summary preview
                                <div className="bg-[#1a1a1a] rounded-lg border border-white/[0.06] p-4 space-y-3">
                                  {/* Document Header */}
                                  <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
                                    <div className="flex items-center justify-center size-8 rounded bg-white/[0.05] border border-white/[0.08]">
                                      <FileText className="h-4 w-4 text-white/60" />
                                    </div>
                                    <div className="flex-1 space-y-1.5">
                                      <div className="h-2 bg-white/10 rounded-full w-3/4"></div>
                                      <div className="h-1.5 bg-white/10 rounded-full w-1/2"></div>
                                    </div>
                                  </div>
                                  
                                  {/* Summary Content Lines */}
                                  <div className="space-y-2">
                                    <div className="h-1.5 bg-white/10 rounded-full w-full"></div>
                                    <div className="h-1.5 bg-white/10 rounded-full w-5/6"></div>
                                    <div className="h-1.5 bg-white/10 rounded-full w-4/5"></div>
                                    <div className="h-1.5 bg-white/10 rounded-full w-full"></div>
                                    <div className="h-1.5 bg-white/10 rounded-full w-3/4"></div>
                                  </div>
                                  
                                  {/* Summary Stats */}
                                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/[0.06]">
                                    <div className="bg-white/[0.03] rounded border border-white/[0.06] p-2 space-y-1.5">
                                      <div className="h-1 bg-white/10 rounded-full w-1/2"></div>
                                      <div className="h-2 bg-white/10 rounded-full w-2/3"></div>
                                    </div>
                                    <div className="bg-white/[0.03] rounded border border-white/[0.06] p-2 space-y-1.5">
                                      <div className="h-1 bg-white/10 rounded-full w-1/2"></div>
                                      <div className="h-2 bg-white/10 rounded-full w-2/3"></div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  )}
                </div>
              </div>

              {/* Right Section */}
              <div className="flex-[0.62] flex flex-col">
                <div className="px-4 lg:px-6 py-6">
                  {/* Intentionally left blank for now */}
                </div>
              </div>
            </div>

            {/* Second Horizontal Divider Line - Full Width */}
            <div className="h-[1px] bg-white/10"></div>
          </div>
        </div>
      </SidebarInset>

      {/* Mudra Chat */}
      <FloatingMudraButton siteId={typeof window !== 'undefined' ? (localStorage.getItem('mudra:siteId') || '') : ''} />

      {/* View All Side Popup */}
      <Sheet open={isViewAllOpen} onOpenChange={setIsViewAllOpen}>
        <SheetContent 
          side="right" 
          className="w-full sm:max-w-2xl bg-dark-grey border-white/10 p-0 overflow-hidden flex flex-col [&>button]:text-white/60 [&>button]:hover:text-white/80 [&>button]:hover:bg-white/[0.05]"
        >
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-white/10">
            <SheetTitle className="text-xl font-semibold text-white tracking-tight">
              {selectedTab === "logs" ? "Agent Logs" : "Agent Summary"}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-6">
            {taskStatus === "completed" ? (
              // Show actual content when completed
              <div className="rounded-lg bg-dark-grey border border-white/[0.05] min-h-[800px]">
                {selectedTab === "logs" ? (
                  // Logs Content
                  <div className="p-4 space-y-2 font-mono text-xs">
                    {taskLogs.map((log, idx) => (
                      <div key={idx} className="text-white/70 flex items-start gap-2">
                        <span className="text-white/40 shrink-0">
                          {log.includes("[INFO]") ? "[INFO]" : log.includes("[SUCCESS]") ? "[SUCCESS]" : ""}
                        </span>
                        <span>{log.replace(/\[(INFO|SUCCESS)\]\s*/, "")}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  // Summary Content - AI-generated rich text
                  <div className="p-4">
                    {taskSummary && taskSummary.content ? (
                      <div className="prose prose-invert max-w-none">
                        {renderSummaryContent(taskSummary.content)}
                      </div>
                    ) : (
                      <p className="text-sm text-white/60">No summary available.</p>
                    )}
                  </div>
                )}
              </div>
            ) : taskStatus === "failed" ? (
              // Failed State
              <div className="flex flex-col items-center justify-center min-h-[800px]">
                <div className="relative w-full max-w-md bg-transparent backdrop-blur-sm rounded-xl border border-red-500/20 p-6 shadow-xl overflow-hidden">
                  {/* Title Section */}
                  <div className="text-center mb-5">
                    <div className="flex items-center justify-center mb-4">
                      <div className="flex items-center justify-center size-12 rounded-full bg-red-500/10 border border-red-500/20">
                        <XCircle className="h-6 w-6 text-red-400" />
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-white tracking-tight mb-2">
                      {selectedTab === "logs" ? "Task Failed" : "Task Failed"}
                    </h3>
                    <p className="text-sm text-white/60 leading-relaxed">
                      {selectedTab === "logs" 
                        ? "The task encountered an error and could not complete successfully."
                        : "The task failed before a summary could be generated."}
                    </p>
                  </div>
                  
                  {/* Failed Preview - Different for Logs vs Summary */}
                  <div className="mb-5">
                    {selectedTab === "logs" ? (
                      // Failed Logs - Error terminal preview
                      <div className="bg-[#1a1a1a] rounded-lg border border-red-500/20 p-4 space-y-3">
                        {/* Terminal Header with Error Indicator */}
                        <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
                          <div className="flex items-center justify-center size-8 rounded bg-red-500/10 border border-red-500/20">
                            <AlertCircle className="h-4 w-4 text-red-400" />
                          </div>
                          <div className="flex-1 space-y-1.5">
                            <div className="h-1.5 bg-red-500/20 rounded-full w-2/3"></div>
                            <div className="h-1 bg-red-500/20 rounded-full w-1/2"></div>
                          </div>
                        </div>
                        
                        {/* Error Log Lines */}
                        <div className="space-y-2 font-mono text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-white/40">$</span>
                            <div className="h-1.5 bg-white/10 rounded-full w-2/3"></div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-red-400">[ERROR]</span>
                            <div className="h-1.5 bg-red-500/20 rounded-full w-3/4"></div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-white/40">&gt;</span>
                            <div className="h-1.5 bg-white/10 rounded-full w-2/3"></div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-red-400">[ERROR]</span>
                            <div className="h-1.5 bg-red-500/20 rounded-full w-5/6"></div>
                          </div>
                        </div>
                        
                        {/* Failed Status Indicator */}
                        <div className="flex items-center gap-2 pt-3 border-t border-white/[0.06]">
                          <XCircle className="w-3.5 h-3.5 text-red-400" />
                          <div className="h-1.5 bg-red-500/20 rounded-full flex-1"></div>
                        </div>
                      </div>
                    ) : (
                      // Failed Summary - Error document preview
                      <div className="bg-[#1a1a1a] rounded-lg border border-red-500/20 p-4 space-y-3">
                        {/* Document Header with Error Indicator */}
                        <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
                          <div className="flex items-center justify-center size-8 rounded bg-red-500/10 border border-red-500/20">
                            <XCircle className="h-4 w-4 text-red-400" />
                          </div>
                          <div className="flex-1 space-y-1.5">
                            <div className="h-2 bg-red-500/20 rounded-full w-3/4"></div>
                            <div className="h-1.5 bg-red-500/20 rounded-full w-1/2"></div>
                          </div>
                        </div>
                        
                        {/* Error Message */}
                        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/[0.06]">
                          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                          <span className="text-xs text-red-400/80 font-medium">Task failed before completion</span>
                        </div>
                        
                        {/* Error Content Lines */}
                        <div className="space-y-2">
                          <div className="h-1.5 bg-red-500/20 rounded-full w-full"></div>
                          <div className="h-1.5 bg-red-500/20 rounded-full w-5/6"></div>
                          <div className="h-1.5 bg-white/10 rounded-full w-4/5"></div>
                          <div className="h-1.5 bg-red-500/20 rounded-full w-full"></div>
                        </div>
                        
                        {/* Error Stats */}
                        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/[0.06]">
                          <div className="bg-red-500/5 rounded border border-red-500/20 p-2 space-y-1.5">
                            <div className="h-1 bg-red-500/20 rounded-full w-1/2"></div>
                            <div className="h-2 bg-red-500/20 rounded-full w-2/3"></div>
                          </div>
                          <div className="bg-white/[0.03] rounded border border-white/[0.06] p-2 space-y-1.5">
                            <div className="h-1 bg-white/10 rounded-full w-1/2"></div>
                            <div className="h-2 bg-white/10 rounded-full w-2/3"></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // Empty State with Animations for Queued/In Progress
              <div className="flex flex-col items-center justify-center min-h-[800px]">
                <div className="relative w-full max-w-md bg-transparent backdrop-blur-sm rounded-xl border border-white/[0.08] p-6 shadow-xl overflow-hidden">
                  {/* Title Section */}
                  <div className="text-center mb-5">
                    <h3 className="text-xl font-semibold text-white tracking-tight mb-2">
                      {taskStatus === "in_progress" 
                        ? (selectedTab === "logs" ? "Processing Logs..." : "Generating Summary...")
                        : (selectedTab === "logs" ? "No Logs Available" : "No Summary Available")}
                    </h3>
                    <p className="text-sm text-white/60 leading-relaxed">
                      {taskStatus === "in_progress"
                        ? "Task is currently running, content will appear shortly"
                        : taskStatus === "queued"
                        ? "Task is queued and will start soon"
                        : selectedTab === "logs" 
                        ? "Logs will appear here once a task starts"
                        : "Summary will appear here once a task completes"}
                    </p>
                  </div>
                  
                  {/* Preview Section with Animations */}
                  <div className="mb-5">
                    {taskStatus === "in_progress" ? (
                      // In Progress - Active streaming animation
                      selectedTab === "logs" ? (
                        // Logs - Streaming terminal animation
                        <div className="bg-[#1a1a1a] rounded-lg border border-orange-500/20 p-4 space-y-3">
                          {/* Terminal Header with Active Indicator */}
                          <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
                            <div className="flex items-center justify-center size-8 rounded bg-orange-500/10 border border-orange-500/20">
                              <Loader2 className="h-4 w-4 text-orange-500 animate-spin" />
                            </div>
                            <div className="flex-1 space-y-1.5">
                              <div className="h-1.5 bg-orange-500/20 rounded-full w-1/3 animate-pulse"></div>
                              <div className="h-1 bg-orange-500/20 rounded-full w-1/4 animate-pulse"></div>
                            </div>
                          </div>
                          
                          {/* Streaming Log Lines */}
                          <div className="space-y-2 font-mono text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-orange-500/60">$</span>
                              <div className="h-1.5 bg-white/10 rounded-full w-2/3"></div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-3 h-3 text-orange-500 animate-spin shrink-0" />
                              <div className="h-1.5 bg-orange-500/20 rounded-full w-1/2 animate-pulse"></div>
                              <span className="text-orange-500/60 text-[10px] ml-auto">streaming...</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-white/40">&gt;</span>
                              <div className="h-1.5 bg-white/10 rounded-full w-1/2"></div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-orange-500/60">[INFO]</span>
                              <div className="h-1.5 bg-white/10 rounded-full w-3/4"></div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-3 h-3 text-orange-500 animate-spin shrink-0" />
                              <div className="h-1.5 bg-orange-500/20 rounded-full w-2/3 animate-pulse"></div>
                            </div>
                          </div>
                          
                          {/* Active Progress Indicator */}
                          <div className="flex items-center gap-2 pt-3 border-t border-white/[0.06]">
                            <Loader2 className="w-3.5 h-3.5 text-orange-500 animate-spin" />
                            <div className="h-1.5 bg-orange-500/20 rounded-full flex-1 relative overflow-hidden">
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/40 to-transparent rounded-full animate-pulse" style={{ animationDuration: '1.5s' }}></div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Summary - Active generation animation
                        <div className="bg-[#1a1a1a] rounded-lg border border-orange-500/20 p-4 space-y-3">
                          {/* Document Header with Active Indicator */}
                          <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
                            <div className="flex items-center justify-center size-8 rounded bg-orange-500/10 border border-orange-500/20">
                              <Loader2 className="h-4 w-4 text-orange-500 animate-spin" />
                            </div>
                            <div className="flex-1 space-y-1.5">
                              <div className="h-2 bg-orange-500/20 rounded-full w-3/4 animate-pulse"></div>
                              <div className="h-1.5 bg-orange-500/20 rounded-full w-1/2 animate-pulse"></div>
                            </div>
                          </div>
                          
                          {/* Active Generation Indicator */}
                          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/[0.06]">
                            <Loader2 className="w-3.5 h-3.5 text-orange-500 animate-spin" />
                            <span className="text-xs text-orange-500/80 font-medium">Generating summary...</span>
                            <div className="ml-auto flex gap-1">
                              <div className="w-1 h-1 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                              <div className="w-1 h-1 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                              <div className="w-1 h-1 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                            </div>
                          </div>
                          
                          {/* Summary Content Lines with Active Animation */}
                          <div className="space-y-2">
                            <div className="h-1.5 bg-orange-500/20 rounded-full w-full animate-pulse"></div>
                            <div className="h-1.5 bg-orange-500/20 rounded-full w-5/6 animate-pulse" style={{ animationDelay: '100ms' }}></div>
                            <div className="h-1.5 bg-white/10 rounded-full w-4/5"></div>
                            <div className="h-1.5 bg-orange-500/20 rounded-full w-full animate-pulse" style={{ animationDelay: '200ms' }}></div>
                            <div className="h-1.5 bg-white/10 rounded-full w-3/4"></div>
                          </div>
                          
                          {/* Summary Stats with Active Animation */}
                          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/[0.06]">
                            <div className="bg-orange-500/5 rounded border border-orange-500/20 p-2 space-y-1.5">
                              <div className="h-1 bg-orange-500/20 rounded-full w-1/2 animate-pulse"></div>
                              <div className="h-2 bg-orange-500/20 rounded-full w-2/3 animate-pulse"></div>
                            </div>
                            <div className="bg-white/[0.03] rounded border border-white/[0.06] p-2 space-y-1.5">
                              <div className="h-1 bg-white/10 rounded-full w-1/2"></div>
                              <div className="h-2 bg-white/10 rounded-full w-2/3"></div>
                            </div>
                          </div>
                        </div>
                      )
                    ) : selectedTab === "logs" ? (
                      // Queued - Static terminal preview
                      <div className="bg-[#1a1a1a] rounded-lg border border-white/[0.06] p-4 space-y-3">
                        {/* Terminal Header */}
                        <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
                          <div className="flex items-center justify-center size-8 rounded bg-white/[0.05] border border-white/[0.08]">
                            <Terminal className="h-4 w-4 text-white/60" />
                          </div>
                          <div className="flex-1 space-y-1.5">
                            <div className="h-1.5 bg-white/10 rounded-full w-1/3"></div>
                            <div className="h-1 bg-white/10 rounded-full w-1/4"></div>
                          </div>
                        </div>
                        
                        {/* Log Lines */}
                        <div className="space-y-2 font-mono text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-white/40">$</span>
                            <div className="h-1.5 bg-white/10 rounded-full w-2/3"></div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-white/40">&gt;</span>
                            <div className="h-1.5 bg-white/10 rounded-full w-1/2"></div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-white/40">[INFO]</span>
                            <div className="h-1.5 bg-white/10 rounded-full w-3/4"></div>
                          </div>
                        </div>
                        
                        {/* Queued Status Indicator */}
                        <div className="flex items-center gap-2 pt-3 border-t border-white/[0.06]">
                          <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"></div>
                          <div className="h-1.5 bg-white/10 rounded-full flex-1"></div>
                        </div>
                      </div>
                    ) : (
                      // Queued - Static summary preview
                      <div className="bg-[#1a1a1a] rounded-lg border border-white/[0.06] p-4 space-y-3">
                        {/* Document Header */}
                        <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
                          <div className="flex items-center justify-center size-8 rounded bg-white/[0.05] border border-white/[0.08]">
                            <FileText className="h-4 w-4 text-white/60" />
                          </div>
                          <div className="flex-1 space-y-1.5">
                            <div className="h-2 bg-white/10 rounded-full w-3/4"></div>
                            <div className="h-1.5 bg-white/10 rounded-full w-1/2"></div>
                          </div>
                        </div>
                        
                        {/* Summary Content Lines */}
                        <div className="space-y-2">
                          <div className="h-1.5 bg-white/10 rounded-full w-full"></div>
                          <div className="h-1.5 bg-white/10 rounded-full w-5/6"></div>
                          <div className="h-1.5 bg-white/10 rounded-full w-4/5"></div>
                          <div className="h-1.5 bg-white/10 rounded-full w-full"></div>
                          <div className="h-1.5 bg-white/10 rounded-full w-3/4"></div>
                        </div>
                        
                        {/* Summary Stats */}
                        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/[0.06]">
                          <div className="bg-white/[0.03] rounded border border-white/[0.06] p-2 space-y-1.5">
                            <div className="h-1 bg-white/10 rounded-full w-1/2"></div>
                            <div className="h-2 bg-white/10 rounded-full w-2/3"></div>
                          </div>
                          <div className="bg-white/[0.03] rounded border border-white/[0.06] p-2 space-y-1.5">
                            <div className="h-1 bg-white/10 rounded-full w-1/2"></div>
                            <div className="h-2 bg-white/10 rounded-full w-2/3"></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  )
}


