"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  PaginationState,
  SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { ChevronDownIcon, ChevronUpIcon, Plus, Trash2, X, Loader2, Pencil, Leaf, Swords, BookOpen, Building2, Download, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react"
import { CircleFlag } from "react-circle-flags"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import Image from "next/image"
// Removed Select imports (no pagination controls at bottom)
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { BrandProfileProvider, useBrandProfile } from "@/components/brand-profile-context"
import { toast } from "sonner"

type TrackedPrompt = {
  id: string
  prompt: string
  visibility: number
  model: string | null
  models: string[] // All models used for this prompt
  intent: string | null
  sentiment: "Positive" | "Neutral" | "Negative" | null
  position: number | null
  lastRun: string | null
  isPending?: boolean // True when prompt is added but not yet analyzed
}

// Format date as relative time (e.g., "2h ago", "1d ago")
const formatRelativeTime = (date: Date | string | null): string | null => {
  if (!date) return null

  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)

  if (months > 0) return `${months}mo ago`
  if (weeks > 0) return `${weeks}w ago`
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'Just now'
}

// Model logo mapping - same as Recent Chats
const getModelIcon = (model: string) => {
  const modelLower = model.toLowerCase()

  if (modelLower.includes('claude') || modelLower.includes('anthropic')) {
    return "/claude-ai-icon.svg"
  }
  if (modelLower.includes('perplexity')) {
    return "/perplexity (2).svg"
  }
  // Gemini uses Gemini logo (Google's AI is Gemini)
  if (modelLower.includes('gemini') || modelLower.includes('google')) {
    return "/gemini (3).svg"
  }
  // ChatGPT/OpenAI uses OpenAI logo
  if (modelLower.includes('gpt') || modelLower.includes('openai') || modelLower.includes('chatgpt')) {
    return "/openai_dark.svg"
  }

  // Default fallback
  return "/openai_dark.svg"
}

// Get display name for model (normalize Google → Gemini, OpenAI → ChatGPT, etc.)
const getModelDisplayName = (model: string): string => {
  const lower = model.toLowerCase()
  if (lower.includes('openai') || lower.includes('gpt') || lower.includes('chatgpt')) return 'ChatGPT'
  if (lower.includes('claude') || lower.includes('anthropic')) return 'Claude'
  if (lower.includes('gemini') || lower.includes('google')) return 'Gemini'
  if (lower.includes('perplexity')) return 'Perplexity'
  return model
}

// Create columns function to access router
const createColumns = (router: ReturnType<typeof useRouter>, selectedCountry: string): ColumnDef<TrackedPrompt>[] => [
  {
    id: "select",
    header: () => null,
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          className="scale-105"
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    size: 28,
    enableSorting: false,
  },
  {
    id: "region",
    header: () => null,
    cell: () => (
      <div className="flex items-center justify-center">
        <CircleFlag countryCode={selectedCountry.toLowerCase()} height="16" width="16" style={{ width: 16, height: 16 }} />
      </div>
    ),
    size: 24,
    enableSorting: false,
  },
  {
    header: () => (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-default -ml-14">Prompt</div>
        </TooltipTrigger>
        <TooltipContent>Query tested against AI models</TooltipContent>
      </Tooltip>
    ),
    accessorKey: "prompt",
    cell: ({ row }) => (
      <div 
        className="font-medium text-white/90 text-[15px] md:text-base leading-relaxed cursor-pointer hover:text-white transition-colors max-w-[300px] md:max-w-[400px] truncate"
        title={row.getValue("prompt")}
        onClick={(e) => {
          e.stopPropagation()
          router.push(`/dashboard/tracked-prompts/${row.original.id}`)
        }}
      >
        {row.getValue("prompt")}
      </div>
    ),
    enableSorting: false,
    size: 400,
  },
  {
    header: () => (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-default text-center">Visibility</div>
        </TooltipTrigger>
        <TooltipContent>Percentage of responses that mention your brand</TooltipContent>
      </Tooltip>
    ),
    accessorKey: "visibility",
    cell: ({ row }) => {
      // Show skeleton loading state for pending prompts
      if (row.original.isPending) {
        return (
          <div className="flex items-center gap-2 pl-2">
            <span className="h-5 w-12 rounded bg-white/[0.06] animate-pulse" />
          </div>
        )
      }
      const value = Number(row.getValue("visibility"))
      const getColor = () => {
        if (value >= 70) return "bg-emerald-500"
        if (value >= 40) return "bg-yellow-500"
        if (value > 0) return "bg-orange-500"
        return "bg-white/30"
      }
      return (
        <div className="flex items-center gap-2 pl-2">
          <div className={`w-2 h-2 rounded-full ${getColor()}`} />
          <span className="text-white/90 font-medium">{value}%</span>
        </div>
      )
    },
    enableSorting: true,
    size: 100,
  },
  {
    header: () => (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-default text-center">Position</div>
        </TooltipTrigger>
        <TooltipContent>Average rank where your brand appears (lower is better)</TooltipContent>
      </Tooltip>
    ),
    accessorKey: "position",
    cell: ({ row }) => {
      // Show skeleton loading state for pending prompts
      if (row.original.isPending) {
        return (
          <div className="flex items-center pl-2">
            <span className="h-5 w-10 rounded bg-white/[0.06] animate-pulse" />
          </div>
        )
      }
      const pos = row.getValue("position") as number | null
      if (pos == null) {
        return (
          <div className="flex items-center pl-2">
            <span className="text-muted-foreground text-sm">—</span>
          </div>
        )
      }
      return (
        <div className="flex items-center pl-2">
          <span className="text-white/80 text-sm font-medium">#{pos.toFixed(1)}</span>
        </div>
      )
    },
    enableSorting: true,
    size: 90,
  },
  {
    header: () => (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-default text-center">Model</div>
        </TooltipTrigger>
        <TooltipContent>AI model used for the last check</TooltipContent>
      </Tooltip>
    ),
    accessorKey: "model",
    cell: ({ row }) => {
      // Show skeleton loading state for pending prompts
      if (row.original.isPending) {
        return (
          <div className="flex items-center justify-center gap-1">
            <span className="h-5 w-5 rounded-full bg-white/[0.06] animate-pulse" />
            <span className="h-5 w-5 rounded-full bg-white/[0.06] animate-pulse" />
          </div>
        )
      }
      const models = row.original.models || []
      if (models.length === 0) {
        return (
          <div className="flex items-center justify-center">
            <span className="text-muted-foreground text-sm">—</span>
          </div>
        )
      }

      return (
        <div className="flex items-center justify-center gap-0.5">
          {models.map((model, idx) => (
            <Tooltip key={`${model}-${idx}`}>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center justify-center size-5 rounded-full bg-white/5 border border-white/[0.04] flex-shrink-0 p-0.5 cursor-default">
                  <img
                    src={getModelIcon(model)}
                    alt={getModelDisplayName(model)}
                    className="size-3.5 object-contain"
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>{getModelDisplayName(model)}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      )
    },
    enableSorting: false,
    size: 70,
  },
  {
    header: () => (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-default text-center">Last Run</div>
        </TooltipTrigger>
        <TooltipContent>Time since the last analysis</TooltipContent>
      </Tooltip>
    ),
    accessorKey: "lastRun",
    cell: ({ row }) => {
      // Show skeleton loading state for pending prompts
      if (row.original.isPending) {
        return (
          <div className="flex items-center justify-center">
            <span className="h-5 w-14 rounded bg-white/[0.06] animate-pulse" />
          </div>
        )
      }
      const lastRun = row.getValue("lastRun") as string | null
      if (!lastRun) {
        return (
          <div className="flex items-center justify-center">
            <span className="text-muted-foreground text-sm">—</span>
          </div>
        )
      }
      return (
        <div className="flex items-center justify-center">
          <span className="text-white/70 text-sm">{lastRun}</span>
        </div>
      )
    },
    enableSorting: false,
    size: 90,
  },
  {
    header: () => (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-default text-center">Intent</div>
        </TooltipTrigger>
        <TooltipContent>Category of the prompt (Organic, Competitor, How‑to, Brand‑Specific)</TooltipContent>
      </Tooltip>
    ),
    accessorKey: "intent",
    cell: ({ row }) => {
      // Show skeleton loading state for pending prompts
      if (row.original.isPending) {
        return (
          <div className="flex items-center justify-center">
            <span className="h-5 w-16 rounded bg-white/[0.06] animate-pulse" />
          </div>
        )
      }
      const intent = row.getValue("intent") as string | null
      if (!intent) {
        return (
          <div className="flex items-center justify-center">
            <span className="text-muted-foreground text-sm">—</span>
          </div>
        )
      }
      const intentConfig: Record<string, { icon: React.ReactNode; label: string }> = {
        "Organic": { icon: <Leaf className="h-3.5 w-3.5" />, label: "Organic" },
        "Competitor": { icon: <Swords className="h-3.5 w-3.5" />, label: "Competitor" },
        "How-to": { icon: <BookOpen className="h-3.5 w-3.5" />, label: "How to" },
        "How-to Guides": { icon: <BookOpen className="h-3.5 w-3.5" />, label: "How to" },
        "Brand-Specific": { icon: <Building2 className="h-3.5 w-3.5" />, label: "Brand-Specific" },
        "FAQ": { icon: <HelpCircle className="h-3.5 w-3.5" />, label: "FAQ" },
      }
      const config = intentConfig[intent] || { icon: null, label: intent }
      return (
        <div className="flex items-center justify-center">
          <Badge className="px-2 py-0.5 rounded text-xs font-medium bg-white text-black border-0 gap-1.5">
            {config.icon}
            {config.label}
          </Badge>
        </div>
      )
    },
    enableSorting: false,
    size: 120,
  },
  {
    header: () => (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-default text-center">Sentiment</div>
        </TooltipTrigger>
        <TooltipContent>Overall tone of mentions (Positive / Neutral / Negative)</TooltipContent>
      </Tooltip>
    ),
    accessorKey: "sentiment",
    cell: ({ row }) => {
      // Show skeleton loading state for pending prompts
      if (row.original.isPending) {
        return (
          <div className="flex items-center justify-center">
            <span className="h-5 w-14 rounded bg-white/[0.06] animate-pulse" />
          </div>
        )
      }
      const sentiment = row.getValue("sentiment") as string | null
      if (!sentiment) {
        return (
          <div className="flex items-center justify-center">
            <span className="text-muted-foreground text-sm">—</span>
          </div>
        )
      }
      return (
        <div className="flex items-center justify-center">
          <Badge className="px-2 py-0.5 rounded text-xs font-medium bg-white/10 text-white/80 border-0">
            {sentiment.charAt(0).toUpperCase() + sentiment.slice(1).toLowerCase()}
          </Badge>
        </div>
      )
    },
    enableSorting: false,
    size: 100,
  },
]

function TrackedPromptsPageInner() {
  const router = useRouter()
  const { profile, selectedCountry } = useBrandProfile()
  const [data, setData] = useState<TrackedPrompt[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [newPromptText, setNewPromptText] = useState("")
  const [newIntent, setNewIntent] = useState<string>("Organic")
  const [runAnalysisOnAdd, setRunAnalysisOnAdd] = useState(true) // BUG-3: Option to run immediate analysis
  const [showAll, setShowAll] = useState(true)
  
  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<TrackedPrompt | null>(null)
  const [editPromptText, setEditPromptText] = useState("")
  const [editIntent, setEditIntent] = useState<string>("Organic")
  const [isEditing, setIsEditing] = useState(false)
  
  // Filter states
  const [selectedModel, setSelectedModel] = useState<string>("all")
  const [selectedIntent, setSelectedIntent] = useState<string>("all")
  
  // Create columns with router access
  const columns = useMemo(() => createColumns(router, selectedCountry), [router, selectedCountry])

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 200, // show all by default (max 100 prompts)
  })
  const [sorting, setSorting] = useState<SortingState>([
    { id: "visibility", desc: true },
  ])

  // State for delete/add operations
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Unified AI generation state (inside Add Prompt dialog)
  const [dialogMode, setDialogMode] = useState<'manual' | 'ai'>('manual')
  const [aiStep, setAiStep] = useState<'describe' | 'preview' | 'running'>('describe')
  const [aiDescription, setAiDescription] = useState("")
  const [aiCount, setAiCount] = useState<3 | 5 | 10>(5)
  const [isAiGenerating, setIsAiGenerating] = useState(false)
  const [generatedPrompts, setGeneratedPrompts] = useState<{id: number, text: string, category: string}[]>([])
  const [analysisStatus, setAnalysisStatus] = useState<Record<number, 'pending' | 'running' | 'done' | 'error'>>({})
  const [analysisCompleted, setAnalysisCompleted] = useState(0)
  const analysisAbortRef = useRef(false)
  const fetchAbortRef = useRef<AbortController | null>(null)

  // Fetch prompts function (extracted for reuse)
  const fetchPrompts = async () => {
    if (!profile?.id) {
      console.log('⏳ Waiting for brand profile...')
      return
    }

    // Abort any in-flight fetch to prevent stale responses from overwriting fresh data
    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort()
    }
    const controller = new AbortController()
    fetchAbortRef.current = controller

    console.log('📡 Fetching tracked prompts for brand:', profile.id, 'with model filter:', selectedModel, 'country:', selectedCountry)
    setIsLoading(true)

    try {
      const modelParam = selectedModel !== 'all' ? `&model=${encodeURIComponent(selectedModel)}` : ''
      const countryParam = selectedCountry ? `&country=${selectedCountry}` : ''
      const response = await fetch(
        `/api/prompts/with-results?brandProfileId=${profile.id}${modelParam}${countryParam}`,
        { signal: controller.signal }
      )
      const result = await response.json()

      // If this request was aborted while parsing, don't update state
      if (controller.signal.aborted) return

      console.log('📥 Prompts API response:', {
        success: result.success,
        count: result.count,
        hasAnalysis: result.hasAnalysis,
        analysisDate: result.analysisDate
      })

      if (result.success && result.prompts) {
        const transformedData = transformPromptsFromApi(result.prompts, result.analysisDate)

        console.log(`✅ Loaded ${transformedData.length} prompts with analysis results`)
        if (transformedData.length > 0) {
          console.log(`   Sample prompt:`, {
            id: transformedData[0].id,
            text: transformedData[0].prompt.substring(0, 50) + '...',
            visibility: transformedData[0].visibility,
            model: transformedData[0].model
          })
        }

        setData(transformedData)
      } else if (!result.hasAnalysis) {
        console.warn('⚠️  No analysis run yet for this brand')
        setData([])
      } else {
        console.warn('⚠️  No prompts found')
        setData([])
      }
    } catch (error: any) {
      if (error.name === 'AbortError') return // Expected when switching regions quickly
      console.error('❌ Error fetching prompts:', error)
      setErrorMessage('Failed to load prompts. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch prompts on mount and when profile or model filter changes
  useEffect(() => {
    fetchPrompts()
    return () => {
      // Cleanup: abort fetch when deps change or unmount
      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort()
      }
    }
  }, [profile?.id, selectedModel, selectedCountry])

  // Filter the data based on selected filters
  // Note: Model filtering is now handled at the API level for accurate metrics
  // Client-side filtering only handles intent
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const intentMatch = selectedIntent === "all" || item.intent === selectedIntent
      return intentMatch
    })
  }, [data, selectedIntent])

  // Get unique models and intents for filter dropdowns
  // Normalize model names to handle duplicates like "Openai" vs "openai" vs "ChatGPT"
  const normalizeModelName = (model: string): string => {
    const lower = model.toLowerCase()
    if (lower.includes('openai') || lower.includes('gpt') || lower.includes('chatgpt')) return 'ChatGPT'
    if (lower.includes('claude') || lower.includes('anthropic')) return 'Claude'
    if (lower.includes('gemini') || lower.includes('google')) return 'Gemini'
    if (lower.includes('perplexity')) return 'Perplexity'
    return model
  }

  const availableModels = useMemo(() => {
    // Collect all models from all prompts (using models array)
    const allModels: string[] = []
    data.forEach(item => {
      if (item.models && item.models.length > 0) {
        item.models.forEach(m => allModels.push(normalizeModelName(m)))
      } else if (item.model) {
        allModels.push(normalizeModelName(item.model))
      }
    })
    const models = Array.from(new Set(allModels))
    return models.sort()
  }, [data])

  const availableIntents = useMemo(() => {
    const intents = Array.from(new Set(data.map(item => item.intent).filter((i): i is string => Boolean(i))))
    return intents.sort()
  }, [data])

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    enableSortingRemoval: false,
    state: { sorting, pagination },
  })

  const selectedCount = Object.keys(table.getState().rowSelection).length
  
  const handleDeletePrompt = async (promptId: string) => {
    setIsDeleting(promptId)
    setErrorMessage(null)
    
    try {
      const numericId = parseInt(promptId)
      console.log('🗑️ Deleting prompt:', promptId, 'for brand:', profile.id)

      // Synthetic prompts (negative IDs) only exist in local state, not in the DB
      if (numericId < 0 || promptId.startsWith('pending-')) {
        console.log('✅ Removing synthetic/pending prompt from local state:', promptId)
        setData((prev) => prev.filter((p) => p.id !== promptId))
        table.resetRowSelection()
        return
      }
      
      const response = await fetch('/api/prompts/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptId: numericId,
          brandProfileId: profile.id,
        }),
      })

      const result = await response.json()
      console.log('📥 Delete prompt response:', result)

      if (result.success) {
        console.log('✅ Prompt deleted successfully')
        // Immediately remove from local state for instant UI feedback
        setData((prev) => prev.filter((p) => p.id !== promptId))
        table.resetRowSelection()
        // Also refresh from server to ensure full consistency
        await fetchPrompts()
      } else {
        const errorMsg = result.error?.message || result.message || 'Failed to delete prompt'
        setErrorMessage(errorMsg)
        console.error('❌ Delete failed:', result)
      }
    } catch (error) {
      console.error('❌ Error deleting prompt:', error)
      setErrorMessage('Failed to delete prompt. Please try again.')
    } finally {
      setIsDeleting(null)
    }
  }

  // Validation constants (match backend)
  const MAX_PROMPT_LENGTH = 500

  // A prompt can be fully analyzed even when visibility is 0%.
  const hasPromptBeenAnalyzed = (prompt: any): boolean => {
    return Boolean(
      prompt?.lastAnalyzedAt ||
      prompt?.promptAggregate ||
      (Array.isArray(prompt?.results) && prompt.results.length > 0) ||
      (Array.isArray(prompt?.models) && prompt.models.length > 0) ||
      prompt?.model
    )
  }

  const transformPromptsFromApi = (
    prompts: any[],
    analysisDate: string | null | undefined,
    pendingPromptIds: Set<string> = new Set()
  ): TrackedPrompt[] => {
    const globalLastRunTime = formatRelativeTime(analysisDate || null)

    return prompts.map((p: any) => {
      const hasBeenAnalyzed = hasPromptBeenAnalyzed(p)
      const lastRunTime = p.lastAnalyzedAt
        ? formatRelativeTime(p.lastAnalyzedAt)
        : globalLastRunTime
      const promptId = p.id.toString()

      return {
        id: promptId,
        prompt: p.text,
        visibility: Math.round(p.visibility || 0),
        model: p.model || null,
        models: p.models || [],
        intent: p.category || null,
        sentiment: p.sentiment || null,
        position: p.position || null,
        lastRun: hasBeenAnalyzed ? lastRunTime : null,
        isPending: !hasBeenAnalyzed && pendingPromptIds.has(promptId),
      }
    })
  }

  const handleAddPrompt = async () => {
    const text = newPromptText.trim()

    // Frontend validation (BUG-4)
    if (!text) {
      setErrorMessage('Please enter a prompt')
      return
    }

    if (text.length > MAX_PROMPT_LENGTH) {
      setErrorMessage(`Prompt cannot exceed ${MAX_PROMPT_LENGTH} characters`)
      return
    }

    // Check if at limit before making request
    if (data.length >= 100) {
      setErrorMessage('Maximum 100 active prompts allowed. Please delete a prompt before adding a new one.')
      return
    }

    // Capture form values before resetting
    const capturedIntent = newIntent
    const capturedRunAnalysis = runAnalysisOnAdd

    // Close dialog and reset form immediately
    setAddOpen(false)
    setNewPromptText("")
    setNewIntent("Organic")
    setErrorMessage(null)

    // Add optimistic pending prompt to the table right away
    const optimisticId = `pending-${Date.now()}`
    const pendingPrompt: TrackedPrompt = {
      id: optimisticId,
      prompt: text,
      visibility: 0,
      model: null,
      models: [],
      intent: capturedIntent,
      sentiment: null,
      position: null,
      lastRun: null,
      isPending: capturedRunAnalysis,
    }
    setData((prev) => [pendingPrompt, ...prev])

    setIsAdding(true)

    try {
      const response = await fetch('/api/prompts/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptText: text,
          category: capturedIntent,
          brandProfileId: profile.id,
          runAnalysis: capturedRunAnalysis, // BUG-3: Pass immediate analysis flag
        }),
      })

      const result = await response.json()
      console.log('📥 Add prompt response:', { status: response.status, result })

      if (response.ok && result.success) {
        const analysisComplete = Boolean(result.data?.analysisComplete)
        console.log('✅ Prompt added successfully', analysisComplete ? `(analysis complete: ${result.data?.visibility}% visibility)` : result.data?.analysisTriggered ? '(analysis triggered)' : '')

        // Validate that server returned a real prompt ID - this is required for polling/tracking
        if (!result.data?.prompt?.id) {
          console.error('❌ API returned success but no prompt ID', { result })
          setData((prev) => prev.filter((p) => p.id !== optimisticId))
          toast.error('Failed to create prompt: server returned invalid response')
          return
        }

        const newPromptId = result.data.prompt.id.toString()
        const analysisTriggered = Boolean(result.data?.analysisTriggered)

        // Replace optimistic prompt ID with real ID from server
        setData((prev) => prev.map((p) => p.id === optimisticId ? { ...p, id: newPromptId, isPending: capturedRunAnalysis && analysisTriggered } : p))

        // If analysis completed synchronously, refresh data immediately
        if (analysisComplete) {
          try {
            const refreshResponse = await fetch(`/api/prompts/with-results?brandProfileId=${profile.id}`)
            const refreshResult = await refreshResponse.json()
            if (refreshResult.success && refreshResult.prompts) {
              const transformedData = transformPromptsFromApi(refreshResult.prompts, refreshResult.analysisDate, new Set())
              setData(transformedData)
              console.log(`✅ Prompt ${newPromptId} data refreshed with analysis results`)
              window.dispatchEvent(new Event('mudra:analysis-complete'))
            }
          } catch (err) {
            console.error('Error refreshing after analysis:', err)
          }
          return
        }

        if (capturedRunAnalysis && analysisTriggered) {
          // Fallback polling in case analysis was triggered but not yet complete
          const pollForResults = async (attempts: number = 0, maxAttempts: number = 18) => {
            const delay = attempts === 0 ? 3000 : 5000
            await new Promise(resolve => setTimeout(resolve, delay))

            try {
              const response = await fetch(`/api/prompts/with-results?brandProfileId=${profile.id}`)
              const refreshResult = await response.json()

              if (refreshResult.success && refreshResult.prompts) {
                const newPromptData = refreshResult.prompts.find((p: any) => p.id.toString() === newPromptId)
                const hasResults = Boolean(newPromptData && hasPromptBeenAnalyzed(newPromptData))
                const shouldKeepPending = !hasResults && attempts < maxAttempts - 1

                const transformedData = transformPromptsFromApi(
                  refreshResult.prompts,
                  refreshResult.analysisDate,
                  shouldKeepPending ? new Set([newPromptId]) : new Set()
                )
                setData(transformedData)

                if (shouldKeepPending) {
                  console.log(`🔄 Prompt ${newPromptId} still pending, polling again (attempt ${attempts + 2}/${maxAttempts})`)
                  pollForResults(attempts + 1, maxAttempts)
                } else if (hasResults) {
                  console.log(`✅ Prompt ${newPromptId} analysis complete!`)
                  window.dispatchEvent(new Event('mudra:analysis-complete'))
                } else {
                  console.log(`⏰ Prompt ${newPromptId} did not complete within polling window`)
                }
              } else if (attempts < maxAttempts - 1) {
                pollForResults(attempts + 1, maxAttempts)
              } else {
                setData((prev) => prev.map((p) => p.id === newPromptId ? { ...p, isPending: false } : p))
              }
            } catch (err) {
              console.error('Error polling for results:', err)
              if (attempts < maxAttempts - 1) {
                pollForResults(attempts + 1, maxAttempts)
              } else {
                setData((prev) => prev.map((p) => p.id === newPromptId ? { ...p, isPending: false } : p))
              }
            }
          }

          pollForResults()
        } else if (!capturedRunAnalysis) {
          // No analysis triggered: refetch from server to show prompt with actual state
          await fetchPrompts()
        }
      } else {
        // API returned an error — remove the optimistic prompt and notify user
        setData((prev) => prev.filter((p) => p.id !== optimisticId))
        const errorMsg = result.error?.message || result.message || 'Failed to add prompt'
        toast.error(errorMsg)
        console.error('❌ Add failed:', { status: response.status, result })
      }
    } catch (error) {
      // Network/unexpected error — remove the optimistic prompt and notify user
      setData((prev) => prev.filter((p) => p.id !== optimisticId))
      toast.error('Failed to add prompt. Please try again.')
      console.error('❌ Error adding prompt:', error)
    } finally {
      setIsAdding(false)
    }
  }

  const resetAiState = () => {
    setDialogMode('manual')
    setAiStep('describe')
    setAiDescription("")
    setAiCount(5)
    setIsAiGenerating(false)
    setGeneratedPrompts([])
    setAnalysisStatus({})
    setAnalysisCompleted(0)
  }

  const handleGenerate = async () => {
    if (!aiDescription.trim()) {
      toast.error("Please describe what prompts you want")
      return
    }
    if (!profile?.id) return

    setIsAiGenerating(true)

    try {
      const response = await fetch('/api/prompts/batch-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandProfileId: profile.id,
          description: aiDescription,
          count: aiCount,
          brandInfo: {
            companyName: profile.companyName || '',
            companyDescription: profile.companyDescription || '',
            industry: profile.companyIndustry || '',
            productsServices: profile.companyServices
              ? profile.companyServices.split(',').map((s: string) => s.trim())
              : [],
            idealCustomer: profile.companyICP || '',
            competitors: profile.competitors || []
          }
        })
      })

      if (!response.ok) {
        try {
          const errorData = await response.json()
          toast.error(errorData.error || "Failed to generate prompts")
        } catch {
          toast.error("Failed to generate prompts")
        }
        return
      }

      const result = await response.json()

      if (!result.success) {
        toast.error(result.error || "Failed to generate prompts")
        return
      }

      const savedPrompts = result.prompts
      if (!Array.isArray(savedPrompts)) {
        toast.error("Invalid response: prompts array missing")
        return
      }

      setGeneratedPrompts(savedPrompts.map((p: any) => ({ id: p.id, text: p.text, category: p.category || 'Organic' })))
      await fetchPrompts()
      setAiStep('preview')
    } catch (error) {
      console.error("Error generating prompts:", error)
      toast.error("Failed to generate prompts")
    } finally {
      setIsAiGenerating(false)
    }
  }

  const handleRunAnalysis = async () => {
    if (!profile?.id) {
      toast.error("Brand profile not loaded. Please refresh and try again.")
      return
    }
    if (generatedPrompts.length === 0) {
      toast.error("No prompts to analyze.")
      return
    }

    setAiStep('running')
    analysisAbortRef.current = false
    const initStatus: Record<number, 'pending'> = {}
    generatedPrompts.forEach(p => { initStatus[p.id] = 'pending' })
    setAnalysisStatus(initStatus)
    setAnalysisCompleted(0)

    // Mark all generated prompts as pending in the table immediately
    const promptIds = new Set(generatedPrompts.map(p => p.id.toString()))
    setData(prev => prev.map(p => promptIds.has(p.id) ? { ...p, isPending: true } : p))

    let completed = 0
    let errorCount = 0
    for (let i = 0; i < generatedPrompts.length; i++) {
      if (analysisAbortRef.current) break

      const prompt = generatedPrompts[i]
      setAnalysisStatus(prev => ({ ...prev, [prompt.id]: 'running' }))

      let success = false
      try {
        const response = await fetch('/api/prompts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            promptId: prompt.id.toString(),
            text: prompt.text,
            category: prompt.category,
            runAnalysis: true
          })
        })

        if (!response.ok) {
          let errorMsg = 'Unknown error'
          try {
            const errorData = await response.json()
            errorMsg = errorData.error || errorMsg
          } catch { /* ignore parse error */ }
          console.error(`Failed to analyze prompt ${prompt.id}: ${response.status} ${errorMsg}`)
          setAnalysisStatus(prev => ({ ...prev, [prompt.id]: 'error' }))
          errorCount++
        } else {
          const result = await response.json()
          if (!result.success) {
            console.error(`Failed to analyze prompt ${prompt.id}: ${result.error || 'Unknown error'}`)
            setAnalysisStatus(prev => ({ ...prev, [prompt.id]: 'error' }))
            errorCount++
          } else {
            setAnalysisStatus(prev => ({ ...prev, [prompt.id]: 'done' }))
            success = true
          }
        }
      } catch (error) {
        console.error(`Failed to analyze prompt ${prompt.id}:`, error)
        setAnalysisStatus(prev => ({ ...prev, [prompt.id]: 'error' }))
        errorCount++
      }

      completed++
      setAnalysisCompleted(completed)

      // Refresh table after each prompt so skeleton clears one-by-one
      if (success || completed === generatedPrompts.length) {
        try {
          const refreshResponse = await fetch(`/api/prompts/with-results?brandProfileId=${profile.id}`)
          const refreshResult = await refreshResponse.json()
          if (refreshResult.success && refreshResult.prompts) {
            // Only keep isPending for prompts not yet analyzed in this batch
            const remainingIds = new Set(generatedPrompts.slice(completed).map(p => p.id.toString()))
            const transformedData = transformPromptsFromApi(refreshResult.prompts, refreshResult.analysisDate, remainingIds)
            setData(transformedData)
          }
        } catch (err) {
          console.error('Error refreshing after prompt analysis:', err)
        }
      }
    }

    window.dispatchEvent(new Event('mudra:analysis-complete'))

    if (errorCount > 0) {
      toast.error(`${errorCount} prompt${errorCount > 1 ? 's' : ''} failed to analyze. Check console for details.`)
    }

    // Auto-close if user hasn't already closed
    if (!analysisAbortRef.current) {
      setAddOpen(false)
    }
    // Always reset AI state after analysis completes so dialog doesn't reopen with stale state
    resetAiState()
  }

  const handleEditPrompt = async () => {
    const text = editPromptText.trim()

    if (!text) {
      setErrorMessage('Please enter a prompt')
      return
    }

    if (text.length > MAX_PROMPT_LENGTH) {
      setErrorMessage(`Prompt cannot exceed ${MAX_PROMPT_LENGTH} characters`)
      return
    }

    if (!editingPrompt) {
      setErrorMessage('No prompt selected for editing')
      return
    }

    const promptChanged = text !== editingPrompt.prompt
    const editedPromptId = editingPrompt.id

    setIsEditing(true)
    setErrorMessage(null)

    try {
      const response = await fetch('/api/prompts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptId: parseInt(editingPrompt.id),
          text: text,
          category: editIntent,
          runAnalysis: promptChanged, // Re-run analysis when text changes
        }),
      })

      const result = await response.json()
      console.log('📥 Edit prompt response:', { status: response.status, result })

      if (response.ok && result.success) {
        console.log('✅ Prompt edited successfully', result.analysisComplete ? `(re-analysis complete: ${result.visibility}% visibility)` : promptChanged ? '(re-analysis pending)' : '')

        // Close dialog and reset form
        setEditOpen(false)
        setEditingPrompt(null)
        setEditPromptText("")
        setEditIntent("Organic")
        setErrorMessage(null)

        // Update the prompt in local state immediately
        setData((prev) => prev.map(p =>
          p.id === editedPromptId
            ? { ...p, prompt: text, intent: editIntent, isPending: promptChanged && !result.analysisComplete }
            : p
        ))

        // Refresh from server to get updated analysis results
        await fetchPrompts()

        // Notify other dashboard components that data changed
        if (result.analysisComplete) {
          window.dispatchEvent(new Event('mudra:analysis-complete'))
        }
      } else {
        const errorMsg = result.error?.message || result.error || 'Failed to edit prompt'
        setErrorMessage(errorMsg)
        console.error('❌ Edit failed:', result)
      }
    } catch (error) {
      console.error('❌ Error editing prompt:', error)
      setErrorMessage('Failed to edit prompt. Please try again.')
    } finally {
      setIsEditing(false)
    }
  }

  const openEditDialog = (prompt: TrackedPrompt) => {
    setEditingPrompt(prompt)
    setEditPromptText(prompt.prompt)
    setEditIntent(prompt.intent || "Organic")
    setErrorMessage(null)
    setEditOpen(true)
  }

  const handleExportCSV = () => {
    const headers = ["Prompt", "Visibility (%)", "Position", "Models", "Last Run", "Intent", "Sentiment"]
    const rows = filteredData.map((item) => [
      `"${item.prompt.replace(/"/g, '""')}"`,
      item.visibility,
      item.position != null ? `#${item.position.toFixed(1)}` : "",
      item.models.map(getModelDisplayName).join("; "),
      item.lastRun || "",
      item.intent || "",
      item.sentiment || "",
    ])

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `tracked-prompts-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

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
          <div className="container-type-inline-size container-name-main flex flex-1 flex-col gap-3 md:gap-4 bg-dark-grey">
            {/* Page Header (match Overview spacing) */}
              <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">Tracked Prompts</h1>
                  <p className="text-muted-foreground">Monitor prompts and mentions across AI models</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="h-9 rounded-lg bg-white/5 text-white hover:bg-white/10 border-0"
                    onClick={() => {
                      if (showAll) {
                        setPagination((p: PaginationState) => ({ ...p, pageIndex: 0, pageSize: 15 }))
                        setShowAll(false)
                      } else {
                        setPagination((p: PaginationState) => ({ ...p, pageIndex: 0, pageSize: filteredData.length }))
                        setShowAll(true)
                      }
                    }}
                    disabled={isLoading || filteredData.length === 0}
                  >
                    {showAll ? "Collapse" : "Expand"}
                  </Button>
                  <Button
                    size="sm"
                    className="h-9 rounded-lg bg-white text-black hover:bg-white/90 border-transparent gap-1.5"
                    onClick={() => setAddOpen(true)}
                    disabled={isLoading || data.length >= 100}
                  >
                    <Plus className="h-4 w-4" />
                    Add Prompt
                  </Button>
                </div>
              </div>
            </div>

            {/* Clean Divider Line - Full Width */}
            <div className="h-[0.25px] bg-white/10"></div>

            {/* Content Area */}
            <div className="flex flex-col flex-1">
              <div className="px-4 lg:px-6 pt-6 pb-6 md:pb-8 space-y-4">
                {/* Filters */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Filter by:</span>
                  </div>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="w-[160px] h-9 !bg-[#161616] hover:!bg-[#1c1c1c] !border-0 text-white rounded-lg transition-all duration-200">
                      <SelectValue placeholder="All Models" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#161616] border-0">
                      <SelectItem value="all">
                        All Models
                      </SelectItem>
                      {availableModels
                        .filter((model): model is string => model !== null)
                        .map((model) => (
                          <SelectItem key={model} value={model}>
                            <div className="flex items-center gap-2">
                              {getModelIcon(model) && (
                                <Image
                                  src={getModelIcon(model)!}
                                  alt=""
                                  width={16}
                                  height={16}
                                  className="shrink-0"
                                />
                              )}
                              <span>{model}</span>
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedIntent} onValueChange={setSelectedIntent}>
                    <SelectTrigger className="w-[180px] h-9 !bg-[#161616] hover:!bg-[#1c1c1c] !border-0 text-white rounded-lg transition-all duration-200">
                      <SelectValue placeholder="All Intents" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#161616] border-0">
                      <SelectItem value="all">All Intents</SelectItem>
                      {availableIntents
                        .filter((intent): intent is string => intent !== null)
                        .map((intent) => (
                          <SelectItem key={intent} value={intent}>
                            {intent}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {(selectedModel !== "all" || selectedIntent !== "all") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 text-muted-foreground hover:text-white"
                      onClick={() => {
                        setSelectedModel("all")
                        setSelectedIntent("all")
                      }}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear filters
                    </Button>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <div className={`px-2.5 py-1 rounded-md text-sm font-medium ${
                      data.length >= 100
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-white/5 text-muted-foreground'
                    }`}>
                      {filteredData.length}/{data.length}
                    </div>
                    <Button
                      size="sm"
                      className="h-8 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border-0 gap-1.5 text-sm"
                      onClick={handleExportCSV}
                      disabled={isLoading || filteredData.length === 0}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export
                    </Button>
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-white/[0.04]">
                  <Table className="table-fixed text-sm">
                    <TableHeader className="bg-white/[0.04]">
                      {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id} className="hover:bg-transparent border-white/[0.06]">
                          {headerGroup.headers.map((header) => (
                            <TableHead
                              key={header.id}
                              style={{ width: `${header.getSize()}px` }}
                              className="h-11 md:h-12 text-white/80"
                            >
                              {header.isPlaceholder ? null : header.column.getCanSort() ? (
                                <div
                                  className={cn(
                                    header.column.getCanSort() &&
                                      "flex h-full cursor-pointer items-center justify-between gap-2 select-none"
                                  )}
                                  onClick={header.column.getToggleSortingHandler()}
                                  onKeyDown={(e) => {
                                    if (
                                      header.column.getCanSort() &&
                                      (e.key === "Enter" || e.key === " ")
                                    ) {
                                      e.preventDefault()
                                      header.column.getToggleSortingHandler()?.(e)
                                    }
                                  }}
                                  tabIndex={header.column.getCanSort() ? 0 : undefined}
                                >
                                  {flexRender(header.column.columnDef.header, header.getContext())}
                                  {{
                                    asc: (
                                      <ChevronUpIcon className="shrink-0 opacity-60" size={16} aria-hidden="true" />
                                    ),
                                    desc: (
                                      <ChevronDownIcon className="shrink-0 opacity-60" size={16} aria-hidden="true" />
                                    ),
                                  }[header.column.getIsSorted() as string] ?? null}
                                </div>
                              ) : (
                                flexRender(header.column.columnDef.header, header.getContext())
                              )}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        // Skeleton loading rows
                        Array.from({ length: 6 }).map((_, i) => (
                          <TableRow key={`skeleton-${i}`} className="border-white/[0.06]">
                            {/* Checkbox */}
                            <TableCell style={{ width: '36px' }} className="py-3.5">
                              <div className="flex items-center justify-center">
                                <Skeleton className="h-4 w-4 rounded bg-white/[0.06]" />
                              </div>
                            </TableCell>
                            {/* Region flag */}
                            <TableCell style={{ width: '32px' }} className="py-3.5">
                              <div className="flex items-center justify-center">
                                <Skeleton className="h-4 w-4 rounded-full bg-white/[0.06]" />
                              </div>
                            </TableCell>
                            {/* Prompt */}
                            <TableCell style={{ width: '400px' }} className="py-3.5">
                              <Skeleton className="h-5 w-[85%] bg-white/[0.06]" />
                            </TableCell>
                            {/* Visibility */}
                            <TableCell style={{ width: '100px' }} className="py-3.5">
                              <div className="flex items-center gap-2 pl-2">
                                <Skeleton className="h-2 w-2 rounded-full bg-white/[0.06]" />
                                <Skeleton className="h-4 w-10 bg-white/[0.06]" />
                              </div>
                            </TableCell>
                            {/* Position */}
                            <TableCell style={{ width: '90px' }} className="py-3.5">
                              <div className="flex items-center pl-2">
                                <Skeleton className="h-4 w-10 bg-white/[0.06]" />
                              </div>
                            </TableCell>
                            {/* Model */}
                            <TableCell style={{ width: '70px' }} className="py-3.5">
                              <div className="flex items-center justify-center">
                                <Skeleton className="h-6 w-6 rounded-full bg-white/[0.06]" />
                              </div>
                            </TableCell>
                            {/* Last Run */}
                            <TableCell style={{ width: '90px' }} className="py-3.5">
                              <div className="flex items-center justify-center">
                                <Skeleton className="h-4 w-14 bg-white/[0.06]" />
                              </div>
                            </TableCell>
                            {/* Intent */}
                            <TableCell style={{ width: '120px' }} className="py-3.5">
                              <div className="flex items-center justify-center">
                                <Skeleton className="h-5 w-16 rounded bg-white/[0.06]" />
                              </div>
                            </TableCell>
                            {/* Sentiment */}
                            <TableCell style={{ width: '100px' }} className="py-3.5">
                              <div className="flex items-center justify-center">
                                <Skeleton className="h-5 w-14 rounded bg-white/[0.06]" />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                          <TableRow 
                            key={row.id} 
                            data-state={row.getIsSelected() && "selected"} 
                            className="border-white/[0.06] hover:bg-white/[0.03] transition-colors"
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell 
                                key={cell.id} 
                                style={{ width: `${cell.column.getSize()}px` }}
                                className="py-3.5 align-middle"
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={columns.length} className="h-32 text-center">
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                              <div className="text-lg">No prompts tracked yet</div>
                              <div className="text-sm">Run an analysis to generate prompts or add custom prompts manually</div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Selection footer */}
                {selectedCount > 0 && (
                  <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-30">
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#1a1a1a]/90 px-4 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                      <div className="flex items-center gap-2 text-sm text-white/80 font-medium">
                        <div className="flex items-center justify-center h-5 w-5 rounded-full bg-white/10">
                          <span className="text-xs">{selectedCount}</span>
                        </div>
                        <span className="text-white/60">
                          {selectedCount === 1 ? 'selected' : 'selected'}
                        </span>
                      </div>
                      <div className="h-4 w-px bg-white/10 mx-1" />
                      {/* Edit button - only show when exactly 1 prompt is selected */}
                      {selectedCount === 1 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-3 rounded-full gap-1.5 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                          onClick={() => {
                            const selectedRows = table.getFilteredSelectedRowModel().rows
                            if (selectedRows.length === 1) {
                              const prompt = selectedRows[0].original
                              setEditingPrompt(prompt)
                              setEditPromptText(prompt.prompt)
                              setEditIntent(prompt.intent || "Organic")
                              setEditOpen(true)
                            }
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 px-3 rounded-full gap-1.5 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                        onClick={() => table.resetRowSelection()}
                      >
                        <X className="h-3.5 w-3.5" />
                        Clear
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 px-3 rounded-full gap-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                        disabled={isDeleting !== null}
                        onClick={async () => {
                          const selectedRows = table.getFilteredSelectedRowModel().rows
                          for (const row of selectedRows) {
                            await handleDeletePrompt(row.original.id)
                          }
                          table.resetRowSelection()
                        }}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Delete
                      </Button>
                    </div>
                  </div>
                )}

                {/* Unified Add Prompt Dialog */}
                <Dialog open={addOpen} onOpenChange={(open) => {
                  if (!open) {
                    if (aiStep === 'running') {
                      // Analysis in progress — close dialog, mark unfinished prompts as pending in table
                      analysisAbortRef.current = true
                      const pendingIds = generatedPrompts
                        .filter(p => analysisStatus[p.id] !== 'done' && analysisStatus[p.id] !== 'error')
                        .map(p => p.id.toString())
                      const pendingSet = new Set(pendingIds)
                      setData(prev => prev.map(p => pendingSet.has(p.id) ? { ...p, isPending: true } : p))
                      setAddOpen(false)
                    } else {
                      setAddOpen(false)
                      resetAiState()
                      setNewPromptText("")
                      setNewIntent("Organic")
                      setRunAnalysisOnAdd(true)
                      setErrorMessage(null)
                    }
                  } else {
                    setAddOpen(true)
                  }
                }}>
                  <DialogContent className="sm:max-w-lg rounded-xl border-0 bg-dark-grey overflow-hidden">
                    <DialogHeader>
                      <DialogTitle>Add Prompt</DialogTitle>
                      <DialogDescription>
                        {dialogMode === 'manual'
                          ? `Manually add a prompt to track (${data.length}/100 active prompts).`
                          : aiStep === 'describe'
                            ? 'Describe what prompts you want and AI will generate them.'
                            : aiStep === 'preview'
                              ? `Review the generated prompts before analyzing.`
                              : `Analyzing prompts against AI models...`
                        }
                      </DialogDescription>
                    </DialogHeader>

                    {/* Mode toggle pill */}
                    {aiStep !== 'running' && (
                      <div className="p-1 rounded-lg bg-white/[0.04] flex">
                        <button
                          className={cn(
                            "flex-1 text-sm font-medium py-1.5 rounded-md transition-colors",
                            dialogMode === 'manual'
                              ? "bg-white/10 text-white"
                              : "text-white/50 hover:text-white/70"
                          )}
                          onClick={() => { setDialogMode('manual'); setErrorMessage(null) }}
                          disabled={aiStep === 'preview'}
                        >
                          Manual
                        </button>
                        <button
                          className={cn(
                            "flex-1 text-sm font-medium py-1.5 rounded-md transition-colors flex items-center justify-center gap-1.5",
                            dialogMode === 'ai'
                              ? "bg-white/10 text-white"
                              : "text-white/50 hover:text-white/70"
                          )}
                          onClick={() => { setDialogMode('ai'); setErrorMessage(null) }}
                          disabled={aiStep === 'preview'}
                        >
                          AI Generate
                        </button>
                      </div>
                    )}

                    {/* ─── Manual mode ─── */}
                    {dialogMode === 'manual' && (
                      <>
                        {errorMessage && (
                          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                            {errorMessage}
                          </div>
                        )}

                        <div className="space-y-4 pt-2">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <Label htmlFor="prompt-text">Prompt</Label>
                              <span className={cn(
                                "text-xs",
                                newPromptText.length > MAX_PROMPT_LENGTH ? "text-red-400" : "text-muted-foreground"
                              )}>
                                {newPromptText.length}/{MAX_PROMPT_LENGTH}
                              </span>
                            </div>
                            <Textarea
                              id="prompt-text"
                              value={newPromptText}
                              onChange={(e) => setNewPromptText(e.target.value)}
                              placeholder="Type your prompt..."
                              className={cn(
                                "min-h-[90px] rounded-lg border-white/10 focus-visible:ring-0 focus-visible:ring-offset-0 outline-none",
                                newPromptText.length > MAX_PROMPT_LENGTH && "border-red-500/50"
                              )}
                              disabled={isAdding}
                              maxLength={MAX_PROMPT_LENGTH + 50}
                            />
                            {newPromptText.length > MAX_PROMPT_LENGTH && (
                              <p className="text-xs text-red-400">
                                Prompt is too long. Please shorten it to {MAX_PROMPT_LENGTH} characters or less.
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="intent">Intent</Label>
                            <Select
                              value={newIntent}
                              onValueChange={(v) => setNewIntent(v ?? "Organic")}
                              disabled={isAdding}
                            >
                              <SelectTrigger id="intent" className="w-full rounded-lg focus-visible:ring-0 focus-visible:ring-offset-0 outline-none border-white/10">
                                <SelectValue placeholder="Select intent" />
                              </SelectTrigger>
                              <SelectContent className="rounded-lg">
                                <SelectItem value="How-to">How to</SelectItem>
                                <SelectItem value="Organic">Organic</SelectItem>
                                <SelectItem value="Brand-Specific">Brand-Specific</SelectItem>
                                <SelectItem value="Competitor">Competitor</SelectItem>
                                <SelectItem value="FAQ">FAQ</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center space-x-2 pt-1">
                            <Checkbox
                              id="run-analysis"
                              checked={runAnalysisOnAdd}
                              onCheckedChange={(checked) => setRunAnalysisOnAdd(checked === true)}
                              disabled={isAdding}
                            />
                            <Label
                              htmlFor="run-analysis"
                              className="text-sm font-normal cursor-pointer text-muted-foreground"
                            >
                              Run analysis immediately (test against all AI models)
                            </Label>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-3">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setAddOpen(false)
                              setErrorMessage(null)
                              setNewPromptText("")
                              setRunAnalysisOnAdd(true)
                              resetAiState()
                            }}
                            className="h-9 rounded-lg"
                            disabled={isAdding}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleAddPrompt}
                            className="h-9 rounded-lg bg-white text-black hover:bg-white/90 border-transparent"
                            disabled={isAdding || !newPromptText.trim() || newPromptText.length > MAX_PROMPT_LENGTH}
                          >
                            {isAdding ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                {runAnalysisOnAdd ? 'Adding & Analyzing...' : 'Adding...'}
                              </>
                            ) : (
                              runAnalysisOnAdd ? 'Add & Analyze' : 'Add Prompt'
                            )}
                          </Button>
                        </div>
                      </>
                    )}

                    {/* ─── AI: Describe step ─── */}
                    {dialogMode === 'ai' && aiStep === 'describe' && (
                      <>
                        <div className="space-y-4 pt-2">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <Label htmlFor="ai-description">Describe what prompts you want</Label>
                              <span className="text-xs text-muted-foreground">
                                {aiDescription.length}/500
                              </span>
                            </div>
                            <Textarea
                              id="ai-description"
                              value={aiDescription}
                              onChange={(e) => setAiDescription(e.target.value)}
                              placeholder="e.g., enterprise pricing and ROI comparisons, or questions about data security compliance"
                              className="min-h-[90px] rounded-lg border-white/10 focus-visible:ring-0 focus-visible:ring-offset-0 outline-none"
                              maxLength={500}
                              disabled={isAiGenerating}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Number of prompts</Label>
                            <div className="flex gap-2">
                              {([3, 5, 10] as const).map(n => (
                                <Button
                                  key={n}
                                  size="sm"
                                  className={cn(
                                    "h-9 rounded-lg border-0 transition-colors",
                                    aiCount === n
                                      ? "bg-white text-black hover:bg-white/90"
                                      : "bg-white/5 text-white hover:bg-white/10"
                                  )}
                                  onClick={() => setAiCount(n)}
                                  disabled={isAiGenerating}
                                >
                                  {n}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-3">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setAddOpen(false)
                              resetAiState()
                            }}
                            className="h-9 rounded-lg"
                            disabled={isAiGenerating}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleGenerate}
                            className="h-9 rounded-lg bg-white text-black hover:bg-white/90 border-transparent gap-1.5"
                            disabled={isAiGenerating || !aiDescription.trim()}
                          >
                            {isAiGenerating ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>Generate {aiCount} Prompts</>
                            )}
                          </Button>
                        </div>
                      </>
                    )}

                    {/* ─── AI: Preview step ─── */}
                    {dialogMode === 'ai' && aiStep === 'preview' && (
                      <>
                        <div className="space-y-3 pt-2">
                          <p className="text-sm text-white/70">{generatedPrompts.length} prompts generated — click to edit</p>
                          <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1">
                            {generatedPrompts.map((p, idx) => (
                              <div key={p.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 flex gap-2.5 overflow-hidden">
                                <span className="text-white/30 text-sm font-medium shrink-0 pt-1.5">{idx + 1}</span>
                                <div className="flex-1 min-w-0 overflow-hidden">
                                  <Textarea
                                    value={p.text}
                                    onChange={(e) => {
                                      setGeneratedPrompts(prev => prev.map((gp, i) =>
                                        i === idx ? { ...gp, text: e.target.value } : gp
                                      ))
                                    }}
                                    className="min-h-[52px] text-sm text-white/90 leading-relaxed bg-transparent border-white/[0.06] rounded-md resize-none focus-visible:ring-0 focus-visible:ring-offset-0 px-2 py-1.5"
                                    maxLength={500}
                                  />
                                  <Badge className="mt-1.5 px-2 py-0.5 rounded text-xs font-medium bg-white/10 text-white/60 border-0">
                                    {p.category}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex justify-between pt-3">
                          <Button
                            variant="outline"
                            onClick={() => setAiStep('describe')}
                            className="h-9 rounded-lg gap-1.5"
                          >
                            ← Back
                          </Button>
                          <Button
                            onClick={handleRunAnalysis}
                            className="h-9 rounded-lg bg-white text-black hover:bg-white/90 border-transparent"
                          >
                            Run Analysis
                          </Button>
                        </div>
                      </>
                    )}

                    {/* ─── AI: Running step ─── */}
                    {dialogMode === 'ai' && aiStep === 'running' && (
                      <>
                        <div className="space-y-4 pt-1 overflow-hidden">
                          {/* Progress header */}
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-white/60" />
                                <span className="text-sm text-white/70">
                                  {analysisCompleted}/{generatedPrompts.length} complete
                                </span>
                              </div>
                              <span className="text-xs text-white/30 tabular-nums">
                                {generatedPrompts.length > 0 ? Math.round((analysisCompleted / generatedPrompts.length) * 100) : 0}%
                              </span>
                            </div>
                            <div className="w-full bg-white/[0.06] rounded-full h-1">
                              <div
                                className="bg-white/80 h-1 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${generatedPrompts.length > 0 ? (analysisCompleted / generatedPrompts.length) * 100 : 0}%` }}
                              />
                            </div>
                          </div>

                          {/* Prompt list */}
                          <div className="max-h-[220px] overflow-y-auto -mx-1 px-1 space-y-1">
                            {generatedPrompts.map((p, idx) => {
                              const status = analysisStatus[p.id] || 'pending'
                              return (
                                <div
                                  key={p.id}
                                  className={cn(
                                    "rounded-lg px-3 py-2 flex items-start gap-2.5 transition-colors overflow-hidden",
                                    status === 'running' ? "bg-white/[0.04]" : "bg-transparent"
                                  )}
                                >
                                  <div className="shrink-0 w-4 pt-0.5 flex justify-center">
                                    {status === 'pending' && (
                                      <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                                    )}
                                    {status === 'running' && (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin text-white/50" />
                                    )}
                                    {status === 'done' && (
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/80" />
                                    )}
                                    {status === 'error' && (
                                      <AlertCircle className="h-3.5 w-3.5 text-red-400/80" />
                                    )}
                                  </div>
                                  <p className={cn(
                                    "flex-1 min-w-0 text-[13px] leading-relaxed break-words line-clamp-2",
                                    status === 'done' ? "text-white/50" :
                                    status === 'running' ? "text-white/80" :
                                    "text-white/40"
                                  )}>
                                    {p.text}
                                  </p>
                                </div>
                              )
                            })}
                          </div>

                          <p className="text-xs text-white/30">You can close this — analysis continues in background.</p>
                        </div>
                        <div className="flex justify-end pt-1">
                          <Button
                            variant="outline"
                            onClick={() => {
                              analysisAbortRef.current = true
                              setAddOpen(false)
                            }}
                            className="h-8 rounded-lg text-xs"
                          >
                            Close
                          </Button>
                        </div>
                      </>
                    )}
                  </DialogContent>
                </Dialog>

                {/* Edit Prompt Dialog */}
                <Dialog open={editOpen} onOpenChange={(open) => {
                  setEditOpen(open)
                  if (!open) {
                    setEditingPrompt(null)
                    setEditPromptText("")
                    setEditIntent("Organic")
                    setErrorMessage(null)
                  }
                }}>
                  <DialogContent className="sm:max-w-lg rounded-xl border-0 bg-dark-grey">
                    <DialogHeader>
                      <DialogTitle>Edit Prompt</DialogTitle>
                      <DialogDescription>
                        Update the prompt text or category.
                      </DialogDescription>
                    </DialogHeader>
                    
                    {errorMessage && (
                      <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                        {errorMessage}
                      </div>
                    )}
                    
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label htmlFor="edit-prompt">Prompt</Label>
                          <span className={cn(
                            "text-xs",
                            editPromptText.length > MAX_PROMPT_LENGTH ? "text-red-400" : "text-muted-foreground"
                          )}>
                            {editPromptText.length}/{MAX_PROMPT_LENGTH}
                          </span>
                        </div>
                        <Textarea 
                          id="edit-prompt"
                          value={editPromptText} 
                          onChange={(e) => setEditPromptText(e.target.value)} 
                          placeholder="Type your prompt..." 
                          className={cn(
                            "min-h-[90px] rounded-lg border-white/10 focus-visible:ring-0 focus-visible:ring-offset-0 outline-none",
                            editPromptText.length > MAX_PROMPT_LENGTH && "border-red-500/50"
                          )}
                          disabled={isEditing}
                          maxLength={MAX_PROMPT_LENGTH + 50}
                        />
                        {editPromptText.length > MAX_PROMPT_LENGTH && (
                          <p className="text-xs text-red-400">
                            Prompt is too long. Please shorten it to {MAX_PROMPT_LENGTH} characters or less.
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-intent">Intent</Label>
                        <Select 
                          value={editIntent} 
                          onValueChange={(v) => {
                            setEditIntent(v ?? "Organic")
                          }}
                          disabled={isEditing}
                        >
                          <SelectTrigger id="edit-intent" className="w-full rounded-lg focus-visible:ring-0 focus-visible:ring-offset-0 outline-none border-white/10">
                            <SelectValue placeholder="Select intent" />
                          </SelectTrigger>
                          <SelectContent className="rounded-lg bg-[#161616] border-0">
                            <SelectItem value="How-to">How to</SelectItem>
                            <SelectItem value="Organic">Organic</SelectItem>
                            <SelectItem value="Brand-Specific">Brand-Specific</SelectItem>
                            <SelectItem value="Competitor">Competitor</SelectItem>
                            <SelectItem value="FAQ">FAQ</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditOpen(false)
                          setEditingPrompt(null)
                          setEditPromptText("")
                          setEditIntent("Organic")
                          setErrorMessage(null)
                        }} 
                        className="h-9 rounded-lg"
                        disabled={isEditing}
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleEditPrompt} 
                        className="h-9 rounded-lg bg-white text-black hover:bg-white/90 border-transparent"
                        disabled={isEditing || !editPromptText.trim() || editPromptText.length > MAX_PROMPT_LENGTH}
                      >
                        {isEditing ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function TrackedPromptsPage() {
  return (
    <BrandProfileProvider>
      <TrackedPromptsPageInner />
    </BrandProfileProvider>
  )
}


