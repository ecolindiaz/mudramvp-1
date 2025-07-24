"use client"

import { cn } from "@/lib/utils"

interface OnboardingStepperProps {
  currentStep: number
  className?: string
}

const steps = [
  "Welcome",
  "About You",
  "Company Profile",
  "Competitors",
  "Current Visibility",
  "Prompts"
]

export function OnboardingStepper({ currentStep, className }: OnboardingStepperProps) {
  return (
    <div className={cn("max-w-[600px] mx-auto py-8", className)}>
      <div className="flex justify-between items-center relative">
        {steps.map((step, index) => (
          <div key={step} className="flex flex-col items-center relative z-10">
            <div 
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                index + 1 === currentStep 
                  ? "bg-white text-black" 
                  : index + 1 < currentStep 
                    ? "bg-white text-black"
                    : "bg-[#27272A] text-white/50"
              )}
            >
              {index + 1}
            </div>
            <span 
              className={cn(
                "mt-2 text-[10px]",
                index + 1 === currentStep 
                  ? "text-white" 
                  : "text-white/50"
              )}
            >
              {step}
            </span>
          </div>
        ))}
        {/* Connecting lines */}
        <div className="absolute top-3 left-0 w-full h-[1px] -translate-y-1/2 z-0">
          <div className="relative w-full h-full">
            {steps.map((_, index) => (
              index < steps.length - 1 && (
                <div
                  key={index}
                  className={cn(
                    "absolute h-[1px] w-[calc(100%/5)]",
                    index + 1 < currentStep 
                      ? "bg-white" 
                      : "bg-[#27272A]"
                  )}
                  style={{ left: `${index * 20}%` }}
                />
              )
            ))}
          </div>
        </div>
      </div>
    </div>
  )
} 