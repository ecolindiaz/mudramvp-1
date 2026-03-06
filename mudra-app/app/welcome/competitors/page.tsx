"use client"

import { OnboardingStepper } from "@/components/ui/onboarding-stepper"
import { MudraLogo } from "@/components/ui/mudra-logo"
import { CompetitorsForm } from "@/components/onboarding/competitors-form"

export default function CompetitorsPage() {
  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4">
        <OnboardingStepper currentStep={5} />
        <MudraLogo size={80} className="py-4" />
        <div className="flex justify-center items-center pb-16">
          <CompetitorsForm />
        </div>
      </div>
    </div>
  )
}
