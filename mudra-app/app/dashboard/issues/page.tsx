"use client"

import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { BrandProfileProvider, useBrandProfile } from "@/components/brand-profile-context"
import { CountdownBadge } from "@/components/dashboard/countdown-badge"
import { IconPlus, IconTrash, IconLoader2, IconSparkles, IconRotate, IconExternalLink, IconGitPullRequest, IconCode, IconCopy, IconCheck, IconWand, IconChevronDown } from "@tabler/icons-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { toast } from "sonner"

function UnicodeStatusGlyph({ glyph, className }: { glyph: string; className?: string }) {
  return (
    <span aria-hidden className={`inline-flex items-center justify-center font-mono text-[15px] leading-none align-middle select-none ${className || ""}`}>
      {glyph}
    </span>
  )
}

const EXECUTION_SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const

function UnicodeExecutionSpinner({ className = "" }: { className?: string }) {
  const [frameIndex, setFrameIndex] = React.useState(0)

  React.useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }

    const timer = window.setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % EXECUTION_SPINNER_FRAMES.length)
    }, 80)

    return () => window.clearInterval(timer)
  }, [])

  return (
    <span aria-hidden className={`inline-flex w-4 justify-center font-mono text-[15px] leading-none align-middle select-none ${className}`}>
      {EXECUTION_SPINNER_FRAMES[frameIndex]}
    </span>
  )
}

// Custom status icons
const IdentifiedIcon = ({ className, animate: _animate }: { className?: string; animate?: boolean }) => (
  <UnicodeStatusGlyph glyph="⠒" className={className} />
)

const InProgressIcon = ({ className, animate = false }: { className?: string; animate?: boolean }) => (
  animate
    ? <UnicodeExecutionSpinner className={className} />
    : <UnicodeStatusGlyph glyph="⠶" className={className} />
)

const CompletedIcon = ({ className, animate: _animate }: { className?: string; animate?: boolean }) => (
  <UnicodeStatusGlyph glyph="⠿" className={className} />
)

const MergedIcon = ({ className, animate: _animate }: { className?: string; animate?: boolean }) => (
  <UnicodeStatusGlyph glyph="⠯" className={className} />
)

const FailedIcon = ({ className, animate: _animate }: { className?: string; animate?: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>
    <path d="M12 9v4"/>
    <path d="M12 17h.01"/>
  </svg>
)

const DismissedIcon = ({ className, animate: _animate }: { className?: string; animate?: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10"/>
    <path d="m15 9-6 6"/>
    <path d="m9 9 6 6"/>
  </svg>
)

// Issue type definition
interface Issue {
  id: number
  title: string
  description?: string | null
  checkCode?: string | null
  status: "identified" | "in_progress" | "completed" | "merged" | "failed" | "dismissed"
  priority: "low" | "medium" | "high"
  order: number
  createdAt: string
  updatedAt: string
  agentType?: string | null
  prUrl?: string | null
  prNumber?: number | null
  generatedOutput?: string | null
  outputType?: string | null
  scriptSource?: string | null
  category?: string | null
}

interface IssueStats {
  total: number
  byStatus: {
    identified: number
    in_progress: number
    completed: number
    merged: number
  }
  byCategory: {
    technical_structure: number
    ai_visibility: number
    conversation: number
  }
  byPriority: {
    low: number
    medium: number
    high: number
  }
  recentIssues: number
  completedThisWeek: number
}

const categoryConfig = {
  technical_structure: { color: "bg-blue-500", label: "Technical" },
  ai_visibility: { color: "bg-purple-500", label: "AI Visibility" },
  conversation: { color: "bg-green-500", label: "Conversation" },
}

const statusConfig = {
  identified: { icon: IdentifiedIcon, color: "text-white/60", bg: "bg-white/5" },
  in_progress: { icon: InProgressIcon, color: "text-amber-400", bg: "bg-amber-400/10" },
  completed: { icon: CompletedIcon, color: "text-white", bg: "bg-white/10" },
  merged: { icon: MergedIcon, color: "text-sky-400", bg: "bg-sky-400/10" },
  failed: { icon: FailedIcon, color: "text-red-400", bg: "bg-red-400/10" },
  dismissed: { icon: DismissedIcon, color: "text-white/40", bg: "bg-white/5" },
}

const priorityConfig = {
  low: { color: "text-white/40", bg: "bg-white/5", dot: "bg-white/40" },
  medium: { color: "text-amber-400", bg: "bg-amber-400/10", dot: "bg-amber-400" },
  high: { color: "text-red-400", bg: "bg-red-400/10", dot: "bg-red-400" },
}

function canGenerateScript(issue: Issue): boolean {
  return issue.status === "identified" && (
    issue.agentType === "schema_markup" ||
    issue.agentType === "meta_optimization" ||
    issue.agentType === "faq_sections"
  )
}

// Sortable Issue Card Component
function SortableIssueCard({
  issue,
  onDelete,
  onFix,
  onGenerateScript,
  onRetry,
  onViewOutput,
  onClick,
  isDeploying,
  isGeneratingScript,
}: {
  issue: Issue
  onDelete: (issue: Issue) => void
  onFix?: (issueId: number) => void
  onGenerateScript?: (issueId: number) => void
  onRetry?: (issueId: number) => void
  onViewOutput?: (issue: Issue) => void
  onClick?: (issue: Issue) => void
  isDeploying?: boolean
  isGeneratingScript?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: issue.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const categoryConf = categoryConfig[issue.category as keyof typeof categoryConfig] || categoryConfig.technical_structure
  const statusConf = statusConfig[issue.status]
  const StatusIcon = statusConf.icon

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick?.(issue)}
      className="bg-white/[0.03] rounded-xl p-3.5 hover:bg-white/[0.05] transition-colors cursor-grab active:cursor-grabbing group"
    >
      <div className="flex items-start gap-3 mb-3">
        <StatusIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${statusConf.color}`} animate={issue.status === "in_progress"} />
        <p className="text-[13px] text-white/90 font-medium leading-relaxed flex-1">
          {issue.title}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-1 hover:bg-white/[0.1] rounded text-white/40 hover:text-white/60 transition-colors"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="1"/>
                <circle cx="12" cy="5" r="1"/>
                <circle cx="12" cy="19" r="1"/>
              </svg>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[#1a1a1a] border-white/10">
            {/* Fix - for identified issues */}
            {issue.status === "identified" && onFix && (
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onFix(issue.id); }}
                className="text-white hover:bg-white/10 cursor-pointer"
                disabled={isDeploying}
              >
                <IconWand className="w-4 h-4 mr-2" />
                Fix
              </DropdownMenuItem>
            )}
            {/* Generate Script - for supported identified issues */}
            {canGenerateScript(issue) && onGenerateScript && (
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onGenerateScript(issue.id); }}
                className="text-white/60 hover:bg-white/[0.05] cursor-pointer"
                disabled={isGeneratingScript}
              >
                {isGeneratingScript ? (
                  <UnicodeExecutionSpinner className="mr-2 text-white/60" />
                ) : (
                  <IconCode className="w-4 h-4 mr-2" />
                )}
                Generate Script
              </DropdownMenuItem>
            )}
            {/* Retry - for failed issues */}
            {issue.status === "failed" && onRetry && (
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onRetry(issue.id); }}
                className="text-amber-400 hover:bg-amber-400/10 cursor-pointer"
                disabled={isDeploying}
              >
                <IconRotate className="w-4 h-4 mr-2" />
                Retry
              </DropdownMenuItem>
            )}
            {/* View PR - for completed issues with PR */}
            {(issue as unknown as { prUrl?: string }).prUrl && (
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); window.open((issue as unknown as { prUrl: string }).prUrl, "_blank"); }}
                className="text-sky-400 hover:bg-sky-400/10 cursor-pointer"
              >
                <IconGitPullRequest className="w-4 h-4 mr-2" />
                View PR
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                // Delay opening the delete dialog so the dropdown fully
                // unmounts first — prevents Radix dismiss-layer conflict
                // that freezes the UI.
                setTimeout(() => onDelete(issue), 0)
              }}
              className="text-red-400 hover:bg-red-400/10 cursor-pointer"
            >
              <IconTrash className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* PR Badge - always visible when PR exists */}
      {issue.prUrl && (
        <a 
          href={issue.prUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 ml-7 mb-2 px-2 py-1 rounded-md bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-colors w-fit"
        >
          <IconGitPullRequest className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium">PR #{issue.prNumber}</span>
          <IconExternalLink className="w-3 h-3 opacity-60" />
        </a>
      )}
      <div className="flex items-center justify-between pl-7">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.05]">
            <span className={`w-1.5 h-1.5 rounded-full ${categoryConf.color}`} />
            <span className="text-[11px] text-white/50">{categoryConf.label}</span>
          </span>
          {issue.priority && priorityConfig[issue.priority] && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.05]">
              <span className={`w-1.5 h-1.5 rounded-full ${priorityConfig[issue.priority].dot}`} />
              <span className="text-[11px] text-white/50 capitalize">{issue.priority}</span>
            </span>
          )}
        </div>
        {(issue.status === "identified" && issue.agentType) || (!issue.prUrl && issue.generatedOutput) ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white text-black hover:bg-white/90 transition-colors text-[11px] font-medium"
              >
                <IconWand className="w-3 h-3" />
                Fix
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#1a1a1a] border-white/10">
              {issue.status === "identified" && issue.agentType && onFix && (
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onFix(issue.id); }}
                  className="text-white hover:bg-white/10 cursor-pointer"
                  disabled={isDeploying}
                >
                  <IconWand className="w-4 h-4 mr-2" />
                  Fix with Agent
                </DropdownMenuItem>
              )}
              {!issue.prUrl && issue.generatedOutput && (
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onViewOutput?.(issue); }}
                  className="text-white hover:bg-white/10 cursor-pointer"
                >
                  <IconCode className="w-4 h-4 mr-2" />
                  See Code
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-[11px] text-white/20">{issue.agentType}</span>
        )}
      </div>
    </div>
  )
}

// Static Issue Card for Drag Overlay
function IssueCardOverlay({ issue }: { issue: Issue }) {
  const categoryConf = categoryConfig[issue.category as keyof typeof categoryConfig] || categoryConfig.technical_structure
  const statusConf = statusConfig[issue.status]
  const StatusIcon = statusConf.icon

  return (
    <div className="bg-white/[0.08] rounded-xl p-3.5 shadow-xl cursor-grabbing w-[260px]">
      <div className="flex items-start gap-3 mb-3">
        <StatusIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${statusConf.color}`} animate={issue.status === "in_progress"} />
        <p className="text-[13px] text-white/90 font-medium leading-relaxed">
          {issue.title}
        </p>
      </div>
      <div className="flex items-center justify-between pl-7">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.05]">
          <span className={`w-1.5 h-1.5 rounded-full ${categoryConf.color}`} />
          <span className="text-[11px] text-white/50">{categoryConf.label}</span>
        </span>
        <span className="text-[11px] text-white/20">{issue.agentType}</span>
      </div>
    </div>
  )
}

// Analysis View Component
function AnalysisView({ stats, isLoading }: { stats: IssueStats | null; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <IconLoader2 className="w-6 h-6 text-white/40 animate-spin" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/40">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>
          <p className="text-white/50 text-sm">No issue data available</p>
        </div>
      </div>
    )
  }

  const completionRate = stats.total > 0 
    ? Math.round(((stats.byStatus.completed + stats.byStatus.merged) / stats.total) * 100) 
    : 0

  return (
    <div className="flex-1 px-4 lg:px-6 py-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Issues */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="text-[11px] text-white/50 uppercase tracking-wider mb-1">Total Issues</div>
          <div className="text-2xl font-bold text-white">{stats.total}</div>
          <div className="text-[12px] text-white/40 mt-1">
            {stats.recentIssues} added this week
          </div>
        </div>

        {/* Completion Rate */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="text-[11px] text-white/50 uppercase tracking-wider mb-1">Completion Rate</div>
          <div className="text-2xl font-bold text-white">{completionRate}%</div>
          <div className="text-[12px] text-white/40 mt-1">
            {stats.completedThisWeek} completed this week
          </div>
        </div>

        {/* Active Issues */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="text-[11px] text-white/50 uppercase tracking-wider mb-1">Active Issues</div>
          <div className="text-2xl font-bold text-amber-400">{stats.byStatus.in_progress}</div>
          <div className="text-[12px] text-white/40 mt-1">
            {stats.byStatus.identified} in backlog
          </div>
        </div>

        {/* Bugs */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="text-[11px] text-white/50 uppercase tracking-wider mb-1">High Priority</div>
          <div className="text-2xl font-bold text-red-400">{stats.byPriority.high}</div>
          <div className="text-[12px] text-white/40 mt-1">
            {stats.byCategory.technical_structure} technical issues
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* By Status */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-medium text-white/80 mb-4">Issues by Status</h3>
          <div className="space-y-3">
            {Object.entries(stats.byStatus).map(([status, count]) => {
              const conf = statusConfig[status as keyof typeof statusConfig]
              const StatusIcon = conf.icon
              const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0
              return (
                <div key={status} className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg ${conf.bg}`}>
                    <StatusIcon className={`w-3.5 h-3.5 ${conf.color}`} />
                  </div>
                  <span className="text-[13px] text-white/70 capitalize w-24">
                    {status.replace("_", " ")}
                  </span>
                  <div className="flex-1 h-2 bg-white/[0.05] rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${conf.bg} rounded-full transition-all`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-[13px] text-white/50 w-8 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* By Category */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-medium text-white/80 mb-4">Issues by Category</h3>
          <div className="space-y-3">
            {Object.entries(stats.byCategory).map(([category, count]) => {
              const conf = categoryConfig[category as keyof typeof categoryConfig] || categoryConfig.technical_structure
              const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0
              return (
                <div key={category} className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${conf.color}`} />
                  <span className="text-[13px] text-white/70 w-24">{conf.label}</span>
                  <div className="flex-1 h-2 bg-white/[0.05] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${conf.color} rounded-full transition-all`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-[13px] text-white/50 w-8 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* By Priority */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 md:col-span-2">
          <h3 className="text-sm font-medium text-white/80 mb-4">Issues by Priority</h3>
          <div className="flex gap-4">
            {Object.entries(stats.byPriority).map(([priority, count]) => {
              const conf = priorityConfig[priority as keyof typeof priorityConfig]
              if (!conf) return null
              return (
                <div key={priority} className={`flex-1 p-4 rounded-xl ${conf.bg} border border-white/[0.06]`}>
                  <div className={`text-2xl font-bold ${conf.color}`}>{count}</div>
                  <div className="text-[12px] text-white/50 capitalize mt-1">{priority}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// Create/Edit Issue Dialog
function IssueDialog({
  open,
  onOpenChange,
  issue,
  defaultStatus,
  onSave,
  isLoading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  issue?: Issue | null
  defaultStatus?: string
  onSave: (data: Partial<Issue>) => void
  isLoading: boolean
}) {
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [status, setStatus] = React.useState<Issue["status"]>("identified")
  const [priority, setPriority] = React.useState<Issue["priority"]>("medium")

  React.useEffect(() => {
    if (issue) {
      setTitle(issue.title)
      setDescription(issue.description || "")
      setStatus(issue.status)
      setPriority(issue.priority)
    } else {
      setTitle("")
      setDescription("")
      setStatus(defaultStatus as Issue["status"] || "identified")
      setPriority("medium")
    }
  }, [issue, defaultStatus, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ title, description: description || null, status, priority })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>{issue ? "Edit Issue" : "Create Issue"}</DialogTitle>
          <DialogDescription className="text-white/50">
            {issue ? "Update the issue details below." : "Add a new issue to track."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-white/70">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Issue title..."
                className="bg-white/[0.05] border-white/10 text-white placeholder:text-white/30"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-white/70">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                className="bg-white/[0.05] border-white/10 text-white placeholder:text-white/30 min-h-[80px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-white/70">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as Issue["status"])}>
                  <SelectTrigger className="bg-white/[0.05] border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    <SelectItem value="identified" className="text-white hover:bg-white/10">Identified</SelectItem>
                    <SelectItem value="in_progress" className="text-white hover:bg-white/10">In Progress</SelectItem>
                    <SelectItem value="completed" className="text-white hover:bg-white/10">Completed</SelectItem>
                    <SelectItem value="merged" className="text-white hover:bg-white/10">Merged</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as Issue["priority"])}>
                  <SelectTrigger className="bg-white/[0.05] border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    <SelectItem value="low" className="text-white hover:bg-white/10">Low</SelectItem>
                    <SelectItem value="medium" className="text-white hover:bg-white/10">Medium</SelectItem>
                    <SelectItem value="high" className="text-white hover:bg-white/10">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !title.trim()}
              className="bg-white text-black hover:bg-white/90"
            >
              {isLoading ? (
                <IconLoader2 className="w-4 h-4 animate-spin" />
              ) : issue ? (
                "Update"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Delete Confirmation Dialog
// The useEffect safety net clears pointer-events:none on document.body
// whenever the dialog closes, preventing the UI from getting stuck
// due to Radix dismiss-layer teardown races with DropdownMenu.
function DeleteDialog({
  open,
  onOpenChange,
  issue,
  onConfirm,
  isLoading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  issue: Issue | null
  onConfirm: () => void
  isLoading: boolean
}) {
  // Safety net: whenever the dialog closes, make sure body is interactive
  React.useEffect(() => {
    if (!open) {
      document.body.style.pointerEvents = ''
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Issue</DialogTitle>
          <DialogDescription className="text-white/50">
            Are you sure you want to delete &quot;{issue?.title}&quot;? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-red-500 text-white hover:bg-red-600"
          >
            {isLoading ? <IconLoader2 className="w-4 h-4 animate-spin" /> : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Issue Detail Dialog (popup when clicking on an issue)
function IssueDetailDialog({
  open,
  onOpenChange,
  issue,
  onDeploy,
  onGenerateScript,
  onRetry,
  onViewOutput,
  isDeploying,
  isGeneratingScript,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  issue: Issue | null
  onDeploy?: (issueId: number) => void
  onGenerateScript?: (issueId: number) => void
  onRetry?: (issueId: number) => void
  onViewOutput?: (issue: Issue) => void
  isDeploying?: boolean
  isGeneratingScript?: boolean
}) {
  const [scriptExpanded, setScriptExpanded] = React.useState(false)
  const [scriptCopied, setScriptCopied] = React.useState(false)

  // Reset expand state when dialog opens with a new issue
  React.useEffect(() => {
    if (!open) setScriptExpanded(false)
  }, [open])

  if (!issue) return null

  const categoryConf = categoryConfig[issue.category as keyof typeof categoryConfig] || categoryConfig.technical_structure
  const statusConf = statusConfig[issue.status]
  const StatusIcon = statusConf.icon
  const priorityConf = issue.priority && priorityConfig[issue.priority] ? priorityConfig[issue.priority] : priorityConfig.medium

  const canDeploy = issue.status === "identified" && issue.agentType
  const canRetry = issue.status === "failed"
  const hasPR = issue.prUrl && issue.prNumber
  const hasOutput = issue.generatedOutput

  const handleCopyScript = async () => {
    if (issue.generatedOutput) {
      await navigator.clipboard.writeText(issue.generatedOutput)
      setScriptCopied(true)
      setTimeout(() => setScriptCopied(false), 2000)
    }
  }
  const canGenerate = canGenerateScript(issue)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#141414] border-white/[0.06] text-white w-[calc(100%-2rem)] max-w-md p-0 overflow-hidden min-w-0">
       {/* Header */}
       <div className="px-5 pt-5 pb-4">
         <div className="flex items-center gap-2 mb-3">
           <StatusIcon className={`w-4 h-4 ${statusConf.color}`} animate={issue.status === "in_progress"} />
           <span className={`text-[11px] ${statusConf.color} capitalize`}>
             {issue.status.replace("_", " ")}
           </span>
           <span className="text-[11px] text-white/30">·</span>
           <span className="text-[11px] text-white/30">
             ISS-{String(issue.id).padStart(2, "0")}
           </span>
         </div>
         <DialogHeader className="p-0">
           <DialogTitle className="text-[15px] font-medium text-white/90 leading-snug">
             {issue.title}
           </DialogTitle>
           <DialogDescription className="sr-only">
             Details for issue {issue.title}
           </DialogDescription>
         </DialogHeader>
       </div>

       {/* Content */}
       <div className="px-5 pb-5 space-y-4 min-w-0 overflow-hidden">
         {/* Description */}
         {issue.description && (
           <p className="text-[13px] text-white/50 leading-relaxed">{issue.description}</p>
         )}

         {/* Metadata */}
         <div className="flex flex-wrap items-center gap-3 text-[12px]">
           <span className="inline-flex items-center gap-1.5">
             <span className={`w-1.5 h-1.5 rounded-full ${categoryConf.color}`} />
             <span className="text-white/50">{categoryConf.label}</span>
           </span>
           <span className={`${priorityConf.color} capitalize`}>{issue.priority}</span>
           {issue.agentType && (
             <>
               <span className="text-white/20">·</span>
               <span className="text-white/40">{issue.agentType}</span>
             </>
           )}
         </div>

         {/* PR Link */}
         {hasPR && (
           <a
             href={issue.prUrl!}
             target="_blank"
             rel="noopener noreferrer"
             className="flex items-center gap-2 text-[12px] text-sky-400 hover:text-sky-300 transition-colors"
           >
             <IconGitPullRequest className="w-3.5 h-3.5" />
             <span>PR #{issue.prNumber}</span>
             <IconExternalLink className="w-3 h-3 opacity-50" />
           </a>
         )}

         {/* Generated Script — preview visible, expandable to full */}
         {hasOutput && !hasPR && (
           <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
             <div className="flex items-center justify-between px-3 py-2">
               <div className="flex items-center gap-2">
                 <IconCode className="w-3.5 h-3.5 text-white/50" />
                 <span className="text-[12px] text-white/50">Generated Script</span>
                 {issue.scriptSource === "llm" && (
                   <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300">AI</span>
                 )}
               </div>
               <Button
                 variant="ghost"
                 size="sm"
                 onClick={handleCopyScript}
                 className="text-white/30 hover:text-white/70 hover:bg-white/[0.05] h-7 w-7 p-0"
               >
                 {scriptCopied ? (
                   <IconCheck className="w-3.5 h-3.5 text-emerald-400" />
                 ) : (
                   <IconCopy className="w-3.5 h-3.5" />
                 )}
               </Button>
             </div>
             <div className="relative px-3 pb-3">
               <pre
                 onClick={() => setScriptExpanded(!scriptExpanded)}
                 className={`bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-[12px] text-white/80 font-mono whitespace-pre-wrap break-words cursor-pointer transition-all ${scriptExpanded ? 'max-h-[300px] overflow-auto' : 'max-h-[80px] overflow-hidden'}`}
               >
                 {issue.generatedOutput}
               </pre>
               {!scriptExpanded && (
                 <button
                   onClick={() => setScriptExpanded(true)}
                   className="flex items-center justify-center gap-1 w-full pt-2 text-[11px] text-white/30 hover:text-white/50 transition-colors"
                 >
                   <span>Show more</span>
                   <IconChevronDown className="w-3 h-3" />
                 </button>
               )}
               {scriptExpanded && (
                 <button
                   onClick={() => setScriptExpanded(false)}
                   className="flex items-center justify-center gap-1 w-full pt-2 text-[11px] text-white/30 hover:text-white/50 transition-colors"
                 >
                   <span>Show less</span>
                   <IconChevronDown className="w-3 h-3 rotate-180" />
                 </button>
               )}
             </div>
           </div>
         )}
       </div>

       {/* Footer */}
       <div className="px-5 py-4 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
         <div className="flex flex-wrap items-center gap-2">
           {canRetry && (
             <Button
               onClick={() => { onRetry?.(issue.id); onOpenChange(false); }}
               disabled={isDeploying}
               variant="ghost"
               size="sm"
               className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
             >
               <IconRotate className="w-3.5 h-3.5 mr-1.5" />
               Retry
             </Button>
           )}
           {canGenerate && (
             <Button
               onClick={() => { onGenerateScript?.(issue.id); onOpenChange(false); }}
               disabled={isGeneratingScript}
               variant="ghost"
               size="sm"
               className="text-white/50 hover:text-white/70 hover:bg-white/[0.05]"
             >
               {isGeneratingScript ? (
                 <UnicodeExecutionSpinner className="mr-1.5 text-white/60" />
               ) : (
                 <IconCode className="w-3.5 h-3.5 mr-1.5" />
               )}
               Generate Script
             </Button>
           )}
         </div>
         {canDeploy && (
           <Button
             onClick={() => { onDeploy?.(issue.id); onOpenChange(false); }}
             disabled={isDeploying}
             size="sm"
             className="bg-white text-black hover:bg-white/90 font-medium"
           >
             {isDeploying ? (
               <>
                 <UnicodeExecutionSpinner className="mr-1.5 text-black/80" />
                 Deploying...
               </>
             ) : (
               "Deploy Agent"
             )}
           </Button>
         )}
       </div>
      </DialogContent>
    </Dialog>
  )
}

// Column with handlers
function IssueColumnWithHandlers({
  title,
  issues,
  status,
  onAddClick,
  onDelete,
  onFix,
  onGenerateScript,
  onRetry,
  onViewOutput,
  onIssueClick,
  deployingId,
  generatingScriptId,
}: {
  title: string
  issues: Issue[]
  status: "identified" | "in_progress" | "completed" | "merged"
  onAddClick: (status: string) => void
  onDelete: (issue: Issue) => void
  onFix?: (issueId: number) => void
  onGenerateScript?: (issueId: number) => void
  onRetry?: (issueId: number) => void
  onViewOutput?: (issue: Issue) => void
  onIssueClick?: (issue: Issue) => void
  deployingId?: number | null
  generatingScriptId?: number | null
}) {
  const config = statusConfig[status]
  const StatusIcon = config.icon

  return (
    <div className="flex-1 min-w-[260px] max-w-[300px]">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <StatusIcon className={`w-[18px] h-[18px] ${config.color}`} />
          <span className="text-[13px] font-medium text-white/80">{title}</span>
          <span className="text-[11px] text-white/40 bg-white/[0.05] px-1.5 py-0.5 rounded-md">
            {issues.length}
          </span>
        </div>
        <button 
          onClick={() => onAddClick(status)}
          className="p-1.5 hover:bg-white/[0.05] rounded-lg transition-colors"
        >
          <IconPlus className="w-3.5 h-3.5 text-white/40 hover:text-white/70" />
        </button>
      </div>

      {/* Issues List */}
      <SortableContext items={issues.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3 min-h-[100px]" data-status={status}>
          {issues.map((issue) => (
              <SortableIssueCard
                key={issue.id}
                issue={issue}
                onDelete={onDelete}
                onFix={onFix}
                onGenerateScript={onGenerateScript}
                onRetry={onRetry}
                onViewOutput={onViewOutput}
                onClick={onIssueClick}
                isDeploying={deployingId === issue.id}
                isGeneratingScript={generatingScriptId === issue.id}
              />
          ))}
          {issues.length === 0 && (
            <div className="text-[13px] text-white/30 py-8 text-center border border-dashed border-white/[0.08] rounded-xl">
              No issues
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

function IssuesPageInner() {
  const [issues, setIssues] = React.useState<Issue[]>([])
  const [stats, setStats] = React.useState<IssueStats | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isStatsLoading, setIsStatsLoading] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [viewMode, setViewMode] = React.useState<"issues" | "analysis">("issues")
  const [activeTab, setActiveTab] = React.useState<"all" | "active" | "identified">("all")
  
  // Dialog states
  const [issueDialogOpen, setIssueDialogOpen] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [outputDialogOpen, setOutputDialogOpen] = React.useState(false)
  const [issueDetailDialogOpen, setIssueDetailDialogOpen] = React.useState(false)
  const [editingIssue, setEditingIssue] = React.useState<Issue | null>(null)
  const [deletingIssue, setDeletingIssue] = React.useState<Issue | null>(null)
  const [viewingOutputIssue, setViewingOutputIssue] = React.useState<Issue | null>(null)
  const [selectedIssue, setSelectedIssue] = React.useState<Issue | null>(null)
  const [defaultStatus, setDefaultStatus] = React.useState<string>("identified")
  const [copiedOutput, setCopiedOutput] = React.useState(false)
  
  // Drag state
  const [activeId, setActiveId] = React.useState<number | null>(null)
  
  // Brand profile for analysis - with safety check
  const brandProfileContext = useBrandProfile()
  const profile = brandProfileContext?.profile ?? null

  // Analysis cooldown state
  const [canRunAnalysis, setCanRunAnalysis] = React.useState(false)
  const [nextAnalysisTime, setNextAnalysisTime] = React.useState<number | null>(null)
  const [isRunningAnalysis, setIsRunningAnalysis] = React.useState(false)

  // Agent deployment state
  const [deployingId, setDeployingId] = React.useState<number | null>(null)
  const [generatingScriptId, setGeneratingScriptId] = React.useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Fetch issues
  const fetchIssues = React.useCallback(async () => {
    try {
      console.log('[Issues Page] Fetching issues...')
      const response = await fetch("/api/issues")
      console.log('[Issues Page] Response status:', response.status)
      
      if (!response.ok) {
        const text = await response.text()
        console.error('[Issues Page] Error response:', text.substring(0, 500))
        throw new Error(`Failed to fetch issues: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log('[Issues Page] Data received:', data)
      
      if (data.success) {
        // API returns { issues, grouped, counts } - extract the issues array
        setIssues(data.data.issues || data.data)
      } else {
        console.error('[Issues Page] API returned error:', data.error)
        throw new Error(data.error?.message || 'Unknown error')
      }
    } catch (error) {
      console.error("Failed to fetch issues:", error)
      // Show error to user via toast
      if (typeof window !== 'undefined' && window.navigator.onLine === false) {
        console.error('Network offline')
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch stats
  const fetchStats = React.useCallback(async () => {
    setIsStatsLoading(true)
    try {
      const response = await fetch("/api/issues/stats")
      const data = await response.json()
      if (data.success) {
        setStats(data.data)
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error)
    } finally {
      setIsStatsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchIssues()
  }, [fetchIssues])

  // Sync PR statuses on page load (catches merged PRs missed by webhooks)
  React.useEffect(() => {
    const syncPRs = async () => {
      try {
        const res = await fetch('/api/issues/sync-prs', { method: 'POST' })
        const data = await res.json()
        if (data.success && data.data.synced > 0) {
          console.log(`[Issues] PR sync: ${data.data.merged} merged, ${data.data.closed} closed`)
          fetchIssues() // Refresh issues to reflect updated statuses
        }
      } catch (error) {
        // Silent fail — webhook is primary, this is just a fallback
        console.debug('[Issues] PR sync check failed (non-critical):', error)
      }
    }
    syncPRs()
  }, [fetchIssues])

  React.useEffect(() => {
    if (viewMode === "analysis") {
      fetchStats()
    }
  }, [viewMode, fetchStats])

  // Check cooldown status
  React.useEffect(() => {
    const checkCooldown = async () => {
      if (!profile?.id || profile.id <= 0) return

      try {
        const response = await fetch(`/api/analysis/cooldown?brandProfileId=${profile.id}`)
        const data = await response.json()

        if (data.success) {
          setCanRunAnalysis(data.allowed)
          if (data.lastRunAt && data.timeUntilNext) {
            setNextAnalysisTime(Date.now() + data.timeUntilNext)
          } else {
            setNextAnalysisTime(null)
          }
        } else {
          console.warn('Cooldown check returned error, allowing analysis:', data.error)
          setCanRunAnalysis(true)
        }
      } catch (error) {
        console.error('Failed to check cooldown:', error)
        setCanRunAnalysis(true)
      }
    }

    checkCooldown()
    const interval = setInterval(checkCooldown, 30000)
    return () => clearInterval(interval)
  }, [profile?.id])

  // Run full analysis (replaces discover issues)
  const handleRunAnalysis = async () => {
    if (!profile?.id || profile.id <= 0) {
      toast.error('Profile not loaded. Please refresh the page.')
      return
    }

    if (!canRunAnalysis) {
      toast.error('Analysis is on cooldown. Please wait 24 hours.')
      return
    }

    if (isRunningAnalysis) return

    setIsRunningAnalysis(true)
    const toastId = 'run-analysis'
    toast.loading('Running analysis... This may take 1-2 minutes.', { id: toastId })

    try {
      const response = await fetch('/api/analysis/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandProfileId: profile.id,
          brandName: profile.companyName,
          website: profile.companyWebsite,
          description: profile.companyDescription,
          industry: profile.companyIndustry,
          competitors: [],
          skipCooldown: false,
          generateReport: true,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Analysis completed! Issues refreshed.', { id: toastId })
        await fetchIssues()
        window.dispatchEvent(new Event('mudra:website-analyzed'))
        setCanRunAnalysis(false)
        setNextAnalysisTime(Date.now() + (24 * 60 * 60 * 1000))
      } else {
        const errorMsg = typeof result.error === 'string'
          ? result.error
          : result.error?.message || 'Analysis failed'
        toast.error(errorMsg, { id: toastId })
      }
    } catch (error) {
      console.error('Failed to run analysis:', error)
      toast.error('Failed to run analysis. Please try again.', { id: toastId })
    } finally {
      setIsRunningAnalysis(false)
    }
  }

  // Deploy agent for an issue (async with polling)
  const handleDeployAgent = async (issueId: number) => {
    setDeployingId(issueId)
    
    // Immediately move issue to in_progress in UI for visual feedback
    setIssues(prev => prev.map(issue => 
      issue.id === issueId ? { ...issue, status: "in_progress" as const } : issue
    ))
    
    toast.info("Agent deploying...", {
      description: "Your issue is being processed. This may take a minute.",
    })
    
    try {
      // Use async mode to avoid timeout
      const response = await fetch(`/api/issues/${issueId}/deploy`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-async-mode": "true"  // Enable fire-and-forget mode
        },
      })
      const result = await response.json()
      
      if (result.success && result.data.status === 'processing') {
        // Start polling for completion
        pollIssueStatus(issueId)
      } else if (result.success && result.data.status === 'completed') {
        // Sync mode completed (rare, for fast operations)
        toast.success("Agent completed", {
          description: result.data.prUrl ? `PR #${result.data.prNumber} created` : "Issue resolved successfully",
        })
        setTimeout(() => fetchIssues(), 500)
        setDeployingId(null)
      } else {
        toast.error("Deployment failed", { description: result.error?.message })
        await fetchIssues()
        setDeployingId(null)
      }
    } catch (error) {
      console.error("Failed to deploy agent:", error)
      toast.error("Deployment failed")
      await fetchIssues()
      setDeployingId(null)
    }
  }

  // Generate script snippet for manual injection
  const handleGenerateScript = async (issueId: number) => {
    setGeneratingScriptId(issueId)
    try {
      const response = await fetch(`/api/issues/${issueId}/generate-script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const result = await response.json()

      if (!result.success) {
        toast.error("Script generation failed", {
          description: result.error?.message || "Could not generate script for this issue.",
        })
        return
      }

      const generatedOutput = result.data?.generatedOutput as string | null
      const outputType = result.data?.outputType as string | null
      const scriptSource = result.data?.scriptSource as string | null

      setIssues((prev) =>
        prev.map((issue) =>
          issue.id === issueId
            ? {
                ...issue,
                generatedOutput: generatedOutput ?? issue.generatedOutput ?? null,
                outputType: outputType ?? issue.outputType ?? null,
                scriptSource: scriptSource ?? issue.scriptSource ?? null,
              }
            : issue
        )
      )

      const current = issues.find((issue) => issue.id === issueId)
      if (current && generatedOutput) {
        setViewingOutputIssue({
          ...current,
          generatedOutput,
          outputType,
          scriptSource,
        })
        setCopiedOutput(false)
        setOutputDialogOpen(true)
      }

      toast.success("Script generated", {
        description: "Use View Output to copy and paste the snippet.",
      })
    } catch (error) {
      console.error("Failed to generate script:", error)
      toast.error("Script generation failed")
    } finally {
      setGeneratingScriptId(null)
    }
  }

  // Poll for issue completion status
  const pollIssueStatus = async (issueId: number) => {
    const maxAttempts = 60  // Max 5 minutes (5s intervals)
    let attempts = 0
    
    const poll = async () => {
      try {
        const response = await fetch(`/api/issues/${issueId}`)
        const result = await response.json()
        
        if (result.success) {
          const issue = result.data
          
          // Update local state
          setIssues(prev => prev.map(i => 
            i.id === issueId ? { ...i, ...issue } : i
          ))
          
          if (issue.status === 'completed' || issue.status === 'merged') {
            toast.success("Agent completed", {
              description: issue.prUrl ? `PR #${issue.prNumber} created` : "Issue resolved successfully",
            })
            setDeployingId(null)
            fetchIssues()  // Refresh full list
            return  // Stop polling
          } else if (issue.status === 'failed' || issue.status === 'identified') {
            // Failed or reset to identified means it failed
            toast.error("Agent failed", {
              description: "Check the issue details for error information.",
            })
            setDeployingId(null)
            fetchIssues()  // Refresh full list
            return  // Stop polling
          }
        }
        
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000)  // Poll every 5 seconds
        } else {
          toast.warning("Agent taking longer than expected", {
            description: "The issue is still processing. Please check back later.",
          })
          setDeployingId(null)
        }
      } catch (error) {
        console.error("Error polling issue status:", error)
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000)
        }
      }
    }
    
    // Start polling after a short delay
    setTimeout(poll, 3000)
  }

  // Retry failed agent execution
  const handleRetryAgent = async (issueId: number) => {
    setDeployingId(issueId)
    try {
      const response = await fetch(`/api/issues/${issueId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const result = await response.json()
      if (result.success) {
        toast.success("Retry successful", {
          description: result.data.prUrl ? `PR #${result.data.prNumber} created` : "Issue resolved",
        })
        await fetchIssues()
      } else {
        toast.error("Retry failed", { description: result.error?.message })
      }
    } catch (error) {
      console.error("Failed to retry:", error)
      toast.error("Retry failed")
    } finally {
      setDeployingId(null)
    }
  }

  // View generated output for an issue
  const handleViewOutput = (issue: Issue) => {
    setViewingOutputIssue(issue)
    setOutputDialogOpen(true)
    setCopiedOutput(false)
  }

  // Open issue detail dialog
  const handleIssueClick = (issue: Issue) => {
    // Blur the focused card so Radix can safely apply aria-hidden
    // to the kanban board when the dialog opens
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    setSelectedIssue(issue)
    setIssueDetailDialogOpen(true)
  }

  // Copy generated output to clipboard
  const handleCopyOutput = async () => {
    if (viewingOutputIssue?.generatedOutput) {
      await navigator.clipboard.writeText(viewingOutputIssue.generatedOutput)
      setCopiedOutput(true)
      toast.success("Copied to clipboard")
      setTimeout(() => setCopiedOutput(false), 2000)
    }
  }

  // Create or update issue
  const handleSaveIssue = async (data: Partial<Issue>) => {
    setIsSaving(true)
    try {
      const url = editingIssue ? `/api/issues/${editingIssue.id}` : "/api/issues"
      const method = editingIssue ? "PATCH" : "POST"
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      
      const result = await response.json()
      if (result.success) {
        await fetchIssues()
        setIssueDialogOpen(false)
        setEditingIssue(null)
      }
    } catch (error) {
      console.error("Failed to save issue:", error)
    } finally {
      setIsSaving(false)
    }
  }

  // Delete issue
  const handleDeleteIssue = async () => {
    if (!deletingIssue) return
    
    // Close all dialogs immediately for better UX
    setDeleteDialogOpen(false)
    setIssueDetailDialogOpen(false)
    setSelectedIssue(null)
    setIsSaving(true)
    
    try {
      const response = await fetch(`/api/issues/${deletingIssue.id}`, {
        method: "DELETE",
      })
      const result = await response.json()
      if (result.success) {
        await fetchIssues()
        toast.success("Issue deleted successfully")
      } else {
        toast.error("Failed to delete issue")
      }
    } catch (error) {
      console.error("Failed to delete issue:", error)
      toast.error("Failed to delete issue")
    } finally {
      // Always reset state
      setDeletingIssue(null)
      setIsSaving(false)
      // Safety net: ensure body is never left with pointer-events:none
      document.body.style.pointerEvents = ''
    }
  }

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number)
  }

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) return

    const activeIssue = issues.find(i => i.id === active.id)
    const overIssue = issues.find(i => i.id === over.id)

    if (!activeIssue) return

    // Determine target status - check if we're dropping on another issue or on a column
    const targetStatus = overIssue?.status || activeIssue.status
    const targetOrder = overIssue?.order ?? 0

    // Optimistic update
    const newIssues = issues.map(issue => {
      if (issue.id === activeIssue.id) {
        return { ...issue, status: targetStatus, order: targetOrder }
      }
      return issue
    })
    setIssues(newIssues)

    // API call
    try {
      await fetch("/api/issues/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueId: activeIssue.id,
          newStatus: targetStatus,
          newOrder: targetOrder,
        }),
      })
      // Refetch to get accurate order
      await fetchIssues()
    } catch (error) {
      console.error("Failed to reorder:", error)
      fetchIssues() // Revert on error
    }
  }

  // Filter issues
  const filteredIssues = issues.filter(issue => {
    if (activeTab === "active" && (issue.status === "completed" || issue.status === "merged")) {
      return false
    }
    if (activeTab === "identified" && issue.status !== "identified") {
      return false
    }
    return true
  })

  const identifiedIssues = filteredIssues.filter(i => i.status === "identified")
  const inProgressIssues = filteredIssues.filter(i => i.status === "in_progress")
  const completedIssues = filteredIssues.filter(i => i.status === "completed")
  const mergedIssues = filteredIssues.filter(i => i.status === "merged")

  const activeIssue = activeId ? issues.find(i => i.id === activeId) : null

  const handleAddClick = (status: string) => {
    setDefaultStatus(status)
    setEditingIssue(null)
    setIssueDialogOpen(true)
  }

  const handleDeleteClick = (issue: Issue) => {
    // Close any open detail dialog first to prevent stacked backdrops
    setIssueDetailDialogOpen(false)
    setSelectedIssue(null)
    setDeletingIssue(issue)
    setDeleteDialogOpen(true)
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
          <div className="@container/main flex flex-1 flex-col bg-dark-grey">
            {/* Page Header */}
            <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">Issues</h1>
                  <p className="text-sm text-white/60 mt-1">Track and fix issues preventing you from winning in AI search</p>
                </div>
                <div className="flex gap-2 items-center">
                {!canRunAnalysis && nextAnalysisTime && (
                  <CountdownBadge targetMs={nextAnalysisTime} />
                )}
                <Button
                  onClick={handleRunAnalysis}
                  disabled={!canRunAnalysis || isRunningAnalysis}
                  variant="outline"
                  className="border-white/10 text-white hover:bg-white/10"
                >
                  {isRunningAnalysis ? (
                    <IconLoader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <IconSparkles className="w-4 h-4 mr-2" />
                  )}
                  {isRunningAnalysis ? "Analyzing..." : "Run Analysis"}
                </Button>
                <Button
                  onClick={() => handleAddClick("identified")}
                  className="bg-white text-black hover:bg-white/90"
                >
                  <IconPlus className="w-4 h-4 mr-2" />
                  New Issue
                </Button>
              </div>
              </div>
            </div>

            {/* Divider Line - Full Width */}
            <div className="h-[0.5px] bg-white/10" />

            {/* Tabs Row */}
            <div className="px-4 lg:px-6 py-3.5 flex items-center justify-between">
              {/* Left side - Filter tags */}
              {viewMode === "issues" && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveTab("all")}
                    className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors ${
                      activeTab === "all"
                        ? "bg-white/[0.08] text-white"
                        : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
                    }`}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                      <circle cx="12" cy="12" r="10"/>
                    </svg>
                    All
                  </button>
                  <button
                    onClick={() => setActiveTab("active")}
                    className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors ${
                      activeTab === "active"
                        ? "bg-white/[0.08] text-white"
                        : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
                    }`}
                  >
                    <InProgressIcon className="w-3.5 h-3.5 opacity-70" />
                    Active
                  </button>
                  <button
                    onClick={() => setActiveTab("identified")}
                    className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors ${
                      activeTab === "identified"
                        ? "bg-white/[0.08] text-white"
                        : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
                    }`}
                  >
                    <IdentifiedIcon className="w-3.5 h-3.5 opacity-70" />
                    Backlog
                  </button>
                </div>
              )}

              {viewMode === "analysis" && <div />}

              {/* Right side - View Mode Selector */}
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  onClick={() => setViewMode("issues")}
                  className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors ${
                    viewMode === "issues"
                      ? "bg-white/[0.08] text-white"
                      : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
                  }`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  Issues
                </button>
                <button
                  onClick={() => setViewMode("analysis")}
                  className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors ${
                    viewMode === "analysis"
                      ? "bg-white/[0.08] text-white"
                      : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
                  }`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                    <line x1="18" y1="20" x2="18" y2="10"/>
                    <line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/>
                  </svg>
                  Analysis
                </button>
              </div>
            </div>

            {/* Divider Line - Full Width */}
            <div className="h-[0.5px] bg-white/10" />

            {/* Loading State */}
            {isLoading && viewMode === "issues" && (
              <div className="flex-1 flex items-center justify-center">
                <IconLoader2 className="w-6 h-6 text-white/40 animate-spin" />
              </div>
            )}

            {/* Kanban Board - Issues View */}
            {!isLoading && viewMode === "issues" && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="flex-1 overflow-x-auto">
                  <div className="px-4 lg:px-6 py-6">
                    <div className="flex gap-6 min-w-max">
                      <IssueColumnWithHandlers
                        title="Identified"
                        issues={identifiedIssues}
                        status="identified"
                        onAddClick={handleAddClick}
                        onDelete={handleDeleteClick}
                        onFix={handleDeployAgent}
                        onGenerateScript={handleGenerateScript}
                        onRetry={handleRetryAgent}
                        onViewOutput={handleViewOutput}
                        onIssueClick={handleIssueClick}
                        deployingId={deployingId}
                        generatingScriptId={generatingScriptId}
                      />
                      <IssueColumnWithHandlers
                        title="In Progress"
                        issues={inProgressIssues}
                        status="in_progress"
                        onAddClick={handleAddClick}
                        onDelete={handleDeleteClick}
                        onFix={handleDeployAgent}
                        onGenerateScript={handleGenerateScript}
                        onRetry={handleRetryAgent}
                        onViewOutput={handleViewOutput}
                        onIssueClick={handleIssueClick}
                        deployingId={deployingId}
                        generatingScriptId={generatingScriptId}
                      />
                      <IssueColumnWithHandlers
                        title="Completed"
                        issues={completedIssues}
                        status="completed"
                        onAddClick={handleAddClick}
                        onDelete={handleDeleteClick}
                        onFix={handleDeployAgent}
                        onGenerateScript={handleGenerateScript}
                        onRetry={handleRetryAgent}
                        onViewOutput={handleViewOutput}
                        onIssueClick={handleIssueClick}
                        deployingId={deployingId}
                        generatingScriptId={generatingScriptId}
                      />
                      <IssueColumnWithHandlers
                        title="Merged"
                        issues={mergedIssues}
                        status="merged"
                        onAddClick={handleAddClick}
                        onDelete={handleDeleteClick}
                        onFix={handleDeployAgent}
                        onGenerateScript={handleGenerateScript}
                        onRetry={handleRetryAgent}
                        onViewOutput={handleViewOutput}
                        onIssueClick={handleIssueClick}
                        deployingId={deployingId}
                        generatingScriptId={generatingScriptId}
                      />
                    </div>
                  </div>
                </div>
                <DragOverlay>
                  {activeIssue ? <IssueCardOverlay issue={activeIssue} /> : null}
                </DragOverlay>
              </DndContext>
            )}

            {/* Analysis View */}
            {viewMode === "analysis" && (
              <AnalysisView stats={stats} isLoading={isStatsLoading} />
            )}
          </div>
        </div>
      </SidebarInset>

      {/* Dialogs */}
      <IssueDialog
        open={issueDialogOpen}
        onOpenChange={setIssueDialogOpen}
        issue={editingIssue}
        defaultStatus={defaultStatus}
        onSave={handleSaveIssue}
        isLoading={isSaving}
      />
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) {
            // Clear the deleting issue when dialog is closed by any means
            setDeletingIssue(null)
          }
        }}
        issue={deletingIssue}
        onConfirm={handleDeleteIssue}
        isLoading={isSaving}
      />
      
      {/* Issue Detail Dialog - popup when clicking on an issue */}
      <IssueDetailDialog
        open={issueDetailDialogOpen}
        onOpenChange={setIssueDetailDialogOpen}
        issue={selectedIssue}
        onDeploy={handleDeployAgent}
        onGenerateScript={handleGenerateScript}
        onRetry={handleRetryAgent}
        onViewOutput={handleViewOutput}
        isDeploying={deployingId === selectedIssue?.id}
        isGeneratingScript={generatingScriptId === selectedIssue?.id}
      />

      {/* View Generated Output Dialog */}
      <Dialog open={outputDialogOpen} onOpenChange={setOutputDialogOpen}>
        <DialogContent className="bg-[#141414] border-white/[0.06] text-white w-[calc(100%-2rem)] max-w-2xl p-0 overflow-hidden flex flex-col max-h-[80vh]">
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <IconCode className="w-4 h-4 text-white/50" />
              <span className="text-[11px] text-white/50">Generated Output</span>
            </div>
            <DialogHeader className="p-0">
              <DialogTitle className="text-[15px] font-medium text-white/90 leading-snug">
                {viewingOutputIssue?.title}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Generated output for {viewingOutputIssue?.title}
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="flex-1 overflow-auto px-5 pb-5">
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyOutput}
                className="absolute top-2 right-2 text-white/40 hover:text-white/70 hover:bg-white/[0.05]"
              >
                {copiedOutput ? (
                  <IconCheck className="w-4 h-4 text-emerald-400" />
                ) : (
                  <IconCopy className="w-4 h-4" />
                )}
              </Button>
              <pre className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4 text-[13px] text-white overflow-auto max-h-[50vh] whitespace-pre-wrap break-words font-mono">
                {viewingOutputIssue?.generatedOutput || "No output available"}
              </pre>
            </div>
            
            {viewingOutputIssue?.outputType && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[11px] text-white/30">Type:</span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-white/[0.05] text-white/50">
                  {viewingOutputIssue.outputType}
                </span>
                {viewingOutputIssue.scriptSource === "llm" ? (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-violet-500/20 text-violet-300">
                    AI Generated
                  </span>
                ) : (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-white/[0.05] text-white/30">
                    Template
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="px-5 py-4 border-t border-white/[0.06] flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOutputDialogOpen(false)}
              className="text-white/50 hover:text-white/70 hover:bg-white/[0.05]"
            >
              Close
            </Button>
            {viewingOutputIssue && viewingOutputIssue.status === "identified" && viewingOutputIssue.agentType && (
              <Button
                size="sm"
                onClick={() => { handleDeployAgent(viewingOutputIssue.id); setOutputDialogOpen(false); }}
                disabled={deployingId === viewingOutputIssue.id}
                className="bg-white text-black hover:bg-white/90 font-medium"
              >
                {deployingId === viewingOutputIssue.id ? (
                  <>
                    <UnicodeExecutionSpinner className="mr-1.5 text-black/80" />
                    Deploying...
                  </>
                ) : (
                  "Deploy Agent"
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}

export default function IssuesPage() {
  return (
    <BrandProfileProvider>
      <React.Suspense fallback={
        <div className="flex h-screen items-center justify-center bg-black">
          <div className="flex flex-col items-center gap-4">
            <IconLoader2 className="h-8 w-8 animate-spin text-white/40" />
            <p className="text-sm text-white/60">Loading issues...</p>
          </div>
        </div>
      }>
        <IssuesPageInner />
      </React.Suspense>
    </BrandProfileProvider>
  )
}
