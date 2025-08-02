import { useState, useCallback } from 'react'

export interface AIVisibilityResult {
  prompt: string
  response: string
  mentioned: boolean
  position: number | null
  weight: number
}

export interface AIVisibilityScore {
  totalScore: number
  maxPossibleScore: number
  percentage: number
  mentionCount: number
  averagePosition: number
  results: AIVisibilityResult[]
  calculatedAt: Date
  companyName: string
}

interface AIVisibilityData {
  currentScore: AIVisibilityScore | null
  historicalData: Array<{
    month: string
    visibility: number
    date: Date
  }>
  isLoading: boolean
  error: string | null
}

export function useAIVisibilityData() {
  const [data, setData] = useState<AIVisibilityData>({
    currentScore: null,
    historicalData: [
      { month: "January", visibility: 58, date: new Date('2024-01-01') },
      { month: "February", visibility: 64, date: new Date('2024-02-01') },
      { month: "March", visibility: 61, date: new Date('2024-03-01') },
      { month: "April", visibility: 73, date: new Date('2024-04-01') },
      { month: "May", visibility: 79, date: new Date('2024-05-01') },
      { month: "June", visibility: 86, date: new Date('2024-06-01') },
    ],
    isLoading: false,
    error: null
  })

  const updateScore = useCallback((newScore: AIVisibilityScore) => {
    setData(prevData => {
      // Add the new score to historical data
      const currentMonth = new Date().toLocaleString('default', { month: 'long' })
      const updatedHistorical = [...prevData.historicalData]
      
      // Update current month or add new entry
      const currentMonthIndex = updatedHistorical.findIndex(item => item.month === currentMonth)
      if (currentMonthIndex >= 0) {
        updatedHistorical[currentMonthIndex] = {
          month: currentMonth,
          visibility: Math.round(newScore.percentage),
          date: new Date()
        }
      } else {
        updatedHistorical.push({
          month: currentMonth,
          visibility: Math.round(newScore.percentage),
          date: new Date()
        })
      }

      return {
        ...prevData,
        currentScore: newScore,
        historicalData: updatedHistorical.slice(-6), // Keep last 6 months
        error: null
      }
    })
  }, [])

  const setLoading = useCallback((loading: boolean) => {
    setData(prevData => ({
      ...prevData,
      isLoading: loading,
      error: loading ? null : prevData.error
    }))
  }, [])

  const setError = useCallback((error: string) => {
    setData(prevData => ({
      ...prevData,
      error,
      isLoading: false
    }))
  }, [])

  const calculateScore = useCallback(async (companyName: string) => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/ai-visibility/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ companyName }),
      })

      if (!response.ok) {
        throw new Error('Failed to calculate AI Visibility score')
      }

      const result: Omit<AIVisibilityScore, 'calculatedAt' | 'companyName'> = await response.json()
      const scoreWithMetadata: AIVisibilityScore = {
        ...result,
        calculatedAt: new Date(),
        companyName
      }

      updateScore(scoreWithMetadata)
      return scoreWithMetadata
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setError(errorMessage)
      throw error
    } finally {
      setLoading(false)
    }
  }, [updateScore, setLoading, setError])

  return {
    data,
    calculateScore,
    updateScore,
    setLoading,
    setError
  }
}