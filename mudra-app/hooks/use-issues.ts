/**
 * useIssues Hook
 * 
 * React hook for managing issues state and operations
 */

import { useState, useEffect, useCallback } from 'react'
import { useBrandProfile } from '@/components/brand-profile-context'

export type IssueStatus = 'identified' | 'in_progress' | 'completed' | 'failed' | 'dismissed'
export type IssueCategory = 'technical_structure' | 'ai_visibility'
export type IssuePriority = 'high' | 'medium' | 'low'

export interface Issue {
  id: number
  title: string
  description: string | null
  status: IssueStatus
  priority: IssuePriority
  category: IssueCategory | null
  discoveryTier: string | null
  agentType: string | null
  order: number
  prUrl: string | null
  prNumber: number | null
  prStatus: string | null
  usedE2bSandbox: boolean
  e2bSandboxId: string | null
  e2bExecutionMs: number | null
  e2bValidationResult: string | null
  dismissedAt: Date | null
  createdAt: Date
  updatedAt: Date
  brandProfileId: number
}

export interface GroupedIssues {
  identified: Issue[]
  in_progress: Issue[]
  completed: Issue[]
  failed: Issue[]
  dismissed: Issue[]
}

export interface IssuesCounts {
  total: number
  byStatus: Record<IssueStatus, number>
  byCategory: Record<string, number>
  byPriority: Record<string, number>
}

interface UseIssuesResult {
  issues: Issue[]
  grouped: GroupedIssues | null
  counts: IssuesCounts | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  discoverIssues: () => Promise<void>
  updateIssue: (id: number, updates: Partial<Issue>) => Promise<void>
  deployAgent: (id: number) => Promise<DeployResult>
  retryAgent: (id: number) => Promise<DeployResult>
  dismissIssue: (id: number) => Promise<void>
  deleteIssue: (id: number) => Promise<void>
}

interface DeployResult {
  success: boolean
  prUrl?: string
  prNumber?: number
  error?: string
}

export function useIssues(): UseIssuesResult {
  const { brandProfile } = useBrandProfile()
  const [issues, setIssues] = useState<Issue[]>([])
  const [grouped, setGrouped] = useState<GroupedIssues | null>(null)
  const [counts, setCounts] = useState<IssuesCounts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!brandProfile?.id) {
      setIssues([])
      setGrouped(null)
      setCounts(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/issues?brandProfileId=${brandProfile.id}`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch issues')
      }

      setIssues(data.data.issues)
      setGrouped(data.data.grouped)
      setCounts(data.data.counts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch issues')
    } finally {
      setLoading(false)
    }
  }, [brandProfile?.id])

  useEffect(() => {
    refresh()
  }, [refresh])

  const discoverIssues = useCallback(async () => {
    if (!brandProfile?.id) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'discover',
          brandProfileId: brandProfile.id
        })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to discover issues')
      }

      // Refresh to get updated issues
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover issues')
    } finally {
      setLoading(false)
    }
  }, [brandProfile?.id, refresh])

  const updateIssue = useCallback(async (id: number, updates: Partial<Issue>) => {
    try {
      const response = await fetch(`/api/issues/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to update issue')
      }

      // Update local state optimistically
      setIssues(prev => prev.map(issue => 
        issue.id === id ? { ...issue, ...updates } : issue
      ))

      // Also update grouped state
      if (grouped && updates.status) {
        const issue = issues.find(i => i.id === id)
        if (issue) {
          const oldStatus = issue.status
          const newStatus = updates.status as IssueStatus
          setGrouped(prev => {
            if (!prev) return prev
            const updated = { ...prev }
            updated[oldStatus] = updated[oldStatus].filter(i => i.id !== id)
            updated[newStatus] = [...updated[newStatus], { ...issue, ...updates }]
            return updated
          })
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update issue')
      throw err
    }
  }, [grouped, issues])

  const deployAgent = useCallback(async (id: number): Promise<DeployResult> => {
    try {
      // Update status to in_progress locally
      await updateIssue(id, { status: 'in_progress' as IssueStatus })

      const response = await fetch(`/api/issues/${id}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (!data.success) {
        await updateIssue(id, { status: 'failed' as IssueStatus })
        return { success: false, error: data.error?.message || 'Deployment failed' }
      }

      // Update with result
      await updateIssue(id, {
        status: 'completed' as IssueStatus,
        prUrl: data.data.prUrl,
        prNumber: data.data.prNumber
      })

      return {
        success: true,
        prUrl: data.data.prUrl,
        prNumber: data.data.prNumber
      }
    } catch (err) {
      await updateIssue(id, { status: 'failed' as IssueStatus })
      return { success: false, error: err instanceof Error ? err.message : 'Deployment failed' }
    }
  }, [updateIssue])

  const retryAgent = useCallback(async (id: number): Promise<DeployResult> => {
    try {
      // Update status to in_progress locally
      await updateIssue(id, { status: 'in_progress' as IssueStatus })

      const response = await fetch(`/api/issues/${id}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (!data.success) {
        await updateIssue(id, { status: 'failed' as IssueStatus })
        return { success: false, error: data.error?.message || 'Retry failed' }
      }

      await updateIssue(id, {
        status: 'completed' as IssueStatus,
        prUrl: data.data.prUrl,
        prNumber: data.data.prNumber
      })

      return {
        success: true,
        prUrl: data.data.prUrl,
        prNumber: data.data.prNumber
      }
    } catch (err) {
      await updateIssue(id, { status: 'failed' as IssueStatus })
      return { success: false, error: err instanceof Error ? err.message : 'Retry failed' }
    }
  }, [updateIssue])

  const dismissIssue = useCallback(async (id: number) => {
    await updateIssue(id, { 
      status: 'dismissed' as IssueStatus,
      dismissedAt: new Date()
    })
  }, [updateIssue])

  const deleteIssue = useCallback(async (id: number) => {
    try {
      const response = await fetch(`/api/issues/${id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to delete issue')
      }

      // Remove from local state
      setIssues(prev => prev.filter(issue => issue.id !== id))
      if (grouped) {
        setGrouped(prev => {
          if (!prev) return prev
          const updated = { ...prev }
          for (const status of Object.keys(updated) as IssueStatus[]) {
            updated[status] = updated[status].filter(i => i.id !== id)
          }
          return updated
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete issue')
      throw err
    }
  }, [grouped])

  return {
    issues,
    grouped,
    counts,
    loading,
    error,
    refresh,
    discoverIssues,
    updateIssue,
    deployAgent,
    retryAgent,
    dismissIssue,
    deleteIssue
  }
}
