'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

export interface DashboardData {
  metrics: {
    timeframe: string
    summary: {
      totalAnalyses: number
      totalMessages: number
      totalConversations: number
      totalCreditsUsed: number
      avgVisibilityScore: number
    }
    visibilityTrend: Array<{
      date: string
      companyName: string
      visibilityScore: number
      shareOfVoice: number
      averagePosition: number
      competitorCount: number
    }>
    competitorInsights: Array<{
      name: string
      appearances: number
      avgVisibilityScore: number
    }>
    providerPerformance: Array<{
      name: string
      totalQueries: number
      avgPosition: number
    }>
    recentActivity: any[]
  }
  analyses?: any[]
}

export function useDashboardData(timeframe: '7d' | '30d' | '90d' = '30d', includeAnalyses = false) {
  const { data: session } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboardData = async () => {
    if (!session?.user) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(
        `/api/dashboard-data?timeframe=${timeframe}&includeAnalyses=${includeAnalyses}`
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        throw new Error(result.error?.message || 'Failed to fetch dashboard data')
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [session, timeframe, includeAnalyses])

  const refetch = () => {
    fetchDashboardData()
  }

  return {
    data,
    loading,
    error,
    refetch
  }
}
