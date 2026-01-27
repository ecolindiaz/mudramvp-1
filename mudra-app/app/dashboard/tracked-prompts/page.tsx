"use client"

import { useMemo, useState, useEffect } from "react"
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
import { ChevronDownIcon, ChevronUpIcon, Plus, Trash2, X, CheckSquare, Loader2 } from "lucide-react"
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
const createColumns = (router: ReturnType<typeof useRouter>): ColumnDef<TrackedPrompt>[] => [
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
    size: 36,
    enableSorting: false,
  },
  {
    header: () => (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-default">Prompt</div>
        </TooltipTrigger>
        <TooltipContent>Query tested against AI models</TooltipContent>
      </Tooltip>
    ),
    accessorKey: "prompt",
    cell: ({ row }) => (
      <div 
        className="font-medium text-white/90 text-[15px] md:text-base leading-relaxed cursor-pointer hover:text-white transition-colors"
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
      if (!pos) {
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
      return (
        <div className="flex items-center justify-center">
          <Badge className="px-2 py-0.5 rounded text-xs font-medium bg-white/10 text-white/80 border-0">
            {intent}
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
  const { profile } = useBrandProfile()
  const [data, setData] = useState<TrackedPrompt[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [newPromptText, setNewPromptText] = useState("")
  const [newIntent, setNewIntent] = useState<string>("Organic")
  const [runAnalysisOnAdd, setRunAnalysisOnAdd] = useState(false) // BUG-3: Option to run immediate analysis
  const [showAll, setShowAll] = useState(false)
  
  // Filter states
  const [selectedModel, setSelectedModel] = useState<string>("all")
  const [selectedIntent, setSelectedIntent] = useState<string>("all")
  
  // Create columns with router access
  const columns = useMemo(() => createColumns(router), [router])

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50, // show all 50 prompts on one page
  })
  const [sorting, setSorting] = useState<SortingState>([
    { id: "visibility", desc: true },
  ])

  // State for delete/add operations
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Fetch prompts function (extracted for reuse)
  const fetchPrompts = async () => {
    if (!profile?.id) {
      console.log('⏳ Waiting for brand profile...')
      return
    }

    console.log('📡 Fetching tracked prompts for brand:', profile.id)
    setIsLoading(true)
    
    try {
      const response = await fetch(`/api/prompts/with-results?brandProfileId=${profile.id}`)
      const result = await response.json()
      
      console.log('📥 Prompts API response:', { 
        success: result.success, 
        count: result.count,
        hasAnalysis: result.hasAnalysis 
      })
      
      if (result.success && result.prompts) {
        // Transform API response to table format
        const transformedData: TrackedPrompt[] = result.prompts.map((p: any) => {
          // Check if prompt has been analyzed (has model or visibility data)
          const hasBeenAnalyzed = p.model || (p.visibility && p.visibility > 0)
          return {
            id: p.id.toString(),
            prompt: p.text,
            visibility: Math.round(p.visibility || 0), // Ensure integer percentage
            model: p.model || null,
            models: p.models || [], // All models used
            intent: p.category || null,
            sentiment: p.sentiment || null,
            position: p.position || null,
            lastRun: null,
            isPending: !hasBeenAnalyzed, // Show loading state if not yet analyzed
          }
        })
        
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
    } catch (error) {
      console.error('❌ Error fetching prompts:', error)
      setErrorMessage('Failed to load prompts. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch prompts on mount and when profile changes
  useEffect(() => {
    fetchPrompts()
  }, [profile?.id])

  // Filter the data based on selected filters
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // Check if any of the item's models match the selected filter (using normalized names)
      let modelMatch = selectedModel === "all"
      if (!modelMatch) {
        if (item.models && item.models.length > 0) {
          modelMatch = item.models.some(m => getModelDisplayName(m) === selectedModel)
        } else if (item.model) {
          modelMatch = getModelDisplayName(item.model) === selectedModel
        }
      }
      const intentMatch = selectedIntent === "all" || item.intent === selectedIntent
      return modelMatch && intentMatch
    })
  }, [data, selectedModel, selectedIntent])

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
      console.log('🗑️ Deleting prompt:', promptId, 'for brand:', profile.id)
      
      const response = await fetch('/api/prompts/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptId: parseInt(promptId), // Convert to number
          brandProfileId: profile.id,
        }),
      })

      const result = await response.json()
      console.log('📥 Delete prompt response:', result)

      if (result.success) {
        console.log('✅ Prompt deleted successfully')
        // Refresh data from server to ensure consistency
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
    if (data.length >= 50) {
      setErrorMessage('Maximum 50 active prompts allowed. Please delete a prompt before adding a new one.')
      return
    }

    setIsAdding(true)
    setErrorMessage(null)

    try {
      const response = await fetch('/api/prompts/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptText: text,
          category: newIntent,
          brandProfileId: profile.id,
          runAnalysis: runAnalysisOnAdd, // BUG-3: Pass immediate analysis flag
        }),
      })

      const result = await response.json()
      console.log('📥 Add prompt response:', { status: response.status, result })

      if (response.ok && result.success) {
        console.log('✅ Prompt added successfully', result.data?.analysisTriggered ? '(analysis triggered)' : '')

        // Close dialog and reset form
        setAddOpen(false)
        setNewPromptText("")
        setNewIntent("Organic")
        setRunAnalysisOnAdd(false)
        setErrorMessage(null)

        // Add the prompt immediately with isPending: true to show loading state
        const newPromptId = result.data?.prompt?.id?.toString() || `pending-${Date.now()}`
        const pendingPrompt: TrackedPrompt = {
          id: newPromptId,
          prompt: text,
          visibility: 0,
          model: null,
          models: [],
          intent: newIntent,
          sentiment: null,
          position: null,
          lastRun: null,
          isPending: true, // Show loading skeleton in data columns
        }

        // Add pending prompt at the top
        setData((prev) => [pendingPrompt, ...prev])

        // If analysis was triggered, poll for results until complete
        if (runAnalysisOnAdd) {
          const pollForResults = async (attempts: number = 0, maxAttempts: number = 6) => {
            if (attempts >= maxAttempts) {
              console.log('⏰ Max polling attempts reached, giving up')
              return
            }

            // Wait before polling (3s first, then 5s intervals)
            const delay = attempts === 0 ? 3000 : 5000
            await new Promise(resolve => setTimeout(resolve, delay))

            try {
              const response = await fetch(`/api/prompts/with-results?brandProfileId=${profile.id}`)
              const refreshResult = await response.json()

              if (refreshResult.success && refreshResult.prompts) {
                // Check if our new prompt now has results
                const newPromptData = refreshResult.prompts.find((p: any) => p.id.toString() === newPromptId)
                const hasResults = newPromptData && (newPromptData.model || (newPromptData.visibility && newPromptData.visibility > 0))

                const transformedData: TrackedPrompt[] = refreshResult.prompts.map((p: any) => {
                  const hasBeenAnalyzed = p.model || (p.visibility && p.visibility > 0)
                  return {
                    id: p.id.toString(),
                    prompt: p.text,
                    visibility: Math.round(p.visibility || 0),
                    model: p.model || null,
                    models: p.models || [],
                    intent: p.category || null,
                    sentiment: p.sentiment || null,
                    position: p.position || null,
                    lastRun: null,
                    isPending: !hasBeenAnalyzed,
                  }
                })
                setData(transformedData)

                // If our prompt still doesn't have results, keep polling
                if (!hasResults && attempts < maxAttempts - 1) {
                  console.log(`🔄 Prompt ${newPromptId} still pending, polling again (attempt ${attempts + 2}/${maxAttempts})`)
                  pollForResults(attempts + 1, maxAttempts)
                } else if (hasResults) {
                  console.log(`✅ Prompt ${newPromptId} analysis complete!`)
                }
              }
            } catch (err) {
              console.error('Error polling for results:', err)
            }
          }

          // Start polling
          pollForResults()
        }
      } else {
        const errorMsg = result.error?.message || result.message || 'Failed to add prompt'
        setErrorMessage(errorMsg)
        console.error('❌ Add failed:', { status: response.status, result })
      }
    } catch (error) {
      console.error('❌ Error adding prompt:', error)
      setErrorMessage('Failed to add prompt. Please try again.')
    } finally {
      setIsAdding(false)
    }
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
                  {isLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading prompts...
                    </div>
                  ) : (
                    <div className={`text-sm ${data.length >= 50 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                      {data.length} / 50 prompts tracked
                      {data.length >= 50 && ' (Max)'}
                    </div>
                  )}
                  <Button
                    size="sm"
                    className="h-9 rounded-lg bg-white/5 text-white hover:bg-white/10 border-0"
                    onClick={() => {
                      if (showAll) {
                        setPagination((p: PaginationState) => ({ ...p, pageIndex: 0, pageSize: 12 }))
                        setShowAll(false)
                      } else {
                        setPagination((p: PaginationState) => ({ ...p, pageIndex: 0, pageSize: filteredData.length }))
                        setShowAll(true)
                      }
                    }}
                    disabled={isLoading || filteredData.length === 0}
                  >
                    {showAll ? "Collapse" : "All Prompts"}
                  </Button>
                  <Button 
                    size="sm" 
                    className="h-9 rounded-lg bg-white text-black hover:bg-white/90 border-transparent gap-1.5" 
                    onClick={() => setAddOpen(true)}
                    disabled={isLoading}
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
                  <div className="ml-auto text-sm text-muted-foreground">
                    Showing {filteredData.length} of {data.length} prompts
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
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-3.5 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                      <div className="flex items-center gap-2 text-sm text-white/90">
                        <CheckSquare className="h-4 w-4 text-white/70" />
                        <span>
                          {selectedCount} {selectedCount === 1 ? 'Prompt' : 'Prompts'} selected
                        </span>
                      </div>
                      <div className="h-4 w-px bg-white/15" />
                      <Button variant="outline" size="sm" className="h-8 rounded-md gap-1.5" onClick={() => table.resetRowSelection()}>
                        <X className="h-4 w-4" />
                        Clear
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="h-8 rounded-md gap-1.5"
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
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Delete {selectedCount > 1 ? 'Prompts' : 'Prompt'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Add Prompt Dialog */}
                <Dialog open={addOpen} onOpenChange={setAddOpen}>
                  <DialogContent className="sm:max-w-lg rounded-xl border-0 bg-dark-grey">
                    <DialogHeader>
                      <DialogTitle>Add Prompt</DialogTitle>
                      <DialogDescription>
                        Manually add a prompt to track ({data.length}/50 active prompts).
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
                          maxLength={MAX_PROMPT_LENGTH + 50} // Allow slight overage to show error
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
                          onValueChange={(v) => {
                            // Ensure we always set a non-null string; fallback to "Organic"
                            setNewIntent(v ?? "Organic")
                          }}
                          disabled={isAdding}
                        >
                          <SelectTrigger id="intent" className="w-full rounded-lg focus-visible:ring-0 focus-visible:ring-offset-0 outline-none border-white/10">
                            <SelectValue placeholder="Select intent" />
                          </SelectTrigger>
                          <SelectContent className="rounded-lg">
                            <SelectItem value="How-to Guides">How-to</SelectItem>
                            <SelectItem value="Organic">Organic</SelectItem>
                            <SelectItem value="Brand-Specific">Brand-Specific</SelectItem>
                            <SelectItem value="Competitor">Competitor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {/* BUG-3 Enhancement: Option to run immediate analysis */}
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
                          setRunAnalysisOnAdd(false)
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


