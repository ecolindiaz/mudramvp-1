"use client"

import { useState, useRef, useCallback } from 'react'

export interface ExtractedCompanyInfo {
  companyDescription: string
  industry: string
  servicesProducts: string[]
  idealCustomerProfiles: string[]
  competitorUrls: string[]
  competitorSource?: 'extracted' | 'ai_suggested'
}

interface UseCompanyExtractionResult {
  isExtracting: boolean
  extractedData: ExtractedCompanyInfo | null
  error: string | null
  failed: boolean
  startExtraction: (url: string) => void
  reset: () => void
}

const DEBOUNCE_MS = 500

export function useCompanyExtraction(): UseCompanyExtractionResult {
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedCompanyInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastUrlRef = useRef<string | null>(null)

  const reset = useCallback(() => {
    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    // Clear any pending debounce
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
      debounceTimeoutRef.current = null
    }
    setIsExtracting(false)
    setExtractedData(null)
    setError(null)
    setFailed(false)
    lastUrlRef.current = null
  }, [])

  const startExtraction = useCallback((url: string) => {
    // Skip if URL is empty or same as last extraction
    if (!url.trim()) {
      return
    }

    // Normalize URL for comparison
    let normalizedUrl = url.trim()
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`
    }

    // Validate URL format early
    try {
      new URL(normalizedUrl)
    } catch {
      setError('Invalid URL format')
      return
    }

    // Skip if same URL as last successful extraction
    if (lastUrlRef.current === normalizedUrl && extractedData) {
      return
    }

    // Clear any pending debounce
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Set extracting state IMMEDIATELY so UI shows loading
    setIsExtracting(true)
    setError(null)
    setFailed(false)

    // Debounce the actual API call
    debounceTimeoutRef.current = setTimeout(async () => {
      // Create new abort controller for this request
      abortControllerRef.current = new AbortController()

      try {
        const response = await fetch('/api/onboarding/extract-company-info', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: normalizedUrl }),
          signal: abortControllerRef.current.signal,
        })

        const result = await response.json()

        if (result.success && result.data) {
          const data = {
            ...result.data,
            ...(result.meta?.competitorSource && {
              competitorSource: result.meta.competitorSource,
            }),
          }
          setExtractedData(data)
          lastUrlRef.current = normalizedUrl
          setError(null)
          setFailed(false)
        } else {
          // Silent failure - don't show error to user but mark as failed
          console.log('Company extraction failed:', result.error?.message || 'Unknown error')
          setError(null)
          setFailed(true)
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Request was cancelled, don't update state
          return
        }
        // Silent failure for network errors
        console.log('Company extraction network error:', err)
        setError(null)
        setFailed(true)
      } finally {
        setIsExtracting(false)
        abortControllerRef.current = null
      }
    }, DEBOUNCE_MS)
  }, [extractedData])

  return {
    isExtracting,
    extractedData,
    error,
    failed,
    startExtraction,
    reset,
  }
}
