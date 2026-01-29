"use client"

import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { BrandProfileProvider } from "@/components/brand-profile-context"
import { IconPlus, IconTrash, IconEdit, IconLoader2, IconSparkles, IconPlayerPlay, IconRotate, IconExternalLink, IconRobot, IconGitPullRequest } from "@tabler/icons-react"
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

// Custom status icons
const IdentifiedIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M10.1 2.182a10 10 0 0 1 3.8 0"/>
    <path d="M13.9 21.818a10 10 0 0 1-3.8 0"/>
    <path d="M17.609 3.721a10 10 0 0 1 2.69 2.7"/>
    <path d="M2.182 13.9a10 10 0 0 1 0-3.8"/>
    <path d="M20.279 17.609a10 10 0 0 1-2.7 2.69"/>
    <path d="M21.818 10.1a10 10 0 0 1 0 3.8"/>
    <path d="M3.721 6.391a10 10 0 0 1 2.7-2.69"/>
    <path d="M6.391 20.279a10 10 0 0 1-2.69-2.7"/>
  </svg>
)

const InProgressIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="19" r="2"/>
    <circle cx="12" cy="5" r="2"/>
    <circle cx="16" cy="12" r="2"/>
    <circle cx="20" cy="19" r="2"/>
    <circle cx="4" cy="19" r="2"/>
    <circle cx="8" cy="12" r="2"/>
  </svg>
)

const CompletedIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21.801 10A10 10 0 1 1 17 3.335"/>
    <path d="m9 11 3 3L22 4"/>
  </svg>
)

const MergedIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="18" cy="18" r="3"/>
    <circle cx="6" cy="6" r="3"/>
    <path d="M6 21V9a9 9 0 0 0 9 9"/>
  </svg>
)

const FailedIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>
    <path d="M12 9v4"/>
    <path d="M12 17h.01"/>
  </svg>
)

const DismissedIcon = ({ className }: { className?: string }) => (
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
  type: "bug" | "improvement" | "feature"
  status: "identified" | "in_progress" | "completed" | "merged" | "failed" | "dismissed"
  priority: "low" | "medium" | "high" | "critical"
  order: number
  createdAt: string
  updatedAt: string
  agentType?: string | null
  prUrl?: string | null
  prNumber?: number | null
}

interface IssueStats {
  total: number
  byStatus: {
    identified: number
    in_progress: number
    completed: number
    merged: number
  }
  byType: {
    bug: number
    improvement: number
    feature: number
  }
  byPriority: {
    low: number
    medium: number
    high: number
    critical: number
  }
  recentIssues: number
  completedThisWeek: number
}

const typeConfig = {
  bug: { color: "bg-red-500", label: "Bug" },
  improvement: { color: "bg-blue-500", label: "Improvement" },
  feature: { color: "bg-purple-500", label: "Feature" },
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
  low: { color: "text-white/40", bg: "bg-white/5" },
  medium: { color: "text-amber-400", bg: "bg-amber-400/10" },
  high: { color: "text-orange-400", bg: "bg-orange-400/10" },
  critical: { color: "text-red-400", bg: "bg-red-400/10" },
}

// Sortable Issue Card Component
function SortableIssueCard({
  issue,
  onEdit,
  onDelete,
  onDeploy,
  onRetry,
  isDeploying,
}: {
  issue: Issue
  onEdit: (issue: Issue) => void
  onDelete: (issue: Issue) => void
  onDeploy?: (issueId: number) => void
  onRetry?: (issueId: number) => void
  isDeploying?: boolean
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

  const typeConf = typeConfig[issue.type]
  const statusConf = statusConfig[issue.status]
  const StatusIcon = statusConf.icon

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all cursor-grab active:cursor-grabbing group"
    >
      <div className="flex items-start gap-3 mb-3">
        <StatusIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${statusConf.color}`} />
        <p className="text-[13px] text-white/90 font-medium leading-relaxed flex-1">
          {issue.title}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className="p-1 hover:bg-white/[0.1] rounded opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/50">
                <circle cx="12" cy="12" r="1"/>
                <circle cx="12" cy="5" r="1"/>
                <circle cx="12" cy="19" r="1"/>
              </svg>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[#1a1a1a] border-white/10">
            {/* Deploy Agent - for identified issues with agentType */}
            {issue.status === "identified" && (issue as unknown as { agentType?: string }).agentType && onDeploy && (
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onDeploy(issue.id); }}
                className="text-emerald-400 hover:bg-emerald-400/10 cursor-pointer"
                disabled={isDeploying}
              >
                {isDeploying ? (
                  <IconLoader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <IconPlayerPlay className="w-4 h-4 mr-2" />
                )}
                Deploy Agent
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
              onClick={(e) => { e.stopPropagation(); onEdit(issue); }}
              className="text-white/80 hover:bg-white/10 cursor-pointer"
            >
              <IconEdit className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onDelete(issue); }}
              className="text-red-400 hover:bg-red-400/10 cursor-pointer"
            >
              <IconTrash className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center justify-between pl-7">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.05]">
            <span className={`w-1.5 h-1.5 rounded-full ${typeConf.color}`} />
            <span className="text-[11px] text-white/50">{typeConf.label}</span>
          </span>
          {issue.priority !== "medium" && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${priorityConfig[issue.priority].bg} ${priorityConfig[issue.priority].color}`}>
              {issue.priority}
            </span>
          )}
        </div>
        <span className="text-[11px] text-white/30 group-hover:text-white/50 transition-colors">
          ISS-{String(issue.id).padStart(2, "0")}
        </span>
      </div>
    </div>
  )
}

// Static Issue Card for Drag Overlay
function IssueCardOverlay({ issue }: { issue: Issue }) {
  const typeConf = typeConfig[issue.type]
  const statusConf = statusConfig[issue.status]
  const StatusIcon = statusConf.icon

  return (
    <div className="bg-white/[0.08] border border-white/[0.15] rounded-xl p-3.5 shadow-xl cursor-grabbing w-[260px]">
      <div className="flex items-start gap-3 mb-3">
        <StatusIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${statusConf.color}`} />
        <p className="text-[13px] text-white/90 font-medium leading-relaxed">
          {issue.title}
        </p>
      </div>
      <div className="flex items-center justify-between pl-7">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.05]">
          <span className={`w-1.5 h-1.5 rounded-full ${typeConf.color}`} />
          <span className="text-[11px] text-white/50">{typeConf.label}</span>
        </span>
        <span className="text-[11px] text-white/30">
          ISS-{String(issue.id).padStart(2, "0")}
        </span>
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
          <div className="text-[11px] text-white/50 uppercase tracking-wider mb-1">Bug Count</div>
          <div className="text-2xl font-bold text-red-400">{stats.byType.bug}</div>
          <div className="text-[12px] text-white/40 mt-1">
            {stats.byPriority.critical + stats.byPriority.high} high priority
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

        {/* By Type */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-medium text-white/80 mb-4">Issues by Type</h3>
          <div className="space-y-3">
            {Object.entries(stats.byType).map(([type, count]) => {
              const conf = typeConfig[type as keyof typeof typeConfig]
              const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0
              return (
                <div key={type} className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${conf.color}`} />
                  <span className="text-[13px] text-white/70 capitalize w-24">{conf.label}</span>
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
  const [type, setType] = React.useState<Issue["type"]>("bug")
  const [status, setStatus] = React.useState<Issue["status"]>("identified")
  const [priority, setPriority] = React.useState<Issue["priority"]>("medium")

  React.useEffect(() => {
    if (issue) {
      setTitle(issue.title)
      setDescription(issue.description || "")
      setType(issue.type)
      setStatus(issue.status)
      setPriority(issue.priority)
    } else {
      setTitle("")
      setDescription("")
      setType("bug")
      setStatus(defaultStatus as Issue["status"] || "identified")
      setPriority("medium")
    }
  }, [issue, defaultStatus, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ title, description: description || null, type, status, priority })
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
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-white/70">Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as Issue["type"])}>
                  <SelectTrigger className="bg-white/[0.05] border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    <SelectItem value="bug" className="text-white hover:bg-white/10">Bug</SelectItem>
                    <SelectItem value="improvement" className="text-white hover:bg-white/10">Improvement</SelectItem>
                    <SelectItem value="feature" className="text-white hover:bg-white/10">Feature</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                    <SelectItem value="critical" className="text-white hover:bg-white/10">Critical</SelectItem>
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

// Column with handlers
function IssueColumnWithHandlers({
  title,
  issues,
  status,
  onAddClick,
  onEdit,
  onDelete,
  onDeploy,
  onRetry,
  deployingId,
}: {
  title: string
  issues: Issue[]
  status: "identified" | "in_progress" | "completed" | "merged"
  onAddClick: (status: string) => void
  onEdit: (issue: Issue) => void
  onDelete: (issue: Issue) => void
  onDeploy?: (issueId: number) => void
  onRetry?: (issueId: number) => void
  deployingId?: number | null
}) {
  const config = statusConfig[status]
  const StatusIcon = config.icon

  return (
    <div className="flex-1 min-w-[260px] max-w-[300px]">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg ${config.bg}`}>
            <StatusIcon className={`w-3.5 h-3.5 ${config.color}`} />
          </div>
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
              onEdit={onEdit} 
              onDelete={onDelete}
              onDeploy={onDeploy}
              onRetry={onRetry}
              isDeploying={deployingId === issue.id}
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
  const [editingIssue, setEditingIssue] = React.useState<Issue | null>(null)
  const [deletingIssue, setDeletingIssue] = React.useState<Issue | null>(null)
  const [defaultStatus, setDefaultStatus] = React.useState<string>("identified")
  
  // Drag state
  const [activeId, setActiveId] = React.useState<number | null>(null)
  
  // Agent deployment state
  const [isDiscovering, setIsDiscovering] = React.useState(false)
  const [deployingId, setDeployingId] = React.useState<number | null>(null)

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
      const response = await fetch("/api/issues")
      const data = await response.json()
      if (data.success) {
        // API returns { issues, grouped, counts } - extract the issues array
        setIssues(data.data.issues || data.data)
      }
    } catch (error) {
      console.error("Failed to fetch issues:", error)
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

  React.useEffect(() => {
    if (viewMode === "analysis") {
      fetchStats()
    }
  }, [viewMode, fetchStats])

  // Discover new issues using AI
  const handleDiscoverIssues = async () => {
    setIsDiscovering(true)
    try {
      const response = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "discover" }),
      })
      const result = await response.json()
      if (result.success) {
        toast.success("Issues discovered", {
          description: `Found ${result.data.discovered?.length || 0} new issues`,
        })
        await fetchIssues()
      } else {
        toast.error("Discovery failed", { description: result.error?.message })
      }
    } catch (error) {
      console.error("Failed to discover issues:", error)
      toast.error("Discovery failed")
    } finally {
      setIsDiscovering(false)
    }
  }

  // Deploy agent for an issue
  const handleDeployAgent = async (issueId: number) => {
    setDeployingId(issueId)
    try {
      const response = await fetch(`/api/issues/${issueId}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const result = await response.json()
      if (result.success) {
        toast.success("Agent deployed", {
          description: result.data.prUrl ? `PR #${result.data.prNumber} created` : "Issue resolved",
        })
        await fetchIssues()
      } else {
        toast.error("Deployment failed", { description: result.error?.message })
      }
    } catch (error) {
      console.error("Failed to deploy agent:", error)
      toast.error("Deployment failed")
    } finally {
      setDeployingId(null)
    }
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
    setIsSaving(true)
    try {
      const response = await fetch(`/api/issues/${deletingIssue.id}`, {
        method: "DELETE",
      })
      const result = await response.json()
      if (result.success) {
        await fetchIssues()
        setDeleteDialogOpen(false)
        setDeletingIssue(null)
      }
    } catch (error) {
      console.error("Failed to delete issue:", error)
    } finally {
      setIsSaving(false)
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

  const handleEditClick = (issue: Issue) => {
    setEditingIssue(issue)
    setIssueDialogOpen(true)
  }

  const handleDeleteClick = (issue: Issue) => {
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
                  <p className="text-sm text-white/60 mt-1">Track and manage issues across your brand</p>
                </div>
                <div className="flex gap-2">
                <Button
                  onClick={handleDiscoverIssues}
                  disabled={isDiscovering}
                  variant="outline"
                  className="border-white/10 text-white hover:bg-white/10"
                >
                  {isDiscovering ? (
                    <IconLoader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <IconSparkles className="w-4 h-4 mr-2" />
                  )}
                  {isDiscovering ? "Discovering..." : "Discover Issues"}
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
                        onEdit={handleEditClick}
                        onDelete={handleDeleteClick}
                        onDeploy={handleDeployAgent}
                        onRetry={handleRetryAgent}
                        deployingId={deployingId}
                      />
                      <IssueColumnWithHandlers
                        title="In Progress"
                        issues={inProgressIssues}
                        status="in_progress"
                        onAddClick={handleAddClick}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteClick}
                        onDeploy={handleDeployAgent}
                        onRetry={handleRetryAgent}
                        deployingId={deployingId}
                      />
                      <IssueColumnWithHandlers
                        title="Completed"
                        issues={completedIssues}
                        status="completed"
                        onAddClick={handleAddClick}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteClick}
                        onDeploy={handleDeployAgent}
                        onRetry={handleRetryAgent}
                        deployingId={deployingId}
                      />
                      <IssueColumnWithHandlers
                        title="Merged"
                        issues={mergedIssues}
                        status="merged"
                        onAddClick={handleAddClick}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteClick}
                        onDeploy={handleDeployAgent}
                        onRetry={handleRetryAgent}
                        deployingId={deployingId}
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
        onOpenChange={setDeleteDialogOpen}
        issue={deletingIssue}
        onConfirm={handleDeleteIssue}
        isLoading={isSaving}
      />
    </SidebarProvider>
  )
}

export default function IssuesPage() {
  return (
    <BrandProfileProvider>
      <IssuesPageInner />
    </BrandProfileProvider>
  )
}
