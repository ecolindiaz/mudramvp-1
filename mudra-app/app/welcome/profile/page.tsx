"use client"

import { OnboardingStepper } from "@/components/ui/onboarding-stepper"
import { MudraLogo } from "@/components/ui/mudra-logo"
import { ProfileForm } from "@/components/onboarding/profile-form"
import { OnboardingProvider } from "@/components/onboarding/onboarding-context"
import { BrandProfileProvider } from "@/components/brand-profile-context"

export default function ProfilePage() {
  return (
    <BrandProfileProvider>
      <OnboardingProvider>
        <div className="min-h-screen bg-black">
          <div className="container mx-auto px-4">
            <OnboardingStepper currentStep={3} />
            <MudraLogo size={80} className="py-4" />
            <div className="flex justify-center items-center pb-16">
              <ProfileForm />
            </div>
          </div>
        </div>
      </OnboardingProvider>
    </BrandProfileProvider>
  )
} 