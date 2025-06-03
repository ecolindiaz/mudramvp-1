"use client"

import { OnboardingStepper } from "@/components/ui/onboarding-stepper"
import { MudraLogo } from "@/components/ui/mudra-logo"
import { ProfileForm } from "@/components/onboarding/profile-form"

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4">
        <OnboardingStepper currentStep={2} />
        <MudraLogo />
        <div className="flex justify-center items-center pb-16">
          <ProfileForm />
        </div>
      </div>
    </div>
  )
} 