"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Search, Clock, Radio, ChevronRight, BookOpen, MoreHorizontal, Sparkles, type LucideProps, MessageSquare, ExternalLink, TrendingUp, Users } from "lucide-react"
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card"
import { BrandProfileProvider, useBrandProfile } from "@/components/brand-profile-context"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

const RedditIcon = (props: LucideProps) => (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="9" cy="12" r="1" />
    <circle cx="15" cy="12" r="1" />
    <path d="M7.5 13.5c.8 1 2.3 1.7 4.5 1.7s3.7-.7 4.5-1.7" />
    <path d="M14.5 7.5 15 4.5l2.5.6" />
  </svg>
)

interface Opportunity {
  id: string
  dbId?: number
  title: string
  description: string
  impact: "High" | "Medium" | "Low"
  status: "queued" | "running" | "completed" | "failed"
  lastActivity: Date
  url?: string
  platform: "Reddit"
  postedAt?: Date
  engagement?: { upvotes?: number; comments?: number }
  promptOrigin?: "search" | "tracked"
  trackedPrompt?: string
  relevanceScore?: number
}

function ConversationRadarPageInner() {
  const { profile } = useBrandProfile()
  const router = useRouter()
  
  // State
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [stats, setStats] = useState<{ total: number; new: number } | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [viewFilter, setViewFilter] = useState<"active" | "all">("active")
  const [isMounted, setIsMounted] = useState(false)
  
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Calculate active opportunities count (70%+ relevance)
  const activeOpportunitiesCount = opportunities.filter((o) => {
    const isActive = o.status === "queued" || o.status === "running"
    const scoreOk = typeof o.relevanceScore === "number" && o.relevanceScore >= 70
    return isActive && scoreOk
  }).length

  // Fetch opportunities
  const fetchOpportunities = async () => {
    if (!profile.id) return
    
    setIsLoading(true)
    try {
      const response = await fetch(`/api/conversation-radar/opportunities?brandProfileId=${profile.id}&status=all&limit=50`)
      const result = await response.json()
      
      if (result.success && result.data) {
        const mapped: Opportunity[] = result.data.map((opp: any) => ({
          id: opp.id,
          dbId: opp.dbId,
          title: opp.title,
          description: opp.description || 'Conversation opportunity',
          impact: opp.impact || 'Medium',
          status: opp.status,
          lastActivity: new Date(opp.lastActivity),
          url: opp.url,
          platform: 'Reddit' as const,
          postedAt: opp.postedAt ? new Date(opp.postedAt) : undefined,
          engagement: opp.engagement,
          promptOrigin: opp.promptOrigin as "search" | "tracked",
          trackedPrompt: opp.trackedPrompt,
          relevanceScore: opp.relevanceScore,
        }))
        setOpportunities(mapped)
      }
      
      // Fetch stats
      const statsResponse = await fetch(`/api/conversation-radar/run?brandProfileId=${profile.id}`)
      const statsResult = await statsResponse.json()
      
      if (statsResult.success && statsResult.data) {
        setStats({
          total: statsResult.data.counts.total,
          new: statsResult.data.counts.new,
        })
      }
    } catch (error) {
      console.error('Error fetching opportunities:', error)
    } finally {
      setIsLoading(false)
      setIsInitialLoad(false)
    }
  }

  // Fetch on mount
  useEffect(() => {
    if (profile.id) {
      fetchOpportunities()
    }
  }, [profile.id])

  // Run radar search
  const runRadarSearch = async () => {
    if (isLoading || !profile.id) return
    
    setIsLoading(true)
    try {
      console.log('🔄 Running Conversation Radar search...')
      const response = await fetch('/api/conversation-radar/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandProfileId: profile.id,
          mode: 'proactive',
          analyze: true,
          analyzeLimit: 15,
        }),
      })
      const result = await response.json()
      console.log('📊 Radar run result:', result)
      await fetchOpportunities()
    } catch (error) {
      console.error('❌ Error running radar:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Filter opportunities
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredOpportunities = (viewFilter === "active" 
    ? opportunities.filter((o) => {
        const isActive = o.status === "queued" || o.status === "running"
        return isActive && typeof o.relevanceScore === "number" && o.relevanceScore >= 70
      }) 
    : opportunities
  ).filter((o) => {
    if (!normalizedQuery) return true
    return (
      o.title.toLowerCase().includes(normalizedQuery) ||
      o.description.toLowerCase().includes(normalizedQuery)
    )
  })

  // Format relative time
  const formatRelativeTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  // Status badge
  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      queued: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'New' },
      running: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'In Progress' },
      completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Completed' },
      failed: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Failed' },
    }
    const c = config[status] || config.queued
    return (
      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", c.bg, c.text)}>
        {c.label}
      </span>
    )
  }

  // Metric cards for Conversation Radar
  const metricCards = [
    {
      title: "Active Opportunities",
      value: activeOpportunitiesCount,
      delta: 0,
      lastValue: 0,
      positive: true,
      accentColor: "rgba(251, 191, 36, 0.9)",
      info: "Conversations you can engage with right now. Counts Reddit opportunities with 70%+ relevance score.",
      icon: Radio,
    },
    {
      title: "Total Discovered",
      value: opportunities.length,
      delta: 0,
      lastValue: 0,
      positive: true,
      accentColor: "rgba(167, 139, 250, 0.9)",
      info: "Total conversation opportunities found by the radar.",
      icon: MessageSquare,
    },
    {
      title: "High Relevance",
      value: opportunities.filter(o => (o.relevanceScore || 0) >= 80).length,
      delta: 0,
      lastValue: 0,
      positive: true,
      accentColor: "rgba(52, 211, 153, 0.9)",
      info: "Opportunities with 80%+ relevance score - highest priority.",
      icon: TrendingUp,
    },
  ]

  if (!isMounted) {
    return null
  }

  return (
    <SidebarProvider
      className="bg-dark-grey"
      style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
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
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">Conversation Radar</h1>
                  <p className="text-muted-foreground">Find and engage with conversations about your brand</p>
                </div>
                
                {/* Right side - buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={runRadarSearch}
                    disabled={isLoading}
                    className="h-8 px-3 rounded-md bg-white text-black hover:bg-white/90 text-xs font-medium shadow-sm hover:shadow transition-shadow gap-1.5"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5" />
                        Run Radar
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => window.open("https://docs.trymudra.com/agentic-features/conversation-radar", "_blank", "noopener")}
                    className="h-8 px-3 rounded-md bg-white/5 text-white hover:bg-white/10 border-0 text-xs font-medium gap-1.5"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Documentation
                  </Button>
                </div>
              </div>
            </div>

            {/* Header Divider */}
            <div className="h-[0.5px] bg-white/[0.04]"></div>

            {/* Metrics Section */}
            <div className="py-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 px-4 lg:px-6">
                {metricCards.map((card) => (
                  <DashboardStatCard
                    key={card.title}
                    title={card.title}
                    value={card.value}
                    delta={card.delta}
                    lastValue={card.lastValue}
                    positive={card.positive}
                    accentColor={card.accentColor}
                    info={card.info}
                    icon={card.icon}
                    sparkline={[]}
                  />
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="h-[0.5px] bg-white/[0.04]"></div>

            {/* Main Content */}
            <div className="flex-1 px-4 lg:px-6 py-6">
              {/* Toolbar */}
              <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewFilter("active")}
                    className={cn(
                      "h-9 px-5 text-sm font-medium transition-all duration-200",
                      viewFilter === "active"
                        ? "bg-white/15 border-white/25 text-white hover:bg-white/20 hover:border-white/30 shadow-sm shadow-white/5"
                        : "border-white/[0.04] bg-transparent text-white/50 hover:bg-white/5 hover:text-white/80 hover:border-white/[0.12]"
                    )}
                  >
                    Active Opportunities
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewFilter("all")}
                    className={cn(
                      "h-9 px-5 text-sm font-medium transition-all duration-200",
                      viewFilter === "all"
                        ? "bg-white/15 border-white/25 text-white hover:bg-white/20 hover:border-white/30 shadow-sm shadow-white/5"
                        : "border-white/[0.04] bg-transparent text-white/50 hover:bg-white/5 hover:text-white/80 hover:border-white/[0.12]"
                    )}
                  >
                    All Opportunities
                  </Button>
                </div>
                
                <div className="relative w-full max-w-[240px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/50" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search opportunities..."
                    className="h-9 rounded-full !bg-[#161616] border border-white/[0.04] text-xs text-white/80 placeholder:text-white/50 pl-8 pr-3 focus-visible:ring-0 focus-visible:border-white/20 focus-visible:!bg-[#161616]"
                  />
                </div>
              </div>

              {/* Opportunities List */}
              {isInitialLoad ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-white/40" />
                </div>
              ) : filteredOpportunities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6">
                  <div className="flex flex-col items-center max-w-md text-center w-full">
                    {/* Dashboard Preview Card */}
                    <div className="relative w-full max-w-md bg-transparent backdrop-blur-sm rounded-xl border border-white/[0.08] p-6 shadow-xl overflow-hidden group">
                      {/* Title Section */}
                      <div className="text-center mb-5">
                        <h3 className="text-xl font-semibold text-white tracking-tight mb-2">
                          {viewFilter === "active" ? "No Active Opportunities" : "No Opportunities Found"}
                        </h3>
                        <p className="text-sm text-white/60 leading-relaxed">
                          {viewFilter === "active"
                            ? "Run the radar to discover conversations about your brand"
                            : "Click 'Run Radar' to search for conversations"}
                        </p>
                      </div>

                      {/* Dashboard Preview */}
                      <div className="mb-5">
                        {/* Header Section */}
                        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/[0.06]">
                          <div className="flex items-center justify-center size-10 rounded-lg bg-white/[0.05] border border-white/[0.08] flex-shrink-0">
                            <Radio className="h-5 w-5 text-orange-500" />
                          </div>
                          <div className="flex-1 space-y-1.5">
                            <div className="h-2 bg-white/10 rounded-full w-3/4"></div>
                            <div className="h-1.5 bg-white/10 rounded-full w-1/2"></div>
                          </div>
                        </div>

                        {/* Dashboard Grid */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          {/* Stat Card 1 */}
                          <div className="bg-white/[0.03] rounded-lg border border-white/[0.06] p-3 space-y-2">
                            <div className="h-1.5 bg-white/10 rounded-full w-2/3"></div>
                            <div className="h-3 bg-white/10 rounded-full w-1/2"></div>
                            <div className="h-1 bg-white/10 rounded-full w-full"></div>
                          </div>

                          {/* Stat Card 2 */}
                          <div className="bg-white/[0.03] rounded-lg border border-white/[0.06] p-3 space-y-2">
                            <div className="h-1.5 bg-white/10 rounded-full w-2/3"></div>
                            <div className="h-3 bg-white/10 rounded-full w-1/2"></div>
                            <div className="h-1 bg-white/10 rounded-full w-full"></div>
                          </div>
                        </div>

                        {/* Status Bar */}
                        <div className="flex items-center gap-2 pt-3 border-t border-white/[0.06]">
                          <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                          <div className="h-1.5 bg-white/10 rounded-full flex-1"></div>
                          <div className="h-2 w-12 bg-white/10 rounded"></div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <Button
                        onClick={runRadarSearch}
                        disabled={isLoading}
                        size="sm"
                        className="w-full h-9 px-5 rounded-md bg-white text-[#0a0a0a] hover:bg-white/90 hover:text-[#0a0a0a] text-sm font-medium gap-2 transition-all shadow-sm hover:shadow-md border-0 disabled:opacity-50"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Running Radar...
                          </>
                        ) : (
                          <>
                            <Radio className="h-4 w-4" />
                            Run Radar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredOpportunities.map((opportunity) => (
                    <Link
                      key={opportunity.id}
                      href={`/dashboard/conversation-radar/${opportunity.dbId || opportunity.id}`}
                      className="block"
                    >
                      <Card className="bg-[#161616] border-white/[0.04] hover:border-white/[0.12] transition-all cursor-pointer group">
                        <CardContent className="p-4">
                          {/* Header */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                                <RedditIcon className="w-4 h-4 text-orange-400" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-sm font-medium text-white truncate group-hover:text-white/90">
                                  {opportunity.title}
                                </h3>
                                <p className="text-xs text-white/50">
                                  {opportunity.postedAt ? formatRelativeTime(opportunity.postedAt) : 'Reddit'}
                                </p>
                              </div>
                            </div>
                            {getStatusBadge(opportunity.status)}
                          </div>
                          
                          {/* Description */}
                          <p className="text-xs text-white/60 line-clamp-2 mb-3">
                            {opportunity.description}
                          </p>
                          
                          {/* Footer */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-xs text-white/40">
                              {opportunity.engagement?.upvotes !== undefined && (
                                <span className="flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3" />
                                  {opportunity.engagement.upvotes}
                                </span>
                              )}
                              {opportunity.engagement?.comments !== undefined && (
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" />
                                  {opportunity.engagement.comments}
                                </span>
                              )}
                            </div>
                            {typeof opportunity.relevanceScore === 'number' && (
                              <div className={cn(
                                "text-[10px] font-medium px-2 py-0.5 rounded-full",
                                opportunity.relevanceScore >= 80 
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : opportunity.relevanceScore >= 70 
                                    ? "bg-amber-500/10 text-amber-400"
                                    : "bg-white/5 text-white/40"
                              )}>
                                {opportunity.relevanceScore}% match
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function ConversationRadarPage() {
  return (
    <BrandProfileProvider>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
        <ConversationRadarPageInner />
      </Suspense>
    </BrandProfileProvider>
  )
}
