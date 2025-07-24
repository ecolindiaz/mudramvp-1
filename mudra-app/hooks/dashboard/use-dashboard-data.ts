"use client"

// Dashboard data fetching hook (placeholder)
// TODO: Replace mock with real API call once backend is ready

import { useState, useEffect } from "react"
import { dashboardData } from "@/app/dashboard/data"
import type { z } from "zod"
import { schema as dataSchema } from "@/components/data-table"

// Type for each dashboard table item, based on schema from DataTable component
export type DashboardTableItem = z.infer<typeof dataSchema>

interface UseDashboardDataResult {
  data: DashboardTableItem[]
  isLoading: boolean
  error: Error | null
}

export function useDashboardData(): UseDashboardDataResult {
  const [data, setData] = useState<DashboardTableItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // Phase 1: use static mock data
    setData(dashboardData)
    setIsLoading(false)

    // Phase 2 (future): fetch from API e.g.
    // fetch("/api/dashboard/metrics")
    //   .then((res) => res.json())
    //   .then((json) => {
    //     const parsed = dataSchema.array().parse(json)
    //     setData(parsed)
    //   })
    //   .catch((err) => setError(err))
    //   .finally(() => setIsLoading(false))
  }, [])

  return { data, isLoading, error }
} 