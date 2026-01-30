"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
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
  type LucideProps,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Custom Reddit icon
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
}

export default function OpportunityDetailPage() {
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
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-white/40" />
                </div>
              ) : !opportunity ? (
                <div className="text-center py-20">
                  <p className="text-white/60">Opportunity not found</p>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto space-y-6">
                  {/* Header Card */}
                  <div className="rounded-xl border border-white/[0.04] bg-[#161616] p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                        <RedditIcon className="w-6 h-6 text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-semibold text-white mb-2">
                          {opportunity.title}
                        </h1>
                        <div className="flex items-center gap-4 text-sm text-white/50 flex-wrap">
                          {opportunity.postedAt && (
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-4 h-4" />
                              {formatRelativeTime(opportunity.postedAt)}
                            </span>
                          )}
                          {opportunity.engagement && (
                            <>
                              {opportunity.engagement.upvotes !== undefined && (
                                <span className="flex items-center gap-1.5">
                                  <TrendingUp className="w-4 h-4" />
                                  {opportunity.engagement.upvotes} upvotes
                                </span>
                              )}
                              {opportunity.engagement.comments !== undefined && (
                                <span className="flex items-center gap-1.5">
                                  <MessageSquare className="w-4 h-4" />
                                  {opportunity.engagement.comments} comments
                                </span>
                              )}
                            </>
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
                        
                        {opportunity.url && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-4 gap-2"
                            onClick={() => window.open(opportunity.url, '_blank', 'noopener')}
                          >
                            <ExternalLink className="w-4 h-4" />
                            View on Reddit
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Tracked Prompt */}
                  {opportunity.trackedPrompt && (
                    <div className="rounded-xl border border-white/[0.04] bg-[#161616] p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <h2 className="text-sm font-semibold text-white">Tracked Prompt</h2>
                      </div>
                      <p className="text-sm text-white/70">{opportunity.trackedPrompt}</p>
                    </div>
                  )}
                  
                  {/* Conversation Snapshot */}
                  {opportunity.conversationSnapshot && (
                    <div className="rounded-xl border border-white/[0.04] bg-[#161616] p-6">
                      <h2 className="text-sm font-semibold text-white mb-3">Conversation Summary</h2>
                      <p className="text-sm text-white/70 whitespace-pre-wrap">
                        {opportunity.conversationSnapshot}
                      </p>
                    </div>
                  )}
                  
                  {/* Why This Matters */}
                  {opportunity.whyThisMatters && opportunity.whyThisMatters.length > 0 && (
                    <div className="rounded-xl border border-white/[0.04] bg-[#161616] p-6">
                      <h2 className="text-sm font-semibold text-white mb-3">Why This Matters</h2>
                      <ul className="space-y-2">
                        {opportunity.whyThisMatters.map((reason, idx) => (
                          <li key={idx} className="text-sm text-white/70 flex items-start gap-2">
                            <span className="text-amber-400 mt-1">•</span>
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Suggested Angle */}
                  {opportunity.suggestedAngle && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
                      <h2 className="text-sm font-semibold text-emerald-400 mb-3">Suggested Response Angle</h2>
                      <p className="text-sm text-white/80">{opportunity.suggestedAngle}</p>
                    </div>
                  )}
                  
                  {/* Promotional Warning */}
                  {opportunity.isPromotionalOpportunity && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
                      <h2 className="text-sm font-semibold text-amber-400 mb-2">⚠️ Promotional Opportunity</h2>
                      <p className="text-sm text-white/70">
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
