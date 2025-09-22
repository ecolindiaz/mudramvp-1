"use client"
import useSWR from 'swr'
import type { NlrLatestResponse } from '@/types/nlr'

export function useNlr(companyId: string | null) {
  const shouldFetch = Boolean(companyId)
  const { data, error, isLoading, mutate } = useSWR<NlrLatestResponse>(
    shouldFetch ? ["/api/nlr/latest", companyId] : null,
    async ([url, cid]: [string, string]) => {
      const qs = `?companyId=${encodeURIComponent(cid)}`
      const res = await fetch(`${url}${qs}`, { headers: { 'x-company-id': cid } })
      if (!res.ok) throw new Error(`Failed to fetch NLR: ${res.status}`)
      return res.json()
    },
    { revalidateOnFocus: false }
  )

  const report = data?.data?.report ?? null
  return { report, sections: data?.data?.sections ?? [], error, isLoading, refresh: mutate }
}


