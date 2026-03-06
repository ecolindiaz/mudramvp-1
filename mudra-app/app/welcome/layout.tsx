"use client"

import { BrandProfileProvider } from "@/components/brand-profile-context"
import { OnboardingProvider } from "@/components/onboarding/onboarding-context"

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <BrandProfileProvider>
      <OnboardingProvider>
        {children}
      </OnboardingProvider>
    </BrandProfileProvider>
  )
}
