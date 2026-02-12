"use client"

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react"
import { useBrandProfile } from "../brand-profile-context"

// Extracted company info from website
export interface ExtractedCompanyInfo {
  companyDescription: string
  industry: string
  servicesProducts: string[]
  idealCustomerProfiles: string[]
  competitorUrls: string[]
  competitorSource?: 'extracted' | 'ai_suggested'
}

export type ExtractionStatus = 'idle' | 'extracting' | 'completed' | 'failed'

export interface DomainEntry {
  domain: string
  regions: string[]
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
  domainEntries: [{ domain: "", regions: [] }],
  userName: "",
  userRole: "",
  companyDescription: "",
  companyIndustry: "",
  servicesProducts: [],
  companyICP: [],
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
  const { setProfile } = useBrandProfile()

  // Load from localStorage after mount (client-side only)
  useEffect(() => {
    const saved = localStorage.getItem('onboardingData')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
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
      companyServices: data.servicesProducts.join(", "),
      companyICP: data.companyICP.join(", "),

      // Competitors
      competitors: data.competitors.filter(c => c.trim() !== ""),

      // Visibility Metrics (defaults for now)
      monthlySearchVolume: "",
      aiRecommendations: "",

      // Extra fields for compatibility
      stage: "",
      resources: { teamSize: 0, budget: 0 }
    }

    console.log("Saving onboarding data to brand profile (with userId):", profile)
    await setProfile(profile)
    console.log("✅ Profile saved, waiting for ID to be available...")
  }, [data, setProfile]) // Add dependencies so function is stable unless data or setProfile changes

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
    <OnboardingContext.Provider value={{ data, updateData, saveToProfile, isComplete }}>
      {children}
    </OnboardingContext.Provider>
  )
}
