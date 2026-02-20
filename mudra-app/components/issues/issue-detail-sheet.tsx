"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { Issue, IssueCategory, IssuePriority } from "@/hooks/use-issues"
import {
  Play,
  RotateCcw,
  ExternalLink,
  XCircle,
  Bot,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  GitPullRequest,
  Cpu,
  Timer,
} from "lucide-react"

interface IssueDetailSheetProps {
  issue: Issue | null
  onClose: () => void
  onDeploy: (id: number) => void
  onRetry: (id: number) => void
  onDismiss: (id: number) => void
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
}

export function IssueDetailSheet({
  issue,
  onClose,
  onDeploy,
  onRetry,
  onDismiss,
  isDeploying = false,
}: IssueDetailSheetProps) {
  if (!issue) return null

  const canDeploy = issue.status === 'identified' && issue.agentType
  const canRetry = issue.status === 'failed'
  const hasPR = issue.prUrl && issue.prNumber

  return (
    <Sheet open={!!issue} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start gap-3">
            <StatusIcon status={issue.status} />
            <div>
              <SheetTitle className="text-left">{issue.title}</SheetTitle>
              <p className="text-sm text-muted-foreground capitalize mt-1">
                {issue.status.replace('_', ' ')}
              </p>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Description */}
          {issue.description && (
            <div>
              <h4 className="text-sm font-medium mb-2">Description</h4>
              <p className="text-sm text-muted-foreground">{issue.description}</p>
            </div>
          )}

          {/* Metadata */}
          <div>
            <h4 className="text-sm font-medium mb-3">Details</h4>
            <div className="flex flex-wrap gap-2">
              <Badge 
                variant="outline" 
                className={cn("text-xs", priorityColors[issue.priority])}
              >
                {issue.priority} priority
              </Badge>
              
              {issue.category && (
                <Badge variant="outline" className="text-xs">
                  {categoryLabels[issue.category]}
                </Badge>
              )}
              
              {issue.discoveryTier && (
                <Badge variant="outline" className="text-xs">
                  Tier: {issue.discoveryTier}
                </Badge>
              )}
              
              {issue.agentType && (
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                  <Bot className="mr-1 h-3 w-3" />
                  {issue.agentType}
                </Badge>
              )}
            </div>
          </div>

          <Separator />

          {/* E2B Sandbox Info */}
          {issue.usedE2bSandbox && (
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Cpu className="h-4 w-4" />
                E2B Sandbox Validation
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/50 rounded-md p-3">
                  <p className="text-muted-foreground text-xs mb-1">Sandbox ID</p>
                  <p className="font-mono text-xs truncate">{issue.e2bSandboxId}</p>
                </div>
                <div className="bg-muted/50 rounded-md p-3">
                  <p className="text-muted-foreground text-xs mb-1">Execution Time</p>
                  <p className="flex items-center gap-1">
                    <Timer className="h-3 w-3" />
                    {issue.e2bExecutionMs}ms
                  </p>
                </div>
              </div>
              {issue.e2bValidationResult && (
                <div className="mt-2 bg-muted/50 rounded-md p-3">
                  <p className="text-muted-foreground text-xs mb-1">Validation Result</p>
                  <pre className="text-xs overflow-x-auto">
                    {JSON.stringify(JSON.parse(issue.e2bValidationResult), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* PR Info */}
          {hasPR && (
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <GitPullRequest className="h-4 w-4" />
                Pull Request
              </h4>
              <div className="bg-muted/50 rounded-md p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">PR #{issue.prNumber}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      Status: {issue.prStatus || 'open'}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={issue.prUrl!} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="space-y-2">
            {canDeploy && (
              <Button
                className="w-full"
                onClick={() => onDeploy(issue.id)}
                disabled={isDeploying}
              >
                {isDeploying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deploying Agent...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Deploy Agent
                  </>
                )}
              </Button>
            )}

            {canRetry && (
              <Button
                variant="outline"
                className="w-full border-red-500/20 text-red-400 hover:bg-red-500/10"
                onClick={() => onRetry(issue.id)}
                disabled={isDeploying}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Retry Execution
              </Button>
            )}

            {issue.status !== 'dismissed' && issue.status !== 'completed' && (
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => onDismiss(issue.id)}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Dismiss Issue
              </Button>
            )}
          </div>

          {/* Timestamps */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Created: {new Date(issue.createdAt).toLocaleString()}</p>
            <p>Updated: {new Date(issue.updatedAt).toLocaleString()}</p>
            {issue.dismissedAt && (
              <p>Dismissed: {new Date(issue.dismissedAt).toLocaleString()}</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function StatusIcon({ status }: { status: Issue['status'] }) {
  const iconClass = "h-5 w-5"
  
  switch (status) {
    case 'identified':
      return <Clock className={cn(iconClass, "text-gray-400")} />
    case 'in_progress':
      return <Loader2 className={cn(iconClass, "text-blue-400 animate-spin")} />
    case 'completed':
      return <CheckCircle2 className={cn(iconClass, "text-green-400")} />
    case 'failed':
      return <AlertTriangle className={cn(iconClass, "text-red-400")} />
    case 'dismissed':
      return <XCircle className={cn(iconClass, "text-gray-500")} />
  }
}
