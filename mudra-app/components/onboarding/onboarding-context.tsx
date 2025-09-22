"use client"

import { createContext, useContext, useState, ReactNode } from "react"
import { useBrandProfile } from "../brand-profile-context"

interface OnboardingData {
  // Welcome form data
  companyName: string
  companyWebsite: string
  companySocialMedia: string
  
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
}

const defaultOnboardingData: OnboardingData = {
  companyName: "",
  companyWebsite: "",
  companySocialMedia: "",
  userName: "",
  userRole: "",
  companyDescription: "",
  companyIndustry: "",
  servicesProducts: [],
  companyICP: [],
  competitors: [],
  knowledgeBaseFiles: [],
}

interface OnboardingContextType {
  data: OnboardingData
  updateData: (updates: Partial<OnboardingData>) => void
  saveToProfile: () => void
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
  const [data, setData] = useState<OnboardingData>(defaultOnboardingData)
  const { setProfile } = useBrandProfile()

  const updateData = (updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }))
  }

  const saveToProfile = () => {
    // Convert onboarding data to brand profile format
    const profile = {
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

    console.log("Saving onboarding data to brand profile:", profile)
    setProfile(profile)
  }

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
