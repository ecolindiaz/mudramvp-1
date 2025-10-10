"use client"

import { OnboardingStepper } from "@/components/ui/onboarding-stepper"
import { MudraLogo } from "@/components/ui/mudra-logo"
import { VisibilityForm } from "@/components/onboarding/visibility-form"
import { OnboardingProvider } from "@/components/onboarding/onboarding-context"
import { BrandProfileProvider } from "@/components/brand-profile-context"

export default function VisibilityPage() {
  return (
    <BrandProfileProvider>
      <OnboardingProvider>
        <div className="min-h-screen bg-black">
          <div className="container mx-auto px-4">
            <OnboardingStepper currentStep={6} />
            <MudraLogo size={80} className="py-4" />
            <div className="flex justify-center items-center pb-16">
              <VisibilityForm />
            </div>
          </div>
        </div>
      </OnboardingProvider>
    </BrandProfileProvider>
  )
} 