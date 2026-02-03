"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
  MoreHorizontal,
  Play,
  RotateCcw,
  ExternalLink,
  XCircle,
  Trash2,
  Bot,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  GitPullRequest,
} from "lucide-react"
import type { Issue, IssueStatus, IssuePriority, IssueCategory } from "@/hooks/use-issues"

interface IssueCardProps {
  issue: Issue
  onDeploy: (id: number) => void
  onRetry: (id: number) => void
  onDismiss: (id: number) => void
  onDelete: (id: number) => void
  onClick?: (issue: Issue) => void
  isDeploying?: boolean
}

const priorityColors: Record<IssuePriority, string> = {
  high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  low: "bg-gray-500/10 text-gray-400 border-gray-500/20",
}

const categoryLabels: Record<IssueCategory, string> = {
  technical_structure: "Technical",
  ai_visibility: "AI Visibility",
  conversation: "Conversation",
}

const categoryColors: Record<IssueCategory, string> = {
  technical_structure: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  ai_visibility: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  conversation: "bg-green-500/10 text-green-400 border-green-500/20",
}

const statusIcons: Record<IssueStatus, React.ReactNode> = {
  identified: <Clock className="h-4 w-4 text-gray-400" />,
  in_progress: <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-400" />,
  failed: <AlertTriangle className="h-4 w-4 text-red-400" />,
  dismissed: <XCircle className="h-4 w-4 text-gray-500" />,
}

export function IssueCard({
  issue,
  onDeploy,
  onRetry,
  onDismiss,
  onDelete,
  onClick,
  isDeploying = false,
}: IssueCardProps) {
  const canDeploy = issue.status === 'identified' && issue.agentType
  const canRetry = issue.status === 'failed'
  const hasPR = issue.prUrl && issue.prNumber

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:border-primary/50 hover:shadow-md",
        issue.status === 'dismissed' && "opacity-60"
      )}
      onClick={() => onClick?.(issue)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {statusIcons[issue.status]}
            <CardTitle className="text-sm font-medium line-clamp-2">
              {issue.title}
            </CardTitle>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canDeploy && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDeploy(issue.id) }}>
                  <Play className="mr-2 h-4 w-4" />
                  Deploy Agent
                </DropdownMenuItem>
              )}
              {canRetry && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRetry(issue.id) }}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Retry
                </DropdownMenuItem>
              )}
              {hasPR && (
                <DropdownMenuItem asChild>
                  <a href={issue.prUrl!} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View PR
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {issue.status !== 'dismissed' && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDismiss(issue.id) }}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Dismiss
                </DropdownMenuItem>
              )}
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onDelete(issue.id) }}
                className="text-red-500 focus:text-red-500"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {issue.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {issue.description}
          </p>
        )}
        
        <div className="flex flex-wrap gap-1.5">
          <Badge 
            variant="outline" 
            className={cn("text-[10px] px-1.5 py-0", priorityColors[issue.priority])}
          >
            {issue.priority}
          </Badge>
          
          {issue.category && (
            <Badge 
              variant="outline" 
              className={cn("text-[10px] px-1.5 py-0", categoryColors[issue.category])}
            >
              {categoryLabels[issue.category]}
            </Badge>
          )}
          
          {issue.agentType && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
              <Bot className="mr-1 h-3 w-3" />
              Agent
            </Badge>
          )}
        </div>

        {/* Show deploy button for identified issues */}
        {canDeploy && (
          <Button
            size="sm"
            className="w-full h-7 text-xs"
            onClick={(e) => { e.stopPropagation(); onDeploy(issue.id) }}
            disabled={isDeploying}
          >
            {isDeploying ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <Play className="mr-1 h-3 w-3" />
                Deploy Agent
              </>
            )}
          </Button>
        )}

        {/* Show retry button for failed issues */}
        {canRetry && (
          <Button
            size="sm"
            variant="outline"
            className="w-full h-7 text-xs border-red-500/20 text-red-400 hover:bg-red-500/10"
            onClick={(e) => { e.stopPropagation(); onRetry(issue.id) }}
            disabled={isDeploying}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Retry
          </Button>
        )}

        {/* Show PR link for completed issues */}
        {hasPR && (
          <Button
            size="sm"
            variant="outline"
            className="w-full h-7 text-xs border-green-500/20 text-green-400 hover:bg-green-500/10"
            asChild
          >
            <a href={issue.prUrl!} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              <GitPullRequest className="mr-1 h-3 w-3" />
              PR #{issue.prNumber}
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
