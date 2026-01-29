"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import type { TimeRange } from "./time-range-selector"
import type { AIModel } from "./model-selector"
import {
  IconDownload,
  IconCopy,
  IconInfoCircle,
  IconCheck
} from "@tabler/icons-react"
import { FileText, ArrowUpRight } from "lucide-react"
import { toast } from "react-hot-toast"
import type { NlrSummaryJson } from '@/types/nlr'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { useBrandProfile } from "@/components/brand-profile-context"

interface NaturalLanguageReportProps {
  className?: string
  timeRange: TimeRange
  selectedModel: AIModel | "all"
}


export function NaturalLanguageReport({ className, timeRange, selectedModel }: NaturalLanguageReportProps) {
  const router = useRouter()
  const { profile } = useBrandProfile()
  const [showReportHistory, setShowReportHistory] = React.useState(false)
  const [isMounted, setIsMounted] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  // Ensure consistent hydration - only use profile.id after mount
  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  // Suppress unused variable warnings for now
  void timeRange

  // Build model filter param for API calls
  const modelParam = selectedModel !== 'all' ? `&model=${selectedModel}` : ''

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
    brandProfileId ? `/api/prompts/with-results?brandProfileId=${brandProfileId}${modelParam}` : null,
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

  // Weekly report via Company/Site not currently used
  const nlrReport = analysisResultsData?.report || null
  const isLoading = isLoadingAnalysis
  const error = analysisError

  // Listen for refresh events from Generate Report button
  React.useEffect(() => {
    const handleRefresh = () => {
      if (refreshAnalysis) refreshAnalysis()
      if (refreshPrompts) refreshPrompts()
    }

    window.addEventListener('mudra:nlr-refresh', handleRefresh)
    window.addEventListener('mudra:analysis-complete', handleRefresh)
    window.addEventListener('mudra:website-analyzed', handleRefresh)
    return () => {
      window.removeEventListener('mudra:nlr-refresh', handleRefresh)
      window.removeEventListener('mudra:analysis-complete', handleRefresh)
      window.removeEventListener('mudra:website-analyzed', handleRefresh)
    }
  }, [refreshAnalysis, refreshPrompts])

  // Build summary from NaturalLanguageReport (WeeklyReport via Company/Site not currently used)
  const summaryJson = null as NlrSummaryJson | null
  const summaryFromModel = ''

  // Fallback: Use NaturalLanguageReport text if no WeeklyReport
  const nlrReportText = nlrReport?.reportText || ''
  const nlrMetadata = nlrReport?.metadata ? (typeof nlrReport.metadata === 'string' ? JSON.parse(nlrReport.metadata) : nlrReport.metadata) : null
  const nlrSummary = nlrMetadata?.summary || nlrReportText

  const whatsChanged = summaryJson?.sections?.whats_changed ?? []
  const highlights = summaryJson?.sections?.highlights ?? []

  // Helper to format score delta in "previous → current (+X% ↑)" format
  // Returns "-" when no previous data (first run after onboarding) or no change
  function formatScoreDelta(change: { previous?: number | null; current?: number | null; relative?: number | null; direction?: string | null; formatted?: string } | null | undefined): string {
    if (!change) return "-"

    // No previous data (first run after onboarding) - show dash
    if (change.previous == null) return "-"

    // No change in scores - show dash
    if (change.previous === change.current) return "-"

    // Use pre-formatted string if available
    if (change.formatted) return change.formatted

    // Otherwise build the delta format
    const prev = change.previous
    const curr = change.current ?? 0
    const pct = change.relative != null ? Math.round(change.relative * 100) : Math.round(((curr - prev) / (prev || 1)) * 100)
    const arrow = change.direction === "up" ? "↑" : change.direction === "down" ? "↓" : ""
    const sign = pct >= 0 ? "+" : ""
    return `${prev} → ${curr} (${sign}${pct}% ${arrow})`
  }

  function buildDigestibleSummary(): string {
    // First try WeeklyReport structured data
    if (summaryJson) {
      const parts: string[] = []

      // Agent Lab section
      const agentLab = summaryJson.sections?.agent_lab
      if (agentLab?.deployments && agentLab.deployments.length > 0) {
        const deploymentStr = agentLab.deployments.map(d => `${d.agent_name} ${d.what_changed}`).join('. ')
        parts.push(`**Agent Lab:** ${deploymentStr}.`)
      }

    // Opportunities section
    const opportunities = summaryJson.sections?.opportunities
    if (opportunities?.count && opportunities.count > 0) {
      parts.push(`**Opportunities:** ${opportunities.summary || `Conversation Radar agent identified ${opportunities.count} high-value opportunities your brand should participate on.`}`)
    }

    // Score Changes with new format: "58 → 71 (+22% ↑)"
    const scoreChangeParts: string[] = []
    const aiVis = summaryJson.sections?.ai_visibility?.score_change
    if (aiVis && (aiVis.current != null || aiVis.formatted)) {
      scoreChangeParts.push(`AI Visibility: ${formatScoreDelta(aiVis)}`)
    }
    const tech = summaryJson.sections?.technical_structure?.overall_change
    if (tech && (tech.current != null || tech.formatted)) {
      scoreChangeParts.push(`Technical Structure: ${formatScoreDelta(tech)}`)
    }
    if (scoreChangeParts.length > 0) {
      parts.push(`**Score Changes:** ${scoreChangeParts.join('. ')}.`)
    }

    // AI Traffic section
    const aiTraffic = summaryJson.sections?.ai_traffic
    if (aiTraffic && aiTraffic.total_visits > 0) {
      if (aiTraffic.formatted) {
        parts.push(`**AI Traffic:** ${aiTraffic.formatted}`)
      } else {
        const providerStr = aiTraffic.by_provider?.map(p => `${p.provider} (${p.visits})`).join(' · ') || ''
        const boostSign = aiTraffic.weekly_boost >= 0 ? '+' : ''
        parts.push(`**AI Traffic:** ${aiTraffic.total_visits} visits from AI sources (${boostSign}${aiTraffic.weekly_boost} vs. last week)${providerStr ? ` — ${providerStr}` : ''}.`)
      }
    }

    // Use highlights for additional context
    const bullets = (highlights?.length ? highlights : whatsChanged.map((w: { label: string }) => w.label)).slice(0, 2)
    if (bullets.length > 0 && parts.length < 3) {
      parts.push(bullets.join(' '))
    }

    // Technical Snapshot Narrative (70–120 words)
    const keyFindings = summaryJson.sections.technical_structure?.key_findings || []
    if (keyFindings.length > 0) {
      const lower = (s: string) => s.toLowerCase()
      const findBy = (substr: string) => keyFindings.find(k => lower(k.title).includes(substr))

      const robots = findBy('robots.txt')
      const llms = findBy('llms.txt')
      const jsonld = keyFindings.find(k => lower(k.title).includes('json-ld'))
      const faq = keyFindings.find(k => lower(k.title).includes('faq'))
      const headings = keyFindings.find(k => lower(k.title).includes('heading structure'))
      const h1 = keyFindings.find(k => lower(k.title).startsWith('h1 '))

      const jsonLdCountMatch = jsonld?.title.match(/\((\d+)\)/)
      const faqCountMatch = faq?.title.match(/\((\d+)\)/)

      const clauses: string[] = []
      if (robots) clauses.push(robots.title.toLowerCase().includes('missing') ? 'robots.txt is missing' : 'robots.txt is present')
      if (llms) clauses.push(llms.title.toLowerCase().includes('missing') ? 'llms.txt is missing' : 'llms.txt is present')
      if (jsonld) {
        if (lower(jsonld.title).includes('detected')) {
          clauses.push(jsonLdCountMatch ? `JSON-LD detected (${jsonLdCountMatch[1]})` : 'JSON-LD detected')
        } else {
          clauses.push('no JSON-LD detected')
        }
      }
      if (faq) {
        if (lower(faq.title).includes('present')) {
          clauses.push(faqCountMatch ? `FAQ content present (${faqCountMatch[1]})` : 'FAQ content present')
        } else {
          clauses.push('no FAQ content detected')
        }
      }
      if (headings) clauses.push(lower(headings.title).includes('sane') ? 'headings look sane' : 'headings may be problematic')
      if (h1) {
        if (lower(h1.title).includes('present')) {
          const m = h1.title.match(/\((\d+)\)/)
          clauses.push(m ? `H1 count ${m[1]}` : 'H1 present')
        } else {
          clauses.push('no H1 detected')
        }
      }

      const narrativeParts: string[] = []
      if (clauses.length > 0) {
        narrativeParts.push(`The crawler snapshot confirms ${clauses.join(', ')}.`)
      }
      if (jsonld || faq) {
        narrativeParts.push('Structured signals like JSON-LD and FAQs help search and AI models understand your entities and answers.')
      }
      if (headings || h1) {
        narrativeParts.push('Clear heading structure and a single primary H1 improve parsing and ranking consistency across pages.')
      }
      narrativeParts.push('Addressing gaps here increases the likelihood of being cited or summarized accurately in AI-generated answers.')

      let narrative = narrativeParts.join(' ')
      const nextTip = summaryJson.sections.risks_next_steps?.[0]
      if (nextTip) narrative += ` Next: ${nextTip}.`

      const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length
      const minWords = 70
      const maxWords = 120

      if (wordCount(narrative) < minWords) {
        const topTasks = summaryJson.sections.tasks?.top_open?.map(t => t.title).slice(0, 3) || []
        if (topTasks.length > 0) {
          narrative += ` Prioritize: ${topTasks.join('; ')}.`
        }
      }
      if (wordCount(narrative) > maxWords) {
        const words = narrative.split(/\s+/).slice(0, maxWords)
        narrative = words.join(' ').replace(/[;,]$/,'').trim() + '.'
      }

      parts.push(narrative)
    }

    const next = summaryJson.sections.risks_next_steps?.[0]
    if (next) parts.push(`Next: ${next}.`)

    const text = parts.filter(Boolean).join(' ').trim()
    return text || summaryFromModel || nlrSummary
    }
  
    // No WeeklyReport data - fallback to NaturalLanguageReport or summaryFromModel
    return summaryFromModel || nlrSummary || ''
  }

  // Build final summary - prioritize WeeklyReport, fallback to NaturalLanguageReport
  const summary = buildDigestibleSummary() || nlrSummary
  
  // Note: brandProfileId is already defined above (line ~51)

  // Fetch real citation data from aggregated prompt results
  const { data: citationsData, isLoading: isLoadingCitations } = useSWR(
    brandProfileId ? `/api/analytics/citations?brandProfileId=${brandProfileId}&limit=5&days=30${modelParam}` : null,
    async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) return null
      const json = await res.json()
      return json.data
    }
  )

  // Transform citation data for display
  const citations: Array<{ domain: string; used: number }> = React.useMemo(() => {
    if (!citationsData?.citations) return []
    return citationsData.citations.map((c: any) => ({
      domain: c.domain,
      used: c.percentage
    }))
  }, [citationsData])

  // Fetch aggregated competitor rankings with proper SOV calculation
  // Uses the new /api/analysis/competitors endpoint that:
  // - Aggregates across ALL analysis runs (all tracked prompts)
  // - SOV % = (competitor mentions ÷ total competitor mentions) × 100
  // - Excludes the user's brand from competitors
  // - Ranks by SOV (highest first)
  // - Returns Top 5 competitors
  const { data: competitorsData, mutate: refreshCompetitors, isLoading: isLoadingCompetitors } = useSWR(
    brandProfileId ? `/api/analysis/competitors?brandProfileId=${brandProfileId}&limit=5${modelParam}` : null,
    async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) return null
      const json = await res.json()
      return json.data
    }
  )

  // Transform competitor data for display
  // Note: User's brand is already excluded by the API
  // Data is already sorted by SOV (highest first) by the API
  const competitorRankings: Array<{ name: string; sov: number }> = React.useMemo(() => {
    if (!competitorsData?.competitors) return []
    
    return competitorsData.competitors.map((comp: any) => ({
      name: comp.name || '',
      sov: comp.shareOfVoice || 0 // SOV % already calculated by API
    }))
  }, [competitorsData])

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

    // Sort by most recent (using updatedAt or createdAt)
    const sorted = [...promptsWithResults].sort((a: any, b: any) => {
      const dateA = new Date(a.updatedAt || a.createdAt).getTime()
      const dateB = new Date(b.updatedAt || b.createdAt).getTime()
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

      // Format timestamp - use static date format to avoid hydration mismatch
      const date = new Date(prompt.updatedAt || prompt.createdAt)
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

    // Get metrics from promptsData aggregate
    const aiVisibility = promptsData?.aggregate?.overallScore
      ? `${Math.round(promptsData.aggregate.overallScore)}%`
      : '—'
    const avgPosition = promptsData?.aggregate?.averagePosition
      ? `#${promptsData.aggregate.averagePosition.toFixed(1)}`
      : '—'
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
            <div className="text-base font-medium text-white/90">Summary</div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <IconInfoCircle className="size-4 text-white/60" />
                </span>
              </TooltipTrigger>
              <TooltipContent sideOffset={8}>AI-generated summary of your brand visibility.</TooltipContent>
            </Tooltip>
          </div>

          <div className="p-5 flex-1 flex flex-col">
            <div className="flex-1">
              {isLoading ? (
                <div className="space-y-2">
                  <div className="h-4 w-full bg-white/10 animate-pulse rounded" />
                  <div className="h-4 w-11/12 bg-white/10 animate-pulse rounded" />
                  <div className="h-4 w-10/12 bg-white/10 animate-pulse rounded" />
                  <div className="h-4 w-full bg-white/10 animate-pulse rounded" />
                  <div className="h-4 w-9/12 bg-white/10 animate-pulse rounded" />
                </div>
              ) : error ? (
                <div className="py-12 text-center">
                  <p className="text-base text-white/60">Failed to load report. Please try again.</p>
                </div>
              ) : !summary ? (
                <div className="py-12 text-center">
                  <p className="text-base text-white/60">No report available yet.</p>
                  <p className="text-sm text-white/40 mt-2">Generate a report to see your AI visibility summary.</p>
                </div>
              ) : (
                <p className="text-base leading-7 text-white/85">
                  {summary}
                </p>
              )}
            </div>

            <div className="flex justify-end mt-4">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-white/50 hover:text-white hover:bg-white/[0.04] text-xs"
                onClick={() => setShowReportHistory(true)}
              >
                <FileText className="size-3.5 mr-1.5" /> History
              </Button>
            </div>
          </div>
        </div>
          
          <div className="flex flex-col gap-5">
            {/* Competitor Rankings Table - Share of Voice */}
            <div className="rounded-xl bg-[#161616] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
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
                    <p className="text-sm text-white/60">No competitor data available yet.</p>
                    <p className="text-xs text-white/40 mt-1">Run an analysis to see competitor rankings.</p>
                  </div>
                ) : (
                  competitorRankings.map((competitor, idx) => {
                    const logoUrl = getCompanyLogoUrl(competitor.name)
                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.02]"
                      >
                        <div className="w-6 text-sm text-white/50 tabular-nums">{idx + 1}</div>
                        <div className="flex items-center gap-2.5 min-w-0">
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt={competitor.name}
                              className="size-6 rounded object-contain bg-white/5"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                target.nextElementSibling?.classList.remove('hidden')
                              }}
                            />
                          ) : null}
                          <span
                            className={`inline-flex items-center justify-center size-6 rounded bg-white/5 border border-white/[0.04] text-[10px] text-white/80 ${logoUrl ? 'hidden' : ''}`}
                          >
                            {competitor.name[0]?.toUpperCase() || '?'}
                          </span>
                          <span className="text-sm truncate text-white/90">
                            {competitor.name}
                          </span>
                        </div>
                        <div className="text-sm tabular-nums text-white/70 font-medium">{competitor.sov}%</div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
          
          {/* Citations list */}
          <div className="rounded-xl bg-[#161616] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
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
            <div className="divide-y divide-white/[0.06]">
              <div className="grid grid-cols-[1fr_auto] items-center px-5 py-2.5 text-xs text-white/50">
                <span>Source</span>
                <span>Mention rate</span>
              </div>
              {isLoadingCitations ? (
                <div className="divide-y divide-white/[0.06]">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[1fr_auto] items-center px-5 py-3.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="block size-6 rounded bg-white/10 animate-pulse" />
                        <span className="block h-4 w-32 rounded bg-white/10 animate-pulse" />
                      </div>
                      <span className="block h-4 w-10 rounded bg-white/10 animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : citations.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <p className="text-sm text-white/60">No citation data available yet.</p>
                  <p className="text-xs text-white/40 mt-1">Run an analysis to see citation sources.</p>
                </div>
              ) : (
                citations.map((c, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_auto] items-center px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="inline-flex items-center justify-center size-6 rounded bg-white/5 border border-white/[0.04] text-[10px] text-white/80">
                        {c.domain[0].toUpperCase()}
                      </span>
                      <span className="truncate text-sm text-white/90">{c.domain}</span>
                    </div>
                    <div className="text-sm tabular-nums text-white/70 font-medium">{c.used}%</div>
                  </div>
                ))
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
    </div>
  )
}


