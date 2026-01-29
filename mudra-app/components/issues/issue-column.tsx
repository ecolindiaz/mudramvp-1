"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { IssueCard } from "./issue-card"
import type { Issue, IssueStatus } from "@/hooks/use-issues"
import {
  Clock,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react"

interface IssueColumnProps {
  status: IssueStatus
  issues: Issue[]
  onDeploy: (id: number) => void
  onRetry: (id: number) => void
  onDismiss: (id: number) => void
  onDelete: (id: number) => void
  onIssueClick?: (issue: Issue) => void
  deployingId?: number | null
}

const statusConfig: Record<IssueStatus, { 
  label: string
  icon: React.ReactNode
  color: string
  bgColor: string
}> = {
  identified: {
    label: "Identified",
    icon: <Clock className="h-4 w-4" />,
    color: "text-gray-400",
    bgColor: "bg-gray-500/10",
  },
  in_progress: {
    label: "In Progress",
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  completed: {
    label: "Completed",
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: "text-green-400",
    bgColor: "bg-green-500/10",
  },
  failed: {
    label: "Failed",
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
  },
  dismissed: {
    label: "Dismissed",
    icon: <XCircle className="h-4 w-4" />,
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
  },
}

export function IssueColumn({
  status,
  issues,
  onDeploy,
  onRetry,
  onDismiss,
  onDelete,
  onIssueClick,
  deployingId,
}: IssueColumnProps) {
  const config = statusConfig[status]

  return (
    <div className="flex flex-col h-full min-w-[280px] max-w-[320px]">
      {/* Column Header */}
      <div className={cn(
        "flex items-center gap-2 p-3 rounded-t-lg border-b",
        config.bgColor
      )}>
        <span className={config.color}>{config.icon}</span>
        <h3 className={cn("font-medium text-sm", config.color)}>
          {config.label}
        </h3>
        <span className={cn(
          "ml-auto text-xs font-medium px-2 py-0.5 rounded-full",
          config.bgColor,
          config.color
        )}>
          {issues.length}
        </span>
      </div>

      {/* Column Content */}
      <ScrollArea className="flex-1 p-2 bg-muted/30 rounded-b-lg">
        <div className="space-y-2">
          {issues.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No issues
            </div>
          ) : (
            issues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onDeploy={onDeploy}
                onRetry={onRetry}
                onDismiss={onDismiss}
                onDelete={onDelete}
                onClick={onIssueClick}
                isDeploying={deployingId === issue.id}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
