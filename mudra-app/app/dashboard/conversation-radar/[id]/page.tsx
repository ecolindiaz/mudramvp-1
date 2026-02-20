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
  ExternalLink,
  ThumbsDown,
  CheckCircle,
  Loader2,
  TrendingUp,
  Radio,
  Hash,
  Eye,
  AlertTriangle,
  CircleDot,
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
                  className="h-9 px-4 text-sm font-medium transition-all duration-200 bg-white/5 border-0 text-white hover:bg-white/10 gap-2"
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
                    className="h-9 px-4 text-sm font-medium transition-all duration-200 border-0 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80 gap-2 disabled:opacity-50"
                  >
                    <ThumbsDown className="w-4 h-4" />
                    Not Relevant
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMarkAsDone}
                    disabled={isUpdatingStatus || currentStatus === 'engaged'}
                    className="h-9 px-4 text-sm font-medium transition-all duration-200 bg-emerald-500/10 border-0 text-emerald-400 hover:bg-emerald-500/20 gap-2 disabled:opacity-50"
                  >
                    {isUpdatingStatus ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
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
                <div className="max-w-4xl mx-auto space-y-8">
                  <div className="space-y-3">
                    <div className="h-8 w-3/4 rounded bg-white/[0.06] animate-pulse" />
                    <div className="flex items-center gap-3">
                      <div className="h-5 w-24 rounded-md bg-white/[0.06] animate-pulse" />
                      <div className="h-5 w-20 rounded-md bg-white/[0.06] animate-pulse" />
                      <div className="h-5 w-16 rounded-md bg-white/[0.06] animate-pulse" />
                    </div>
                  </div>
                  <div className="flex items-center gap-6 py-4 border-y border-white/[0.06]">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="h-3 w-16 rounded bg-white/[0.06] animate-pulse" />
                        <div className="h-5 w-10 rounded bg-white/[0.06] animate-pulse" />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-3 pb-6 border-b border-white/[0.06]">
                      <div className="h-5 w-40 rounded bg-white/[0.06] animate-pulse" />
                      <div className="h-3 w-full rounded bg-white/[0.06] animate-pulse" />
                      <div className="h-3 w-5/6 rounded bg-white/[0.06] animate-pulse" />
                    </div>
                    <div className="space-y-3 pb-6 border-b border-white/[0.06]">
                      <div className="h-5 w-36 rounded bg-white/[0.06] animate-pulse" />
                      <div className="h-3 w-full rounded bg-white/[0.06] animate-pulse" />
                      <div className="h-3 w-4/6 rounded bg-white/[0.06] animate-pulse" />
                    </div>
                  </div>
                </div>
              ) : !opportunity ? (
                <div className="text-center py-20">
                  <p className="text-white/60">Opportunity not found</p>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto">
                  {/* Title */}
                  <h1 className="text-2xl font-bold text-white leading-snug tracking-tight">
                    {opportunity.postTitle || opportunity.title}
                  </h1>

                  {/* Metadata pills */}
                  <div className="flex items-center gap-2 flex-wrap mt-3">
                    {opportunity.subreddit && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-white/[0.06] text-xs text-white/60">
                        <Hash className="w-3 h-3" />
                        r/{opportunity.subreddit}
                      </span>
                    )}
                    {opportunity.postedAt && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-white/[0.06] text-xs text-white/50">
                        <Calendar className="w-3 h-3" />
                        {formatRelativeTime(opportunity.postedAt)}
                      </span>
                    )}
                    {opportunity.mode && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-white/[0.06] text-xs text-white/50">
                        <Radio className="w-3 h-3" />
                        {opportunity.mode === 'cited' ? 'Cited' : 'Proactive'}
                      </span>
                    )}
                    {typeof opportunity.relevanceScore === 'number' && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md border border-white/[0.06] text-xs font-medium text-white/60">
                        {opportunity.relevanceScore}% match
                      </span>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="h-[0.5px] bg-white/[0.04] mt-6" />

                  {/* Stats row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                    {opportunity.engagement?.upvotes !== undefined && (
                      <div className="rounded-lg bg-[#1b1b1b] p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <TrendingUp className="w-3.5 h-3.5 text-white/40" />
                          <span className="text-xs text-white/40">Upvotes</span>
                        </div>
                        <span className="text-xl font-medium text-white tabular-nums">{opportunity.engagement.upvotes}</span>
                      </div>
                    )}
                    {opportunity.engagement?.comments !== undefined && (
                      <div className="rounded-lg bg-[#1b1b1b] p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <MessageSquare className="w-3.5 h-3.5 text-white/40" />
                          <span className="text-xs text-white/40">Comments</span>
                        </div>
                        <span className="text-xl font-medium text-white tabular-nums">{opportunity.engagement.comments}</span>
                      </div>
                    )}
                    {typeof opportunity.relevanceScore === 'number' && (
                      <div className="rounded-lg bg-[#1b1b1b] p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Eye className="w-3.5 h-3.5 text-white/40" />
                          <span className="text-xs text-white/40">Relevance</span>
                        </div>
                        <span className="text-xl font-medium text-white tabular-nums">{opportunity.relevanceScore}%</span>
                      </div>
                    )}
                    {opportunity.url && (
                      <button
                        onClick={() => window.open(opportunity.url, '_blank', 'noopener')}
                        className="rounded-lg bg-[#1b1b1b] p-3 text-left hover:bg-white/[0.06] transition-colors"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <ExternalLink className="w-3.5 h-3.5 text-white/40" />
                          <span className="text-xs text-white/40">Source</span>
                        </div>
                        <span className="text-sm font-medium text-white/70">View Thread &rarr;</span>
                      </button>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="h-[0.5px] bg-white/[0.04] mt-5" />

                  {/* Sections */}
                  <div className="mt-6 space-y-8">
                    {/* Tracked Prompt / Search Query */}
                    {(opportunity.trackedPrompt || opportunity.searchQuery) && (
                      <details open className="group">
                        <summary className="flex items-center gap-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                          <span className="text-white/30 text-xs transition-transform group-open:rotate-90">&#9654;</span>
                          <h2 className="text-base font-semibold text-white">
                            {opportunity.trackedPrompt ? 'Tracked Prompt' : 'Search Query'}
                          </h2>
                        </summary>
                        <div className="mt-4 pl-5">
                          <p className="text-sm text-white/60 leading-relaxed">
                            {opportunity.trackedPrompt || opportunity.searchQuery}
                          </p>
                        </div>
                      </details>
                    )}

                    {/* Conversation Summary */}
                    {opportunity.conversationSnapshot && (
                      <details open className="group">
                        <summary className="flex items-center gap-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                          <span className="text-white/30 text-xs transition-transform group-open:rotate-90">&#9654;</span>
                          <h2 className="text-base font-semibold text-white">Conversation Summary</h2>
                        </summary>
                        <div className="mt-4 pl-5">
                          <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">
                            {opportunity.conversationSnapshot}
                          </p>
                        </div>
                      </details>
                    )}

                    {/* Original Post Body (if no snapshot) */}
                    {!opportunity.conversationSnapshot && opportunity.postBody && (
                      <details open className="group">
                        <summary className="flex items-center gap-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                          <span className="text-white/30 text-xs transition-transform group-open:rotate-90">&#9654;</span>
                          <h2 className="text-base font-semibold text-white">Post Content</h2>
                        </summary>
                        <div className="mt-4 pl-5">
                          <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap line-clamp-[12]">
                            {opportunity.postBody}
                          </p>
                        </div>
                      </details>
                    )}

                    {/* Why This Matters */}
                    {opportunity.whyThisMatters && opportunity.whyThisMatters.length > 0 && (
                      <details open className="group">
                        <summary className="flex items-center gap-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                          <span className="text-white/30 text-xs transition-transform group-open:rotate-90">&#9654;</span>
                          <h2 className="text-base font-semibold text-white">Why This Matters</h2>
                        </summary>
                        <div className="mt-4 pl-5 space-y-0">
                          {opportunity.whyThisMatters.map((reason, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                "flex items-start gap-3 py-3",
                                idx < opportunity.whyThisMatters!.length - 1 && "border-b border-white/[0.06]"
                              )}
                            >
                              <CircleDot className="w-4 h-4 text-white/20 mt-0.5 shrink-0" />
                              <span className="text-sm text-white/60 leading-relaxed">{reason}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    {/* Suggested Angle */}
                    {opportunity.suggestedAngle && (
                      <details open className="group">
                        <summary className="flex items-center gap-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                          <span className="text-white/30 text-xs transition-transform group-open:rotate-90">&#9654;</span>
                          <h2 className="text-base font-semibold text-white">Suggested Response Angle</h2>
                        </summary>
                        <div className="mt-4 pl-5">
                          <p className="text-sm text-white/60 leading-relaxed">{opportunity.suggestedAngle}</p>
                        </div>
                      </details>
                    )}

                    {/* Promotional Warning */}
                    {opportunity.isPromotionalOpportunity && (
                      <details open className="group">
                        <summary className="flex items-center gap-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                          <span className="text-white/30 text-xs transition-transform group-open:rotate-90">&#9654;</span>
                          <h2 className="text-base font-semibold text-white">Promotional Opportunity</h2>
                        </summary>
                        <div className="mt-4 pl-5">
                          <p className="text-sm text-white/60 leading-relaxed">
                            {opportunity.promotionalReason || "This appears to be a promotional opportunity. Engage carefully to avoid appearing spammy."}
                          </p>
                        </div>
                      </details>
                    )}
                  </div>
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
