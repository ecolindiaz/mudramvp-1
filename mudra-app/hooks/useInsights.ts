"use client"

import { useState, useEffect } from 'react'
import type { TimeRange } from '@/components/dashboard/time-range-selector'

interface InsightsData {
  brandInsights?: any
  citationGaps?: any
  trackedPrompts?: any
  summary?: {
    overallScore: number
    keyMetrics: {
      aiVisibilityScore: number
      citationGapScore: number
      competitivePosition: number
      contentOpportunities: number
    }
    recommendations?: string[]
    alerts?: any[]
  }
}

interface UseInsightsReturn {
  data: InsightsData | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  triggerAnalysis: (config: AnalysisConfig) => Promise<void>
}

interface AnalysisConfig {
  companyUrl: string
  competitors?: string[]
  analysisTypes?: string[]
  priority?: 'normal' | 'high'
}

export function useInsights(timeRange: TimeRange = '7d'): UseInsightsReturn {
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInsights = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(
        `/api/insights?timeRange=${timeRange}&recommendations=true&alerts=true`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
      
      if (!response.ok) {
        throw new Error(`Failed to fetch insights: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        setData(result.data)
      } else {
        throw new Error(result.error || 'Failed to fetch insights')
      }
    } catch (err) {
      console.error('Error fetching insights:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const triggerAnalysis = async (config: AnalysisConfig) => {
    try {
      setError(null)
      
      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      })
      
      if (!response.ok) {
        throw new Error(`Failed to trigger analysis: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to trigger analysis')
      }
      
      // Optionally refetch data after triggering analysis
      // You might want to poll for updates or use websockets for real-time updates
      console.log('Analysis triggered:', result.analysisId)
      
    } catch (err) {
      console.error('Error triggering analysis:', err)
      setError(err instanceof Error ? err.message : 'Failed to trigger analysis')
    }
  }

  useEffect(() => {
    fetchInsights()
  }, [timeRange])

  return {
    data,
    loading,
    error,
    refetch: fetchInsights,
    triggerAnalysis
  }
}

// Hook specifically for brand insights
export function useBrandInsights(timeRange: TimeRange = '7d') {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBrandInsights = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/insights/brand?timeRange=${timeRange}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch brand insights: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        setData(result.data)
      } else {
        throw new Error(result.error || 'Failed to fetch brand insights')
      }
    } catch (err) {
      console.error('Error fetching brand insights:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBrandInsights()
  }, [timeRange])

  return { data, loading, error, refetch: fetchBrandInsights }
}

// Hook specifically for citation gaps
export function useCitationGaps(timeRange: TimeRange = '7d') {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCitationGaps = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/insights/citation-gaps?timeRange=${timeRange}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch citation gaps: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        setData(result.data)
      } else {
        throw new Error(result.error || 'Failed to fetch citation gaps')
      }
    } catch (err) {
      console.error('Error fetching citation gaps:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const triggerAnalysis = async (companyUrl: string, competitors?: string[]) => {
    try {
      setError(null)
      
      const response = await fetch('/api/insights/citation-gaps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyUrl,
          competitors,
          analysisType: 'comprehensive'
        }),
      })
      
      if (!response.ok) {
        throw new Error(`Failed to trigger citation gaps analysis: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to trigger analysis')
      }
      
      console.log('Citation gaps analysis triggered:', result.analysisId)
      
    } catch (err) {
      console.error('Error triggering citation gaps analysis:', err)
      setError(err instanceof Error ? err.message : 'Failed to trigger analysis')
    }
  }

  useEffect(() => {
    fetchCitationGaps()
  }, [timeRange])

  return { 
    data, 
    loading, 
    error, 
    refetch: fetchCitationGaps,
    triggerAnalysis
  }
}
