"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowLeft, TrendingUp, Target, Award, MessageSquare, MessageSquareText, Building2, GraduationCap, Globe, Clock, Maximize2, Tag, ChevronRight, CheckCircle, ChevronDown, XCircle, ExternalLink, FileText, ListOrdered, BookOpen, HelpCircle } from "lucide-react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { FloatingMudraButton } from "@/components/floating-mudra-button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BrandProfileProvider, useBrandProfile } from "@/components/brand-profile-context"
import { useParams } from "next/navigation"
import { useEffect } from "react"

// Model icon mapping - helper function to get icon based on model name
const getModelIcon = (model: string): string | null => {
  const modelLower = model.toLowerCase()
  if (modelLower.includes('chatgpt') || modelLower.includes('gpt') || modelLower.includes('openai')) return "/openai_dark.svg"
  if (modelLower.includes('claude') || modelLower.includes('anthropic')) return "/claude-ai-icon.svg"
  if (modelLower.includes('perplexity')) return "/perplexity (2).svg"
  if (modelLower.includes('gemini')) return "/gemini (3).svg"
  if (modelLower.includes('google') || modelLower.includes('aio') || modelLower.includes('overviews')) return "/google-logo.svg"
  return null
}

// Palette for dynamic competitor lines (high-contrast, dark-theme friendly)
// Green color for "You" (user's brand)
const YOU_COLOR = "#22c55e" // emerald-500
const COMPETITOR_COLORS = [
  "#4e79a7", // tableau blue
  "#f28e2b", // tableau orange
  "#e15759", // tableau red
  "#76b7b2", // tableau teal
  "#59a14f", // tableau green
  "#edc948", // tableau yellow
  "#b07aa1", // tableau purple
  "#ff9da7", // tableau pink
  "#9c755f", // tableau brown
  "#bab0ab", // tableau gray
]

function toSeriesKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_")
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white/30" style={{ backgroundColor: color }} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

type CompetitorRow = { 
  rank: number
  company: string
  visibility: number
  position: number | null
  sentiment: 'Positive' | 'Neutral' | 'Negative'
  isYou?: boolean
}

// Citation source type from API
type CitationSource = {
  domain: string
  frequency: number
  citationFrequencyPercent: number
  citationType: 'Blog Post' | 'Listicle' | 'Docs' | 'Case Study' | 'Academic' | 'News' | 'Other'
  urls?: Array<{
    url: string
    title?: string
    citationType: string
    brandMentioned: boolean
  }>
  chatsWithCitation?: number
}



// Recent chats history
type ChatHistoryEntry = {
  id: string
  provider: 'Google' | 'OpenAI' | 'Anthropic' | 'Perplexity' | 'Gemini'
  snippet: string
  rank: number
  timeAgo: string
  avgPosition: number
  date: string
  mentioned: boolean
  position: number
  extraMentions: number
  fullResponse: string
  responseCitations?: { domain: string; type?: 'Example' | 'Listicle' | 'Blog Post' | 'Case Study' | 'Docs' | 'Other' }[]
}

// @deprecated - This mock data is no longer used. All data now comes from the API.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockRecentChats: ChatHistoryEntry[] = [
  {
    id: 'h1',
    provider: 'Google',
    snippet: 'Leading AI infrastructure providers in Silicon Valley include NVIDIA, Google, Microsoft and Scale AI…',
    rank: 1,
    timeAgo: '23 hr. ago',
    avgPosition: 1.6,
    date: '27 Oct, 2025',
    mentioned: true,
    position: 4,
    extraMentions: 38,
    fullResponse: [
      'Leading AI infrastructure providers in Silicon Valley include hardware giants like NVIDIA, cloud providers such as Google and Microsoft, and specialized infrastructure and data companies like Scale AI and SambaNova Systems. These companies provide the hardware, software, and data services essential for developing and deploying AI models.',
      '',
      'Sources: digiscorp.com · nvidia.com · vt.edu · shadihinlab.com',
      '',
      'Hardware and chip providers — source: impaxam.com',
      '• NVIDIA: A dominant force in AI hardware, providing GPUs and software that are integrated into systems by other hardware manufacturers like Dell, HPE, and Supermicro.',
      '• SambaNova Systems: Develops hardware and software solutions specifically for large‑scale deep learning.',
      '• AMD: A major player in AI chips, offering components like FPGAs.',
      '',
      'Cloud and platform providers — source: yahoo.com',
      '• Google: Invests heavily in AI and has developed its own hardware like TPUs.',
      '• Microsoft: A major cloud provider investing billions in AI infrastructure, including data centers.',
      '• Amazon: Also investing billions in data centers to support AI infrastructure.',
      '• IBM: Provides enterprise‑level AI solutions and infrastructure.'
    ].join('\n'),
    responseCitations: [
      { domain: 'digiscorp.com', type: 'Docs' },
      { domain: 'nvidia.com', type: 'Docs' },
      { domain: 'vt.edu', type: 'Other' },
      { domain: 'shadihinlab.com', type: 'Blog Post' },
      { domain: 'impaxam.com', type: 'Docs' },
      { domain: 'yahoo.com', type: 'Blog Post' }
    ]
  },
  {
    id: 'h2',
    provider: 'OpenAI',
    snippet: 'If you’re an AI startup in the U.S., here’s a structured growth framework to scale…',
    rank: 1,
    timeAgo: '23 hr. ago',
    avgPosition: 1.8,
    date: '27 Oct, 2025',
    mentioned: true,
    position: 1,
    extraMentions: 14,
    fullResponse: [
      'If you’re an AI‑startup based in the U.S., scaling well means more than “just build a model and go viral.” Below is a structured growth framework tailored to AI startups — combining what’s working in 2025 with practical U.S. market considerations.',
      '',
      '1. Foundation & Product–Market Fit',
      '✓ Solve a real, urgent problem',
      '• Many AI startups fail by building “cool tech” instead of solving a pressing pain point. Pick a domain where customers pay for value.',
      '• Focus on outcome not model: time saved, cost reduced, revenue improved.',
      '',
      '🧱 Build a defensible core',
      '• As models commoditize, moats come from proprietary data, domain expertise, workflow embedding, and vertical specialization.',
      '',
      '2. Go‑to‑Market & Growth Strategy',
      '📌 Focus on a niche then expand',
      '• Start with one clearly defined segment. Once you nail it, expand horizontally or deepen vertically.',
      '',
      '🔁 Use AI to power growth itself',
      '• Leverage your product’s AI for lead scoring, sales assistance, and onboarding.',
    ].join('\n'),
    responseCitations: [
      { domain: 'a16z.com', type: 'Blog Post' },
      { domain: 'ycombinator.com', type: 'Blog Post' }
    ]
  },
  {
    id: 'h3',
    provider: 'Anthropic',
    snippet: 'There are several high‑quality data annotation platforms that cater to different data types…',
    rank: 2,
    timeAgo: '23 hr. ago',
    avgPosition: 2.3,
    date: '27 Oct, 2025',
    mentioned: true,
    position: 4,
    extraMentions: 38,
    fullResponse: [
      'Best data annotation platforms for machine learning fall into three buckets: full‑service vendors, managed marketplaces, and self‑serve tools.',
      '',
      '• Full‑service: Provide project management, QA, and vertical expertise (e.g., medical, legal).',
      '• Managed marketplaces: Flexible staffing with vetted workers; great for spikes and cost control.',
      '• Self‑serve: Fast iteration for in‑house teams; strong analytics and labeling ops features.',
    ].join('\n'),
    responseCitations: [
      { domain: 'paperswithcode.com', type: 'Docs' },
      { domain: 'scale.com', type: 'Docs' }
    ]
  },
  {
    id: 'h4',
    provider: 'Perplexity',
    snippet: 'Here are five top companies that offer high‑quality data labeling and training‑data solutions…',
    rank: 1,
    timeAgo: '23 hr. ago',
    avgPosition: 1.4,
    date: '28 Oct, 2025',
    mentioned: true,
    position: 4,
    extraMentions: 38,
    fullResponse: [
      'Top companies that offer high‑quality data labeling and training‑data solutions include Scale AI, Labelbox, and Appen, each with strengths in tooling, workforce quality, or vertical expertise.',
      '',
      '• Scale AI: enterprise‑grade workflows and robust QA.',
      '• Labelbox: modern tooling and model‑assisted labeling.',
      '• Appen: global workforce at scale.',
    ].join('\n'),
    responseCitations: [
      { domain: 'labelbox.com', type: 'Docs' },
      { domain: 'scale.com', type: 'Docs' },
      { domain: 'appen.com', type: 'Docs' }
    ]
  },
  {
    id: 'h5',
    provider: 'Gemini',
    snippet: 'Major US‑based AI platforms include large integrated cloud services and specialized providers…',
    rank: 1,
    timeAgo: '23 hr. ago',
    avgPosition: 1.5,
    date: '30 Oct, 2025',
    mentioned: true,
    position: 1,
    extraMentions: 39,
    fullResponse: [
      'US‑based platforms for AI model training and hosting include AWS, Google Cloud, Microsoft Azure, and Oracle. For startups, selecting a platform often comes down to managed services, GPU availability, and ecosystem fit.',
      '',
      '• AWS: breadth of managed services and GPU options.',
      '• Google Cloud: Vertex AI and TPU availability.',
      '• Azure: strong enterprise integrations and OpenAI partnership.',
    ].join('\n'),
    responseCitations: [
      { domain: 'cloud.google.com', type: 'Docs' },
      { domain: 'aws.amazon.com', type: 'Docs' },
      { domain: 'azure.microsoft.com', type: 'Docs' }
    ]
  },
]

// Helper to map provider names from API to UI format
function mapProviderName(provider: string): ChatHistoryEntry['provider'] {
  const lower = provider.toLowerCase()
  if (lower.includes('openai') || lower.includes('chatgpt') || lower.includes('gpt')) return 'OpenAI'
  if (lower.includes('anthropic') || lower.includes('claude')) return 'Anthropic'
  if (lower.includes('perplexity')) return 'Perplexity'
  if (lower.includes('gemini')) return 'Gemini'
  if (lower.includes('google')) return 'Google'
  return 'OpenAI' // Default fallback
}

function getProviderBadgeClass(_provider: ChatHistoryEntry['provider']) {
  // Neutral, minimalist chip regardless of provider
  return 'bg-white/10 text-white/80'
}

function getProviderIconSrc(provider: ChatHistoryEntry['provider']): string {
  switch (provider) {
    case 'OpenAI':
      return '/openai_dark.svg'
    case 'Anthropic':
      return '/claude-ai-icon.svg'
    case 'Perplexity':
      return '/perplexity%20(2).svg'
    case 'Gemini':
    case 'Google':
      return '/gemini%20(3).svg'
    default:
      return '/openai_dark.svg'
  }
}

function getProviderDisplay(provider: ChatHistoryEntry['provider']): string {
  switch (provider) {
    case 'OpenAI':
      return 'ChatGPT'
    case 'Anthropic':
      return 'Claude'
    case 'Perplexity':
      return 'Perplexity'
    case 'Google':
      return 'Google AI Overviews'
    case 'Gemini':
      return 'Gemini'
  }
}

function getVisibilityClass(value: number) {
  // Monochrome style to match dashboard UI
  return value > 0
    ? "bg-white/10 text-white/90 border-white/15"
    : "bg-white/5 text-white/70 border-white/15"
}

function getPositionClass(value: number | null) {
  // Monochrome style to match dashboard UI
  return value === null
    ? "bg-white/5 text-white/60 border-white/15"
    : "bg-white/10 text-white/90 border-white/15"
}

type CitationCategory = 'Social Content' | 'Company Sources' | 'Academic Sources' | 'Wikipedia'
function mapCitationCategory(original?: string): CitationCategory {
  const src = (original || '').toLowerCase()
  if (src.includes('wikipedia')) return 'Wikipedia'
  if (src.includes('academic') || src.includes('paper') || src.includes('research')) return 'Academic Sources'
  if (src.includes('docs') || src.includes('documentation') || src.includes('case') || src.includes('company')) return 'Company Sources'
  return 'Social Content'
}

// Helper to extract domain from URL
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace('www.', '')
  } catch {
    // If URL parsing fails, try to extract domain with regex
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/)
    return match ? match[1] : url
  }
}

// Helper to map citation metadata to type
function mapCitationType(title: string): 'Example' | 'Listicle' | 'Blog Post' | 'Case Study' | 'Docs' | 'Other' {
  const titleLower = title.toLowerCase()
  if (titleLower.includes('example')) return 'Example'
  if (titleLower.includes('list') || titleLower.includes('top ') || titleLower.includes('best ')) return 'Listicle'
  if (titleLower.includes('blog') || titleLower.includes('article')) return 'Blog Post'
  if (titleLower.includes('case study') || titleLower.includes('success story')) return 'Case Study'
  if (titleLower.includes('docs') || titleLower.includes('documentation') || titleLower.includes('guide')) return 'Docs'
  return 'Other'
}

type ContentType = 'Blog Post' | 'Listicle' | 'Guide' | 'Discussion'
function mapContentType(original?: string): ContentType {
  const src = (original || '').toLowerCase()
  if (src.includes('list')) return 'Listicle'
  if (src.includes('doc') || src.includes('guide')) return 'Guide'
  if (src.includes('discussion') || src.includes('forum')) return 'Discussion'
  return 'Blog Post'
}

function ContentTypeIcon({ type }: { type: ContentType }) {
  const common = 'h-3.5 w-3.5'
  switch (type) {
    case 'Blog Post':
      return <FileText className={common} />
    case 'Listicle':
      return <ListOrdered className={common} />
    case 'Guide':
      return <BookOpen className={common} />
    case 'Discussion':
      return <MessageSquare className={common} />
  }
}

function CitationCategoryIcon({ category }: { category: CitationCategory }) {
  const common = 'h-3.5 w-3.5'
  switch (category) {
    case 'Social Content':
      return <MessageSquareText className={common} />
    case 'Company Sources':
      return <Building2 className={common} />
    case 'Academic Sources':
      return <GraduationCap className={common} />
    case 'Wikipedia':
      return <Globe className={common} />
  }
}

// (Derived metrics moved inside component)

function TrackedPromptDeepViewInner() {
  const { profile } = useBrandProfile()
  const [dateRange, setDateRange] = useState<'7d' | '14d' | '30d'>('7d')
  const params = useParams() as { id?: string } | undefined
  const promptId = params?.id
  
  // Real data state
  const [promptData, setPromptData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Platform and date range filters (lifted up for propagation across all components)
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all")
  
  // Fetch prompt details from API with filters
  useEffect(() => {
    if (!profile?.id || !promptId) {
      return
    }

    async function fetchPromptDetails() {
      setIsLoading(true)
      setError(null)
      
      try {
        // Include date range and platform in API request
        const url = `/api/prompts/${promptId}?brandProfileId=${profile.id}&dateRange=${dateRange}&platform=${selectedPlatform}`
        const response = await fetch(url)
        const result = await response.json()
        
        if (response.ok && result.success) {
          setPromptData(result.prompt)
        } else {
          setError(result.error || 'Failed to load prompt')
        }
      } catch (err) {
        console.error('Error fetching prompt:', err)
        setError('Failed to load prompt details')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPromptDetails()
  }, [profile?.id, promptId, dateRange, selectedPlatform])  // Re-fetch when filters change
  
  const promptLabel = promptData?.text || (promptId ? `Prompt ${promptId}` : 'Current Prompt')
  const promptIntentRaw = promptData?.category
  const promptIntentLabel = promptIntentRaw
    ? (promptIntentRaw === 'How-to' ? 'Guide' : promptIntentRaw.replace('-', ' '))
    : null
  // Expand to show more rows
  const INITIAL_VISIBLE = 10
  const [sourceVisibleCount, setSourceVisibleCount] = useState(INITIAL_VISIBLE)
  const [sourcesRange, setSourcesRange] = useState<'7d' | '14d' | '30d'>('7d')
  
  // Citation sources from API
  const citationSources: CitationSource[] = useMemo(() => {
    if (!promptData?.citationAnalysis?.sources) {
      return []
    }
    return promptData.citationAnalysis.sources.map((source: any) => ({
      domain: source.domain,
      frequency: source.frequency,
      citationFrequencyPercent: source.citationFrequencyPercent,
      citationType: source.citationType || 'Other',
      urls: source.urls || [],
      chatsWithCitation: source.chatsWithCitation
    }))
  }, [promptData])
  
  const sortedCitationSources = useMemo(() => 
    [...citationSources].sort((a, b) => b.frequency - a.frequency), 
    [citationSources]
  )
  const totalCitationFrequency = useMemo(() => 
    citationSources.reduce((sum, c) => sum + c.frequency, 0),
    [citationSources]
  )
  const visibleSources = sortedCitationSources.slice(0, sourceVisibleCount)
  
  function providerKey(p: ChatHistoryEntry['provider']): 'ChatGPT' | 'Claude' | 'Perplexity' | 'AI Overviews' | 'Gemini' {
    switch (p) {
      case 'OpenAI':
        return 'ChatGPT'
      case 'Anthropic':
        return 'Claude'
      case 'Perplexity':
        return 'Perplexity'
      case 'Google':
        return 'AI Overviews'
      case 'Gemini':
        return 'Gemini'
    }
  }
  // Compute recent chats from API response
  const recentChats: ChatHistoryEntry[] = useMemo(() => {
    if (!promptData?.testResults || promptData.testResults.length === 0) {
      return [] // Return empty array - empty states will be shown by the UI
    }
    
    return promptData.testResults.map((result: any, index: number) => {
      const provider = mapProviderName(result.provider || result.model)
      const snippet = result.response 
        ? result.response.substring(0, 100) + (result.response.length > 100 ? '…' : '')
        : 'No response available'
      
      // Calculate time ago (using analysisDate)
      const analysisDate = promptData.analysisDate ? new Date(promptData.analysisDate) : new Date()
      const now = new Date()
      const hoursAgo = Math.floor((now.getTime() - analysisDate.getTime()) / (1000 * 60 * 60))
      const timeAgo = hoursAgo < 24 ? `${hoursAgo} hr. ago` : `${Math.floor(hoursAgo / 24)} days ago`
      
      // Extract citations from API response
      const responseCitations = (result.citations || []).map((citation: any) => ({
        domain: extractDomain(citation.url),
        type: mapCitationType(citation.title || '')
      }))
      
      return {
        id: `chat_${index}`,
        provider,
        snippet,
        rank: index + 1,
        timeAgo,
        avgPosition: result.position || 0,
        date: analysisDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
        mentioned: result.mentioned || false,
        position: result.position || 0,
        extraMentions: result.competitorsMentioned?.length || 0,
        fullResponse: result.response || 'No response available',
        responseCitations
      }
    })
  }, [promptData])
  
  const filteredChats = recentChats.filter((c) => selectedPlatform === 'all' || providerKey(c.provider) === selectedPlatform)
  const [chatVisibleCount, setChatVisibleCount] = useState(INITIAL_VISIBLE)
  const visibleChats = filteredChats.slice(0, chatVisibleCount)
  // Source dialog view & pagination for chats by source
  const [sourceDialogView, setSourceDialogView] = useState<'sources' | 'prompt'>('sources')
  const [sourceChatsVisibleCount, setSourceChatsVisibleCount] = useState(INITIAL_VISIBLE)
  const remainingSources = Math.max(0, sortedCitationSources.length - visibleSources.length)
  const remainingChats = Math.max(0, filteredChats.length - visibleChats.length)
  type BottomView = 'chats' | 'sources'
  const [bottomView, setBottomView] = useState<BottomView>('chats')
  // Selected competitor (single-select like radio)
  const [activeCompetitor, setActiveCompetitor] = useState<string | null>(null)

  // Compute competitors data from API response
  const competitorsData: CompetitorRow[] = useMemo(() => {
    // Try to use the detailed metrics first, fallback to simple list
    if (promptData?.competitiveLandscape?.competitorsWithMetrics) {
      return promptData.competitiveLandscape.competitorsWithMetrics.map((competitor: any, index: number) => ({
        rank: index + 1,
        company: competitor.name,
        visibility: competitor.visibility,
        position: competitor.position,
        sentiment: competitor.sentiment as 'Positive' | 'Neutral' | 'Negative'
      }))
    }
    
    // Fallback: if only the simple 'mentioned' list is available
    if (promptData?.competitiveLandscape?.mentioned) {
      return promptData.competitiveLandscape.mentioned.map((company: string, index: number) => ({
        rank: index + 1,
        company,
        visibility: 0,
        position: null,
        sentiment: 'Neutral' as const,
        isYou: false
      }))
    }
    
    return []
  }, [promptData])

  // Compute competitors data WITH "You" row from API response
  const competitorsDataWithYou: CompetitorRow[] = useMemo(() => {
    // Use competitorsWithYou from API if available (includes "You" row)
    if (promptData?.competitiveLandscape?.competitorsWithYou) {
      return promptData.competitiveLandscape.competitorsWithYou.map((competitor: any, index: number) => ({
        rank: competitor.isYou ? 0 : index, // "You" gets rank 0 to stay at top
        company: competitor.name,
        visibility: competitor.visibility,
        position: competitor.position,
        sentiment: (competitor.sentiment as 'Positive' | 'Neutral' | 'Negative') || 'Neutral',
        isYou: competitor.isYou || false
      }))
    }
    
    // Fallback: construct "You" row from brand metrics + competitors
    const youRow: CompetitorRow = {
      rank: 0,
      company: promptData?.brandProfile?.companyName || profile?.companyName || 'Your Brand',
      visibility: promptData?.visibility || 0,
      position: promptData?.averagePosition || null,
      sentiment: (promptData?.sentiment as 'Positive' | 'Neutral' | 'Negative') || 'Neutral',
      isYou: true
    }
    
    return [youRow, ...competitorsData.map(c => ({ ...c, isYou: false }))]
  }, [promptData, competitorsData, profile?.companyName])

  // Dynamic competitor series config (including "You" with special color)
  const competitorSeries = useMemo(() => {
    return competitorsDataWithYou.map((c, idx) => ({
      key: toSeriesKey(c.company),
      label: c.company,
      color: c.isYou ? YOU_COLOR : COMPETITOR_COLORS[(idx - 1) % COMPETITOR_COLORS.length],
      visibility: c.visibility,
      isYou: c.isYou
    }))
  }, [competitorsDataWithYou])

  const computedChartConfig = useMemo(() => {
    const cfg: ChartConfig = {}
    competitorSeries.forEach((s) => {
      cfg[s.key] = { label: s.label, color: s.color }
    })
    return cfg
  }, [competitorSeries])

  // Build chart data from API visibility history time-series
  const chartData = useMemo(() => {
    // Use real visibility history from API if available
    if (promptData?.visibilityHistory && promptData.visibilityHistory.length > 0) {
      return promptData.visibilityHistory.map((point: any) => {
        const row: any = { day: point.displayDate }
        
        // Add "you" visibility
        row['you'] = point.you || 0
        
        // Add each competitor's visibility for this day
        if (point.competitors) {
          Object.keys(point.competitors).forEach(compName => {
            row[toSeriesKey(compName)] = point.competitors[compName]
          })
        }
        
        // Also add any competitors that might not have data for this day
        competitorSeries.forEach((s) => {
          if (!(s.key in row)) {
            row[s.key] = 0
          }
        })
        
        return row
      })
    }
    
    // Fallback: create flat chart data from current visibility values
    // Generate placeholder days based on date range
    const days = dateRange === '7d' ? 7 : dateRange === '14d' ? 14 : 30
    const now = new Date()
    const dataPoints = []
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const displayDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      
      const row: any = { day: displayDate }
      competitorSeries.forEach((s) => {
        row[s.key] = s.visibility
      })
      dataPoints.push(row)
    }
    
    return dataPoints
  }, [promptData?.visibilityHistory, competitorSeries, dateRange])

  // Derived metrics for bottom stats
  const avgYouVisibility = useMemo(() => {
    const youData = competitorsDataWithYou.find(c => c.isYou)
    return youData?.visibility || 0
  }, [competitorsDataWithYou])

  const bestPosition = useMemo(() => {
    const allPositions = competitorsDataWithYou
      .filter(c => c.position !== null)
      .map(c => c.position!)
    const bestPositionValue = allPositions.length > 0 ? Math.min(...allPositions) : null
    return bestPositionValue !== null ? bestPositionValue.toFixed(1) : "—"
  }, [competitorsDataWithYou])

  const topCompetitor = useMemo(() => {
    // Find the competitor with highest visibility (excluding "You")
    const competitors = competitorsDataWithYou.filter(c => !c.isYou)
    if (competitors.length === 0) return "—"
    const sorted = [...competitors].sort((a, b) => b.visibility - a.visibility)
    return sorted[0]?.company || "—"
  }, [competitorsDataWithYou])

  const rowHeightClass = 'h-12'
  
  // Show loading state
  if (isLoading) {
    return (
      <SidebarProvider
        className="bg-dark-grey"
        style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
      >
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <Separator className="w-full border-border" />
          <div className="flex flex-1 flex-col items-center justify-center bg-dark-grey p-8">
            <div className="text-muted-foreground">Loading prompt details...</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }
  
  // Show error state
  if (error || !promptData) {
    return (
      <SidebarProvider
        className="bg-dark-grey"
        style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
      >
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <Separator className="w-full border-border" />
          <div className="flex flex-1 flex-col items-center justify-center bg-dark-grey p-8">
            <div className="text-center space-y-4">
              <div className="text-xl text-white">Prompt Not Found</div>
              <div className="text-muted-foreground">{error || 'The requested prompt could not be found.'}</div>
              <Link href="/dashboard/tracked-prompts">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Tracked Prompts
                </Button>
              </Link>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
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
          <div className="container-type-inline-size container-name-main flex flex-1 flex-col gap-3 md:gap-4 bg-dark-grey">
            {/* Page Header */}
            <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link href="/dashboard/tracked-prompts">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 text-muted-foreground hover:text-white"
                      aria-label="Back to Tracked Prompts"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to Tracked Prompts
                    </Button>
                  </Link>
                </div>
                <div />
              </div>
              {/* Current Prompt and Intent tags + aligned filters */}
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                    <MessageSquare className="h-4 w-4 text-white/80" />
                    <span className="text-sm font-medium text-white/90 truncate" title={promptLabel}>{promptLabel}</span>
                  </div>
                  {promptIntentLabel && (
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                      <Tag className="h-4 w-4 text-white/80" />
                      <span className="text-sm font-medium text-white/90">{promptIntentLabel}</span>
                    </div>
                  )}
                </div>
                <div className="hidden md:flex items-center gap-3">
                  <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                    <SelectTrigger className="w-[160px] h-9 bg-white/5 border-white/10 text-white focus-visible:ring-0 focus-visible:ring-offset-0 outline-none">
                      <SelectValue placeholder="All Platforms" />
                    </SelectTrigger>
                    <SelectContent className="bg-dark-grey border-white/10">
                      <SelectItem value="all" className="focus:bg-white/10 outline-none">
                        All Platforms
                      </SelectItem>
                      <SelectItem value="ChatGPT" className="focus:bg-white/10 outline-none">
                        <div className="flex items-center gap-2">
                          {getModelIcon("ChatGPT") && (
                            <Image 
                              src={getModelIcon("ChatGPT")!} 
                              alt="" 
                              width={16} 
                              height={16}
                              className="shrink-0"
                            />
                          )}
                          <span>ChatGPT</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Claude" className="focus:bg-white/10 outline-none">
                        <div className="flex items-center gap-2">
                          {getModelIcon("Claude") && (
                            <Image 
                              src={getModelIcon("Claude")!} 
                              alt="" 
                              width={16} 
                              height={16}
                              className="shrink-0"
                            />
                          )}
                          <span>Claude</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Perplexity" className="focus:bg-white/10 outline-none">
                        <div className="flex items-center gap-2">
                          {getModelIcon("Perplexity") && (
                            <Image 
                              src={getModelIcon("Perplexity")!} 
                              alt="" 
                              width={16} 
                              height={16}
                              className="shrink-0"
                            />
                          )}
                          <span>Perplexity</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Gemini" className="focus:bg-white/10 outline-none">
                        <div className="flex items-center gap-2">
                          {getModelIcon("Gemini") && (
                            <Image 
                              src={getModelIcon("Gemini")!} 
                              alt="" 
                              width={16} 
                              height={16}
                              className="shrink-0"
                            />
                          )}
                          <span>Gemini</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="AI Overviews" className="focus:bg-white/10 outline-none">
                        <div className="flex items-center gap-2">
                          {getModelIcon("Google AIO") && (
                            <Image 
                              src={getModelIcon("Google AIO")!} 
                              alt="" 
                              width={16} 
                              height={16}
                              className="shrink-0"
                            />
                          )}
                          <span>Google AIO</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    {([
                      { key: '7d', label: '7d' },
                      { key: '14d', label: '14d' },
                      { key: '30d', label: '30d' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setDateRange(opt.key)}
                        className={cn(
                          "h-8 px-3 text-sm rounded-full border border-white/10",
                          dateRange === opt.key ? "bg-white/10 text-white" : "bg-transparent text-white/80 hover:text-white hover:bg-white/5"
                        )}
                        aria-pressed={dateRange === opt.key}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Clean Divider Line - Full Width */}
            <div className="h-[1px] bg-white/10"></div>

            {/* Content */}
            <div className="flex flex-1 px-4 lg:px-6 pt-6 pb-6 md:pb-8">
              <div className="w-full space-y-4">
                {/* Top row: two metric containers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="bg-transparent rounded-lg border border-white/[0.06]">
                    <CardContent className="pt-1 md:pt-2 px-5 md:px-6 pb-3 md:pb-4 min-h-[340px] md:min-h-[380px]">
                      <div className="flex items-center justify-between -mt-2 mb-0">
                        <div className="text-[14px] md:text-[15px] text-white/90 font-semibold">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1.5 cursor-help">Prompt Visibility <HelpCircle className="h-3.5 w-3.5 opacity-70" /></span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Percentage of chats mentioning your brand and competitors
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="hidden md:flex items-center gap-4" />
                      </div>
                      <Separator className="-mx-5 md:-mx-6 mb-2 border-border" />
                      <ChartContainer config={computedChartConfig} className="h-[290px] md:h-[330px] w-full [&_.recharts-cartesian-axis-tick_text]:fill-white [&_.recharts-cartesian-axis-tick_text]:opacity-90">
                        <LineChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="4 8" stroke="#ffffff" strokeOpacity={0.08} vertical={false} />
                          <XAxis
                            dataKey="day"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: '#ffffff' }}
                            tickMargin={8}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: '#ffffff' }}
                            tickFormatter={(v: number) => `${v}%`}
                            domain={[0, 100]}
                            tickMargin={8}
                          />
                          <ChartTooltip 
                            cursor={{ stroke: '#ffffff', strokeDasharray: '4 6', strokeOpacity: 0.15 }}
                            content={<ChartTooltipContent indicator="line" className="bg-black border-white/20 text-white/90 shadow-xl" />}
                          />
                          {competitorSeries.map((s) => (
                            <Line
                              key={s.key}
                              type="stepAfter"
                              dataKey={s.key}
                              stroke={s.color}
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 4, strokeWidth: 0 }}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              hide={!!activeCompetitor && activeCompetitor !== s.label}
                            />
                          ))}
                        </LineChart>
                      </ChartContainer>
                      <div className="mt-3 flex items-center justify-center gap-6 md:hidden" />
                    </CardContent>
                  </Card>
                  <Card className="bg-transparent rounded-lg border border-white/[0.06] py-0">
                    <CardContent className="p-0 min-h-[340px] md:min-h-[380px]">
                      <div>
                        <div className="rounded-lg border-0 overflow-hidden max-h-[340px] md:max-h-[360px] overflow-y-auto">
                          <Table className="w-full text-[15px]">
                          <TableHeader className="bg-white/5 sticky top-0 z-10 backdrop-blur-sm border-b border-white/10 text-[13px]">
                              <TableRow className="hover:bg-transparent h-12">
                                <TableHead className="w-[44px] text-white/70 px-4"></TableHead>
                                <TableHead className="w-[56px] text-white/70 px-2">#</TableHead>
                                <TableHead className="text-white/70 px-4">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex items-center gap-1.5 cursor-help">Company <HelpCircle className="h-3.5 w-3.5 opacity-70" /></span>
                                    </TooltipTrigger>
                                    <TooltipContent>Competitor name mentioned in responses</TooltipContent>
                                  </Tooltip>
                                </TableHead>
                                <TableHead className="w-[120px] text-right text-white/70 px-4">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex items-center gap-1.5 cursor-help">Visibility <HelpCircle className="h-3.5 w-3.5 opacity-70" /></span>
                                    </TooltipTrigger>
                                    <TooltipContent>Percent of chats that mention this competitor</TooltipContent>
                                  </Tooltip>
                                </TableHead>
                                <TableHead className="w-[140px] text-right text-white/70 px-4">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex items-center gap-1.5 cursor-help">Sentiment <HelpCircle className="h-3.5 w-3.5 opacity-70" /></span>
                                    </TooltipTrigger>
                                    <TooltipContent>Overall tone of mentions for this competitor</TooltipContent>
                                  </Tooltip>
                                </TableHead>
                                <TableHead className="w-[120px] text-right text-white/70 px-4">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex items-center gap-1.5 cursor-help">Position <HelpCircle className="h-3.5 w-3.5 opacity-70" /></span>
                                    </TooltipTrigger>
                                    <TooltipContent>Average position where competitor appears (lower is better)</TooltipContent>
                                  </Tooltip>
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                            {competitorsDataWithYou.length === 0 ? (
                              <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={6} className="h-32 text-center">
                                  <div className="flex flex-col items-center justify-center gap-2 text-white/60">
                                    <Building2 className="h-8 w-8 opacity-40" />
                                    <div className="text-sm">No competitor data available yet</div>
                                    <div className="text-xs text-white/40">
                                      Competitors will appear here after they are mentioned in AI responses
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : (
                              competitorsDataWithYou.map((row, index) => (
                                <TableRow 
                                  key={row.isYou ? 'you-row' : row.rank} 
                                  className={cn(
                                    "hover:bg-white/10 h-12 md:h-14 border-b border-white/10 last:border-b-0",
                                    row.isYou && "bg-emerald-500/10 border-l-2 border-l-emerald-500"
                                  )}
                                >
                                  <TableCell className="px-4 align-middle">
                                    <Checkbox
                                      className="scale-105"
                                      checked={activeCompetitor === row.company}
                                      onCheckedChange={() => setActiveCompetitor(activeCompetitor === row.company ? null : row.company)}
                                      aria-label={`Select ${row.company}`}
                                    />
                                  </TableCell>
                                  <TableCell className="text-white/90 px-2">
                                    {row.isYou ? (
                                      <span className="text-emerald-400 font-medium">★</span>
                                    ) : (
                                      index
                                    )}
                                  </TableCell>
                                  <TableCell className="text-white/90 truncate px-4">
                                    <span className={cn("truncate", row.isYou && "text-emerald-400 font-medium")}>
                                      {row.isYou ? `${row.company} (You)` : row.company}
                                    </span>
                                  </TableCell>
                                <TableCell className="text-right px-4">
                                    <Badge variant="outline" className={cn(
                                      "rounded-md px-2 py-0.5 text-[13px] border",
                                      row.isYou ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : getVisibilityClass(row.visibility)
                                    )}>
                                    {row.visibility}%
                                  </Badge>
                                </TableCell>
                                  <TableCell className="text-right px-4">
                                    <Badge className={`px-2 py-0.5 text-[13px] rounded border-0 ${
                                      row.sentiment === 'Negative' ? 'bg-red-500/20 text-red-300' :
                                      row.sentiment === 'Neutral' ? 'bg-white/10 text-white/80' :
                                      'bg-emerald-500/20 text-emerald-300'
                                    }`}>
                                      {row.sentiment}
                                    </Badge>
                                  </TableCell>
                                <TableCell className="text-right px-4">
                                  {row.position === null ? (
                                    <span className="text-white/60">—</span>
                                  ) : (
                                      <Badge variant="outline" className={`rounded-md px-2 py-0.5 text-[13px] border ${getPositionClass(row.position)}`}>
                                      {row.position.toFixed(1)}
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                            )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                {/* Bottom controls: toggle between Recent Chats and Sources */}
                <div className="flex items-center justify-start gap-2 px-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant={bottomView === 'chats' ? 'default' : 'ghost'}
                      size="sm"
                      className={bottomView === 'chats' ? 'h-8 rounded-full bg-white text-black hover:bg-white/90' : 'h-8 rounded-full border border-white/10 bg-white/5 text-white/80 hover:text-white'}
                      onClick={() => setBottomView('chats')}
                    >
                      Recent Chats
                    </Button>
                    <Button
                      variant={bottomView === 'sources' ? 'default' : 'ghost'}
                      size="sm"
                      className={bottomView === 'sources' ? 'h-8 rounded-full bg-white text-black hover:bg-white/90' : 'h-8 rounded-full border border-white/10 bg-white/5 text-white/80 hover:text-white'}
                      onClick={() => setBottomView('sources')}
                    >
                      Sources
                    </Button>
                  </div>
                </div>
                {/* Bottom: switch between chat executions table and sources table */}
                <Card className="bg-transparent rounded-lg border border-white/[0.06] py-0">
                  <CardContent className="p-0">
                    
                    {bottomView === 'sources' ? (
                      <div className="p-0">
                        <Table className="w-full text-[15px] table-fixed">
                          <TableHeader className="sticky top-0 z-10 backdrop-blur-sm bg-white/5 border-b border-white/[0.08] text-[13px]">
                            <TableRow className="hover:bg-transparent h-12">
                              <TableHead className="w-[56px] text-center text-white/70 px-2">#</TableHead>
                              <TableHead className="w-[50%] text-white/70 pl-2 pr-4">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1.5 cursor-help">Domain <HelpCircle className="h-3.5 w-3.5 opacity-70" /></span>
                                  </TooltipTrigger>
                                  <TooltipContent>Root domain cited in model responses for this prompt.</TooltipContent>
                                </Tooltip>
                              </TableHead>
                              <TableHead className="w-[120px] text-center text-white/70 px-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1.5 cursor-help">Citation Frequency (%) <HelpCircle className="h-3.5 w-3.5 opacity-70" /></span>
                                  </TooltipTrigger>
                                  <TooltipContent>Share of prompt runs where this domain appears as a citation.</TooltipContent>
                                </Tooltip>
                              </TableHead>
                              <TableHead className="w-[180px] text-center text-white/70 px-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1.5 cursor-help">Type of Citation <HelpCircle className="h-3.5 w-3.5 opacity-70" /></span>
                                  </TooltipTrigger>
                                  <TooltipContent>Category of this source.</TooltipContent>
                                </Tooltip>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {visibleSources.length === 0 ? (
                              <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={4} className="h-32 text-center">
                                  <div className="flex flex-col items-center justify-center gap-2 text-white/60">
                                    <Globe className="h-8 w-8 opacity-40" />
                                    <div className="text-sm">No citation sources found</div>
                                    <div className="text-xs text-white/40">
                                      Sources will appear here after they are cited in AI responses
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : visibleSources.map((row, idx) => (
                              <Dialog key={`${row.domain}-${row.citationType}-${idx}`}>
                                <DialogTrigger asChild>
                              <TableRow className={`hover:bg-white/10 even:bg-white/[0.03] border-b border-white/10 last:border-b-0 ${rowHeightClass} cursor-pointer`}>
                                    <TableCell className="w-[56px] text-center text-white/80 px-2">
                                      {idx + 1}
                                    </TableCell>
                                    <TableCell className="w-[50%] text-white/90 truncate pl-2 pr-4 max-w-0">
                                      <span className="truncate">{row.domain}</span>
                                    </TableCell>
                                    <TableCell className="text-center px-2">
                                      <div className="flex items-center justify-center">
                                        <Badge variant="outline" className="inline-flex items-center justify-center h-6 min-w-[56px] px-2 text-[13px] rounded-md border border-white/10 bg-white/5 text-white/90">
                                          {row.citationFrequencyPercent || Math.round((row.frequency / Math.max(1, totalCitationFrequency)) * 100)}%
                                        </Badge>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center px-2">
                                      <div className="flex items-center justify-center">
                                        <Badge className="inline-flex items-center justify-center gap-1.5 h-6 min-w-[140px] px-2 text-[13px] rounded bg-white text-black">
                                          <CitationCategoryIcon category={mapCitationCategory(row.citationType)} />
                                          {mapCitationCategory(row.citationType)}
                                        </Badge>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-4xl md:max-w-4xl rounded-xl border border-white/[0.08] bg-transparent backdrop-blur-sm p-0 max-h-[90vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle className="sr-only">Source Details</DialogTitle>
                                  </DialogHeader>
                                  <div className="px-5 py-6 space-y-6">
                                    {/* Breadcrumb guide */}
                                    <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px]">
                                      <MessageSquare className="h-3.5 w-3.5 text-white/70" />
                                      <span className="text-white/70">Prompts</span>
                                      <ChevronRight className="h-3.5 w-3.5 text-white/50" />
                                      <span className="truncate max-w-[45%] text-white/80" title={promptLabel}>{promptLabel}</span>
                                      <ChevronRight className="h-3.5 w-3.5 text-white/50" />
                                      <span className="text-white/70">Sources</span>
                                      <ChevronRight className="h-3.5 w-3.5 text-white/50" />
                                      <span className="truncate text-white/90 font-medium" title={row.domain}>{row.domain}</span>
                                    </div>
                                    {/* Domain header with range filter on the right */}
                                    <div className="flex items-center justify-between py-1.5">
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className="text-sm text-white/80 truncate">{row.domain}</div>
                                        <a href={`https://${row.domain}`} target="_blank" rel="noreferrer" className="text-xs text-white/70 hover:text-white/90 underline whitespace-nowrap">Visit domain</a>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {(['7d','14d','30d'] as const).map((r) => (
                                          <Button
                                            key={r}
                                            variant={sourcesRange === r ? 'default' : 'ghost'}
                                            size="sm"
                                            className={(sourcesRange === r ? 'bg-white text-black hover:bg-white/90 ' : 'border border-white/10 bg-white/5 text-white/80 hover:text-white ') + 'h-7 rounded-full text-[12px] px-3'}
                                            onClick={() => setSourcesRange(r)}
                                            aria-label={`Filter URLs ${r}`}
                                          >
                                            {r.toUpperCase()}
                                          </Button>
                                        ))}
                                      </div>
                                    </div>
                                    {/* KPI row */}
                                    <div className="grid grid-cols-1 gap-4">
                                      {/* Left KPI: Citation Frequency % */}
                                      <div className="rounded-lg border border-white/10 bg-white/5 p-5 md:p-5 min-h-[110px]">
                                        <div className="flex items-center justify-between gap-6">
                                          <div className="flex-1">
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <div className="text-base md:text-lg font-semibold text-white/90 cursor-help inline-flex items-center gap-1.5">Citation Frequency <HelpCircle className="h-3.5 w-3.5 opacity-70" /></div>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                Percentage of prompt runs where this domain appears
                                              </TooltipContent>
                                            </Tooltip>
                                          </div>
                                          <div className="text-4xl md:text-5xl font-semibold leading-none tracking-tight text-white/90">
                                            {Math.round((row.frequency / Math.max(1, totalCitationFrequency)) * 100)}%
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    {/* View selector: Sources | This prompt | All prompts */}
                                    <div className="mt-2 flex items-center justify-start">
                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant={sourceDialogView === 'sources' ? 'default' : 'ghost'}
                                          size="sm"
                                          className={(sourceDialogView === 'sources' ? 'bg-white text-black hover:bg-white/90 ' : 'border border-white/10 bg-white/5 text-white/80 hover:text-white ') + 'h-7 rounded-full text-[12px] px-3'}
                                          onClick={() => setSourceDialogView('sources')}
                                          aria-label="View sources list"
                                        >
                                          Sources
                                        </Button>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant={sourceDialogView === 'prompt' ? 'default' : 'ghost'}
                                              size="sm"
                                              className={(sourceDialogView === 'prompt' ? 'bg-white text-black hover:bg-white/90 ' : 'border border-white/10 bg-white/5 text-white/80 hover:text-white ') + 'h-7 rounded-full text-[12px] px-3'}
                                              onClick={() => setSourceDialogView('prompt')}
                                              aria-label="View chats for this prompt"
                                            >
                                              This prompt <HelpCircle className="h-3 w-3 ml-1 opacity-70" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            Shows chats for this prompt where this source was cited
                                          </TooltipContent>
                                        </Tooltip>
                                      </div>
                                    </div>

                                    {/* Chats by source (conditional) */}
                                    {sourceDialogView !== 'sources' && (() => {
                                      const platformMatches = (chat: ChatHistoryEntry) => selectedPlatform === 'all' || providerKey(chat.provider) === selectedPlatform
                                      const domainMatches = (chat: ChatHistoryEntry) => (chat.responseCitations || []).some((c) => (c as any).domain === row.domain)
                                      const scopeChats = recentChats
                                      const chatsForDomain = scopeChats.filter((c) => platformMatches(c) && domainMatches(c))
                                      const visibleChatsLocal = chatsForDomain.slice(0, sourceChatsVisibleCount)
                                      const remainingLocal = Math.max(0, chatsForDomain.length - visibleChatsLocal.length)

                                      return (
                                        <div className="mt-3 rounded-lg border border-white/[0.08] bg-transparent">
                                          <div className="max-h-[30vh] overflow-y-auto">
                                            <Table className="w-full text-[14px] md:text-[15px] table-fixed">
                                              <TableHeader className="sticky top-0 z-10 backdrop-blur-sm bg-white/5 border-b border-white/[0.08] text-[13px]">
                                                <TableRow className="hover:bg-transparent h-10">
                                                  <TableHead className="w-[220px] text-white/70 px-4">Platform</TableHead>
                                                  <TableHead className="text-white/70">Response</TableHead>
                                                  <TableHead className="w-[100px] text-center text-white/70 px-2">Citations</TableHead>
                                                  <TableHead className="w-[140px] text-center text-white/70 px-2">Date</TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {visibleChatsLocal.map((chat) => (
                                                  <TableRow key={chat.id} className="hover:bg-white/[0.04] border-b border-white/[0.08] last:border-b-0">
                                                    <TableCell className="px-4">
                                                      <div className="flex items-center gap-2">
                                                        <div className="flex items-center justify-center size-7 rounded-md border border-white/10 bg-white/5">
                                                          <Image src={getProviderIconSrc(chat.provider)} alt={`${chat.provider} icon`} width={12} height={12} />
                                                        </div>
                                                        <span className="text-sm text-white/90">{getProviderDisplay(chat.provider)}</span>
                                                      </div>
                                                    </TableCell>
                                                    <TableCell>
                                                      <div className="text-xs text-white/80 line-clamp-2 max-w-full">
                                                        {(chat.fullResponse || '').split('\n').filter(Boolean).slice(0, 2).join(' ').slice(0, 220)}
                                                      </div>
                                                    </TableCell>
                                                    <TableCell className="text-center text-white/80 px-2">
                                                      <Badge variant="outline" className="h-6 px-2 text-[12px] rounded-md border-white/[0.08] bg-white/5 text-white/90">
                                                        {Math.max(1, (chat.responseCitations || []).filter((c) => (c as any).domain === row.domain).length)}
                                                      </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center text-white/80 px-2">{chat.date}</TableCell>
                                                  </TableRow>
                                                ))}
                                                {visibleChatsLocal.length === 0 ? (
                                                  <TableRow>
                                                    <TableCell colSpan={4} className="text-center text-white/60 h-16">
                                                      No chats found for this source.
                                                    </TableCell>
                                                  </TableRow>
                                                ) : null}
                                              </TableBody>
                                            </Table>
                                          </div>
                                          <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.08]">
                                            <div className="flex items-center gap-2">
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 px-3 rounded-md border-white/[0.08] bg-white/5 text-white/80 hover:text-white"
                                                onClick={() => setSourceChatsVisibleCount(Math.min(sourceChatsVisibleCount + INITIAL_VISIBLE, chatsForDomain.length))}
                                                aria-label="Expand chats for this source"
                                                disabled={remainingLocal <= 0}
                                              >
                                                Expand
                                              </Button>
                                              {remainingLocal > 0 ? (
                                                <span className="text-xs text-white/50">{Math.min(INITIAL_VISIBLE, remainingLocal)} more</span>
                                              ) : (
                                                <span className="text-xs text-white/40">All items shown</span>
                                              )}
                                            </div>
                                            <span className="text-xs text-white/60">Showing 1 – {visibleChatsLocal.length} of {chatsForDomain.length} items</span>
                                          </div>
                                        </div>
                                      )
                                    })()}

                                    {/* URLs table (mock; wired later) */}
                                    {sourceDialogView === 'sources' && (
                                    <div className="rounded-lg border border-white/10 bg-white/[0.03]">
                                      <div className="max-h-[45vh] overflow-y-auto">
                                        <Table className="w-full text-[15px]">
                                          <TableHeader className="sticky top-0 z-10 backdrop-blur-sm bg-white/5 border-b border-white/[0.08] text-[13px]">
                                            <TableRow className="hover:bg-transparent h-10">
                                              <TableHead className="text-white/70 px-4">URL</TableHead>
                                              <TableHead className="w-[180px] text-center text-white/70 px-2">
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <span className="inline-flex items-center gap-1.5 cursor-help">Type of Content <HelpCircle className="h-3.5 w-3.5 opacity-70" /></span>
                                                  </TooltipTrigger>
                                                  <TooltipContent>Format of the referenced page (blog, guide, list, etc.)</TooltipContent>
                                                </Tooltip>
                                              </TableHead>
                                              <TableHead className="w-[140px] text-center text-white/70 px-2">
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <span className="inline-flex items-center gap-1.5 cursor-help">Mentioned? <HelpCircle className="h-3.5 w-3.5 opacity-70" /></span>
                                                  </TooltipTrigger>
                                                  <TooltipContent>Was your brand mentioned in this source?</TooltipContent>
                                                </Tooltip>
                                              </TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {/* Use real URLs from API if available, otherwise show empty state */}
                                            {(row.urls && row.urls.length > 0) ? (
                                              row.urls.map((item: { url: string; title?: string; citationType: string; brandMentioned: boolean }, idx: number) => (
                                              <TableRow key={`${item.url}-${idx}`} className="hover:bg-white/10 h-12 border-b border-white/10 last:border-b-0">
                                                <TableCell className="px-5">
                                                  <a href={item.url} target="_blank" rel="noreferrer" className="text-white/90 hover:underline truncate inline-block max-w-full align-middle">
                                                    {item.url}
                                                  </a>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                  <Badge className="h-6 px-2 text-[12px] rounded border border-white/15 bg-white/10 text-white/80 inline-flex items-center gap-1">
                                                    <ContentTypeIcon type={mapContentType(item.citationType)} />
                                                    {mapContentType(item.citationType)}
                                                  </Badge>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                  {item.brandMentioned ? (
                                                    <Badge className="h-6 px-2 text-[12px] rounded border-0 bg-emerald-500/20 text-emerald-300 inline-flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" />Yes</Badge>
                                                  ) : (
                                                    <Badge className="h-6 px-2 text-[12px] rounded border-0 bg-red-500/20 text-red-300 inline-flex items-center gap-1"><XCircle className="h-3.5 w-3.5" />No</Badge>
                                                  )}
                                                </TableCell>
                                              </TableRow>
                                              ))
                                            ) : (
                                              <TableRow>
                                                <TableCell colSpan={3} className="text-center text-white/60 h-16">
                                                  No individual URLs tracked for this domain yet.
                                                </TableCell>
                                              </TableRow>
                                            )}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </div>
                                    )}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            ))}
                          </TableBody>
                        </Table>
                        {/* Bottom footer with Expand control and range */}
                        <div className="flex items-center justify-between px-4 py-2 border-t border-white/10">
                          <div className="flex items-center gap-2">
                              <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 rounded-md border-white/10 bg-white/5 text-white/80 hover:text-white"
                              onClick={() => setSourceVisibleCount(Math.min(sourceVisibleCount + INITIAL_VISIBLE, sortedCitationSources.length))}
                              aria-label="Expand sources"
                              disabled={remainingSources <= 0}
                            >
                              Expand
                            </Button>
                              {remainingSources > 0 ? (
                                <span className="text-xs text-white/50">{Math.min(INITIAL_VISIBLE, remainingSources)} more</span>
                              ) : (
                                <span className="text-xs text-white/40">All items shown</span>
                              )}
                          </div>
                          <span className="text-xs text-white/60">
                            {sortedCitationSources.length > 0 
                              ? `Showing 1 – ${visibleSources.length} of ${sortedCitationSources.length} items`
                              : 'No sources available'
                            }
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-0">
                        <Table className="w-full text-[14px] md:text-[15px] table-fixed">
                          <TableHeader className="sticky top-0 z-10 backdrop-blur-sm bg-white/5 border-b border-white/[0.08] text-[13px]">
                            <TableRow className="hover:bg-transparent h-12">
                              <TableHead className="w-[220px] text-white/70 px-4">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1.5 cursor-help">Platform <HelpCircle className="h-3.5 w-3.5 opacity-70" /></span>
                                  </TooltipTrigger>
                                  <TooltipContent>Platform where the prompt was run.</TooltipContent>
                                </Tooltip>
                              </TableHead>
                              <TableHead className="w-[120px] text-white/70">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1.5 cursor-help">Mentioned? <HelpCircle className="h-3.5 w-3.5 opacity-70" /></span>
                                  </TooltipTrigger>
                                  <TooltipContent>Whether your brand was or wasn’t mentioned in the model response</TooltipContent>
                                </Tooltip>
                              </TableHead>
                              <TableHead className="w-[100px] text-white/70">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1.5 cursor-help">Position <HelpCircle className="h-3.5 w-3.5 opacity-70" /></span>
                                  </TooltipTrigger>
                                  <TooltipContent>Position of brand mention in the model’s response (less is better)</TooltipContent>
                                </Tooltip>
                              </TableHead>
                              <TableHead className="text-white/70">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1.5 cursor-help">Response <HelpCircle className="h-3.5 w-3.5 opacity-70" /></span>
                                  </TooltipTrigger>
                                  <TooltipContent>Output of the model</TooltipContent>
                                </Tooltip>
                              </TableHead>
                              <TableHead className="w-[140px] text-white/70 text-center px-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1.5 cursor-help">Date <HelpCircle className="h-3.5 w-3.5 opacity-70" /></span>
                                  </TooltipTrigger>
                                  <TooltipContent>When this prompt was queried</TooltipContent>
                                </Tooltip>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {visibleChats.length === 0 ? (
                              <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={5} className="h-32 text-center">
                                  <div className="flex flex-col items-center justify-center gap-2 text-white/60">
                                    <MessageSquare className="h-8 w-8 opacity-40" />
                                    <div className="text-sm">No chat responses found</div>
                                    <div className="text-xs text-white/40">
                                      {selectedPlatform !== 'all' 
                                        ? `No responses from ${selectedPlatform} for the selected time range`
                                        : 'Responses will appear here after analysis runs'
                                      }
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : visibleChats.map((chat) => (
                              <Dialog key={chat.id}>
                                <DialogTrigger asChild>
                                  <TableRow className={`group hover:bg-white/10 even:bg-white/[0.03] border-b border-white/10 last:border-b-0 ${rowHeightClass} cursor-pointer`}>
                                    <TableCell className="px-4">
                                      <div className="flex items-center gap-2">
                                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-[4px] ring-1 ring-white/15 overflow-hidden bg-white/5">
                                          <Image src={getProviderIconSrc(chat.provider)} alt={`${chat.provider} icon`} width={14} height={14} />
                                        </span>
                                        <span className="text-sm text-white/90">{getProviderDisplay(chat.provider)}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-white/90">
                                      {chat.mentioned ? (
                                        <Badge className="h-6 px-2 text-[12px] rounded border-0 bg-emerald-500/20 text-emerald-300 gap-1"><CheckCircle className="h-3.5 w-3.5" />Yes</Badge>
                                      ) : (
                                        <Badge className="h-6 px-2 text-[12px] rounded border-0 bg-red-500/20 text-red-300 gap-1"><XCircle className="h-3.5 w-3.5" />No</Badge>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-white/90">
                                      <Badge variant="outline" className="h-6 px-2 text-[12px] rounded-md border-white/10 bg-white/5 text-white/90">#{chat.position}</Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="text-xs text-white/80 line-clamp-1">{chat.snippet}</div>
                                        <span className="text-xs text-white/50 group-hover:text-white/80 underline">View</span>
                                      </div>
                                    </TableCell>
                                <TableCell className="text-center text-white/80 px-2">{chat.date}</TableCell>
                                  </TableRow>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-3xl rounded-xl border border-white/[0.08] bg-transparent backdrop-blur-sm p-0">
                                  <DialogHeader>
                                    <DialogTitle className="sr-only">Chat Details</DialogTitle>
                                  </DialogHeader>
                                  <div className="p-5 space-y-5">
                                    {/* Top stats */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                      <div className="rounded-md border border-white/10 bg-white/5 p-3 flex items-center gap-2">
                                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-[4px] ring-1 ring-white/15 overflow-hidden bg-white/5">
                                          <Image src={getProviderIconSrc(chat.provider)} alt={`${chat.provider} icon`} width={14} height={14} />
                                        </span>
                                        <span className="text-sm text-white/90">{getProviderDisplay(chat.provider)}</span>
                                      </div>
                                      <div className="rounded-md border border-white/10 bg-white/5 p-3 flex items-center gap-2">
                                        {chat.mentioned ? (
                                          <CheckCircle className="h-4 w-4 text-emerald-300" />
                                        ) : (
                                          <XCircle className="h-4 w-4 text-white/60" />
                                        )}
                                        <span className="text-sm text-white/90">{chat.mentioned ? 'Mentioned' : 'Not Mentioned'}</span>
                                      </div>
                                      <div className="rounded-md border border-white/10 bg-white/5 p-3 flex items-center gap-2">
                                        <span className="text-xs text-white/70">Position</span>
                                        <Badge variant="outline" className="h-6 px-2 text-[12px] rounded-md border-white/10 bg-white/5 text-white/90">#{chat.position}</Badge>
                                      </div>
                                      <div className="rounded-md border border-white/10 bg-white/5 p-3 text-center">
                                        <div className="text-xs text-white/70">Date</div>
                                        <div className="text-sm text-white/90">{chat.date}</div>
                                      </div>
                                    </div>

                                    {/* Prompt as title */}
                                    <div>
                                      <div className="text-xs text-white/60 mb-1">Prompt</div>
                                      <div className="text-base md:text-lg font-semibold text-white/90">{promptLabel}</div>
                                    </div>

                                    {/* Response container */}
                                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-4 max-h-[45vh] overflow-y-auto">
                                      <div className="text-xs text-white/60 mb-2">Model Response</div>
                                      <pre className="text-[13px] text-white/85 leading-relaxed whitespace-pre-wrap font-mono">
{``}
                                        {chat.fullResponse}
                                      </pre>
                                    </div>

                                    {/* Citations widgets */}
                                    <div>
                                      <div className="text-xs text-white/60 mb-2">Citations in this response</div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[30vh] overflow-y-auto pr-1">
                                        {(chat.responseCitations && chat.responseCitations.length > 0 ? chat.responseCitations : citationSources).map((c) => (
                                          <Dialog key={`${(c as any).domain}-${(c as any).citationType ?? (c as any).type ?? ''}`}>
                                            <DialogTrigger asChild>
                                              <div className="rounded-md border border-white/10 bg-white/5 p-3 flex items-center justify-between cursor-pointer hover:bg-white/10">
                                                <div className="truncate text-sm text-white/90 mr-2 underline">
                                                  {(c as any).domain}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  {('frequency' in (c as any) ? (c as any).frequency : undefined) !== undefined ? (
                                                    <Badge variant="outline" className="h-6 px-2 text-[12px] rounded-md border-white/10 bg-white/5 text-white/80">
                                                      {Math.round((((c as any).frequency / Math.max(1, totalCitationFrequency)) as number) * 100)}%
                                                    </Badge>
                                                  ) : null}
                                                  {((c as any).citationType ?? (c as any).type) ? (
                                                    <Badge className="h-6 px-2 text-[12px] rounded-md border-0 bg-white text-black">{(c as any).citationType ?? (c as any).type}</Badge>
                                                  ) : null}
                                                </div>
                                              </div>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-4xl md:max-w-4xl rounded-xl border border-white/[0.08] bg-transparent backdrop-blur-sm p-0 max-h-[90vh] overflow-y-auto">
                                              <DialogHeader>
                                                <DialogTitle className="sr-only">Source Details</DialogTitle>
                                              </DialogHeader>
                                              <div className="px-5 py-6 space-y-6">
                                                {/* Breadcrumb guide */}
                                                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px]">
                                                  <MessageSquare className="h-3.5 w-3.5 text-white/70" />
                                                  <span className="text-white/70">Prompts</span>
                                                  <ChevronRight className="h-3.5 w-3.5 text-white/50" />
                                                  <span className="truncate max-w-[45%] text-white/80" title={promptLabel}>{promptLabel}</span>
                                                  <ChevronRight className="h-3.5 w-3.5 text-white/50" />
                                                  <span className="text-white/70">Sources</span>
                                                  <ChevronRight className="h-3.5 w-3.5 text-white/50" />
                                                  <span className="truncate text-white/90 font-medium" title={(c as any).domain}>{(c as any).domain}</span>
                                                </div>
                                                {/* Domain header with range filter on the right */}
                                                <div className="flex items-center justify-between py-1.5">
                                                  <div className="flex items-center gap-3 min-w-0">
                                                    <div className="text-sm text-white/80 truncate">{(c as any).domain}</div>
                                                    <a href={`https://${(c as any).domain}`} target="_blank" rel="noreferrer" className="text-xs text-white/70 hover:text-white/90 underline whitespace-nowrap">Visit domain</a>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    {(['7d','14d','30d'] as const).map((r) => (
                                                      <Button
                                                        key={r}
                                                        variant={sourcesRange === r ? 'default' : 'ghost'}
                                                        size="sm"
                                                        className={(sourcesRange === r ? 'bg-white text-black hover:bg-white/90 ' : 'border border-white/10 bg-white/5 text-white/80 hover:text-white ') + 'h-7 rounded-full text-[12px] px-3'}
                                                        onClick={() => setSourcesRange(r)}
                                                        aria-label={`Filter URLs ${r}`}
                                                      >
                                                        {r.toUpperCase()}
                                                      </Button>
                                                    ))}
                                                  </div>
                                                </div>
                                                {/* KPI row */}
                                                <div className="grid grid-cols-1 gap-4">
                                                  {/* Left KPI: Citation Frequency % */}
                                                  <div className="rounded-lg border border-white/10 bg-white/5 p-5 md:p-5 min-h-[110px]">
                                                    <div className="flex items-center justify-between gap-6">
                                                      <div className="flex-1">
                                                        <Tooltip>
                                                          <TooltipTrigger asChild>
                                                            <div className="text-base md:text-lg font-semibold text-white/90 cursor-help inline-flex items-center gap-1.5">Citation Frequency <HelpCircle className="h-3.5 w-3.5 opacity-70" /></div>
                                                          </TooltipTrigger>
                                                          <TooltipContent>
                                                            Percentage of prompt runs where this domain appears
                                                          </TooltipContent>
                                                        </Tooltip>
                                                      </div>
                                                      <div className="text-4xl md:text-5xl font-semibold leading-none tracking-tight text-white/90">
                                                        {(() => {
                                                          const src = sortedCitationSources.find((s) => s.domain === (c as any).domain)
                                                          return Math.round(((src?.frequency || 0) / Math.max(1, totalCitationFrequency)) * 100)
                                                        })()}%
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                                {/* View selector: Sources | This prompt */}
                                                <div className="mt-2 flex items-center justify-start">
                                                  <div className="flex items-center gap-2">
                                                    <Button
                                                      variant={sourceDialogView === 'sources' ? 'default' : 'ghost'}
                                                      size="sm"
                                                      className={(sourceDialogView === 'sources' ? 'bg-white text-black hover:bg-white/90 ' : 'border border-white/10 bg-white/5 text-white/80 hover:text-white ') + 'h-7 rounded-full text-[12px] px-3'}
                                                      onClick={() => setSourceDialogView('sources')}
                                                      aria-label="View sources list"
                                                    >
                                                      Sources
                                                    </Button>
                                                    <Tooltip>
                                                      <TooltipTrigger asChild>
                                                        <Button
                                                          variant={sourceDialogView === 'prompt' ? 'default' : 'ghost'}
                                                          size="sm"
                                                          className={(sourceDialogView === 'prompt' ? 'bg-white text-black hover:bg-white/90 ' : 'border border-white/10 bg-white/5 text-white/80 hover:text-white ') + 'h-7 rounded-full text-[12px] px-3'}
                                                          onClick={() => setSourceDialogView('prompt')}
                                                          aria-label="View chats for this prompt"
                                                        >
                                                          This prompt <HelpCircle className="h-3 w-3 ml-1 opacity-70" />
                                                        </Button>
                                                      </TooltipTrigger>
                                                      <TooltipContent>
                                                        Shows chats for this prompt where this source was cited
                                                      </TooltipContent>
                                                    </Tooltip>
                                                  </div>
                                                </div>
                                                {/* Chats by source (conditional) */}
                                                {sourceDialogView !== 'sources' && (() => {
                                                  const domain = (c as any).domain
                                                  const platformMatches = (chat: ChatHistoryEntry) => selectedPlatform === 'all' || providerKey(chat.provider) === selectedPlatform
                                                  const domainMatches = (chat: ChatHistoryEntry) => (chat.responseCitations || []).some((x) => (x as any).domain === domain)
                                                  const chatsForDomain = recentChats.filter((x) => platformMatches(x) && domainMatches(x))
                                                  const visibleChatsLocal = chatsForDomain.slice(0, sourceChatsVisibleCount)
                                                  const remainingLocal = Math.max(0, chatsForDomain.length - visibleChatsLocal.length)
                                                  return (
                                                    <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03]">
                                                      <div className="max-h-[30vh] overflow-y-auto">
                                                        <Table className="w-full text-[14px] md:text-[15px] table-fixed">
                                                          <TableHeader className="sticky top-0 z-10 backdrop-blur-sm bg-white/5 border-b border-white/[0.08] text-[13px]">
                                                            <TableRow className="hover:bg-transparent h-10">
                                                              <TableHead className="w-[220px] text-white/70 px-4">Platform</TableHead>
                                                              <TableHead className="text-white/70">Response</TableHead>
                                                              <TableHead className="w-[100px] text-center text-white/70 px-2">Citations</TableHead>
                                                              <TableHead className="w-[140px] text-center text-white/70 px-2">Date</TableHead>
                                                            </TableRow>
                                                          </TableHeader>
                                                          <TableBody>
                                                            {visibleChatsLocal.map((chat) => (
                                                              <TableRow key={chat.id} className="hover:bg-white/10 border-b border-white/10 last:border-b-0">
                                                                <TableCell className="px-4">
                                                                  <div className="flex items-center gap-2">
                                                                    <span className="text-sm text-white/90">{getProviderDisplay(chat.provider)}</span>
                                                                  </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                  <div className="text-xs text-white/80 line-clamp-2 max-w-full">
                                                                    {(chat.fullResponse || '').split('\n').filter(Boolean).slice(0, 2).join(' ').slice(0, 220)}
                                                                  </div>
                                                                </TableCell>
                                                                <TableCell className="text-center text-white/80 px-2">
                                                                  <Badge variant="outline" className="h-6 px-2 text-[12px] rounded-md border-white/10 bg-white/5 text-white/90">
                                                                    {Math.max(1, (chat.responseCitations || []).filter((y) => (y as any).domain === domain).length)}
                                                                  </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-center text-white/80 px-2">{chat.date}</TableCell>
                                                              </TableRow>
                                                            ))}
                                                            {visibleChatsLocal.length === 0 ? (
                                                              <TableRow>
                                                                <TableCell colSpan={4} className="text-center text-white/60 h-16">
                                                                  No chats found for this source.
                                                                </TableCell>
                                                              </TableRow>
                                                            ) : null}
                                                          </TableBody>
                                                        </Table>
                                                      </div>
                                                      <div className="flex items-center justify-between px-4 py-2 border-t border-white/10">
                                                        <div className="flex items-center gap-2">
                                                          <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 px-3 rounded-md border-white/10 bg-white/5 text-white/80 hover:text-white"
                                                            onClick={() => setSourceChatsVisibleCount(Math.min(sourceChatsVisibleCount + INITIAL_VISIBLE, chatsForDomain.length))}
                                                            aria-label="Expand chats for this source"
                                                            disabled={remainingLocal <= 0}
                                                          >
                                                            Expand
                                                          </Button>
                                                          {remainingLocal > 0 ? (
                                                            <span className="text-xs text-white/50">{Math.min(INITIAL_VISIBLE, remainingLocal)} more</span>
                                                          ) : (
                                                            <span className="text-xs text-white/40">All items shown</span>
                                                          )}
                                                        </div>
                                                        <span className="text-xs text-white/60">Showing 1 – {visibleChatsLocal.length} of {chatsForDomain.length} items</span>
                                                      </div>
                                                    </div>
                                                  )
                                                })()}
                                                {/* URLs table (mock; wired later) */}
                                                {sourceDialogView === 'sources' && (
                                                  <div className="rounded-lg border border-white/10 bg-white/[0.03]">
                                                    <div className="max-h-[45vh] overflow-y-auto">
                                                      <Table className="w-full text-[15px]">
                                                        <TableHeader className="sticky top-0 z-10 backdrop-blur-sm bg-white/5 border-b border-white/[0.08] text-[13px]">
                                                          <TableRow className="hover:bg-transparent h-10">
                                                            <TableHead className="text-white/70 px-4">URL</TableHead>
                                                            <TableHead className="w-[180px] text-center text-white/70 px-2">
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <span className="inline-flex items-center gap-1.5 cursor-help">Type of Content <HelpCircle className="h-3.5 w-3.5 opacity-70" /></span>
                                                </TooltipTrigger>
                                                <TooltipContent>Format of the referenced page (blog, guide, list, etc.)</TooltipContent>
                                              </Tooltip>
                                                            </TableHead>
                                                            <TableHead className="w-[140px] text-center text-white/70 px-2">
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <span className="inline-flex items-center gap-1.5 cursor-help">Mentioned? <HelpCircle className="h-3.5 w-3.5 opacity-70" /></span>
                                                </TooltipTrigger>
                                                <TooltipContent>Was your brand mentioned in this source?</TooltipContent>
                                              </Tooltip>
                                                            </TableHead>
                                                          </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                          {/* Use real URL data from citation sources if available */}
                                                          {(() => {
                                                            const domain = (c as any).domain
                                                            const sourceData = sortedCitationSources.find(s => s.domain === domain)
                                                            const urls = sourceData?.urls || []
                                                            
                                                            if (urls.length === 0) {
                                                              return (
                                                                <TableRow>
                                                                  <TableCell colSpan={3} className="text-center text-white/60 h-16">
                                                                    No individual URLs tracked for this domain yet.
                                                                  </TableCell>
                                                                </TableRow>
                                                              )
                                                            }
                                                            
                                                            return urls.map((item: { url: string; title?: string; citationType: string; brandMentioned: boolean }, idx: number) => (
                                                            <TableRow key={`${item.url}-${idx}`} className="hover:bg-white/10 h-12 border-b border-white/10 last:border-b-0">
                                                              <TableCell className="px-5">
                                                                <a href={item.url} target="_blank" rel="noreferrer" className="text-white/90 hover:underline truncate inline-block max-w-full align-middle">
                                                                  {item.url}
                                                                </a>
                                                              </TableCell>
                                                              <TableCell className="text-center">
                                                                <Badge className="h-6 px-2 text-[12px] rounded border border-white/15 bg-white/10 text-white/80 inline-flex items-center gap-1">
                                                                  <ContentTypeIcon type={mapContentType(item.citationType)} />
                                                                  {mapContentType(item.citationType)}
                                                                </Badge>
                                                              </TableCell>
                                                              <TableCell className="text-center">
                                                                {item.brandMentioned ? (
                                                                  <Badge className="h-6 px-2 text-[12px] rounded border-0 bg-emerald-500/20 text-emerald-300 inline-flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" />Yes</Badge>
                                                                ) : (
                                                                  <Badge className="h-6 px-2 text-[12px] rounded border-0 bg-red-500/20 text-red-300 inline-flex items-center gap-1"><XCircle className="h-3.5 w-3.5" />No</Badge>
                                                                )}
                                                              </TableCell>
                                                            </TableRow>
                                                            ))
                                                          })()}
                                                        </TableBody>
                                                      </Table>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            </DialogContent>
                                          </Dialog>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            ))}
                          </TableBody>
                        </Table>
                        <div className="flex items-center justify-between px-4 py-2 border-t border-white/10">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 rounded-md border-white/10 bg-white/5 text-white/80 hover:text-white"
                              onClick={() => setChatVisibleCount(Math.min(chatVisibleCount + INITIAL_VISIBLE, filteredChats.length))}
                              aria-label="Expand recent chats"
                              disabled={remainingChats <= 0}
                            >
                              Expand
                            </Button>
                            {remainingChats > 0 ? (
                              <span className="text-xs text-white/50">{Math.min(INITIAL_VISIBLE, remainingChats)} more</span>
                            ) : (
                              <span className="text-xs text-white/40">All items shown</span>
                            )}
                          </div>
                          <span className="text-xs text-white/60">Showing 1 – {visibleChats.length} of {filteredChats.length} items</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>

      <FloatingMudraButton siteId={typeof window !== 'undefined' ? (localStorage.getItem('mudra:siteId') || '') : ''} />
    </SidebarProvider>
  )
}

export default function TrackedPromptDeepView() {
  return (
    <BrandProfileProvider>
      <TrackedPromptDeepViewInner />
    </BrandProfileProvider>
  )
}