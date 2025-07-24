"use client"

import { OnboardingStepper } from "@/components/ui/onboarding-stepper"
import { MudraLogo } from "@/components/ui/mudra-logo"
import { WelcomeForm } from "@/components/onboarding/welcome-form"

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4">
        <OnboardingStepper currentStep={1} />
        <MudraLogo />
        <div className="flex justify-center items-center pb-16">
          <WelcomeForm />
        </div>
      </div>
    </div>
  )
} 