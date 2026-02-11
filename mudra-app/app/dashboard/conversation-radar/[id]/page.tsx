"use client"

import { Suspense, useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { BrandProfileProvider } from "@/components/brand-profile-context"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import {
  ChevronLeft,
  Calendar,
  MessageSquare,
  Sparkles,
  ExternalLink,
  ThumbsDown,
  CheckCircle,
  Loader2,
  TrendingUp,
  Globe,
  Radio,
  Hash,
  Eye,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface OpportunityData {
  id: number
  title: string
  description?: string
  url?: string
  platform: string
  postedAt?: string
  engagement?: { upvotes?: number; comments?: number }
  promptOrigin?: string
  trackedPrompt?: string
  relevanceScore?: number
  status: string
  conversationSnapshot?: string
  whyThisMatters?: string[]
  suggestedAngle?: string
  isPromotionalOpportunity?: boolean
  promotionalReason?: string
  subreddit?: string
  mode?: string
  postTitle?: string
  postBody?: string
  score?: number
  numComments?: number
  searchQuery?: string
}

function OpportunityDetailPageInner() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const opportunityId = params?.id
  
  const [opportunity, setOpportunity] = useState<OpportunityData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [currentStatus, setCurrentStatus] = useState<string>('new')
  
  // Fetch opportunity data
  useEffect(() => {
    const fetchOpportunity = async () => {
      if (!opportunityId) return
      
      setIsLoading(true)
      try {
        const response = await fetch(`/api/conversation-radar/opportunities?opportunityId=${opportunityId}`)
        const result = await response.json()
        
        if (result.success && result.data) {
          setOpportunity(result.data)
          setCurrentStatus(result.data.status || 'new')
        }
      } catch (error) {
        console.error('Failed to fetch opportunity:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchOpportunity()
  }, [opportunityId])
  
  // Mark as done (engaged)
  const handleMarkAsDone = async () => {
    if (!opportunityId) return
    setIsUpdatingStatus(true)
    try {
      const response = await fetch('/api/conversation-radar/opportunities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: parseInt(opportunityId), status: 'engaged' }),
      })
      const result = await response.json()
      if (result.success) {
        setCurrentStatus('engaged')
        setTimeout(() => router.push('/dashboard/conversation-radar'), 500)
      }
    } catch (error) {
      console.error('Failed to mark as done:', error)
    } finally {
      setIsUpdatingStatus(false)
    }
  }
  
  // Mark as not relevant (dismissed)
  const handleNotRelevant = async () => {
    if (!opportunityId) return
    setIsUpdatingStatus(true)
    try {
      const response = await fetch('/api/conversation-radar/opportunities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: parseInt(opportunityId), status: 'dismissed' }),
      })
      const result = await response.json()
      if (result.success) {
        setCurrentStatus('dismissed')
        setTimeout(() => router.push('/dashboard/conversation-radar'), 500)
      }
    } catch (error) {
      console.error('Failed to dismiss:', error)
    } finally {
      setIsUpdatingStatus(false)
    }
  }
  
  // Format relative time
  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return "Unknown"
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/dashboard/conversation-radar')}
                  className="h-9 px-4 text-sm font-medium transition-all duration-200 bg-white/15 border-white/25 text-white hover:bg-white/20 hover:border-white/30 shadow-sm shadow-white/5 gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNotRelevant}
                    disabled={isUpdatingStatus || currentStatus === 'dismissed'}
                    className="h-9 px-4 text-sm font-medium transition-all duration-200 border-white/[0.04] bg-transparent text-white/50 hover:bg-white/5 hover:text-white/80 hover:border-white/[0.12] gap-2 disabled:opacity-50"
                  >
                    <ThumbsDown className="w-4 h-4" />
                    Not Relevant
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMarkAsDone}
                    disabled={isUpdatingStatus || currentStatus === 'engaged'}
                    className="h-9 px-4 text-sm font-medium transition-all duration-200 bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20 hover:border-green-500/40 gap-2 disabled:opacity-50"
                  >
                    {isUpdatingStatus ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : currentStatus === 'engaged' ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    {currentStatus === 'engaged' ? 'Done!' : 'Mark as Done'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-[0.5px] bg-white/[0.04]"></div>

            {/* Content */}
            <div className="flex-1 px-4 lg:px-6 py-6">
              {isLoading ? (
                /* Skeleton loading state */
                <div className="max-w-4xl mx-auto space-y-5">
                  {/* Header skeleton */}
                  <div className="rounded-xl border border-white/[0.04] bg-[#161616] p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-white/[0.06] animate-pulse shrink-0" />
                      <div className="flex-1 space-y-3">
                        <div className="h-6 w-3/4 rounded bg-white/[0.06] animate-pulse" />
                        <div className="flex items-center gap-3">
                          <div className="h-4 w-20 rounded bg-white/[0.06] animate-pulse" />
                          <div className="h-4 w-24 rounded bg-white/[0.06] animate-pulse" />
                          <div className="h-5 w-16 rounded-full bg-white/[0.06] animate-pulse" />
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Metadata skeleton */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="rounded-xl border border-white/[0.04] bg-[#161616] p-4">
                        <div className="h-3 w-16 rounded bg-white/[0.06] animate-pulse mb-2" />
                        <div className="h-5 w-12 rounded bg-white/[0.06] animate-pulse" />
                      </div>
                    ))}
                  </div>
                  {/* Content skeleton */}
                  <div className="rounded-xl border border-white/[0.04] bg-[#161616] p-6 space-y-3">
                    <div className="h-4 w-40 rounded bg-white/[0.06] animate-pulse" />
                    <div className="space-y-2">
                      <div className="h-3 w-full rounded bg-white/[0.06] animate-pulse" />
                      <div className="h-3 w-5/6 rounded bg-white/[0.06] animate-pulse" />
                      <div className="h-3 w-4/6 rounded bg-white/[0.06] animate-pulse" />
                    </div>
                  </div>
                  {/* Why this matters skeleton */}
                  <div className="rounded-xl border border-white/[0.04] bg-[#161616] p-6 space-y-3">
                    <div className="h-4 w-36 rounded bg-white/[0.06] animate-pulse" />
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="size-1.5 rounded-full bg-white/[0.06] animate-pulse" />
                        <div className="h-3 w-3/4 rounded bg-white/[0.06] animate-pulse" />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="size-1.5 rounded-full bg-white/[0.06] animate-pulse" />
                        <div className="h-3 w-2/3 rounded bg-white/[0.06] animate-pulse" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : !opportunity ? (
                <div className="text-center py-20">
                  <p className="text-white/60">Opportunity not found</p>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto space-y-5">
                  {/* Header Card */}
                  <div className="rounded-xl border border-white/[0.04] bg-[#161616] p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                        <Globe className="w-5 h-5 text-white/50" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-semibold text-white mb-2 leading-snug">
                          {opportunity.postTitle || opportunity.title}
                        </h1>
                        <div className="flex items-center gap-3 text-sm text-white/50 flex-wrap">
                          {opportunity.subreddit && (
                            <span className="flex items-center gap-1.5 text-white/60">
                              <Hash className="w-3.5 h-3.5" />
                              r/{opportunity.subreddit}
                            </span>
                          )}
                          {opportunity.postedAt && (
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatRelativeTime(opportunity.postedAt)}
                            </span>
                          )}
                          {opportunity.mode && (
                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.05] text-xs text-white/50">
                              <Radio className="w-3 h-3" />
                              {opportunity.mode === 'cited' ? 'Cited' : 'Proactive'}
                            </span>
                          )}
                          {typeof opportunity.relevanceScore === 'number' && (
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-xs font-medium",
                              opportunity.relevanceScore >= 80
                                ? "bg-emerald-500/10 text-emerald-400"
                                : opportunity.relevanceScore >= 70
                                  ? "bg-amber-500/10 text-amber-400"
                                  : "bg-white/5 text-white/40"
                            )}>
                              {opportunity.relevanceScore}% match
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {opportunity.engagement?.upvotes !== undefined && (
                      <div className="rounded-xl border border-white/[0.04] bg-[#161616] p-4">
                        <div className="flex items-center gap-1.5 mb-1">
                          <TrendingUp className="w-3.5 h-3.5 text-white/40" />
                          <span className="text-xs text-white/40">Upvotes</span>
                        </div>
                        <span className="text-lg font-medium text-white tabular-nums">{opportunity.engagement.upvotes}</span>
                      </div>
                    )}
                    {opportunity.engagement?.comments !== undefined && (
                      <div className="rounded-xl border border-white/[0.04] bg-[#161616] p-4">
                        <div className="flex items-center gap-1.5 mb-1">
                          <MessageSquare className="w-3.5 h-3.5 text-white/40" />
                          <span className="text-xs text-white/40">Comments</span>
                        </div>
                        <span className="text-lg font-medium text-white tabular-nums">{opportunity.engagement.comments}</span>
                      </div>
                    )}
                    {typeof opportunity.relevanceScore === 'number' && (
                      <div className="rounded-xl border border-white/[0.04] bg-[#161616] p-4">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Eye className="w-3.5 h-3.5 text-white/40" />
                          <span className="text-xs text-white/40">Relevance</span>
                        </div>
                        <span className={cn(
                          "text-lg font-medium tabular-nums",
                          opportunity.relevanceScore >= 80 ? "text-emerald-400" :
                          opportunity.relevanceScore >= 70 ? "text-amber-400" : "text-white/60"
                        )}>{opportunity.relevanceScore}%</span>
                      </div>
                    )}
                    {opportunity.url && (
                      <button
                        onClick={() => window.open(opportunity.url, '_blank', 'noopener')}
                        className="rounded-xl border border-white/[0.04] bg-[#161616] p-4 text-left hover:bg-white/[0.03] transition-colors"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <ExternalLink className="w-3.5 h-3.5 text-white/40" />
                          <span className="text-xs text-white/40">Source</span>
                        </div>
                        <span className="text-sm font-medium text-white/70">View Thread</span>
                      </button>
                    )}
                  </div>

                  {/* Tracked Prompt / Search Query */}
                  {(opportunity.trackedPrompt || opportunity.searchQuery) && (
                    <div className="rounded-xl border border-white/[0.04] bg-[#161616] p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <h2 className="text-sm font-medium text-white">
                          {opportunity.trackedPrompt ? 'Tracked Prompt' : 'Search Query'}
                        </h2>
                      </div>
                      <p className="text-sm text-white/70 leading-relaxed">
                        {opportunity.trackedPrompt || opportunity.searchQuery}
                      </p>
                    </div>
                  )}

                  {/* Conversation Summary */}
                  {opportunity.conversationSnapshot && (
                    <div className="rounded-xl border border-white/[0.04] bg-[#161616] p-5">
                      <h2 className="text-sm font-medium text-white mb-3">Conversation Summary</h2>
                      <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                        {opportunity.conversationSnapshot}
                      </p>
                    </div>
                  )}

                  {/* Original Post Body (if no snapshot) */}
                  {!opportunity.conversationSnapshot && opportunity.postBody && (
                    <div className="rounded-xl border border-white/[0.04] bg-[#161616] p-5">
                      <h2 className="text-sm font-medium text-white mb-3">Post Content</h2>
                      <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap line-clamp-[12]">
                        {opportunity.postBody}
                      </p>
                    </div>
                  )}

                  {/* Why This Matters */}
                  {opportunity.whyThisMatters && opportunity.whyThisMatters.length > 0 && (
                    <div className="rounded-xl border border-white/[0.04] bg-[#161616] p-5">
                      <h2 className="text-sm font-medium text-white mb-3">Why This Matters</h2>
                      <ul className="space-y-2.5">
                        {opportunity.whyThisMatters.map((reason, idx) => (
                          <li key={idx} className="text-sm text-white/70 flex items-start gap-2.5 leading-relaxed">
                            <span className="text-white/30 mt-0.5 shrink-0">-</span>
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Suggested Angle */}
                  {opportunity.suggestedAngle && (
                    <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.03] p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <h2 className="text-sm font-medium text-emerald-400">Suggested Response Angle</h2>
                      </div>
                      <p className="text-sm text-white/70 leading-relaxed">{opportunity.suggestedAngle}</p>
                    </div>
                  )}

                  {/* Promotional Warning */}
                  {opportunity.isPromotionalOpportunity && (
                    <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.03] p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <h2 className="text-sm font-medium text-amber-400">Promotional Opportunity</h2>
                      </div>
                      <p className="text-sm text-white/60 leading-relaxed">
                        {opportunity.promotionalReason || "This appears to be a promotional opportunity. Engage carefully to avoid appearing spammy."}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function OpportunityDetailPage() {
  return (
    <BrandProfileProvider>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
        <OpportunityDetailPageInner />
      </Suspense>
    </BrandProfileProvider>
  )
}
