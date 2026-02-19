"use client"
import useSWR from 'swr'
import type { NlrLatestResponse, NlrCountryOverlay } from '@/types/nlr'

interface UseNlrParams {
  companyId?: string | null
  brandProfileId?: string | null
  country?: string | null
}

export function useNlr(params: UseNlrParams) {
  const { companyId, brandProfileId, country } = params
  const hasId = Boolean(companyId || brandProfileId)

  const { data, error, isLoading, mutate } = useSWR<NlrLatestResponse>(
    hasId ? ["/api/nlr/latest", companyId, brandProfileId, country] : null,
    async ([url]: [string, string | null | undefined, string | null | undefined, string | null | undefined]) => {
      const qsParts: string[] = []
      if (companyId) qsParts.push(`companyId=${encodeURIComponent(companyId)}`)
      if (brandProfileId) qsParts.push(`brandProfileId=${encodeURIComponent(brandProfileId)}`)
      if (country) qsParts.push(`country=${encodeURIComponent(country)}`)
      const qs = qsParts.length > 0 ? `?${qsParts.join('&')}` : ''
      const headers: Record<string, string> = {}
      if (companyId) headers['x-company-id'] = companyId
      const res = await fetch(`${url}${qs}`, { headers })
      if (!res.ok) throw new Error(`Failed to fetch NLR: ${res.status}`)
      return res.json()
    },
    { revalidateOnFocus: false }
  )

  const report = data?.data?.report ?? null
  const countryOverlay: NlrCountryOverlay | null = data?.data?.countryOverlay ?? null
  return { report, sections: data?.data?.sections ?? [], countryOverlay, error, isLoading, refresh: mutate }
}
