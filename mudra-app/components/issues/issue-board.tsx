"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { IssueColumn } from "./issue-column"
import { IssueDetailSheet } from "./issue-detail-sheet"
import { useIssues, type Issue, type IssueStatus } from "@/hooks/use-issues"
import {
  RefreshCw,
  Sparkles,
  AlertCircle,
} from "lucide-react"

const COLUMN_ORDER: IssueStatus[] = ['identified', 'in_progress', 'completed', 'failed', 'dismissed']

export function IssueBoard() {
  const {
    grouped,
    counts,
    loading,
    error,
    refresh,
    discoverIssues,
    deployAgent,
    retryAgent,
    dismissIssue,
    deleteIssue,
  } = useIssues()

  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [deployingId, setDeployingId] = useState<number | null>(null)
  const [isDiscovering, setIsDiscovering] = useState(false)

  const handleDeploy = async (id: number) => {
    setDeployingId(id)
    try {
      const result = await deployAgent(id)
      if (result.success) {
        toast.success("Agent deployed successfully", {
          description: result.prUrl ? `PR #${result.prNumber} created` : "Issue resolved",
        })
      } else {
        toast.error("Deployment failed", {
          description: result.error,
        })
      }
    } catch {
      toast.error("Deployment failed")
    } finally {
      setDeployingId(null)
    }
  }

  const handleRetry = async (id: number) => {
    setDeployingId(id)
    try {
      const result = await retryAgent(id)
      if (result.success) {
        toast.success("Retry successful", {
          description: result.prUrl ? `PR #${result.prNumber} created` : "Issue resolved",
        })
      } else {
        toast.error("Retry failed", {
          description: result.error,
        })
      }
    } catch {
      toast.error("Retry failed")
    } finally {
      setDeployingId(null)
    }
  }

  const handleDismiss = async (id: number) => {
    try {
      await dismissIssue(id)
      toast.success("Issue dismissed")
    } catch {
      toast.error("Failed to dismiss issue")
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteIssue(id)
      toast.success("Issue deleted")
    } catch {
      toast.error("Failed to delete issue")
    }
  }

  const handleDiscover = async () => {
    setIsDiscovering(true)
    try {
      await discoverIssues()
      toast.success("Issues discovered", {
        description: "New issues have been added to the board",
      })
    } catch {
      toast.error("Discovery failed")
    } finally {
      setIsDiscovering(false)
    }
  }

  if (loading && !grouped) {
    return <IssuesBoardSkeleton />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={refresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Issues</h2>
          {counts && (
            <p className="text-sm text-muted-foreground">
              {counts.total} total issues
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={handleDiscover} disabled={isDiscovering}>
            <Sparkles className={`mr-2 h-4 w-4 ${isDiscovering ? 'animate-pulse' : ''}`} />
            {isDiscovering ? 'Discovering...' : 'Discover Issues'}
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <ScrollArea className="flex-1 pb-4">
        <div className="flex gap-4 h-[calc(100vh-280px)] min-h-[500px]">
          {COLUMN_ORDER.map((status) => (
            <IssueColumn
              key={status}
              status={status}
              issues={grouped?.[status] || []}
              onDeploy={handleDeploy}
              onRetry={handleRetry}
              onDismiss={handleDismiss}
              onDelete={handleDelete}
              onIssueClick={setSelectedIssue}
              deployingId={deployingId}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Issue Detail Sheet */}
      <IssueDetailSheet
        issue={selectedIssue}
        onClose={() => setSelectedIssue(null)}
        onDeploy={handleDeploy}
        onRetry={handleRetry}
        onDismiss={handleDismiss}
        isDeploying={deployingId === selectedIssue?.id}
      />
    </div>
  )
}

function IssuesBoardSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <Skeleton className="h-7 w-32 mb-2" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>
      <div className="flex gap-4 h-[500px]">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex flex-col min-w-[280px]">
            <Skeleton className="h-12 rounded-t-lg" />
            <div className="flex-1 space-y-2 p-2 bg-muted/30 rounded-b-lg">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
