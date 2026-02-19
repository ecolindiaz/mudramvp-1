"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import type { TimeRange } from "./time-range-selector"
import type { AIModel } from "./model-selector"
import {
  IconDownload,
  IconCopy,
  IconInfoCircle,
  IconCheck
} from "@tabler/icons-react"
import { FileText, ArrowUpRight, ListOrdered, BookOpen, Newspaper, GraduationCap, Globe, MessageSquare, PlayCircle, Building2, Star, Share2, BookMarked, ExternalLink, X, ChevronRight, Expand, Radio } from "lucide-react"
import { CircleFlag } from "react-circle-flags"
import { Badge } from "@/components/ui/badge"
import { toast } from "react-hot-toast"
import type { NlrSummaryJson } from '@/types/nlr'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { useBrandProfile } from "@/components/brand-profile-context"
import { useNlr } from "@/hooks/use-nlr"
import { ExpansionModal, type ExpansionModalColumn } from "./expansion-modal"
import { CompanyLogo, DomainLogo } from "@/components/ui/company-logo"
import { getCompanyDomain } from "@/lib/logo"
import { buildExecutiveSummaryFromJson, isJsonLikeText } from "@/lib/analysis/nlr/narrative"
import { IssuesIcon, ContentLabIcon } from "@/components/icons"

interface NaturalLanguageReportProps {
  className?: string
  timeRange: TimeRange
  selectedModel: AIModel | "all"
  days?: number
}

// Citation type icon helper - matches the Sources table in tracked prompts
type CitationType = 'Blog' | 'Listicle' | 'Docs' | 'News' | 'Academic' | 'Wiki' | 'Forum' | 'Video' | 'Product' | 'Review' | 'Social' | 'Other'

function CitationTypeIcon({ type }: { type: CitationType }) {
  const iconClass = 'h-3.5 w-3.5'
  switch (type) {
    case 'Blog':
      return <FileText className={iconClass} />
    case 'Listicle':
      return <ListOrdered className={iconClass} />
    case 'Docs':
      return <BookOpen className={iconClass} />
    case 'News':
      return <Newspaper className={iconClass} />
    case 'Academic':
      return <GraduationCap className={iconClass} />
    case 'Wiki':
      return <BookMarked className={iconClass} />
    case 'Forum':
      return <MessageSquare className={iconClass} />
    case 'Video':
      return <PlayCircle className={iconClass} />
    case 'Product':
      return <Building2 className={iconClass} />
    case 'Review':
      return <Star className={iconClass} />
    case 'Social':
      return <Share2 className={iconClass} />
    case 'Other':
    default:
      return <Globe className={iconClass} />
  }
}

const reportActionWidgets: Array<{
  title: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    title: "Fix Issues",
    href: "/dashboard/issues",
    Icon: IssuesIcon,
  },
  {
    title: "Engineer Content",
    href: "/dashboard/campaigns",
    Icon: ContentLabIcon,
  },
  {
    title: "Find Opportunities",
    href: "/dashboard/conversation-radar",
    Icon: Radio,
  },
]


export function NaturalLanguageReport({ className, timeRange, selectedModel, days = 30 }: NaturalLanguageReportProps) {
  const router = useRouter()
  const { profile, selectedCountry } = useBrandProfile()
  const [showReportHistory, setShowReportHistory] = React.useState(false)
  const [isMounted, setIsMounted] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [showCompetitorRankingsModal, setShowCompetitorRankingsModal] = React.useState(false)
  const [showCitationsModal, setShowCitationsModal] = React.useState(false)
  const [isCompetitorRankingsExpanded, setIsCompetitorRankingsExpanded] = React.useState(false)
  const [isCitationsExpanded, setIsCitationsExpanded] = React.useState(false)
  // State for the URLs modal (first level - shows URLs for a domain)
  const [selectedSource, setSelectedSource] = React.useState<{
    domain: string;
    urls: string[];
    totalUrls: number;
    urlsWithPrompts: Array<{ url: string; prompts: Array<{ promptId: number | null; promptText: string; provider: string }>; totalPrompts: number }>;
    type: string;
    prompts: Array<{ promptId: number | null; promptText: string; provider: string }>; // Domain-level (fallback)
    totalPrompts: number;
  } | null>(null)

  // State for the prompts sheet (second level - shows prompts for a specific URL)
  const [selectedUrl, setSelectedUrl] = React.useState<{
    url: string;
    domain: string;
    prompts: Array<{ promptId: number | null; promptText: string; provider: string }>;
    totalPrompts: number;
  } | null>(null)

  // Track navigation origin for back button functionality
  const [cameFromCitationsModal, setCameFromCitationsModal] = React.useState(false)

  // Ensure consistent hydration - only use profile.id after mount
  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  // Suppress unused variable warnings for now
  void timeRange

  // Build model filter param for API calls
  const modelParam = selectedModel !== 'all' ? `&model=${selectedModel}` : ''
  const countryParam = selectedCountry ? `&country=${selectedCountry}` : ''

  // Get brandProfileId from context (only after mount to avoid hydration mismatch)
  const brandProfileId = isMounted && profile?.id > 0 ? String(profile.id) : null
  const { data: analysisResultsData, isLoading: isLoadingAnalysis, error: analysisError, mutate: refreshAnalysis } = useSWR(
    brandProfileId ? `/api/analysis/results?brandProfileId=${brandProfileId}` : null,
    async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) return null
      return res.json()
    }
  )

  // Fetch recent prompts/chats with results (includes aggregate metrics)
  const { data: promptsData, isLoading: isLoadingPrompts, mutate: refreshPrompts } = useSWR(
    brandProfileId ? `/api/prompts/with-results?brandProfileId=${brandProfileId}${modelParam}&days=${days}${countryParam}` : null,
    async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) return null
      return res.json()
    }
  )

  // Fetch technical score for report export
  const { data: technicalData } = useSWR(
    brandProfileId ? `/api/analysis/technical-history?brandProfileId=${brandProfileId}&limit=1` : null,
    async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) return null
      return res.json()
    }
  )

  // Fetch WeeklyReport via brandProfileId (with country overlay when selected)
  const { report: weeklyReport, countryOverlay, error: nlrError, isLoading: isLoadingNlr, refresh: refreshNlr } = useNlr({ brandProfileId, country: selectedCountry || null })

  // Fallback: legacy NaturalLanguageReport from analysis results
  const nlrReport = analysisResultsData?.report || null
  const isLoading = isLoadingAnalysis || isLoadingNlr
  const error = analysisError || nlrError

  // Listen for refresh events from Generate Report button
  React.useEffect(() => {
    const handleRefresh = () => {
      if (refreshAnalysis) refreshAnalysis()
      if (refreshPrompts) refreshPrompts()
      if (refreshNlr) refreshNlr()
    }

    window.addEventListener('mudra:nlr-refresh', handleRefresh)
    window.addEventListener('mudra:analysis-complete', handleRefresh)
    window.addEventListener('mudra:website-analyzed', handleRefresh)
    return () => {
      window.removeEventListener('mudra:nlr-refresh', handleRefresh)
      window.removeEventListener('mudra:analysis-complete', handleRefresh)
      window.removeEventListener('mudra:website-analyzed', handleRefresh)
    }
  }, [refreshAnalysis, refreshPrompts, refreshNlr])

  // WeeklyReport structured data — build one effective object with country overlay merged in.
  // Every consumer (summary builder, markdown export, etc.) reads from this single source.
  const baseSummaryJson: NlrSummaryJson | null = weeklyReport?.summaryJson ? (weeklyReport.summaryJson as NlrSummaryJson) : null
  const summaryJson: NlrSummaryJson | null = React.useMemo(() => {
    if (!baseSummaryJson) return null
    if (!countryOverlay) return baseSummaryJson

    // Deep-merge country overlay into the base JSON
    const overlayScore = countryOverlay.aiVisibility?.score
    const overlayPos = countryOverlay.aiVisibility?.averagePosition

    return {
      ...baseSummaryJson,
      sections: {
        ...baseSummaryJson.sections,
        // Override AI Visibility with country-specific values
        ai_visibility: {
          ...baseSummaryJson.sections.ai_visibility,
          score_change: overlayScore
            ? {
                previous: overlayScore.previous,
                current: overlayScore.current,
                direction: overlayScore.direction,
                relative: overlayScore.relative,
                absolute: overlayScore.absolute,
                formatted: '',
              }
            : baseSummaryJson.sections.ai_visibility.score_change,
        },
        // Override Average Position with country-specific values
        average_position: overlayPos
          ? {
              current: overlayPos.current,
              previous: overlayPos.previous,
              direction: overlayPos.direction,
              delta: overlayPos.absolute,
              formatted: '',
            }
          : baseSummaryJson.sections.average_position,
      },
    }
  }, [baseSummaryJson, countryOverlay])

  const summaryFromModel: string = weeklyReport?.summaryMarkdown || ''

  // Fallback: Use NaturalLanguageReport text if no WeeklyReport
  const nlrReportText = nlrReport?.reportText || ''
  const nlrMetadata = nlrReport?.metadata ? (typeof nlrReport.metadata === 'string' ? JSON.parse(nlrReport.metadata) : nlrReport.metadata) : null
  const nlrSummary = nlrMetadata?.summary || nlrReportText

  function buildDigestibleSummary(): string {
    if (summaryJson) {
      const generated = buildExecutiveSummaryFromJson(summaryJson)
      if (generated) return generated
    }

    const modelText = summaryFromModel?.trim()
    if (modelText && !isJsonLikeText(modelText)) {
      return modelText
    }

    const legacyText = nlrSummary?.trim()
    if (legacyText && !isJsonLikeText(legacyText)) {
      return legacyText
    }

    return ''
  }

  // Build final summary - prioritize WeeklyReport, fallback to NaturalLanguageReport
  const summary = buildDigestibleSummary() || nlrSummary
  // Note: brandProfileId is already defined above (line ~51)

  // Fetch real citation data from aggregated prompt results (preview - top 5)
  const { data: citationsData, isLoading: isLoadingCitations } = useSWR(
    brandProfileId ? `/api/analytics/citations?brandProfileId=${brandProfileId}&limit=5&days=${days}${modelParam}${countryParam}` : null,
    async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) return null
      const json = await res.json()
      return json.data
    }
  )

  // Fetch ALL citations for expansion modal (no limit)
  const { data: allCitationsData, isLoading: isLoadingAllCitations } = useSWR(
    showCitationsModal && brandProfileId
      ? `/api/analytics/citations?brandProfileId=${brandProfileId}&days=${days}${modelParam}${countryParam}`
      : null,
    async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) return null
      const json = await res.json()
      return json.data
    }
  )

  // Transform citation data for display (including URLs and prompts for drill-down)
  const citations: Array<{
    domain: string;
    used: number;
    type: string;
    urls: string[];
    totalUrls: number;
    urlsWithPrompts: Array<{ url: string; prompts: Array<{ promptId: number | null; promptText: string; provider: string }>; totalPrompts: number }>;
    prompts: Array<{ promptId: number | null; promptText: string; provider: string }>;
    totalPrompts: number;
  }> = React.useMemo(() => {
    if (!citationsData?.citations) return []
    return citationsData.citations.map((c: any) => ({
      domain: c.domain,
      used: c.percentage,
      type: c.type || 'Other',
      urls: c.urls || [],
      totalUrls: c.totalUrls || c.urls?.length || 0,
      urlsWithPrompts: (c.urlsWithPrompts || []).map((u: any) => ({
        url: u.url,
        prompts: (u.prompts || []).map((p: any) => ({
          promptId: p.promptId || null,
          promptText: p.promptText,
          provider: p.provider
        })),
        totalPrompts: u.totalPrompts || u.prompts?.length || 0
      })),
      prompts: (c.prompts || []).map((p: any) => ({
        promptId: p.promptId || null,
        promptText: p.promptText,
        provider: p.provider
      })),
      totalPrompts: c.totalPrompts || c.prompts?.length || 0
    }))
  }, [citationsData])

  // Transform ALL citation data for expansion modal
  const allCitations: Array<{
    domain: string;
    used: number;
    type: string;
    urls: string[];
    totalUrls: number;
    urlsWithPrompts: Array<{ url: string; prompts: Array<{ promptId: number | null; promptText: string; provider: string }>; totalPrompts: number }>;
    prompts: Array<{ promptId: number | null; promptText: string; provider: string }>;
    totalPrompts: number;
  }> = React.useMemo(() => {
    if (!allCitationsData?.citations) return []
    return allCitationsData.citations.map((c: any) => ({
      domain: c.domain,
      used: c.percentage,
      type: c.type || 'Other',
      urls: c.urls || [],
      totalUrls: c.totalUrls || c.urls?.length || 0,
      urlsWithPrompts: (c.urlsWithPrompts || []).map((u: any) => ({
        url: u.url,
        prompts: (u.prompts || []).map((p: any) => ({
          promptId: p.promptId || null,
          promptText: p.promptText,
          provider: p.provider
        })),
        totalPrompts: u.totalPrompts || u.prompts?.length || 0
      })),
      prompts: (c.prompts || []).map((p: any) => ({
        promptId: p.promptId || null,
        promptText: p.promptText,
        provider: p.provider
      })),
      totalPrompts: c.totalPrompts || c.prompts?.length || 0
    }))
  }, [allCitationsData])

  // Fetch aggregated competitor rankings with proper SOV calculation
  // Uses the new /api/analysis/competitors endpoint that:
  // - Aggregates across ALL analysis runs (all tracked prompts)
  // - SOV % = (competitor mentions ÷ total competitor mentions) × 100
  // - Excludes the user's brand from competitors
  // - Ranks by SOV (highest first)
  // - Returns Top 5 competitors for preview
  const { data: competitorsData, mutate: refreshCompetitors, isLoading: isLoadingCompetitors } = useSWR(
    brandProfileId ? `/api/analysis/competitors?brandProfileId=${brandProfileId}&limit=5&days=${days}${modelParam}${countryParam}` : null,
    async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) return null
      const json = await res.json()
      return json.data
    }
  )

  // Fetch ALL competitors for expansion modal (no limit)
  const { data: allCompetitorsData, isLoading: isLoadingAllCompetitors } = useSWR(
    showCompetitorRankingsModal && brandProfileId
      ? `/api/analysis/competitors?brandProfileId=${brandProfileId}&days=${days}${modelParam}${countryParam}`
      : null,
    async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) return null
      const json = await res.json()
      return json.data
    }
  )

  // Transform competitor data for display (preview - top 5)
  // Note: User's brand is already excluded by the API
  // Data is already sorted by SOV (highest first) by the API
  const competitorRankings: Array<{ name: string; sov: number; domain?: string }> = React.useMemo(() => {
    if (!competitorsData?.competitors) return []

    return competitorsData.competitors.map((comp: any) => ({
      name: comp.name || '',
      sov: comp.shareOfVoice || 0, // SOV % already calculated by API
      domain: comp.domain
    }))
  }, [competitorsData])

  // Transform ALL competitor data for expansion modal
  const allCompetitorRankings: Array<{ name: string; sov: number; domain?: string }> = React.useMemo(() => {
    if (!allCompetitorsData?.competitors) return []

    return allCompetitorsData.competitors.map((comp: any) => ({
      name: comp.name || '',
      sov: comp.shareOfVoice || 0,
      domain: comp.domain
    }))
  }, [allCompetitorsData])

  // Listen for analysis completion to refresh competitor data
  React.useEffect(() => {
    const handleAnalysisComplete = () => {
      refreshCompetitors()
    }
    
    window.addEventListener('mudra:website-analyzed', handleAnalysisComplete)
    window.addEventListener('mudra:analysis-complete', handleAnalysisComplete)
    
    return () => {
      window.removeEventListener('mudra:website-analyzed', handleAnalysisComplete)
      window.removeEventListener('mudra:analysis-complete', handleAnalysisComplete)
    }
  }, [refreshCompetitors])

  // Recent chats data - derived from prompts with analysis results
  const recentChats = React.useMemo(() => {
    if (!promptsData?.prompts || !promptsData.hasAnalysis) return []

    // Use the analysis date (when analysis was run) for timestamp display
    // This is more accurate than prompt creation dates
    const analysisDate = promptsData.analysisDate ? new Date(promptsData.analysisDate) : null

    // Filter prompts that have results (were actually run)
    let promptsWithResults = promptsData.prompts.filter(
      (p: any) => p.results && p.results.length > 0
    )

    // If a specific model is selected, filter to only show chats from that model
    if (selectedModel !== 'all') {
      const normalizeModel = (name: string) => {
        const lower = name.toLowerCase().trim()
        if (lower.includes('chatgpt') || lower.includes('openai') || lower.includes('gpt')) return 'chatgpt'
        if (lower.includes('claude') || lower.includes('anthropic')) return 'claude'
        if (lower.includes('perplexity')) return 'perplexity'
        if (lower.includes('gemini')) return 'gemini'
        if (lower.includes('google') && lower.includes('aio')) return 'google-aio'
        return lower
      }

      promptsWithResults = promptsWithResults.filter((p: any) => {
        // Check if any result matches the selected model
        return p.results.some((r: any) => normalizeModel(r.model || '') === selectedModel)
      })
    }

    // Sort by most recent analysis date per prompt (lastAnalyzedAt), falling back to updatedAt
    const sorted = [...promptsWithResults].sort((a: any, b: any) => {
      const dateA = new Date(a.lastAnalyzedAt || a.updatedAt || a.createdAt).getTime()
      const dateB = new Date(b.lastAnalyzedAt || b.updatedAt || b.createdAt).getTime()
      return dateB - dateA
    })

    // Take the 4 most recent and transform to expected format
    return sorted.slice(0, 4).map((prompt: any) => {
      // Get the primary model from results (or filtered model if specific model selected)
      let primaryModel = prompt.results?.[0]?.model || prompt.model || 'ChatGPT'
      if (selectedModel !== 'all') {
        // If filtering by model, use that model name for display
        const modelLabels: Record<string, string> = {
          chatgpt: 'ChatGPT',
          claude: 'Claude',
          perplexity: 'Perplexity',
          gemini: 'Gemini',
          'google-aio': 'Google AIO'
        }
        primaryModel = modelLabels[selectedModel] || selectedModel
      }

      // Use per-prompt lastAnalyzedAt when available, fall back to global analysisDate
      const date = prompt.lastAnalyzedAt
        ? new Date(prompt.lastAnalyzedAt)
        : (analysisDate || new Date(prompt.updatedAt || prompt.createdAt))
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

      return {
        id: String(prompt.id),
        promptId: String(prompt.id),
        question: prompt.text,
        timestamp: dateStr,
        time: timeStr,
        model: primaryModel
      }
    })
  }, [promptsData, selectedModel])

  const handleChatClick = (promptId: string) => {
    // Navigate to tracked prompt detail page
    router.push(`/dashboard/tracked-prompts/${promptId}`)
  }

  // Build the full report as markdown
  const buildFullReport = (): string => {
    const brandName = profile?.companyName || profile?.companyWebsite || 'Your Brand'
    const date = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    // Get metrics from effectiveSummaryJson (country overlay already merged), with promptsData fallback
    const aiVisScore = summaryJson?.sections?.ai_visibility?.score_change?.current
    const aiVisibility = aiVisScore != null
      ? `${Math.round(aiVisScore)}%`
      : (promptsData?.aggregate?.overallScore ? `${Math.round(promptsData.aggregate.overallScore)}%` : '—')
    const avgPosValue = summaryJson?.sections?.average_position?.current
    const avgPosition = avgPosValue != null
      ? `#${avgPosValue}`
      : (promptsData?.aggregate?.averagePosition ? `#${promptsData.aggregate.averagePosition.toFixed(1)}` : '—')
    const technicalScore = technicalData?.data?.[0]?.overallScore
      ? `${technicalData.data[0].overallScore}%`
      : '—'

    let report = `# AI Visibility Report for ${brandName}\n`
    report += `*Generated on ${date}*\n\n`

    // Overview Metrics
    report += `## Overview Metrics\n\n`
    report += `| Metric | Value |\n`
    report += `|--------|-------|\n`
    report += `| AI Visibility | ${aiVisibility} |\n`
    report += `| Avg Position | ${avgPosition} |\n`
    report += `| Technical Score | ${technicalScore} |\n\n`

    // Summary
    if (summary) {
      report += `## Summary\n\n`
      report += `${summary}\n\n`
    }

    // Competitor Rankings
    if (competitorRankings.length > 0) {
      report += `## Competitor Rankings (Share of Voice)\n\n`
      report += `| Rank | Company | SOV % |\n`
      report += `|------|---------|-------|\n`
      competitorRankings.forEach((comp, idx) => {
        report += `| ${idx + 1} | ${comp.name} | ${comp.sov}% |\n`
      })
      report += `\n`
    }

    // Citations
    if (citations.length > 0) {
      report += `## Top Citations\n\n`
      report += `| Source | Mention Rate |\n`
      report += `|--------|-------------|\n`
      citations.forEach((c) => {
        report += `| ${c.domain} | ${c.used}% |\n`
      })
      report += `\n`
    }

    // Recent Chats
    if (recentChats.length > 0) {
      report += `## Recent AI Conversations\n\n`
      recentChats.forEach((chat) => {
        report += `- **${chat.model}** (${chat.timestamp}): "${chat.question}"\n`
      })
      report += `\n`
    }

    report += `---\n`
    report += `*Report generated by trymudra.com*\n`

    return report
  }

  const handleCopy = async () => {
    try {
      const report = buildFullReport()
      await navigator.clipboard.writeText(report)
      setCopied(true)
      toast.success('Report copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      toast.error('Failed to copy report')
    }
  }

  const handleDownload = () => {
    try {
      const report = buildFullReport()
      const brandName = profile?.companyName || profile?.companyWebsite || 'report'
      const date = new Date().toISOString().split('T')[0]
      const filename = `${brandName.toLowerCase().replace(/\s+/g, '-')}-ai-visibility-report-${date}.md`

      const blob = new Blob([report], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Report downloaded')
    } catch (error) {
      console.error('Failed to download:', error)
      toast.error('Failed to download report')
    }
  }

  // Report history data (will be connected to backend)
  const reportHistory: Array<{ id: string; title: string; date: string }> = []

  // Company name to domain mapping for logo fetching
  const getCompanyDomain = (companyName: string): string | null => {
    const name = companyName.toLowerCase().trim()

    // Common mappings for tech companies
    const domainMap: Record<string, string> = {
      'netlify': 'netlify.com',
      'render': 'render.com',
      'railway': 'railway.app',
      'aws': 'aws.amazon.com',
      'aws amplify': 'aws.amazon.com',
      'amazon web services': 'aws.amazon.com',
      'microsoft azure': 'azure.microsoft.com',
      'azure': 'azure.microsoft.com',
      'google cloud': 'cloud.google.com',
      'google cloud platform': 'cloud.google.com',
      'gcp': 'cloud.google.com',
      'digitalocean': 'digitalocean.com',
      'heroku': 'heroku.com',
      'cloudflare': 'cloudflare.com',
      'cloudflare pages': 'cloudflare.com',
      'firebase': 'firebase.google.com',
      'github pages': 'github.com',
      'github': 'github.com',
      'gitlab': 'gitlab.com',
      'fly.io': 'fly.io',
      'flyio': 'fly.io',
      'supabase': 'supabase.com',
      'planetscale': 'planetscale.com',
      'vercel': 'vercel.com',
      'coolify': 'coolify.io',
      'northflank': 'northflank.com',
      'salesforce': 'salesforce.com',
      'hubspot': 'hubspot.com',
      'stripe': 'stripe.com',
      'twilio': 'twilio.com',
      'auth0': 'auth0.com',
      'okta': 'okta.com',
      'datadog': 'datadoghq.com',
      'new relic': 'newrelic.com',
      'sentry': 'sentry.io',
      'mongodb': 'mongodb.com',
      'redis': 'redis.io',
      'elastic': 'elastic.co',
      'elasticsearch': 'elastic.co',
      'docker': 'docker.com',
      'kubernetes': 'kubernetes.io',
    }

    // Check direct mapping
    if (domainMap[name]) return domainMap[name]

    // Check partial match
    for (const [key, domain] of Object.entries(domainMap)) {
      if (name.includes(key) || key.includes(name)) return domain
    }

    // Try to guess domain from company name (e.g., "Acme Inc" -> "acme.com")
    const simpleName = name.replace(/\s+(inc|llc|corp|ltd|co|io|ai|labs?)\.?$/i, '').replace(/\s+/g, '')
    if (simpleName.length > 2) {
      return `${simpleName}.com`
    }

    return null
  }

  // Get company logo URL using Clearbit with Google favicon fallback
  const getCompanyLogoUrl = (companyName: string): string | null => {
    const domain = getCompanyDomain(companyName)
    if (!domain) return null
    // Use Clearbit Logo API (high quality logos)
    return `https://logo.clearbit.com/${domain}`
  }

  // Model logo mapping - using public folder
  const getModelIcon = (model: string) => {
    const modelLower = model.toLowerCase()
    
    if (modelLower.includes('claude') || modelLower.includes('anthropic')) {
      return "/claude-ai-icon.svg"
    }
    if (modelLower.includes('perplexity')) {
      return "/perplexity (2).svg"
    }
    if (modelLower.includes('gemini') || modelLower.includes('google')) {
      return "/gemini (3).svg"
    }
    if (modelLower.includes('gpt') || modelLower.includes('openai') || modelLower.includes('chatgpt')) {
      return "/openai_dark.svg"
    }
    
    // Default fallback
    return "/openai_dark.svg"
  }

  return (
    <div className={cn("", className)}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold tracking-tight text-white">Natural Language Report</h2>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <IconInfoCircle className="size-4 text-white/60 hover:text-white/90 transition-colors cursor-default" />
              </span>
            </TooltipTrigger>
            <TooltipContent sideOffset={8}>The Natural Language Report is your recurring, human-readable summary of what changed in AI search for your brand.</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-white/80 hover:text-white"
            onClick={handleCopy}
          >
            {copied ? <IconCheck className="size-3.5 mr-1" /> : <IconCopy className="size-3.5 mr-1" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-white/80 hover:text-white"
            onClick={handleDownload}
          >
            <IconDownload className="size-3.5 mr-1" /> Download
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Summary */}
        <div className="rounded-xl bg-[#161616] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div className="text-base font-medium text-white">Summary</div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center justify-center size-7 rounded-lg hover:bg-white/[0.04] transition-colors cursor-default">
                  <IconInfoCircle className="size-4 text-white/50 hover:text-white/80 transition-colors" />
                </span>
              </TooltipTrigger>
              <TooltipContent sideOffset={8}>AI-generated summary of your brand visibility.</TooltipContent>
            </Tooltip>
          </div>

	          <div className="p-5 flex-1 flex flex-col min-h-[200px]">
            <div className="flex-1">
              {isLoading ? (
                <div className="space-y-3">
                  <div className="h-4 w-full bg-white/[0.06] animate-pulse rounded-md" />
                  <div className="h-4 w-11/12 bg-white/[0.06] animate-pulse rounded-md" />
                  <div className="h-4 w-10/12 bg-white/[0.06] animate-pulse rounded-md" />
                  <div className="h-4 w-full bg-white/[0.06] animate-pulse rounded-md" />
                  <div className="h-4 w-9/12 bg-white/[0.06] animate-pulse rounded-md" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="flex items-center justify-center size-12 rounded-full bg-red-500/10 border border-red-500/20 mb-3">
                    <IconInfoCircle className="size-5 text-red-400" />
                  </div>
                  <p className="text-sm font-medium text-white/70">Failed to load report</p>
                  <p className="text-xs text-white/40 mt-1">Please try again later</p>
                </div>
              ) : !summary ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="flex items-center justify-center size-12 rounded-full bg-white/[0.04] border border-white/[0.06] mb-3">
                    <FileText className="size-5 text-white/40" />
                  </div>
                  <p className="text-sm font-medium text-white/70">No report available yet</p>
                  <p className="text-xs text-white/40 mt-1">Generate a report to see your AI visibility summary</p>
                </div>
              ) : (
                <div className="relative">
                  <p className="text-[14.4px] leading-[2] text-white">
                    {summary.split(/(\*\*[^*]+\*\*|(?:rose|increased|improved)\b|(?:fell|declined|decreased)\b|(?:held at)\b|#\d+(?:\.\d+)?|\b\d+(?:\.\d+)?%|\(\+[^)]+\)|\(-[^)]+\))/gi).map((part: string, i: number) => {
                      if (/^\*\*(.+)\*\*$/.test(part)) {
                        return <span key={i} className="font-medium text-white/90">{part.slice(2, -2)}</span>
                      }
                      if (/^(rose|increased|improved)$/i.test(part)) {
                        return <span key={i} className="text-white/90 font-medium">{part}</span>
                      }
                      if (/^(fell|declined|decreased)$/i.test(part)) {
                        return <span key={i} className="text-white/90 font-medium">{part}</span>
                      }
                      if (/^held at$/i.test(part)) {
                        return <span key={i} className="text-white/90 font-medium">{part}</span>
                      }
                      if (/^\(\+/.test(part)) {
                        return <Badge key={i} variant="outline" className="text-[11px] px-1.5 py-0 bg-gray-500/10 text-green-300/80 border-transparent tabular-nums align-middle mx-0.5">{part}</Badge>
                      }
                      if (/^\(-/.test(part)) {
                        return <Badge key={i} variant="outline" className="text-[11px] px-1.5 py-0 bg-gray-500/10 text-red-400 border-transparent tabular-nums align-middle mx-0.5">{part}</Badge>
                      }
                      if (/^\d+(?:\.\d+)?%$/.test(part)) {
                        return <Badge key={i} variant="outline" className="text-[11px] px-1.5 py-0 bg-gray-500/10 text-white border-transparent tabular-nums align-middle mx-0.5">{part}</Badge>
                      }
                      if (/^#?\d+(?:\.\d+)?$/.test(part)) {
                        return <Badge key={i} variant="outline" className="text-[11px] px-1.5 py-0 bg-gray-500/10 text-white border-transparent tabular-nums align-middle mx-0.5">{part}</Badge>
                      }
                      return part
                    })}
                  </p>
                </div>
              )}
            </div>
		            {summary && (
		              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
		                {reportActionWidgets.map((widget) => {
		                  const WidgetIcon = widget.Icon
		                  return (
		                    <button
		                      key={`summary-${widget.title}`}
		                      type="button"
		                      onClick={() => router.push(widget.href)}
		                      className="inline-flex w-full items-center justify-center gap-1.5 px-2.5 py-[5px] rounded-md bg-white/[0.05] text-[11.5px] text-white/60 hover:text-white/80 hover:bg-white/[0.08] transition-colors"
		                      aria-label={widget.title}
		                    >
		                      <WidgetIcon className="w-3.5 h-3.5" />
		                      <span>{widget.title}</span>
		                    </button>
		                  )
		                })}
	              </div>
	            )}
	
	          </div>
          <div className="flex justify-end px-5 py-3 border-t border-white/[0.06]">
            <Button
              variant="ghost"
              size="sm"
              className="group h-8 px-3.5 text-white/60 hover:text-white hover:bg-white/[0.08] text-xs font-medium rounded-lg transition-all gap-1.5"
              onClick={() => setShowReportHistory(true)}
            >
              <FileText className="size-3.5" />
              View History
              <ChevronRight className="size-3 text-white/40 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all" />
            </Button>
          </div>
        </div>
          
          <div className="flex flex-col gap-5">
            {/* Competitor Rankings Table - Share of Voice */}
            <div className="rounded-xl bg-[#161616] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <div className="text-base font-medium text-white/90">Competitor Rankings</div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <IconInfoCircle className="size-4 text-white/60" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent sideOffset={8}>How often competitors are mentioned across all AI responses.</TooltipContent>
                  </Tooltip>
                </div>
                <button
                onClick={() => setShowCompetitorRankingsModal(true)}
                className="flex items-center justify-center size-7 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all"
              >
                <Expand className="size-4" />
              </button>
              </div>
              <div className="divide-y divide-white/[0.06]">
                  <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-2.5 text-xs text-white/50">
                    <span className="w-6">#</span>
                    <span>Company</span>
                    <span>SOV %</span>
                  </div>
                  {isLoadingCompetitors ? (
                    <div className="divide-y divide-white/[0.06]">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-3.5"
                        >
                          <div className="w-6">
                            <span className="block h-4 w-4 rounded bg-white/10 animate-pulse" />
                          </div>
                          <div className="flex items-center gap-2.5">
                            <span className="block size-6 rounded bg-white/10 animate-pulse" />
                            <span className="block h-4 w-24 rounded bg-white/10 animate-pulse" />
                          </div>
                          <span className="block h-4 w-12 rounded bg-white/10 animate-pulse" />
                        </div>
                      ))}
                    </div>
                  ) : competitorRankings.length === 0 ? (
                    <div className="px-5 py-16 text-center">
                      <p className="text-sm text-white/60">No competitor data found for the selected time range.</p>
                      <p className="text-xs text-white/40 mt-1">Try selecting a longer period or run a new analysis.</p>
                    </div>
                  ) : (
                    <>
                      {(isCompetitorRankingsExpanded ? competitorRankings : competitorRankings.slice(0, 5)).map((competitor, idx) => {
                        return (
                          <a
                            key={idx}
                            href={`https://${competitor.domain || getCompanyDomain(competitor.name)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.02] group"
                          >
                            <div className="w-6 text-sm text-white/50 tabular-nums">{idx + 1}</div>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <CompanyLogo company={competitor.name} size={24} />
                              <span className="text-sm truncate text-white/90 group-hover:underline underline-offset-2">
                                {competitor.name}
                              </span>
                              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
                            </div>
                            <div className="text-sm tabular-nums text-white/70 font-medium">{competitor.sov}%</div>
                          </a>
                        )
                      })}
                      {competitorRankings.length > 5 && (
                        <div className="flex justify-end px-5 py-3 border-t border-white/[0.06]">
                          <button
                            onClick={() => setIsCompetitorRankingsExpanded(!isCompetitorRankingsExpanded)}
                            className="px-3 py-1.5 text-sm text-black bg-white hover:bg-white/90 rounded-lg transition-colors font-medium"
                          >
                            {isCompetitorRankingsExpanded ? 'Show less' : `Show all ${competitorRankings.length} items`}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
            </div>
          </div>

          {/* Citations list */}
          <div className="rounded-xl bg-[#161616] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="text-base font-medium text-white/90">Citations</div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <IconInfoCircle className="size-4 text-white/60" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={8}>Top sources AI cites from your industry.</TooltipContent>
                </Tooltip>
              </div>
              <button
                onClick={() => setShowCitationsModal(true)}
                className="flex items-center justify-center size-7 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all"
              >
                <Expand className="size-4" />
              </button>
            </div>
            <div className="divide-y divide-white/[0.06]">
              <div className="grid grid-cols-[auto_1fr_100px_130px] items-center gap-4 px-5 py-2.5 text-xs text-white/50">
                <span className="w-6">#</span>
                <span>Source</span>
                <span className="text-center">Type</span>
                <span className="text-right">Mention rate</span>
              </div>
              {isLoadingCitations ? (
                <div className="divide-y divide-white/[0.06]">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[auto_1fr_100px_130px] items-center gap-4 px-5 py-3.5"
                    >
                      <div className="w-6">
                        <span className="block h-4 w-4 rounded bg-white/10 animate-pulse" />
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="block size-6 rounded bg-white/10 animate-pulse" />
                        <span className="block h-4 w-32 rounded bg-white/10 animate-pulse" />
                      </div>
                      <span className="block h-6 w-16 mx-auto rounded bg-white/10 animate-pulse" />
                      <span className="block h-4 w-10 ml-auto rounded bg-white/10 animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : citations.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <p className="text-sm text-white/60">No citation data found for the selected time range.</p>
                  <p className="text-xs text-white/40 mt-1">Try selecting a longer period or run a new analysis.</p>
                </div>
              ) : (
                <>
                  {(isCitationsExpanded ? citations : citations.slice(0, 5)).map((c, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-[auto_1fr_100px_130px] items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                      onClick={() => {
                        setCameFromCitationsModal(false)
                        setSelectedSource({
                          domain: c.domain,
                          urls: c.urls || [],
                          totalUrls: c.totalUrls || 0,
                          urlsWithPrompts: c.urlsWithPrompts || [],
                          type: c.type,
                          prompts: c.prompts || [],
                          totalPrompts: c.totalPrompts || 0
                        })
                      }}
                    >
                      <div className="w-6 text-sm text-white/50 tabular-nums">{idx + 1}</div>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <DomainLogo domain={c.domain} size={24} />
                        <span className="truncate text-sm text-white/90">{c.domain}</span>
                      </div>
                      <div className="flex justify-center">
                        <Badge className="inline-flex items-center gap-1.5 h-6 px-2 text-[11px] rounded-md bg-white/95 text-black font-medium shadow-sm">
                          <CitationTypeIcon type={c.type as CitationType} />
                          {c.type}
                        </Badge>
                      </div>
                      <div className="text-sm tabular-nums text-white/70 font-medium text-right">{c.used}%</div>
                    </div>
                  ))}
                  {citations.length > 5 && (
                    <div className="flex justify-end px-5 py-3 border-t border-white/[0.06]">
                      <button
                        onClick={() => setIsCitationsExpanded(!isCitationsExpanded)}
                        className="px-3 py-1.5 text-sm text-black bg-white hover:bg-white/90 rounded-lg transition-colors font-medium"
                      >
                        {isCitationsExpanded ? 'Show less' : `Show all ${citations.length} items`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          
          {/* Recent Chats - right column */}
          <div className="rounded-xl bg-[#161616] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="text-base font-medium text-white/90">Recent Chats</div>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <IconInfoCircle className="size-4 text-white/60 hover:text-white/90 transition-colors cursor-default" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Recent AI model queries and their results</TooltipContent>
              </Tooltip>
            </div>
            <div className="p-4">
              {!isMounted || isLoadingPrompts ? (
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="p-5 rounded-xl border border-white/[0.04] bg-white/[0.01]"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <span className="size-6 rounded-md bg-white/10 animate-pulse" />
                        <span className="block h-3 w-20 rounded bg-white/10 animate-pulse" />
                      </div>
                      <span className="block h-4 w-full rounded bg-white/10 animate-pulse mb-2" />
                      <span className="block h-4 w-3/4 rounded bg-white/10 animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : recentChats.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-base text-white/60">No recent chats available yet.</p>
                  <p className="text-sm text-white/40 mt-2">Recent chat responses will appear here once analyzed.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {recentChats.map((chat) => (
                    <div
                      key={chat.id}
                      onClick={() => handleChatClick(chat.promptId)}
                      className="relative p-5 rounded-xl border border-white/[0.04] hover:border-white/[0.06] hover:bg-white/[0.01] transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={getModelIcon(chat.model)}
                            alt={chat.model}
                            className="size-6 object-contain"
                          />
                          <CircleFlag countryCode={selectedCountry.toLowerCase()} height="14" width="14" className="flex-shrink-0" style={{ width: 14, height: 14 }} />
                          <span className="text-xs text-white/50">{chat.timestamp}</span>
                        </div>
                        <span className="text-xs text-white/40">{chat.time}</span>
                      </div>
                      <p className="text-base text-white/85 leading-relaxed line-clamp-3 pr-6">
                        {chat.question}
                      </p>
                      <ArrowUpRight className="absolute bottom-4 right-4 size-4 text-white/20 group-hover:text-white/50 transition-colors" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Report History Modal */}
      <Dialog open={showReportHistory} onOpenChange={setShowReportHistory}>
        <DialogContent className="max-w-2xl bg-dark-grey border-0 p-0 overflow-hidden">
          <DialogHeader className="p-7 pb-5 border-b border-white/[0.04]">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-semibold text-white">Report History</DialogTitle>
                <DialogDescription className="text-white/60 text-sm mt-1">
                  {reportHistory.length > 0 ? `${reportHistory.length} reports generated` : 'No reports yet'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6">
            {reportHistory.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-white/60">No history of reports yet.</p>
                <p className="text-xs text-white/40 mt-1">Reports will appear here once generated.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {reportHistory.map((report) => (
                  <div
                    key={report.id}
                    className="rounded-lg border border-white/[0.04] bg-transparent p-4 hover:bg-white/[0.02] hover:border-white/[0.12] transition-all cursor-pointer group"
                    onClick={() => console.log('Open report:', report.id)}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex items-center justify-center size-8 rounded-md bg-white/5 border border-white/[0.04] flex-shrink-0 group-hover:border-white/[0.12] transition-colors">
                          <FileText className="size-4 text-white/70 group-hover:text-white/90 transition-colors" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-white/90 group-hover:text-white transition-colors">
                            {report.title}
                          </h3>
                          <p className="text-xs text-white/50 mt-1">{report.date}</p>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 rounded-md opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          console.log('Download report:', report.id)
                        }}
                      >
                        <IconDownload className="size-4 text-white/70" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Competitor Rankings Expansion Modal - shows ALL competitors */}
      <ExpansionModal
        open={showCompetitorRankingsModal}
        onOpenChange={setShowCompetitorRankingsModal}
        title="Competitor Rankings"
        description="How often competitors are mentioned across all AI responses"
        data={(allCompetitorRankings.length > 0 ? allCompetitorRankings : competitorRankings).slice(0, 20)}
        initialLimit={5}
        isLoading={isLoadingAllCompetitors || (showCompetitorRankingsModal && allCompetitorRankings.length === 0 && isLoadingCompetitors)}
        searchKey="name"
        searchPlaceholder="Search competitors..."
        emptyMessage="No competitor data found for the selected time range."
        emptySubMessage="Try selecting a longer period or run a new analysis."
        columns={[
          {
            key: "rank",
            header: "#",
            width: "50px",
            render: (_, idx) => (
              <span className="text-white/50 tabular-nums">{idx + 1}</span>
            ),
          },
          {
            key: "name",
            header: "Company",
            width: "1fr",
            sortable: true,
            render: (item) => {
              return (
                <a
                  href={`https://${item.domain || getCompanyDomain(item.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 min-w-0 group"
                  onClick={(e) => e.stopPropagation()}
                >
                  <CompanyLogo company={item.name} size={24} />
                  <span className="truncate text-white/90 group-hover:underline underline-offset-2">{item.name}</span>
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
                </a>
              )
            },
          },
          {
            key: "sov",
            header: "SOV %",
            width: "80px",
            align: "right",
            sortable: true,
            render: (item) => (
              <span className="tabular-nums text-white/70 font-medium">{item.sov}%</span>
            ),
          },
        ] as ExpansionModalColumn<{ name: string; sov: number; domain?: string }>[]}
      />

      {/* Citations Expansion Modal - shows ALL citations */}
      <ExpansionModal
        open={showCitationsModal}
        onOpenChange={setShowCitationsModal}
        title="Citations"
        description="Top sources AI cites from your industry"
        data={(allCitations.length > 0 ? allCitations : citations).slice(0, 20)}
        initialLimit={5}
        isLoading={isLoadingAllCitations || (showCitationsModal && allCitations.length === 0 && isLoadingCitations)}
        searchKey="domain"
        searchPlaceholder="Search sources..."
        emptyMessage="No citation data found for the selected time range."
        emptySubMessage="Try selecting a longer period or run a new analysis."
        onRowClick={(item) => {
          // Close the ExpansionModal first to avoid stacked modals
          setShowCitationsModal(false)
          setCameFromCitationsModal(true)
          setSelectedSource({
            domain: item.domain,
            urls: item.urls || [],
            totalUrls: item.totalUrls || 0,
            urlsWithPrompts: item.urlsWithPrompts || [],
            type: item.type,
            prompts: item.prompts || [],
            totalPrompts: item.totalPrompts || 0
          })
        }}
        columns={[
          {
            key: "rank",
            header: "#",
            width: "50px",
            render: (_, idx) => (
              <span className="text-white/50 tabular-nums">{idx + 1}</span>
            ),
          },
          {
            key: "domain",
            header: "Source",
            width: "1fr",
            sortable: true,
            render: (item) => (
              <div className="flex items-center gap-2.5 min-w-0">
                <DomainLogo domain={item.domain} size={24} />
                <span className="truncate text-white/90">{item.domain}</span>
                <ChevronRight className="size-3.5 text-white/30 ml-auto flex-shrink-0" />
              </div>
            ),
          },
          {
            key: "type",
            header: "Type",
            width: "100px",
            sortable: true,
            render: (item) => (
              <Badge className="inline-flex items-center gap-1.5 h-6 px-2 text-[11px] rounded-md bg-white/95 text-black font-medium shadow-sm w-fit">
                <CitationTypeIcon type={item.type as CitationType} />
                {item.type}
              </Badge>
            ),
          },
          {
            key: "used",
            header: "Mention rate",
            width: "100px",
            align: "right",
            sortable: true,
            render: (item) => (
              <span className="tabular-nums text-white/70 font-medium">{item.used}%</span>
            ),
          },
        ] as ExpansionModalColumn<{ domain: string; used: number; type: string; urls: string[]; totalUrls: number; urlsWithPrompts: Array<{ url: string; prompts: Array<{ promptId: number | null; promptText: string; provider: string }>; totalPrompts: number }>; prompts: Array<{ promptId: number | null; promptText: string; provider: string }>; totalPrompts: number }>[]}
      />

      {/* Source URLs Modal - popup showing URLs for a domain */}
      <Dialog open={!!selectedSource} onOpenChange={(open) => { if (!open) { setSelectedSource(null); setCameFromCitationsModal(false) } }}>
        <DialogContent 
          showCloseButton={false}
          className="!max-w-3xl bg-[#161616] border-white/[0.08] p-0 !rounded-2xl overflow-hidden"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>URLs for {selectedSource?.domain}</DialogTitle>
            <DialogDescription>List of URLs captured from this source</DialogDescription>
          </DialogHeader>
          {selectedSource && (
            <div className="flex flex-col max-h-[70vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {cameFromCitationsModal && (
                    <button
                      onClick={() => {
                        setSelectedSource(null)
                        setCameFromCitationsModal(false)
                        setShowCitationsModal(true)
                      }}
                      className="flex items-center justify-center size-8 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.1] transition-colors flex-shrink-0"
                      title="Back to Citations"
                    >
                      <ArrowUpRight className="size-3.5 rotate-[-135deg]" />
                    </button>
                  )}
                  <DomainLogo domain={selectedSource.domain} size={32} className="rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[15px] font-semibold text-white truncate">{selectedSource.domain}</h2>
                    <p className="text-xs text-white/50 mt-0.5">Click a URL to see related prompts</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedSource(null)
                    setCameFromCitationsModal(false)
                  }}
                  className="flex items-center justify-center size-7 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              {/* Toolbar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-white/[0.01]">
                <div className="flex items-center gap-2">
                  <Badge className="inline-flex items-center gap-1.5 h-6 px-2 text-[11px] rounded-md bg-white/95 text-black font-medium">
                    <CitationTypeIcon type={selectedSource.type as CitationType} />
                    {selectedSource.type}
                  </Badge>
                </div>
                <span className="text-xs text-white/40">
                  {selectedSource.totalUrls > selectedSource.urls.length
                    ? `Showing ${selectedSource.urls.length} of ${selectedSource.totalUrls} sources`
                    : `${selectedSource.urls.length} ${selectedSource.urls.length === 1 ? 'source' : 'sources'}`
                  }
                </span>
              </div>

              {/* URLs List */}
              <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent" style={{ maxHeight: '45vh' }}>
                {selectedSource.urls.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="flex items-center justify-center size-10 rounded-full bg-white/[0.04] border border-white/[0.06] mb-2.5">
                      <Globe className="size-4 text-white/40" />
                    </div>
                    <p className="text-sm text-white/60">No URLs tracked</p>
                    <p className="text-xs text-white/40 mt-0.5">URLs will appear after analysis</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.06]">
                    {selectedSource.urls.map((url, idx) => {
                      let displayPath = url
                      try {
                        const urlObj = new URL(url)
                        displayPath = urlObj.pathname || '/'
                        if (displayPath === '/') displayPath = urlObj.hostname
                        // Cap at 50 chars for consistent row heights
                        if (displayPath.length > 50) {
                          displayPath = displayPath.slice(0, 47) + '...'
                        }
                      } catch {
                        if (displayPath.length > 50) {
                          displayPath = displayPath.slice(0, 47) + '...'
                        }
                      }

                      // Get prompt count for this specific URL
                      const urlData = selectedSource.urlsWithPrompts?.find(u => u.url === url)
                      const promptCount = urlData?.prompts?.length || 0
                      const totalPromptCount = urlData?.totalPrompts || promptCount

                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors cursor-pointer group overflow-hidden"
                          onClick={() => {
                            // Find the URL-specific prompts from urlsWithPrompts
                            const urlPrompts = urlData?.prompts || []
                            // Fallback to domain-level prompts if no URL-specific prompts found
                            const promptsToShow = urlPrompts.length > 0 ? urlPrompts : selectedSource.prompts
                            const totalPromptsForUrl = urlPrompts.length > 0 ? totalPromptCount : selectedSource.totalPrompts
                            setSelectedUrl({
                              url,
                              domain: selectedSource.domain,
                              prompts: promptsToShow,
                              totalPrompts: totalPromptsForUrl
                            })
                          }}
                        >
                          <span className="text-white/30 text-[11px] w-5 text-center flex-shrink-0 tabular-nums">{idx + 1}</span>
                          <span
                            className="flex-1 min-w-0 text-[13px] text-white/70 group-hover:text-white truncate transition-colors"
                            title={url}
                          >
                            {displayPath}
                          </span>
                          {totalPromptCount > 0 && (
                            <span className="text-[11px] text-white/40 flex-shrink-0 tabular-nums whitespace-nowrap">
                              {totalPromptCount} {totalPromptCount === 1 ? 'prompt' : 'prompts'}
                            </span>
                          )}
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center size-7 rounded-md text-white/40 hover:text-white hover:bg-white/[0.08] transition-all flex-shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                          <ChevronRight className="size-3.5 text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0" />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06]">
                {cameFromCitationsModal ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSelectedSource(null)
                      setCameFromCitationsModal(false)
                      setShowCitationsModal(true)
                    }}
                    className="h-8 px-3 text-white/60 hover:text-white hover:bg-white/[0.08] rounded-lg text-[13px] font-medium gap-1.5"
                  >
                    <ArrowUpRight className="size-3.5 rotate-[-135deg]" />
                    Back to Citations
                  </Button>
                ) : (
                  <div />
                )}
                <Button
                  onClick={() => {
                    setSelectedSource(null)
                    setCameFromCitationsModal(false)
                  }}
                  className="h-8 px-4 bg-white text-black hover:bg-white/90 rounded-lg text-[13px] font-medium"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Prompts Sheet - slides in from right when URL is clicked */}
      <Sheet open={!!selectedUrl} onOpenChange={(open) => { if (!open) setSelectedUrl(null) }}>
        <SheetContent
          side="right"
          className="!w-[576px] !max-w-[90vw] bg-[#161616] border-l border-white/[0.08] p-0 gap-0 [&>button]:hidden rounded-l-2xl"
        >
          <SheetTitle className="sr-only">Prompts citing {selectedUrl?.url}</SheetTitle>
          <SheetDescription className="sr-only">List of prompts that cited this URL</SheetDescription>
          {selectedUrl && (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button
                    onClick={() => setSelectedUrl(null)}
                    className="flex items-center justify-center size-8 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.1] transition-colors flex-shrink-0"
                  >
                    <ArrowUpRight className="size-3.5 rotate-[-135deg]" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[15px] font-semibold text-white">Prompts</h2>
                    <p className="text-xs text-white/50 mt-0.5 truncate" title={selectedUrl.url}>
                      {(() => {
                        try {
                          const urlObj = new URL(selectedUrl.url)
                          return urlObj.pathname || '/'
                        } catch {
                          return selectedUrl.url
                        }
                      })()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUrl(null)}
                  className="flex items-center justify-center size-7 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              {/* Toolbar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-white/[0.01]">
                <span className="text-xs text-white/50">Citing this source</span>
                <span className="text-xs text-white/40">
                  {selectedUrl.totalPrompts > selectedUrl.prompts.length
                    ? `Showing ${selectedUrl.prompts.length} of ${selectedUrl.totalPrompts} prompts`
                    : `${selectedUrl.prompts.length} ${selectedUrl.prompts.length === 1 ? 'prompt' : 'prompts'}`
                  }
                </span>
              </div>

              {/* Prompts List */}
              <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {selectedUrl.prompts.length > 0 ? (
                  <div className="divide-y divide-white/[0.06]">
                    {selectedUrl.prompts.map((prompt, idx) => {
                      const getProviderIcon = (provider: string) => {
                        const p = provider.toLowerCase()
                        if (p.includes('chatgpt') || p.includes('openai') || p.includes('gpt')) return '/openai_dark.svg'
                        if (p.includes('claude') || p.includes('anthropic')) return '/claude-ai-icon.svg'
                        if (p.includes('perplexity')) return '/perplexity (2).svg'
                        if (p.includes('gemini')) return '/gemini (3).svg'
                        if (p.includes('google')) return '/google-logo.svg'
                        return null
                      }
                      const providerIcon = getProviderIcon(prompt.provider)
                      const isClickable = prompt.promptId !== null

                      return (
                        <div
                          key={idx}
                          className={`flex items-start gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors ${isClickable ? 'cursor-pointer' : ''} group`}
                          onClick={() => {
                            if (isClickable && prompt.promptId) {
                              router.push(`/dashboard/tracked-prompts/${prompt.promptId}`)
                            }
                          }}
                        >
                          <span className="text-white/30 text-[11px] w-5 text-center flex-shrink-0 pt-0.5 tabular-nums">{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-[13px] text-white/70 group-hover:text-white leading-relaxed transition-colors ${isClickable ? 'group-hover:underline underline-offset-2' : ''}`}
                              title={prompt.promptText}
                            >
                              {prompt.promptText}
                            </p>
                            <div className="flex items-center gap-1.5 mt-2">
                              {providerIcon && (
                                <img src={providerIcon} alt="" className="size-3.5" />
                              )}
                              <span className="text-[11px] text-white/40">
                                {prompt.provider.replace(/openai|anthropic/gi, '').trim() || prompt.provider}
                              </span>
                            </div>
                          </div>
                          {isClickable && (
                            <ChevronRight className="size-3.5 text-white/20 group-hover:text-white/50 flex-shrink-0 transition-colors mt-0.5" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-12">
                    <div className="flex items-center justify-center size-10 rounded-full bg-white/[0.04] border border-white/[0.06] mb-2.5">
                      <MessageSquare className="size-4 text-white/40" />
                    </div>
                    <p className="text-sm text-white/60">No prompts yet</p>
                    <p className="text-xs text-white/40 mt-0.5">Prompts citing this source will appear here</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06]">
                <Button
                  variant="ghost"
                  onClick={() => setSelectedUrl(null)}
                  className="h-8 px-3 text-white/60 hover:text-white hover:bg-white/[0.08] rounded-lg text-[13px] font-medium gap-1.5"
                >
                  <ArrowUpRight className="size-3.5 rotate-[-135deg]" />
                  Back to URLs
                </Button>
                <Button
                  onClick={() => setSelectedUrl(null)}
                  className="h-8 px-4 bg-white text-black hover:bg-white/90 rounded-lg text-[13px] font-medium"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
