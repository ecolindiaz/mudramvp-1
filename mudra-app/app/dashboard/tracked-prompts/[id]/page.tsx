"use client"

import Link from "next/link"
import React, { useMemo, useState, useRef } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ArrowLeft, TrendingUp, Target, Award, MessageSquare, MessageSquareText, Building2, GraduationCap, Globe, Clock, Maximize2, Tag, ChevronRight, CheckCircle, ChevronDown, ChevronUp, XCircle, ExternalLink, FileText, ListOrdered, BookOpen, HelpCircle, Copy, Check, Newspaper, PlayCircle, Star, Package, Users } from "lucide-react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BrandProfileProvider, useBrandProfile } from "@/components/brand-profile-context"
import { useParams } from "next/navigation"
import { useEffect } from "react"
import { CompanyLogo, DomainLogo } from "@/components/ui/company-logo"
import { getCompanyDomain } from "@/lib/logo"

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

// Custom tooltip for visibility chart - clean, limited to 10 brands
function VisibilityChartTooltip({ 
  active, 
  payload, 
  label,
  competitorSeries 
}: { 
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; color: string }>
  label?: string
  competitorSeries: Array<{ key: string; label: string; color: string; isYou?: boolean }>
}) {
  if (!active || !payload?.length) return null

  // Sort by value descending and limit to 10
  const sortedPayload = [...payload]
    .filter(p => p.value !== null && p.value !== undefined)
    .sort((a, b) => (b.value || 0) - (a.value || 0))
    .slice(0, 10)

  return (
    <div className="rounded-lg border border-white/[0.06] bg-[#0a0a0a]/95 backdrop-blur-sm px-3 py-2.5 shadow-2xl min-w-[170px]">
      <p className="text-[11px] text-white/50 mb-2">{label}</p>
      <div className="space-y-1">
        {sortedPayload.map((entry) => {
          const seriesInfo = competitorSeries.find(s => s.key === entry.dataKey)
          const isYou = seriesInfo?.isYou
          return (
            <div 
              key={entry.dataKey} 
              className="flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <CompanyLogo company={seriesInfo?.label || entry.dataKey} size={14} />
                <span className={cn(
                  "text-xs truncate max-w-[110px]",
                  isYou ? "text-white font-medium" : "text-white/70"
                )}>
                  {seriesInfo?.label || entry.dataKey}
                </span>
              </div>
              <span className={cn(
                "text-xs font-mono tabular-nums",
                isYou ? "text-white font-medium" : "text-white/50"
              )}>
                {entry.value?.toFixed(1)}%
              </span>
            </div>
          )
        })}
      </div>
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
  domain?: string
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

// Recursively highlight brand name in React children (for use inside ReactMarkdown output)
function highlightBrandInChildren(children: React.ReactNode, brandName: string | undefined): React.ReactNode {
  if (!brandName) return children
  const escaped = brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')

  return React.Children.map(children, (child) => {
    if (typeof child === 'string') {
      const parts = child.split(regex)
      if (parts.length === 1) return child
      return parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-emerald-500/20 text-emerald-300 rounded-sm px-0.5">{part}</mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )
    }
    if (React.isValidElement(child) && child.props?.children) {
      return React.cloneElement(child as React.ReactElement<any>, {
        children: highlightBrandInChildren(child.props.children, brandName),
      })
    }
    return child
  })
}

// Response Renderer Component with copy, expand/collapse, and formatting
function ResponseRenderer({ responseText, brandName }: { responseText: string; brandName?: string }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const wordCount = responseText.split(/\s+/).filter(Boolean).length
  const isLongResponse = wordCount > 150

  const handleCopy = async () => {
    await navigator.clipboard.writeText(responseText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleToggleExpand = () => {
    const wasExpanded = isExpanded
    setIsExpanded(!isExpanded)
    if (!wasExpanded && containerRef.current) {
      setTimeout(() => {
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 50)
    }
  }

  return (
    <div ref={containerRef} className="rounded-lg border border-white/[0.03] bg-white/[0.02] overflow-hidden w-full max-w-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/40">Response</span>
          <span className="text-[11px] text-white/30 bg-white/[0.05] px-1.5 py-0.5 rounded">{wordCount} words</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className={cn(
        "px-5 py-4 text-[13px] text-white/60 leading-[1.7] overflow-auto w-full max-w-full transition-all",
        isExpanded ? "max-h-[400px]" : "max-h-[200px]"
      )}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="text-[16px] font-bold text-white/95 mt-5 mb-3 first:mt-0">{highlightBrandInChildren(children, brandName)}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-[15px] font-semibold text-white/90 mt-5 mb-2.5 first:mt-0">{highlightBrandInChildren(children, brandName)}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-[14px] font-semibold text-white/90 mt-4 mb-2 first:mt-0">{highlightBrandInChildren(children, brandName)}</h3>
            ),
            h4: ({ children }) => (
              <h4 className="text-[13px] font-semibold text-white/90 mt-3 mb-1.5">{highlightBrandInChildren(children, brandName)}</h4>
            ),
            p: ({ children }) => (
              <p className="mb-3 text-white/60 leading-[1.7] last:mb-0 break-words">{highlightBrandInChildren(children, brandName)}</p>
            ),
            ul: ({ children }) => (
              <ul className="my-3 ml-4 space-y-2 list-disc list-outside">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="my-3 ml-4 space-y-2 list-decimal list-outside">{children}</ol>
            ),
            li: ({ children }) => (
              <li className="text-white/60 leading-[1.6] pl-1">{highlightBrandInChildren(children, brandName)}</li>
            ),
            strong: ({ children }) => (
              <strong className="text-white/90 font-medium">{children}</strong>
            ),
            em: ({ children }) => (
              <em className="text-white/70 italic">{children}</em>
            ),
            code: ({ children, className }) => {
              const isBlock = className?.includes('language-')
              if (isBlock) {
                return (
                  <code className="block text-[12px] text-emerald-400/90">{children}</code>
                )
              }
              return (
                <code className="text-emerald-400/80 bg-white/[0.06] px-1.5 py-0.5 rounded text-[12px] break-all">{children}</code>
              )
            },
            pre: ({ children }) => (
              <pre className="bg-white/[0.04] border border-white/[0.08] rounded-lg my-4 p-4 overflow-x-auto max-w-full">{children}</pre>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-white/20 pl-4 my-4 text-white/50 italic">{highlightBrandInChildren(children, brandName)}</blockquote>
            ),
            a: ({ href, children }) => (
              <a href={href} className="text-emerald-400/80 hover:text-emerald-400 transition-colors break-words" target="_blank" rel="noopener noreferrer">{children}</a>
            ),
            hr: () => (
              <hr className="border-white/[0.08] my-5" />
            ),
            table: ({ children }) => (
              <div className="my-4 overflow-x-auto rounded-lg border border-white/[0.08]">
                <table className="w-full text-[12px]">{children}</table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className="bg-white/[0.04] border-b border-white/[0.08]">{children}</thead>
            ),
            tbody: ({ children }) => (
              <tbody className="divide-y divide-white/[0.06]">{children}</tbody>
            ),
            tr: ({ children }) => (
              <tr className="hover:bg-white/[0.02] transition-colors">{children}</tr>
            ),
            th: ({ children }) => (
              <th className="text-left text-white/80 font-medium px-3 py-2.5">{highlightBrandInChildren(children, brandName)}</th>
            ),
            td: ({ children }) => (
              <td className="text-white/60 px-3 py-2.5">{highlightBrandInChildren(children, brandName)}</td>
            ),
          }}
        >
          {responseText}
        </ReactMarkdown>
      </div>
      {isLongResponse && (
        <button
          onClick={handleToggleExpand}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-white/40 hover:text-white/60 border-t border-white/[0.04] transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              <span>Show less</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              <span>Show full response</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}

const CITATIONS_INITIAL_LIMIT = 10

function CitationsList({ citations }: { citations: Array<{ url: string }> }) {
  const [expanded, setExpanded] = useState(false)

  const getDomain = (url: string) => {
    try {
      const parsed = new URL(url)
      return parsed.host.replace(/^www\./, '')
    } catch {
      return ''
    }
  }

  const visible = expanded ? citations : citations.slice(0, CITATIONS_INITIAL_LIMIT)
  const remaining = citations.length - CITATIONS_INITIAL_LIMIT

  return (
    <div className="rounded-lg border border-white/[0.03] bg-white/[0.02] p-4">
      <div className="text-xs text-white/40 mb-3">Citations ({citations.length} sources)</div>
      {citations.length > 0 ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {visible.map((citation, index) => {
              const domain = getDomain(citation.url)
              return (
                <a
                  key={`${citation.url}-${index}`}
                  href={citation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={citation.url}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.04] text-[13px] text-white/70 hover:text-white/90 transition-all"
                >
                  {domain ? (
                    <DomainLogo domain={domain} size={16} />
                  ) : (
                    <Globe className="h-4 w-4 flex-shrink-0 text-white/40" />
                  )}
                  <span className="truncate max-w-[180px]">{domain || citation.url.slice(0, 30)}</span>
                </a>
              )
            })}
          </div>
          {remaining > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-white/40 hover:text-white/60 transition-colors pt-1"
            >
              {expanded ? 'Show less' : `+ ${remaining} more sources`}
            </button>
          )}
        </div>
      ) : (
        <div className="text-[13px] text-white/40">
          No citations captured for this response
        </div>
      )}
    </div>
  )
}

// Recent chats history
type ChatHistoryEntry = {
  id: string
  provider: 'ChatGPT' | 'Claude' | 'Perplexity' | 'Gemini'
  snippet: string
  rank: number
  timeAgo: string
  avgPosition: number
  date: string
  mentioned: boolean
  position: number | null
  extraMentions: number
  fullResponse: string
  responseCitations?: { url: string; domain: string; title?: string; type?: 'Example' | 'Listicle' | 'Blog Post' | 'Case Study' | 'Docs' | 'Other' }[]
}

// Helper to map provider names from API to UI format
function mapProviderName(provider: string): ChatHistoryEntry['provider'] {
  const lower = provider.toLowerCase()
  // ChatGPT/OpenAI -> ChatGPT
  if (lower.includes('openai') || lower.includes('chatgpt') || lower.includes('gpt')) return 'ChatGPT'
  // Claude/Anthropic -> Claude
  if (lower.includes('anthropic') || lower.includes('claude')) return 'Claude'
  // Perplexity
  if (lower.includes('perplexity')) return 'Perplexity'
  // Gemini/Google -> Gemini (we use Gemini, not Google AI Overviews)
  if (lower.includes('gemini') || lower.includes('google')) return 'Gemini'
  return 'ChatGPT' // Default fallback
}

function getProviderBadgeClass(_provider: ChatHistoryEntry['provider']) {
  // Neutral, minimalist chip regardless of provider
  return 'bg-white/10 text-white/80'
}

function getProviderIconSrc(provider: ChatHistoryEntry['provider']): string {
  switch (provider) {
    case 'ChatGPT':
      return '/openai_dark.svg'
    case 'Claude':
      return '/claude-ai-icon.svg'
    case 'Perplexity':
      return '/perplexity%20(2).svg'
    case 'Gemini':
      return '/gemini%20(3).svg'
    default:
      return '/openai_dark.svg'
  }
}

function getProviderDisplay(provider: ChatHistoryEntry['provider']): string {
  switch (provider) {
    case 'ChatGPT':
      return 'ChatGPT'
    case 'Claude':
      return 'Claude'
    case 'Perplexity':
      return 'Perplexity'
    case 'Gemini':
      return 'Gemini'
    default:
      return 'ChatGPT'
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

type CitationCategory = 'Social Content' | 'Company Sources' | 'Academic Sources' | 'Wikipedia' | 'Blog' | 'News' | 'Forum' | 'Listicle' | 'Review' | 'Video' | 'Product' | 'Other'

function mapCitationCategory(original?: string): CitationCategory {
  const src = (original || '').toLowerCase()

  // Map backend citation types to UI categories
  // Backend returns: 'Blog' | 'Listicle' | 'Docs' | 'News' | 'Academic' | 'Wiki' | 'Forum' | 'Video' | 'Product' | 'Review' | 'Social' | 'Other'

  // Wikipedia/Wiki
  if (src === 'wiki' || src.includes('wikipedia')) return 'Wikipedia'

  // Academic sources
  if (src === 'academic' || src.includes('paper') || src.includes('research')) return 'Academic Sources'

  // Documentation / Company official sources
  if (src === 'docs' || src.includes('documentation') || src.includes('case')) return 'Company Sources'

  // Product pages
  if (src === 'product') return 'Product'

  // Blog content
  if (src === 'blog') return 'Blog'

  // News articles
  if (src === 'news') return 'News'

  // Forums/Community discussions
  if (src === 'forum') return 'Forum'

  // Listicle/Comparison sites
  if (src === 'listicle') return 'Listicle'

  // Review sites
  if (src === 'review') return 'Review'

  // Video content
  if (src === 'video') return 'Video'

  // Actual social media
  if (src === 'social') return 'Social Content'

  // Other/fallback
  return 'Other'
}

// Helper to extract domain from URL
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)

    // Handle Google Vertex AI Search redirect URLs
    // These look like: vertexaisearch.cloud.google.com/grounding-api-redirect/AWhgh...
    if (urlObj.hostname.includes('vertexaisearch.cloud.google.com')) {
      // The path contains base64-encoded data with the actual URL
      // Try to decode it - the URL is often at the end after decoding
      const path = urlObj.pathname

      // Try to find encoded URL patterns in the path
      // Sometimes the actual domain is visible in the decoded path
      try {
        // Base64 decode the path segment after /grounding-api-redirect/
        const encodedPart = path.split('/grounding-api-redirect/')[1]
        if (encodedPart) {
          // Try base64 decode
          const decoded = atob(encodedPart.split('/')[0])
          // Look for domain patterns in decoded content
          const domainMatch = decoded.match(/https?:\/\/(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,})/)
          if (domainMatch) {
            return domainMatch[1]
          }
        }
      } catch {
        // Base64 decode failed, continue
      }

      // Fallback: return a cleaner label for vertex URLs
      return 'Google Search Result'
    }

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
    case 'Blog':
      return <FileText className={common} />
    case 'News':
      return <Newspaper className={common} />
    case 'Forum':
      return <Users className={common} />
    case 'Listicle':
      return <ListOrdered className={common} />
    case 'Review':
      return <Star className={common} />
    case 'Video':
      return <PlayCircle className={common} />
    case 'Product':
      return <Package className={common} />
    case 'Other':
    default:
      return <HelpCircle className={common} />
  }
}

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
    ? (promptIntentRaw === 'How-to' || promptIntentRaw === 'How-to Guides' ? 'Guide' : promptIntentRaw.replace('-', ' '))
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
  
  function providerKey(p: ChatHistoryEntry['provider']): 'ChatGPT' | 'Claude' | 'Perplexity' | 'Gemini' {
    switch (p) {
      case 'ChatGPT':
        return 'ChatGPT'
      case 'Claude':
        return 'Claude'
      case 'Perplexity':
        return 'Perplexity'
      case 'Gemini':
        return 'Gemini'
      default:
        return 'ChatGPT'
    }
  }
  // Compute recent chats from API response
  const recentChats: ChatHistoryEntry[] = useMemo(() => {
    if (!promptData?.testResults || promptData.testResults.length === 0) {
      return [] // Return empty array - empty states will be shown by the UI
    }

    const chats = promptData.testResults.map((result: any, index: number) => {
      const provider = mapProviderName(result.provider || result.model)
      const snippet = result.response
        ? result.response.substring(0, 100) + (result.response.length > 100 ? '…' : '')
        : 'No response available'

      // Use analysisRunDate from each result (for historical data), fallback to promptData.analysisDate
      const analysisDate = result.analysisRunDate
        ? new Date(result.analysisRunDate)
        : (promptData.analysisDate ? new Date(promptData.analysisDate) : new Date())
      const now = new Date()
      const hoursAgo = Math.floor((now.getTime() - analysisDate.getTime()) / (1000 * 60 * 60))
      const timeAgo = hoursAgo < 24 ? `${hoursAgo} hr. ago` : `${Math.floor(hoursAgo / 24)} days ago`

      // Extract citations from API response, web search sources, AND response text - deduplicated by normalized URL
      // This matches the logic used in citation-extraction.service.ts for the Sources tab
      const seenUrls = new Set<string>()
      const normalizeUrl = (url: string): string => {
        try {
          const parsed = new URL(url)
          // Normalize: lowercase host, remove trailing slash, remove common tracking params
          return `${parsed.protocol}//${parsed.host.toLowerCase()}${parsed.pathname.replace(/\/$/, '')}`
        } catch {
          return url.toLowerCase().replace(/\/$/, '')
        }
      }

      // Start with explicit citations from API
      const allCitations: Array<{ url: string; title?: string }> = (result.citations || [])
        .filter((c: any) => c.url)
        .map((c: any) => ({ url: c.url, title: c.title }))

      // Include sources from web search APIs (OpenAI Responses API, Gemini grounding, etc.)
      for (const source of (result.sources || [])) {
        const url = source?.url || source?.link || (typeof source === 'string' ? source : '')
        if (url && !allCitations.some(c => c.url === url)) {
          allCitations.push({ url, title: source?.title })
        }
      }

      // Also extract URLs from response text
      const responseText = result.response || ''
      const urlPattern = /https?:\/\/[^\s\)\]\}\,<>"']+/g
      const urlsInResponse = responseText.match(urlPattern) || []
      for (const url of urlsInResponse) {
        const cleanUrl = url.replace(/[.,;:!?]+$/, '')
        // Skip if already in explicit citations
        if (!allCitations.some(c => c.url === cleanUrl)) {
          allCitations.push({ url: cleanUrl })
        }
      }

      // Deduplicate by normalized URL
      const responseCitations = allCitations
        .filter((citation) => {
          const url = citation.url || ''
          if (!url) return false
          const normalizedUrl = normalizeUrl(url)
          if (seenUrls.has(normalizedUrl)) return false
          seenUrls.add(normalizedUrl)
          return true
        })
        .map((citation) => ({
          url: citation.url,
          domain: extractDomain(citation.url),
          title: citation.title || '',
          type: mapCitationType(citation.title || '')
        }))

      return {
        id: `chat_${index}`,
        provider,
        snippet,
        rank: index + 1,
        timeAgo,
        avgPosition: result.position ?? 0,
        date: analysisDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
        mentioned: result.mentioned || false,
        position: result.position ?? null,
        extraMentions: result.competitorsMentioned?.length || 0,
        fullResponse: result.response || 'No response available',
        responseCitations,
        // Store the raw date for sorting
        _sortDate: analysisDate.getTime()
      }
    })

    // Sort by date descending (newest first), then by provider for consistency within same date
    return chats.sort((a: any, b: any) => b._sortDate - a._sortDate)
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
        sentiment: competitor.sentiment as 'Positive' | 'Neutral' | 'Negative',
        domain: competitor.domain
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
        isYou: competitor.isYou || false,
        domain: competitor.domain
      }))
    }
    
    // Fallback: construct "You" row from brand metrics + competitors
    const youRow: CompetitorRow = {
      rank: 0,
      company: promptData?.brandProfile?.companyName || profile?.companyName || 'Your Brand',
      visibility: promptData?.visibility || 0,
      position: promptData?.averagePosition ?? null,
      sentiment: (promptData?.sentiment as 'Positive' | 'Neutral' | 'Negative') || 'Neutral',
      isYou: true
    }
    
    return [youRow, ...competitorsData.map(c => ({ ...c, isYou: false }))]
  }, [promptData, competitorsData, profile?.companyName])

  // Dynamic competitor series config (including "You" with special color)
  // Deduplicate by key, limit to top 10 brands by visibility
  const competitorSeries = useMemo(() => {
    const seenKeys = new Set<string>()
    const allSeries = competitorsDataWithYou
      .map((c, idx) => ({
        key: toSeriesKey(c.company),
        label: c.company,
        color: c.isYou ? YOU_COLOR : COMPETITOR_COLORS[(idx - 1) % COMPETITOR_COLORS.length],
        visibility: c.visibility,
        isYou: c.isYou
      }))
      .filter(s => {
        if (seenKeys.has(s.key)) return false
        seenKeys.add(s.key)
        return true
      })
    
    // Always include "You", then top 9 competitors by visibility
    const youEntry = allSeries.find(s => s.isYou)
    const competitors = allSeries
      .filter(s => !s.isYou)
      .sort((a, b) => b.visibility - a.visibility)
      .slice(0, 9)
    
    return youEntry ? [youEntry, ...competitors] : competitors.slice(0, 10)
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
      // Filter to only days with actual data for smoother trends
      const dataWithValues = promptData.visibilityHistory.filter((point: any) =>
        point.you !== null && point.totalResponses > 0
      )

      return dataWithValues.map((point: any) => {
        const row: any = { day: point.displayDate }

        // Add "you" visibility (Firegeo score, not mention rate)
        row['you'] = point.you

        // Add each competitor's visibility for this day
        if (point.competitors) {
          Object.keys(point.competitors).forEach(compName => {
            row[toSeriesKey(compName)] = point.competitors[compName]
          })
        }

        // Also add any competitors that might not have data for this day
        // Use null for days without mentions - connectNulls will interpolate
        competitorSeries.forEach((s) => {
          if (!(s.key in row)) {
            row[s.key] = null // null = not mentioned, line will interpolate through
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
  
  // Show loading state with skeleton animations
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
          <div className="flex flex-1 flex-col bg-dark-grey">
            <div className="container-type-inline-size container-name-main flex flex-1 flex-col gap-3 md:gap-4 bg-dark-grey">
              {/* Page Header Skeleton */}
              <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-48 bg-white/[0.06]" />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-64 bg-white/[0.06]" />
                    <Skeleton className="h-4 w-16 bg-white/[0.06]" />
                  </div>
                  <div className="hidden md:flex items-center gap-3">
                    <Skeleton className="h-8 w-[140px] bg-white/[0.06]" />
                    <div className="flex items-center gap-1">
                      <Skeleton className="h-7 w-8 bg-white/[0.06]" />
                      <Skeleton className="h-7 w-8 bg-white/[0.06]" />
                      <Skeleton className="h-7 w-8 bg-white/[0.06]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="h-[0.25px] bg-white/10" />

              {/* Content Skeleton */}
              <div className="flex flex-1 px-4 lg:px-6 pt-6 pb-6 md:pb-8">
                <div className="w-full space-y-4">
                  {/* Top row: two cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Chart Card Skeleton */}
                    <Card className="bg-transparent rounded-lg border border-white/[0.03]">
                      <CardContent className="pt-1 md:pt-2 px-5 md:px-6 pb-3 md:pb-4 min-h-[340px] md:min-h-[380px]">
                        <div className="flex items-center justify-between -mt-2 mb-0">
                          <Skeleton className="h-5 w-32 bg-white/[0.06]" />
                        </div>
                        <Separator className="-mx-5 md:-mx-6 mb-2 border-border" />
                        {/* Chart skeleton - using lines to simulate a line chart */}
                        <div className="h-[290px] md:h-[330px] w-full flex flex-col justify-between pt-4">
                          <div className="flex-1 relative">
                            {/* Horizontal grid lines */}
                            {[0, 1, 2, 3, 4].map((i) => (
                              <div key={i} className="absolute w-full border-t border-white/[0.04]" style={{ top: `${i * 25}%` }} />
                            ))}
                            {/* Skeleton area representing chart data */}
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-full h-[60%] flex items-end px-4">
                                <Skeleton className="w-full h-full bg-white/[0.04] rounded" />
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-between pt-2">
                            {Array.from({ length: 7 }).map((_, i) => (
                              <Skeleton key={i} className="h-3 w-8 bg-white/[0.06]" />
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Table Card Skeleton */}
                    <Card className="bg-transparent rounded-xl border border-white/[0.04] overflow-hidden py-0 shadow-none gap-0">
                      <CardContent className="p-0 min-h-[360px] md:min-h-[400px]">
                        <div className="overflow-hidden">
                          {/* Table Header */}
                          <div className="flex items-center h-11 px-4 bg-white/[0.04] border-b border-white/[0.03]">
                            <Skeleton className="h-4 w-6 mr-4 bg-white/[0.06]" />
                            <Skeleton className="h-4 w-6 mr-4 bg-white/[0.06]" />
                            <Skeleton className="h-4 w-24 mr-auto bg-white/[0.06]" />
                            <Skeleton className="h-4 w-16 mx-4 bg-white/[0.06]" />
                            <Skeleton className="h-4 w-16 mx-4 bg-white/[0.06]" />
                            <Skeleton className="h-4 w-14 bg-white/[0.06]" />
                          </div>
                          {/* Table Rows */}
                          {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex items-center h-12 px-4 border-b border-white/[0.03]">
                              <Skeleton className="h-4 w-4 mr-4 rounded bg-white/[0.06]" />
                              <Skeleton className="h-4 w-4 mr-4 bg-white/[0.06]" />
                              <Skeleton className="h-4 w-32 mr-auto bg-white/[0.06]" />
                              <Skeleton className="h-4 w-12 mx-4 bg-white/[0.06]" />
                              <Skeleton className="h-5 w-14 mx-4 rounded bg-white/[0.06]" />
                              <Skeleton className="h-4 w-10 bg-white/[0.06]" />
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Bottom Toggle Skeleton */}
                  <div className="flex items-center justify-start gap-2 px-4">
                    <Skeleton className="h-8 w-28 rounded-lg bg-white/[0.06]" />
                    <Skeleton className="h-8 w-20 rounded-lg bg-white/[0.06]" />
                  </div>

                  {/* Bottom Table Card Skeleton */}
                  <Card className="bg-transparent rounded-lg border border-white/[0.03] py-0 shadow-none gap-0">
                    <CardContent className="p-0">
                      {/* Table Header */}
                      <div className="flex items-center h-12 px-4 bg-white/[0.03] border-b border-white/[0.03]">
                        <Skeleton className="h-4 w-24 mr-8 bg-white/[0.06]" />
                        <Skeleton className="h-4 w-20 mr-8 bg-white/[0.06]" />
                        <Skeleton className="h-4 w-16 mr-8 bg-white/[0.06]" />
                        <Skeleton className="h-4 w-48 mr-auto bg-white/[0.06]" />
                        <Skeleton className="h-4 w-14 bg-white/[0.06]" />
                      </div>
                      {/* Table Rows */}
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center h-12 px-4 border-b border-white/[0.03] last:border-b-0">
                          <div className="flex items-center gap-2 w-24 mr-8">
                            <Skeleton className="h-6 w-6 rounded bg-white/[0.06]" />
                            <Skeleton className="h-4 w-16 bg-white/[0.06]" />
                          </div>
                          <Skeleton className="h-5 w-12 mr-8 rounded bg-white/[0.06]" />
                          <Skeleton className="h-5 w-10 mr-8 rounded bg-white/[0.06]" />
                          <Skeleton className="h-4 w-64 mr-auto bg-white/[0.06]" />
                          <Skeleton className="h-4 w-16 bg-white/[0.06]" />
                        </div>
                      ))}
                      {/* Footer */}
                      <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.03]">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-7 w-16 rounded bg-white/[0.06]" />
                          <Skeleton className="h-4 w-16 bg-white/[0.06]" />
                        </div>
                        <Skeleton className="h-4 w-32 bg-white/[0.06]" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
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
              <div className="mt-3 flex items-center justify-between gap-4 overflow-hidden">
                <div className="flex items-center gap-2 min-w-0 flex-1 text-[13px] text-white/50">
                  <MessageSquare className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate" title={promptLabel}>{promptLabel}</span>
                  {promptIntentLabel && (
                    <>
                      <span className="text-white/20 flex-shrink-0">·</span>
                      <Tag className="h-3 w-3 flex-shrink-0" />
                      <span className="flex-shrink-0">{promptIntentLabel}</span>
                    </>
                  )}
                </div>
                <div className="hidden md:flex items-center gap-3 flex-shrink-0">
                  <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                    <SelectTrigger className="w-[140px] h-8 text-[13px] !bg-[#161616] hover:!bg-[#1c1c1c] !border-0 text-white rounded-lg transition-all duration-200 focus-visible:ring-0 focus-visible:ring-offset-0 outline-none">
                      <SelectValue placeholder="All Platforms" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#161616] border-0">
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

                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1 text-[13px]">
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
                          "px-2 py-1 rounded transition-colors",
                          dateRange === opt.key 
                            ? "text-white bg-white/[0.06]" 
                            : "text-white/40 hover:text-white/60"
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
            <div className="h-[0.25px] bg-white/10"></div>

            {/* Content */}
            <div className="flex flex-1 px-4 lg:px-6 pt-6 pb-6 md:pb-8">
              <div className="w-full space-y-4">
                {/* Top row: two metric containers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="relative rounded-lg border border-white/[0.03] overflow-hidden py-0 shadow-none gap-0 bg-transparent">
                    <CardContent className="p-0 min-h-[340px] md:min-h-[380px] flex flex-col">
                      <div className="sticky top-0 z-10 bg-white/[0.04] pt-4 pb-3 px-5 md:px-6">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium text-white/80">
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
                      </div>
                      <div className="flex-1 px-4 md:px-5 pb-3 md:pb-4 mt-6 relative">
                        {/* Micro dots background - aligned with chart plotting area */}
                        <div className="absolute top-0 bottom-6 left-[56px] right-2 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.035)_1px,transparent_0)] bg-[length:8px_8px] pointer-events-none" />
                        <ChartContainer config={computedChartConfig} className="relative h-[280px] md:h-[320px] w-full [&_.recharts-cartesian-axis-tick_text]:fill-white/80">
                          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <XAxis
                              dataKey="day"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.6)' }}
                              tickMargin={10}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.6)' }}
                              tickFormatter={(v: number) => `${v}%`}
                              domain={[0, 100]}
                              width={48}
                              tickMargin={4}
                            />
                            <ChartTooltip 
                              cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }}
                              content={<VisibilityChartTooltip competitorSeries={competitorSeries} />}
                            />
                            {competitorSeries.map((s) => (
                              <Line
                                key={s.key}
                                type="monotone"
                                dataKey={s.key}
                                stroke={s.color}
                                strokeWidth={2}
                                dot={{ r: 2.5, strokeWidth: 0, fill: s.color }}
                                activeDot={{ r: 4, strokeWidth: 0 }}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                connectNulls={true}
                                hide={!!activeCompetitor && activeCompetitor !== s.label}
                              />
                            ))}
                          </LineChart>
                        </ChartContainer>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-transparent rounded-xl border border-white/[0.04] overflow-hidden py-0 shadow-none gap-0">
                    <CardContent className="p-0 min-h-[360px] md:min-h-[400px] flex flex-col">
                      <div className="sticky top-0 z-10 bg-white/[0.04]">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/[0.03]">
                              <th className="w-12 h-11 px-4 text-left font-medium text-white/80"></th>
                              <th className="w-12 h-11 text-left font-medium text-white/80 px-2">#</th>
                              <th className="h-11 text-left font-medium text-white/80 px-4">Company</th>
                              <th className="w-28 h-11 text-center font-medium text-white/80 px-4">Visibility</th>
                              <th className="w-28 h-11 text-center font-medium text-white/80 px-4">Sentiment</th>
                              <th className="w-24 h-11 text-center font-medium text-white/80 px-4">Position</th>
                            </tr>
                          </thead>
                        </table>
                      </div>
                      <div className="overflow-y-auto flex-1 max-h-[320px] md:max-h-[360px]">
                        <Table className="w-full text-sm">
                          <TableHeader className="sr-only">
                            <TableRow>
                              <TableHead></TableHead>
                              <TableHead>#</TableHead>
                              <TableHead>Company</TableHead>
                              <TableHead>Visibility</TableHead>
                              <TableHead>Sentiment</TableHead>
                              <TableHead>Position</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {competitorsDataWithYou.length === 0 ? (
                              <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={6} className="h-32 text-center">
                                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                    <Building2 className="h-6 w-6 opacity-40" />
                                    <div className="text-sm">No competitor data yet</div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : (
                              competitorsDataWithYou.map((row, index) => (
                                <TableRow 
                                  key={row.isYou ? 'you-row' : row.rank} 
                                  className="border-white/[0.03] hover:bg-white/[0.03] transition-colors"
                                >
                                  <TableCell className="px-4 py-3.5 align-middle">
                                    <Checkbox
                                      checked={activeCompetitor === row.company}
                                      onCheckedChange={() => setActiveCompetitor(activeCompetitor === row.company ? null : row.company)}
                                      aria-label={`Select ${row.company}`}
                                    />
                                  </TableCell>
                                  <TableCell className="text-white/60 px-2 py-3.5 align-middle">
                                    {index}
                                  </TableCell>
                                  <TableCell className="text-white/90 px-4 py-3.5 align-middle">
                                    {row.isYou ? (
                                      <div className="flex items-center gap-2">
                                        <CompanyLogo company={row.company} size={20} />
                                        <span>{row.company} (You)</span>
                                      </div>
                                    ) : (
                                      <a
                                        href={`https://${row.domain || getCompanyDomain(row.company)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 hover:text-white transition-colors group"
                                      >
                                        <CompanyLogo company={row.company} size={20} />
                                        <span className="group-hover:underline underline-offset-2">{row.company}</span>
                                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                                      </a>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center px-4 py-3.5 align-middle">
                                    <div className="flex items-center justify-center gap-2">
                                      <div className={cn(
                                        "w-2 h-2 rounded-full",
                                        row.visibility >= 70 ? "bg-emerald-500" :
                                        row.visibility >= 40 ? "bg-yellow-500" :
                                        row.visibility > 0 ? "bg-orange-500" : "bg-white/30"
                                      )} />
                                      <span className="text-white/80">{row.visibility}%</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center px-4 py-3.5 align-middle">
                                    <Badge className={cn(
                                      "px-2 py-0.5 rounded text-xs font-medium border-0",
                                      row.sentiment === 'Negative' && "bg-white/10 text-white/80",
                                      row.sentiment === 'Neutral' && "bg-white/10 text-white/80",
                                      row.sentiment === 'Positive' && "bg-white/10 text-white/80"
                                    )}>
                                      {row.sentiment}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-white/60 text-center px-4 py-3.5 align-middle">
                                    {row.position === null ? "—" : `#${row.position.toFixed(1)}`}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
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
                      className={bottomView === 'chats' ? 'h-8 rounded-lg bg-white text-black hover:bg-white/90 transition-all duration-200' : 'h-8 rounded-lg bg-[#161616] hover:bg-[#1c1c1c] text-white/70 hover:text-white border-0 transition-all duration-200'}
                      onClick={() => setBottomView('chats')}
                    >
                      Recent Chats
                    </Button>
                    <Button
                      variant={bottomView === 'sources' ? 'default' : 'ghost'}
                      size="sm"
                      className={bottomView === 'sources' ? 'h-8 rounded-lg bg-white text-black hover:bg-white/90 transition-all duration-200' : 'h-8 rounded-lg bg-[#161616] hover:bg-[#1c1c1c] text-white/70 hover:text-white border-0 transition-all duration-200'}
                      onClick={() => setBottomView('sources')}
                    >
                      Sources
                    </Button>
                  </div>
                </div>
                {/* Bottom: switch between chat executions table and sources table */}
                <Card className="bg-transparent rounded-lg border border-white/[0.03] py-0 shadow-none gap-0">
                  <CardContent className="p-0">
                    
                    {bottomView === 'sources' ? (
                      <div>
                        <Table className="w-full text-[14px] table-fixed">
                          <TableHeader className="sticky top-0 z-10 bg-white/[0.03] border-b border-white/[0.03] text-[13px]">
                            <TableRow className="hover:bg-transparent h-12">
                              <TableHead className="w-[56px] text-center text-white/50 font-medium px-2">#</TableHead>
                              <TableHead className="w-[50%] text-white/50 font-medium pl-2 pr-4">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1.5 cursor-help">Domain <HelpCircle className="h-3.5 w-3.5 opacity-50" /></span>
                                  </TooltipTrigger>
                                  <TooltipContent>Root domain cited in model responses for this prompt.</TooltipContent>
                                </Tooltip>
                              </TableHead>
                              <TableHead className="w-[120px] text-center text-white/50 font-medium px-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1.5 cursor-help">Citation Frequency (%) <HelpCircle className="h-3.5 w-3.5 opacity-50" /></span>
                                  </TooltipTrigger>
                                  <TooltipContent>Share of prompt runs where this domain appears as a citation.</TooltipContent>
                                </Tooltip>
                              </TableHead>
                              <TableHead className="w-[180px] text-center text-white/50 font-medium px-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1.5 cursor-help">Type of Citation <HelpCircle className="h-3.5 w-3.5 opacity-50" /></span>
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
                                  <div className="flex flex-col items-center justify-center gap-3 text-white/60">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04] ring-1 ring-white/[0.06]">
                                      <Globe className="h-5 w-5 opacity-50" />
                                    </div>
                                    <div className="text-sm font-medium text-white/70">No citation sources found</div>
                                    <div className="text-xs text-white/40">
                                      Sources will appear here after they are cited in AI responses
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : visibleSources.map((row, idx) => (
                              <Dialog key={`${row.domain}-${row.citationType}-${idx}`}>
                                <DialogTrigger asChild>
                              <TableRow className={`group transition-colors duration-150 hover:bg-white/[0.04] odd:bg-transparent even:bg-white/[0.015] border-b border-white/[0.04] last:border-b-0 ${rowHeightClass} cursor-pointer`}>
                                    <TableCell className="w-[56px] text-center text-white/40 group-hover:text-white/60 px-2 transition-colors">
                                      {idx + 1}
                                    </TableCell>
                                    <TableCell className="w-[50%] text-white/80 group-hover:text-white/95 pl-2 pr-4 max-w-0 transition-colors">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <DomainLogo domain={row.domain} size={18} />
                                        <span className="truncate">{row.domain}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center px-2">
                                      <div className="flex items-center justify-center">
                                        <Badge variant="outline" className="inline-flex items-center justify-center h-6 min-w-[56px] px-2.5 text-[13px] rounded-md border border-white/[0.04] bg-white/[0.03] text-white/80 tabular-nums">
                                          {row.citationFrequencyPercent || Math.round((row.frequency / Math.max(1, totalCitationFrequency)) * 100)}%
                                        </Badge>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center px-2">
                                      <div className="flex items-center justify-center">
                                        <Badge className="inline-flex items-center justify-center gap-1.5 h-6 min-w-[140px] px-2.5 text-[13px] rounded-md bg-white/95 text-black font-medium shadow-sm">
                                          <CitationCategoryIcon category={mapCitationCategory(row.citationType)} />
                                          {mapCitationCategory(row.citationType)}
                                        </Badge>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-2xl rounded-xl border border-white/[0.04] bg-dark-grey p-0 max-h-[85vh] overflow-hidden">
                                  <DialogHeader className="sr-only">
                                    <DialogTitle>Source Details</DialogTitle>
                                  </DialogHeader>
                                  
                                  {/* Header section */}
                                  <div className="px-5 pt-5 pb-4 pr-12 border-b border-white/[0.04]">
                                    <div className="flex items-center gap-3">
                                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.05]">
                                        <DomainLogo domain={row.domain} size={20} className="text-white/70" />
                                      </div>
                                      <div className="space-y-0.5">
                                        <div className="text-sm font-medium text-white/90">{row.domain}</div>
                                        <a
                                          href={`https://${row.domain}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                          Visit domain
                                        </a>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Tab selector with citation frequency */}
                                  <div className="px-5 pt-3 pb-2 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="flex flex-col">
                                        <div className="text-lg font-semibold text-white/90 tabular-nums">
                                          {row.citationFrequencyPercent || Math.round((row.frequency / Math.max(1, totalCitationFrequency)) * 100)}%
                                        </div>
                                        <div className="text-[10px] text-white/40">Citation frequency</div>
                                      </div>
                                    </div>
                                    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                                      <button
                                        type="button"
                                        onClick={() => setSourceDialogView('sources')}
                                        className={cn(
                                          "px-3 py-1.5 rounded-md text-[13px] font-medium transition-all",
                                          sourceDialogView === 'sources'
                                            ? "bg-white text-black"
                                            : "text-white/50 hover:text-white/70"
                                        )}
                                      >
                                        URLs
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setSourceDialogView('prompt')}
                                        className={cn(
                                          "px-3 py-1.5 rounded-md text-[13px] font-medium transition-all",
                                          sourceDialogView === 'prompt'
                                            ? "bg-white text-black"
                                            : "text-white/50 hover:text-white/70"
                                        )}
                                      >
                                        Responses
                                      </button>
                                    </div>
                                  </div>
                                  
                                  {/* Content area */}
                                  <div className="px-5 pb-5 space-y-3 overflow-y-auto max-h-[calc(85vh-180px)]">

                                    {/* Responses tab - show prompt + responses citing this source */}
                                    {sourceDialogView !== 'sources' && (() => {
                                      const platformMatches = (chat: ChatHistoryEntry) => selectedPlatform === 'all' || providerKey(chat.provider) === selectedPlatform
                                      const domainMatches = (chat: ChatHistoryEntry) => (chat.responseCitations || []).some((c) => (c as any).domain === row.domain)
                                      const scopeChats = recentChats
                                      const chatsForDomain = scopeChats.filter((c) => platformMatches(c) && domainMatches(c))
                                      const visibleChatsLocal = chatsForDomain.slice(0, sourceChatsVisibleCount)
                                      const remainingLocal = Math.max(0, chatsForDomain.length - visibleChatsLocal.length)

                                      return (
                                        <div className="space-y-3">
                                          {/* Prompt card - clickable to expand */}
                                          <Dialog>
                                            <DialogTrigger asChild>
                                              <button 
                                                type="button"
                                                className="w-full text-left rounded-lg border border-white/[0.03] bg-white/[0.02] p-4 hover:bg-white/[0.04] hover:border-white/[0.06] transition-colors cursor-pointer group"
                                              >
                                                <div className="flex items-center justify-between mb-2">
                                                  <div className="flex items-center gap-2">
                                                    <MessageSquareText className="h-3.5 w-3.5 text-white/40" />
                                                    <span className="text-[11px] font-medium text-white/40 uppercase tracking-wide">Tracked Prompt</span>
                                                  </div>
                                                  <Maximize2 className="h-3.5 w-3.5 text-white/30 group-hover:text-white/50 transition-colors" />
                                                </div>
                                                <p className="text-[13px] text-white/80 leading-relaxed line-clamp-2">{promptData?.text || 'Loading prompt...'}</p>
                                              </button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-lg rounded-xl border border-white/[0.04] bg-dark-grey p-0">
                                              <DialogHeader className="px-5 pt-5 pb-3 pr-12 border-b border-white/[0.04]">
                                                <DialogTitle className="flex items-center gap-2 text-sm font-medium text-white/90">
                                                  <MessageSquareText className="h-4 w-4 text-white/50" />
                                                  Tracked Prompt
                                                </DialogTitle>
                                              </DialogHeader>
                                              <div className="px-5 py-4">
                                                <p className="text-[14px] text-white/80 leading-relaxed whitespace-pre-wrap">{promptData?.text || 'Loading prompt...'}</p>
                                              </div>
                                            </DialogContent>
                                          </Dialog>
                                          
                                          {/* Responses list - clickable to view full response */}
                                          <div className="rounded-lg border border-white/[0.03] bg-white/[0.02] overflow-hidden">
                                            <div className="max-h-[260px] overflow-y-auto divide-y divide-white/[0.03]">
                                              {visibleChatsLocal.map((chat) => {
                                                const responseText = (chat.fullResponse || '').split('\n').filter(Boolean).join(' ')
                                                const words = responseText.split(/\s+/).filter(Boolean)
                                                const previewText = words.slice(0, 12).join(' ')
                                                const hasMore = words.length > 12
                                                return (
                                                  <Dialog key={chat.id}>
                                                    <DialogTrigger asChild>
                                                      <button 
                                                        type="button"
                                                        className="w-full text-left px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer group"
                                                      >
                                                        <div className="flex items-start gap-3">
                                                          {/* Model logo */}
                                                          <div className="flex-shrink-0 mt-0.5">
                                                            <Image 
                                                              src={getProviderIconSrc(chat.provider)} 
                                                              alt={chat.provider} 
                                                              width={18} 
                                                              height={18}
                                                              className="rounded"
                                                            />
                                                          </div>
                                                          {/* Content */}
                                                          <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                              <span className="text-[12px] font-medium text-white/70">{getProviderDisplay(chat.provider)}</span>
                                                              <span className="text-[11px] text-white/30">•</span>
                                                              <span className="text-[11px] text-white/40">{chat.date}</span>
                                                            </div>
                                                            <p className="text-[13px] text-white/50 group-hover:text-white/70 transition-colors line-clamp-2">
                                                              {previewText}{hasMore && '...'}
                                                            </p>
                                                          </div>
                                                          {/* Expand icon */}
                                                          <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/40 transition-colors flex-shrink-0 mt-1" />
                                                        </div>
                                                      </button>
                                                    </DialogTrigger>
                                                    <DialogContent className="sm:max-w-2xl rounded-xl border border-white/[0.04] bg-dark-grey p-0 max-h-[80vh] overflow-hidden">
                                                      <DialogHeader className="px-5 pt-5 pb-3 pr-12 border-b border-white/[0.04]">
                                                        <DialogTitle className="flex items-center gap-3 text-sm font-medium text-white/90">
                                                          <Image 
                                                            src={getProviderIconSrc(chat.provider)} 
                                                            alt={chat.provider} 
                                                            width={20} 
                                                            height={20}
                                                            className="rounded"
                                                          />
                                                          <span>{getProviderDisplay(chat.provider)} Response</span>
                                                          <span className="text-[12px] text-white/40 font-normal">{chat.date}</span>
                                                        </DialogTitle>
                                                      </DialogHeader>
                                                      <div className="px-5 py-4 overflow-y-auto max-h-[calc(80vh-80px)]">
                                                        <div className="text-[14px] text-white/80 leading-relaxed whitespace-pre-wrap">
                                                          {chat.fullResponse || 'No response content available.'}
                                                        </div>
                                                      </div>
                                                    </DialogContent>
                                                  </Dialog>
                                                )
                                              })}
                                              {visibleChatsLocal.length === 0 && (
                                                <div className="text-center py-10">
                                                  <div className="text-[13px] text-white/40">No responses found citing this source</div>
                                                </div>
                                              )}
                                            </div>
                                            {chatsForDomain.length > 0 && (
                                              <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.03] text-[12px]">
                                                <button
                                                  type="button"
                                                  onClick={() => setSourceChatsVisibleCount(Math.min(sourceChatsVisibleCount + INITIAL_VISIBLE, chatsForDomain.length))}
                                                  disabled={remainingLocal <= 0}
                                                  className={cn(
                                                    "text-white/50 hover:text-white/70 transition-colors",
                                                    remainingLocal <= 0 && "opacity-40 cursor-not-allowed"
                                                  )}
                                                >
                                                  {remainingLocal > 0 ? `Show ${Math.min(INITIAL_VISIBLE, remainingLocal)} more` : 'All shown'}
                                                </button>
                                                <span className="text-white/40">{visibleChatsLocal.length} of {chatsForDomain.length}</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )
                                    })()}

                                    {/* URLs table */}
                                    {sourceDialogView === 'sources' && (
                                    <div className="rounded-lg border border-white/[0.03] bg-white/[0.02] overflow-hidden">
                                      <div className="max-h-[40vh] overflow-y-auto">
                                        <Table className="w-full">
                                          <TableHeader className="sticky top-0 z-10 bg-white/[0.03]">
                                            <TableRow className="hover:bg-transparent border-b border-white/[0.03]">
                                              <TableHead className="text-[13px] font-medium text-white/50 px-4 h-10">URL</TableHead>
                                              <TableHead className="w-[140px] text-center text-[13px] font-medium text-white/50 px-3 h-10">Type</TableHead>
                                              <TableHead className="w-[100px] text-center text-[13px] font-medium text-white/50 px-3 h-10">Mentioned</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {(row.urls && row.urls.length > 0) ? (
                                              row.urls
                                                .filter((item: { url: string }) => item.url && item.url.trim().length > 0)
                                                .map((item: { url: string; title?: string; citationType: string; brandMentioned: boolean }, idx: number) => {
                                                  // Format URL for display: show path, truncate if too long
                                                  const formatUrlForDisplay = (url: string): string => {
                                                    try {
                                                      const parsed = new URL(url)
                                                      // Show domain + path (without query params for cleaner display)
                                                      const pathPart = parsed.pathname === '/' ? '' : parsed.pathname
                                                      const display = parsed.hostname.replace('www.', '') + pathPart
                                                      // Truncate if too long
                                                      return display.length > 60 ? display.substring(0, 57) + '...' : display
                                                    } catch {
                                                      // Fallback for malformed URLs
                                                      return url.length > 60 ? url.substring(0, 57) + '...' : url
                                                    }
                                                  }
                                                  return (
                                                    <TableRow key={`${item.url}-${idx}`} className="hover:bg-white/[0.03] border-b border-white/[0.04] last:border-b-0 transition-colors">
                                                      <TableCell className="px-4 py-3">
                                                        <a
                                                          href={item.url}
                                                          target="_blank"
                                                          rel="noreferrer"
                                                          className="text-[13px] text-white/70 hover:text-white transition-colors truncate block max-w-[400px]"
                                                          title={item.url}
                                                        >
                                                          {formatUrlForDisplay(item.url)}
                                                        </a>
                                                      </TableCell>
                                                      <TableCell className="text-center px-3 py-3">
                                                        <span className="inline-flex items-center gap-1.5 text-[12px] text-white/60">
                                                          <ContentTypeIcon type={mapContentType(item.citationType)} />
                                                          {mapContentType(item.citationType)}
                                                        </span>
                                                      </TableCell>
                                                      <TableCell className="text-center px-3 py-3">
                                                        {item.brandMentioned ? (
                                                          <span className="inline-flex items-center gap-1 text-[12px] text-emerald-400">
                                                            <CheckCircle className="h-3.5 w-3.5" />Yes
                                                          </span>
                                                        ) : (
                                                          <span className="inline-flex items-center gap-1 text-[12px] text-white/40">
                                                            <XCircle className="h-3.5 w-3.5" />No
                                                          </span>
                                                        )}
                                                      </TableCell>
                                                    </TableRow>
                                                  )
                                                })
                                            ) : (
                                              <TableRow>
                                                <TableCell colSpan={3} className="text-center py-10">
                                                  <div className="text-[13px] text-white/40">No URLs tracked for this domain yet</div>
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
                        <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.03] bg-white/[0.01]">
                          <div className="flex items-center gap-3">
                              <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-3 rounded-md border-white/[0.04] bg-white/[0.03] text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors text-[13px]"
                              onClick={() => setSourceVisibleCount(Math.min(sourceVisibleCount + INITIAL_VISIBLE, sortedCitationSources.length))}
                              aria-label="Expand sources"
                              disabled={remainingSources <= 0}
                            >
                              Expand
                            </Button>
                              {remainingSources > 0 ? (
                                <span className="text-[12px] text-white/40">{Math.min(INITIAL_VISIBLE, remainingSources)} more</span>
                              ) : (
                                <span className="text-[12px] text-white/30">All items shown</span>
                              )}
                          </div>
                          <span className="text-[12px] text-white/40 tabular-nums">
                            {sortedCitationSources.length > 0 
                              ? `Showing 1 – ${visibleSources.length} of ${sortedCitationSources.length} items`
                              : 'No sources available'
                            }
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Table className="w-full text-[14px] table-fixed">
                          <TableHeader className="sticky top-0 z-10 bg-white/[0.03] border-b border-white/[0.03] text-[13px]">
                            <TableRow className="hover:bg-transparent h-12">
                              <TableHead className="w-[220px] text-white/50 font-medium px-4">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1.5 cursor-help">Platform <HelpCircle className="h-3.5 w-3.5 opacity-50" /></span>
                                  </TooltipTrigger>
                                  <TooltipContent>Platform where the prompt was run.</TooltipContent>
                                </Tooltip>
                              </TableHead>
                              <TableHead className="w-[120px] text-white/50 font-medium">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1.5 cursor-help">Mentioned? <HelpCircle className="h-3.5 w-3.5 opacity-50" /></span>
                                  </TooltipTrigger>
                                  <TooltipContent>Whether your brand was or wasn't mentioned in the model response</TooltipContent>
                                </Tooltip>
                              </TableHead>
                              <TableHead className="w-[100px] text-white/50 font-medium">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1.5 cursor-help">Position <HelpCircle className="h-3.5 w-3.5 opacity-50" /></span>
                                  </TooltipTrigger>
                                  <TooltipContent>Position of brand mention in the model's response (less is better)</TooltipContent>
                                </Tooltip>
                              </TableHead>
                              <TableHead className="text-white/50 font-medium">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1.5 cursor-help">Response <HelpCircle className="h-3.5 w-3.5 opacity-50" /></span>
                                  </TooltipTrigger>
                                  <TooltipContent>Output of the model</TooltipContent>
                                </Tooltip>
                              </TableHead>
                              <TableHead className="w-[140px] text-white/50 font-medium text-center px-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1.5 cursor-help">Date <HelpCircle className="h-3.5 w-3.5 opacity-50" /></span>
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
                                  <TableRow className={`group hover:bg-white/10 even:bg-white/[0.03] border-b border-white/[0.04] last:border-b-0 ${rowHeightClass} cursor-pointer`}>
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
                                      <Badge variant="outline" className="h-6 px-2 text-[12px] rounded-md border-white/[0.04] bg-white/5 text-white/90">{chat.position != null ? `#${chat.position}` : '—'}</Badge>
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
                                <DialogContent className="sm:max-w-3xl rounded-xl border border-white/[0.03] bg-dark-grey p-0 max-h-[90vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle className="sr-only">Chat Details</DialogTitle>
                                  </DialogHeader>
                                  <div className="p-6 space-y-6">
                                    {/* Header with model info */}
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05]">
                                          <Image src={getProviderIconSrc(chat.provider)} alt={`${chat.provider} icon`} width={18} height={18} />
                                        </span>
                                        <div>
                                          <div className="text-sm font-medium text-white/90">{getProviderDisplay(chat.provider)}</div>
                                          <div className="text-xs text-white/40">{chat.date}</div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3 text-[13px]">
                                        <div className="flex items-center gap-1.5">
                                          {chat.mentioned ? (
                                            <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                                          ) : (
                                            <XCircle className="h-3.5 w-3.5 text-white/40" />
                                          )}
                                          <span className="text-white/60">{chat.mentioned ? 'Mentioned' : 'Not mentioned'}</span>
                                        </div>
                                        <span className="text-white/20">·</span>
                                        <span className="text-white/60">Position <span className="text-white/90">{chat.position != null ? `#${chat.position}` : '—'}</span></span>
                                      </div>
                                    </div>

                                    {/* Prompt */}
                                    <div>
                                      <div className="text-xs text-white/40 mb-1.5">Prompt</div>
                                      <div className="text-[15px] text-white/80">{promptLabel}</div>
                                    </div>

                                    {/* Full Response */}
                                    <ResponseRenderer responseText={chat.fullResponse || 'No response available'} brandName={profile?.companyName} />

                                    {/* Citations */}
                                    <CitationsList citations={chat.responseCitations || []} />
                                  </div>
                                </DialogContent>
                              </Dialog>
                            ))}
                          </TableBody>
                        </Table>
                        <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.04]">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 rounded-md border-white/[0.04] bg-white/5 text-white/80 hover:text-white"
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