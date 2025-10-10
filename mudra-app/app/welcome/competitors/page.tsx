"use client"

import { OnboardingStepper } from "@/components/ui/onboarding-stepper"
import { MudraLogo } from "@/components/ui/mudra-logo"
import { CompetitorsForm } from "@/components/onboarding/competitors-form"
import { OnboardingProvider } from "@/components/onboarding/onboarding-context"
import { BrandProfileProvider } from "@/components/brand-profile-context"

export default function CompetitorsPage() {
  return (
    <BrandProfileProvider>
      <OnboardingProvider>
        <div className="min-h-screen bg-black">
          <div className="container mx-auto px-4">
            <OnboardingStepper currentStep={5} />
            <MudraLogo size={80} className="py-4" />
            <div className="flex justify-center items-center pb-16">
              <CompetitorsForm />
            </div>
          </div>
        </div>
      </OnboardingProvider>
    </BrandProfileProvider>
  )
} 