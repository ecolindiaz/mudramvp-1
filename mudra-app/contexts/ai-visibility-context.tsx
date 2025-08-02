"use client"

import React, { createContext, useContext, ReactNode } from 'react'
import { useAIVisibilityData, type AIVisibilityScore } from '@/hooks/use-ai-visibility-data'

interface AIVisibilityContextType {
  data: {
    currentScore: AIVisibilityScore | null
    historicalData: Array<{
      month: string
      visibility: number
      date: Date
    }>
    isLoading: boolean
    error: string | null
  }
  calculateScore: (companyName: string) => Promise<AIVisibilityScore>
  updateScore: (score: AIVisibilityScore) => void
  setLoading: (loading: boolean) => void
  setError: (error: string) => void
}

const AIVisibilityContext = createContext<AIVisibilityContextType | undefined>(undefined)

export function AIVisibilityProvider({ children }: { children: ReactNode }) {
  const aiVisibilityData = useAIVisibilityData()

  return (
    <AIVisibilityContext.Provider value={aiVisibilityData}>
      {children}
    </AIVisibilityContext.Provider>
  )
}

export function useAIVisibility() {
  const context = useContext(AIVisibilityContext)
  if (context === undefined) {
    throw new Error('useAIVisibility must be used within an AIVisibilityProvider')
  }
  return context
}