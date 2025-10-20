"use client"

import { useMemo, useState } from "react"
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
import { ChevronDownIcon, ChevronUpIcon, Plus, Trash2, X, CheckSquare } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { FloatingMudraButton } from "@/components/floating-mudra-button"
import { BrandProfileProvider } from "@/components/brand-profile-context"

type TrackedPrompt = {
  id: string
  prompt: string
  visibility: number
  model: "ChatGPT" | "Perplexity"
  intent: "Organic" | "Competitor" | "How-to Guides" | "Brand-Specific"
  sentiment: "Positive" | "Neutral" | "Negative"
  position: number
}

const columns: ColumnDef<TrackedPrompt>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          className="scale-105"
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
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
      <div className="font-medium text-white/90 text-[15px] md:text-base leading-relaxed">
        {row.getValue("prompt")}
      </div>
    ),
    enableSorting: false,
    size: 640,
  },
  {
    header: () => (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-full text-center cursor-default">Visibility</div>
        </TooltipTrigger>
        <TooltipContent>Percentage of responses that mention your brand</TooltipContent>
      </Tooltip>
    ),
    accessorKey: "visibility",
    cell: ({ row }) => {
      const value = Number(row.getValue("visibility"))
      return <div className="w-24 mx-auto text-center text-white/90 font-semibold">{value}%</div>
    },
    enableSorting: false,
    size: 160,
  },
  {
    header: () => (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-default">Position</div>
        </TooltipTrigger>
        <TooltipContent>Average rank where your brand appears (lower is better)</TooltipContent>
      </Tooltip>
    ),
    accessorKey: "position",
    cell: ({ row }) => {
      const pos = Number(row.getValue("position"))
      return (
        <Badge variant="outline" className="px-2 rounded text-muted-foreground"># {pos.toFixed(1)}</Badge>
      )
    },
    enableSorting: false,
    size: 120,
  },
  {
    header: () => (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-default">Model</div>
        </TooltipTrigger>
        <TooltipContent>AI model used for the last check</TooltipContent>
      </Tooltip>
    ),
    accessorKey: "model",
    cell: ({ row }) => {
      const model = String(row.getValue("model"))
      const iconSrc =
        model === "ChatGPT"
          ? "/images/Group%2048095369.png"
          : model === "Perplexity"
          ? "/images/Group%2048095371%20(1).png"
          : null

      return (
        <Badge variant="outline" className="text-muted-foreground px-2 rounded inline-flex items-center gap-1.5">
          {iconSrc ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center">
                  <Image
                    src={iconSrc}
                    width={16}
                    height={16}
                    alt={`${model} icon`}
                    className="rounded-[3px]"
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>{model}</TooltipContent>
            </Tooltip>
          ) : null}
          <span>{model}</span>
        </Badge>
      )
    },
    enableSorting: false,
    size: 140,
  },
  {
    header: () => (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-default">Intent</div>
        </TooltipTrigger>
        <TooltipContent>Category of the prompt (Organic, Competitor, How‑to, Brand‑Specific)</TooltipContent>
      </Tooltip>
    ),
    accessorKey: "intent",
    cell: ({ row }) => (
      <Badge className="px-2 rounded bg-white text-black">{row.getValue("intent")}</Badge>
    ),
    enableSorting: false,
    size: 170,
  },
  {
    header: () => (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-default">Sentiment</div>
        </TooltipTrigger>
        <TooltipContent>Overall tone of mentions (Positive / Neutral / Negative)</TooltipContent>
      </Tooltip>
    ),
    accessorKey: "sentiment",
    cell: ({ row }) => (
      <Badge
        className={cn(
          "px-2 rounded",
          row.getValue("sentiment") === "Negative" &&
            "bg-red-500/20 text-red-300",
          row.getValue("sentiment") === "Neutral" &&
            "bg-white/10 text-white/80",
          row.getValue("sentiment") === "Positive" &&
            "bg-emerald-500/20 text-emerald-300"
        )}
      >
        {row.getValue("sentiment")}
      </Badge>
    ),
    enableSorting: false,
    size: 140,
  },
]

function TrackedPromptsPageInner() {
  const hardcodedData: TrackedPrompt[] = useMemo(
    () => [
      { id: "1", prompt: "Best data annotation tools for AI research labs in the AI/ML industry", visibility: 68, model: "ChatGPT", intent: "Organic", sentiment: "Positive", position: 1.0 },
      { id: "2", prompt: "Affordable labeling data services for machine learning projects", visibility: 55, model: "Perplexity", intent: "Competitor", sentiment: "Neutral", position: 2.0 },
      { id: "3", prompt: "Top providers of supervised fine tuning data for AI models", visibility: 61, model: "Perplexity", intent: "Brand-Specific", sentiment: "Positive", position: 2.0 },
      { id: "4", prompt: "Alternatives to traditional data labeling for AI research labs", visibility: 43, model: "Perplexity", intent: "Organic", sentiment: "Neutral", position: 2.5 },
      { id: "5", prompt: "How to improve model accuracy with high-quality training data", visibility: 72, model: "ChatGPT", intent: "How-to Guides", sentiment: "Positive", position: 1.3 },
      { id: "6", prompt: "Effective ways to source supervised fine tuning data for AI models", visibility: 49, model: "ChatGPT", intent: "How-to Guides", sentiment: "Neutral", position: 4.5 },
      { id: "7", prompt: "What are the best practices for data labeling in machine learning?", visibility: 58, model: "Perplexity", intent: "How-to Guides", sentiment: "Positive", position: 1.0 },
      { id: "8", prompt: "Recommendations for data quality tools for AI research projects", visibility: 37, model: "Perplexity", intent: "Organic", sentiment: "Negative", position: 3.0 },
      { id: "9", prompt: "How to choose a data provider for AI model enhancement", visibility: 64, model: "ChatGPT", intent: "Brand-Specific", sentiment: "Positive", position: 1.0 },
      { id: "10", prompt: "Comparing data annotation services for AI and ML applications", visibility: 41, model: "ChatGPT", intent: "Competitor", sentiment: "Neutral", position: 4.0 },
      { id: "11", prompt: "Who are the leading data annotation companies for training AI models?", visibility: 70, model: "ChatGPT", intent: "Organic", sentiment: "Positive", position: 1.8 },
      { id: "12", prompt: "Which data providers specialize in RLHF datasets for LLMs?", visibility: 52, model: "Perplexity", intent: "Brand-Specific", sentiment: "Neutral", position: 2.6 },
      { id: "13", prompt: "Cheapest managed data labeling platforms for startups", visibility: 46, model: "ChatGPT", intent: "Competitor", sentiment: "Neutral", position: 3.2 },
      { id: "14", prompt: "Best tools to audit and improve training data quality", visibility: 57, model: "Perplexity", intent: "How-to Guides", sentiment: "Positive", position: 2.1 },
      { id: "15", prompt: "Vendors that provide synthetic data for computer vision", visibility: 44, model: "Perplexity", intent: "Brand-Specific", sentiment: "Neutral", position: 2.9 },
      { id: "16", prompt: "Enterprise-grade platforms for multi-language text annotation", visibility: 62, model: "ChatGPT", intent: "Competitor", sentiment: "Positive", position: 1.7 },
      { id: "17", prompt: "Where to source high-quality evaluation datasets for LLMs", visibility: 48, model: "ChatGPT", intent: "Organic", sentiment: "Neutral", position: 2.4 },
      { id: "18", prompt: "Recommended open datasets for supervised fine-tuning", visibility: 53, model: "Perplexity", intent: "How-to Guides", sentiment: "Positive", position: 2.2 },
      { id: "19", prompt: "How to compare top data labeling vendors and pricing", visibility: 45, model: "Perplexity", intent: "Competitor", sentiment: "Neutral", position: 3.6 },
      { id: "20", prompt: "AI-ready data marketplaces for machine learning teams", visibility: 50, model: "ChatGPT", intent: "Brand-Specific", sentiment: "Positive", position: 2.8 },
    ],
    []
  )

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 12, // show 12 prompts initially
  })
  const [sorting, setSorting] = useState<SortingState>([
    { id: "visibility", desc: true },
  ])
  // Add 30 more hardcoded prompts (total ~50)
  const extraPrompts: TrackedPrompt[] = useMemo(() => [
    { id: "21", prompt: "Top labeling tools for multilingual datasets", visibility: 47, model: "Perplexity", intent: "Organic", sentiment: "Neutral", position: 3.1 },
    { id: "22", prompt: "Guide to building RLHF datasets at startup scale", visibility: 52, model: "ChatGPT", intent: "How-to Guides", sentiment: "Positive", position: 2.3 },
    { id: "23", prompt: "Compare open-source data labeling frameworks", visibility: 40, model: "Perplexity", intent: "Competitor", sentiment: "Neutral", position: 3.9 },
    { id: "24", prompt: "Vendors offering privacy-first annotation solutions", visibility: 51, model: "ChatGPT", intent: "Brand-Specific", sentiment: "Positive", position: 2.6 },
    { id: "25", prompt: "How to evaluate training data vendors for LLMs", visibility: 56, model: "Perplexity", intent: "How-to Guides", sentiment: "Positive", position: 2.2 },
    { id: "26", prompt: "Crowdsourcing vs in-house labeling: which is better?", visibility: 43, model: "ChatGPT", intent: "Organic", sentiment: "Neutral", position: 3.5 },
    { id: "27", prompt: "Best ways to measure data quality for AI projects", visibility: 59, model: "Perplexity", intent: "How-to Guides", sentiment: "Positive", position: 1.9 },
    { id: "28", prompt: "Where to buy domain-specific datasets for LLMs", visibility: 46, model: "ChatGPT", intent: "Brand-Specific", sentiment: "Neutral", position: 3.2 },
    { id: "29", prompt: "Annotation tools for video and multimodal datasets", visibility: 42, model: "Perplexity", intent: "Organic", sentiment: "Neutral", position: 3.7 },
    { id: "30", prompt: "How to structure prompts to assess brand visibility", visibility: 54, model: "ChatGPT", intent: "How-to Guides", sentiment: "Positive", position: 2.0 },
    { id: "31", prompt: "Affordable options for expert human-in-the-loop labeling", visibility: 44, model: "Perplexity", intent: "Competitor", sentiment: "Neutral", position: 3.4 },
    { id: "32", prompt: "What datasets improve retrieval quality for RAG systems?", visibility: 58, model: "ChatGPT", intent: "How-to Guides", sentiment: "Positive", position: 1.8 },
    { id: "33", prompt: "Top annotation vendors with SOC2 compliance", visibility: 45, model: "Perplexity", intent: "Brand-Specific", sentiment: "Neutral", position: 3.0 },
    { id: "34", prompt: "Evaluating dataset bias and mitigation techniques", visibility: 49, model: "ChatGPT", intent: "How-to Guides", sentiment: "Neutral", position: 2.7 },
    { id: "35", prompt: "Best tools for active learning workflows in labeling", visibility: 50, model: "Perplexity", intent: "Organic", sentiment: "Positive", position: 2.4 },
    { id: "36", prompt: "Benchmarks to validate fine-tuned model accuracy", visibility: 53, model: "ChatGPT", intent: "How-to Guides", sentiment: "Positive", position: 2.1 },
    { id: "37", prompt: "Providers offering healthcare-compliant data labeling", visibility: 41, model: "Perplexity", intent: "Brand-Specific", sentiment: "Neutral", position: 3.8 },
    { id: "38", prompt: "How to track impact of better data on model KPIs", visibility: 57, model: "ChatGPT", intent: "How-to Guides", sentiment: "Positive", position: 1.7 },
    { id: "39", prompt: "Starter datasets for evaluating LLM guardrails", visibility: 45, model: "Perplexity", intent: "Organic", sentiment: "Neutral", position: 3.1 },
    { id: "40", prompt: "Comparison of Perplexity vs ChatGPT for research queries", visibility: 48, model: "ChatGPT", intent: "Competitor", sentiment: "Neutral", position: 2.9 },
    { id: "41", prompt: "How to scope a data labeling pilot for your team", visibility: 55, model: "Perplexity", intent: "How-to Guides", sentiment: "Positive", position: 2.2 },
    { id: "42", prompt: "Recommended dataset licensing models for startups", visibility: 43, model: "ChatGPT", intent: "Organic", sentiment: "Neutral", position: 3.2 },
    { id: "43", prompt: "Top European data annotation providers", visibility: 47, model: "Perplexity", intent: "Competitor", sentiment: "Neutral", position: 2.7 },
    { id: "44", prompt: "How to design labeling guidelines for consistency", visibility: 60, model: "ChatGPT", intent: "How-to Guides", sentiment: "Positive", position: 1.5 },
    { id: "45", prompt: "What are the best QA processes for labeled data?", visibility: 52, model: "Perplexity", intent: "How-to Guides", sentiment: "Positive", position: 2.0 },
    { id: "46", prompt: "Vendors for multilingual sentiment and intent labels", visibility: 46, model: "ChatGPT", intent: "Brand-Specific", sentiment: "Neutral", position: 2.8 },
    { id: "47", prompt: "Open datasets for evaluation of classification models", visibility: 49, model: "Perplexity", intent: "Organic", sentiment: "Neutral", position: 2.6 },
    { id: "48", prompt: "How to choose KPIs for annotation program success", visibility: 55, model: "ChatGPT", intent: "How-to Guides", sentiment: "Positive", position: 1.9 },
    { id: "49", prompt: "Pros and cons of managed vs self-hosted labeling tools", visibility: 44, model: "Perplexity", intent: "Competitor", sentiment: "Neutral", position: 3.3 },
    { id: "50", prompt: "Checklist for buying AI-ready datasets", visibility: 58, model: "ChatGPT", intent: "How-to Guides", sentiment: "Positive", position: 1.6 },
  ], [])

  const fullData = useMemo(() => [...hardcodedData, ...extraPrompts], [hardcodedData, extraPrompts])

  const [data, setData] = useState<TrackedPrompt[]>(() => hardcodedData)
  const [addOpen, setAddOpen] = useState(false)
  const [newPromptText, setNewPromptText] = useState("")
  const [newIntent, setNewIntent] = useState<TrackedPrompt["intent"]>("Organic")
  const [showAll, setShowAll] = useState(false)

  const table = useReactTable({
    data,
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
  const handleAddPrompt = () => {
    const text = newPromptText.trim()
    if (!text) return
    const next: TrackedPrompt = {
      id: `${Date.now()}`,
      prompt: text,
      visibility: 50,
      model: "ChatGPT",
      intent: newIntent,
      sentiment: "Neutral",
      position: 3.0,
    }
    setData((prev) => [next, ...prev])
    setAddOpen(false)
    setNewPromptText("")
    setNewIntent("Organic")
  }

  return (
    <SidebarProvider
      className="bg-dark-grey"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 52)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset className="bg-dark-grey m-0 shadow-none rounded-none border-none">
        <SiteHeader />
        <Separator className="w-full border-border" />
        <div className="flex flex-1 flex-col bg-dark-grey">
          <div className="@container/main flex flex-1 flex-col gap-3 md:gap-4 bg-dark-grey">
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
                    variant="outline"
                    className="h-9 rounded-lg"
                    onClick={() => {
                      if (showAll) {
                        setData(hardcodedData)
                        setPagination((p) => ({ ...p, pageIndex: 0, pageSize: 12 }))
                        setShowAll(false)
                      } else {
                        setData(fullData)
                        setPagination((p) => ({ ...p, pageIndex: 0, pageSize: fullData.length }))
                        setShowAll(true)
                      }
                    }}
                  >
                    {showAll ? "Collapse" : "All Prompts"}
                  </Button>
                  <Button size="sm" className="h-9 rounded-lg bg-white text-black hover:bg-white/90 border-transparent gap-1.5" onClick={() => setAddOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Add Prompt
                  </Button>
                </div>
              </div>
              <div className="mt-4">
                <div className="relative">
                  <div className="h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                  <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex flex-col flex-1">
              <div className="px-4 lg:px-6 mt-2 md:mt-4 pb-6 md:pb-8 space-y-4">
                <div className="overflow-hidden rounded-md border border-white/[0.06] bg-transparent">
                  <Table className="table-fixed text-[14px] md:text-[15px]">
                    <TableHeader className="bg-white/[0.04]">
                      {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id} className="hover:bg-transparent text-[13px] md:text-sm">
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
                      {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                          <TableRow key={row.id} data-state={row.getIsSelected() && "selected"} className="text-[14px] md:text-[15px]">
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id} className="py-4 align-middle">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={columns.length} className="h-24 text-center">
                            No results.
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
                      <Button variant="destructive" size="sm" className="h-8 rounded-md gap-1.5">
                        <Trash2 className="h-4 w-4" />
                        Delete Prompt
                      </Button>
                    </div>
                  </div>
                )}

                {/* Add Prompt Dialog */}
                <Dialog open={addOpen} onOpenChange={setAddOpen}>
                  <DialogContent className="sm:max-w-lg rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl">
                    <DialogHeader>
                      <DialogTitle>Add Prompt</DialogTitle>
                      <DialogDescription>Manually add a prompt to track.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="prompt-text">Prompt</Label>
                        <Textarea id="prompt-text" value={newPromptText} onChange={(e) => setNewPromptText(e.target.value)} placeholder="Type your prompt..." className="min-h-[90px] rounded-lg border-white/10" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="intent">Intent</Label>
                        <Select value={newIntent} onValueChange={(v) => setNewIntent(v as TrackedPrompt["intent"])}>
                          <SelectTrigger id="intent" className="w-full rounded-lg">
                            <SelectValue placeholder="Select intent" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="How-to Guides">How-to Guides</SelectItem>
                            <SelectItem value="Organic">Organic</SelectItem>
                            <SelectItem value="Brand-Specific">Brand-Specific</SelectItem>
                            <SelectItem value="Competitor">Competitor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-3">
                      <Button variant="outline" onClick={() => setAddOpen(false)} className="h-9 rounded-lg">Cancel</Button>
                      <Button onClick={handleAddPrompt} className="h-9 rounded-lg bg-white text-black hover:bg-white/90 border-transparent">Add Prompt</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>

      <FloatingMudraButton siteId={typeof window !== 'undefined' ? (localStorage.getItem('mudra:siteId') || '') : ''} />
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


