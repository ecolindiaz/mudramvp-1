"use client"

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react"
import { useBrandProfile } from "../brand-profile-context"
import type { ExtractedCompanyInfo } from '@/types/extraction'

export type { ExtractedCompanyInfo } from '@/types/extraction'

export type ExtractionStatus = 'idle' | 'extracting' | 'completed' | 'failed'

export interface DomainEntry {
  id: string
  domain: string
  regions: string[]
  extractedInfo: ExtractedCompanyInfo | null
  extractionStatus: ExtractionStatus
}

interface OnboardingData {
  // Account data
  userId: number | null
  username: string

  // Welcome form data
  companyName: string
  companyWebsite: string
  companyDomains: string[]
  companySocialMedia: string
  trackingRegions: string[]
  domainEntries: DomainEntry[]

  // Profile form data
  userName: string
  userRole: string

  // Company form data
  companyDescription: string
  companyIndustry: string
  servicesProducts: string[]
  companyICP: string[]
  websitePlatform: string

  // Competitors form data
  competitors: string[]

  // Visibility form data (knowledge base files)
  knowledgeBaseFiles: File[]

  // Extracted company info from website
  extractedCompanyInfo: ExtractedCompanyInfo | null
  extractionStatus: ExtractionStatus
}

const defaultOnboardingData: OnboardingData = {
  userId: null,
  username: "",
  companyName: "",
  companyWebsite: "",
  companyDomains: [],
  companySocialMedia: "",
  trackingRegions: [],
  domainEntries: [{ id: crypto.randomUUID(), domain: "", regions: [], extractedInfo: null, extractionStatus: 'idle' }],
  userName: "",
  userRole: "",
  companyDescription: "",
  companyIndustry: "",
  servicesProducts: [],
  companyICP: [],
  websitePlatform: "",
  competitors: [],
  knowledgeBaseFiles: [],
  extractedCompanyInfo: null,
  extractionStatus: 'idle',
}

interface OnboardingContextType {
  data: OnboardingData
  updateData: (updates: Partial<OnboardingData>) => void
  saveToProfile: () => Promise<void>
  isComplete: () => boolean
  additionalMonitorIds: number[]
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined)

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (!context) {
    throw new Error("useOnboarding must be used within OnboardingProvider")
  }
  return context
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  // Always start with default data to ensure SSR/CSR match
  const [data, setData] = useState<OnboardingData>(defaultOnboardingData)
  const [additionalMonitorIds, setAdditionalMonitorIds] = useState<number[]>([])
  const { setProfile } = useBrandProfile()

  // Load from localStorage after mount (client-side only)
  useEffect(() => {
    const saved = localStorage.getItem('onboardingData')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.domainEntries) {
          parsed.domainEntries = parsed.domainEntries.map((e: any) => ({
            ...e,
            id: e.id || crypto.randomUUID(),
            ...(e.extractionStatus === 'extracting' ? { extractionStatus: 'idle' } : {}),
          }))
        }
        setData(parsed)
        console.log('📦 Loaded onboarding data from localStorage:', parsed)
      } catch (e) {
        console.error('Failed to parse saved onboarding data:', e)
      }
    }
  }, [])

  const updateData = useCallback((updates: Partial<OnboardingData>) => {
    setData(prev => {
      const newData = { ...prev, ...updates }
      // Save to localStorage whenever data updates
      if (typeof window !== 'undefined') {
        localStorage.setItem('onboardingData', JSON.stringify(newData))
      }
      return newData
    })
  }, [])

  const saveToProfile = useCallback(async () => {
    // Primary domain entry (index 0)
    const primaryEntry = data.domainEntries[0]
    const primaryRegions = primaryEntry?.regions?.filter(Boolean) || []

    // Convert onboarding data to brand profile format
    const profile = {
      // ID (will be set by database or updated from existing)
      id: 0,

      // User ID (from account creation)
      userId: data.userId,

      // Company Information
      companyName: data.companyName,
      companyWebsite: data.companyWebsite,
      companyLinkedIn: data.companySocialMedia,
      companyTwitter: data.companySocialMedia,

      // Personal Information
      userName: data.userName,
      userRole: data.userRole,
      userAvatar: "",

      // Company Profile
      companyDescription: data.companyDescription,
      companyIndustry: data.companyIndustry,
      companyServices: JSON.stringify(data.servicesProducts),
      companyICP: JSON.stringify(data.companyICP),

      // Competitors
      competitors: data.competitors.filter(c => c.trim() !== ""),

      // Visibility Metrics (defaults for now)
      monthlySearchVolume: "",
      aiRecommendations: "",

      // Multi-country tracking — use only the primary domain's regions
      trackingCountries: primaryRegions.length > 0
        ? primaryRegions
        : data.trackingRegions.length > 0
          ? data.trackingRegions
          : ["US"],
      primaryCountry: primaryRegions[0] || data.trackingRegions[0] || "US",

      // Extra fields for compatibility
      stage: "",
      resources: { teamSize: 0, budget: 0 },

      // Website platform
      websitePlatform: data.websitePlatform || "",
    }

    console.log("Saving onboarding data to brand profile (with userId):", profile)
    const savedProfile = await setProfile(profile)
    console.log("✅ Profile saved with ID:", savedProfile?.id)

    // Create additional monitors for domain entries beyond the first
    const extraEntries = data.domainEntries.slice(1).filter(e => e.domain.trim())
    if (extraEntries.length > 0 && savedProfile?.id) {
      const primaryCompanyInfo = {
        companyDescription: data.companyDescription,
        companyIndustry: data.companyIndustry,
        companyServices: JSON.stringify(data.servicesProducts),
        companyICP: JSON.stringify(data.companyICP),
        competitors: data.competitors.filter(c => c.trim() !== ""),
      }

      const monitorIds: number[] = []
      for (const entry of extraEntries) {
        try {
          const regions = entry.regions.filter(Boolean)
          const extracted = entry.extractedInfo
          const entryCompanyInfo = extracted ? {
            companyDescription: extracted.companyDescription || data.companyDescription,
            companyIndustry: extracted.industry || data.companyIndustry,
            companyServices: (extracted.servicesProducts?.length > 0
              ? extracted.servicesProducts : data.servicesProducts).join(", "),
            companyICP: JSON.stringify(extracted.idealCustomerProfiles?.length > 0
              ? extracted.idealCustomerProfiles : data.companyICP),
            competitors: extracted.competitorUrls?.length > 0
              ? extracted.competitorUrls
              : data.competitors.filter(c => c.trim() !== ""),
          } : primaryCompanyInfo

          const res = await fetch("/api/monitors", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              companyName: data.companyName,
              companyWebsite: entry.domain,
              trackingCountries: regions.length > 0 ? regions : ["US"],
              primaryCountry: regions[0] || "US",
              ...entryCompanyInfo,
            }),
          })
          const result = await res.json()
          if (result.success && result.monitor?.id) {
            monitorIds.push(result.monitor.id)
            console.log(`✅ Additional monitor created for ${entry.domain}, ID:`, result.monitor.id)
          } else {
            console.error(`Failed to create monitor for ${entry.domain}:`, result.error)
          }
        } catch (err) {
          console.error(`Error creating monitor for ${entry.domain}:`, err)
        }
      }
      setAdditionalMonitorIds(monitorIds)
    }
  }, [data, setProfile])

  const isComplete = () => {
    return !!(
      data.companyName && 
      data.companyWebsite && 
      data.userName && 
      data.userRole && 
      data.companyDescription && 
      data.companyIndustry
    )
  }

  return (
    <OnboardingContext.Provider value={{ data, updateData, saveToProfile, isComplete, additionalMonitorIds }}>
      {children}
    </OnboardingContext.Provider>
  )
}
