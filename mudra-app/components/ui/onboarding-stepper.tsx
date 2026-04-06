"use client"

import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

interface OnboardingStepperProps {
  currentStep: number
  className?: string
}

const steps = [
  "Account",
  "Welcome",
  "About You",
  "Company",
  "Competitors",
  "Analysis"
]

export function OnboardingStepper({ currentStep, className }: OnboardingStepperProps) {
  return (
    <div className={cn("max-w-[640px] mx-auto py-8 px-4", className)}>
      <div className="flex justify-between items-center relative">
        {steps.map((step, index) => {
          const isCompleted = index + 1 < currentStep
          const isCurrent = index + 1 === currentStep
          
          return (
            <div key={step} className="flex flex-col items-center relative z-10">
              <div 
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300",
                  isCurrent 
                    ? "bg-white text-black shadow-[0_0_12px_rgba(255,255,255,0.3)]" 
                    : isCompleted 
                      ? "bg-white text-black"
                      : "bg-[#161616] border border-white/[0.08] text-white/40"
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4 animate-in fade-in zoom-in duration-300" />
                ) : (
                  index + 1
                )}
              </div>
              <span 
                className={cn(
                  "mt-2.5 text-[11px] font-medium transition-colors duration-200",
                  isCurrent 
                    ? "text-white" 
                    : isCompleted
                      ? "text-white/70"
                      : "text-white/40"
                )}
              >
                {step}
              </span>
            </div>
          )
        })}
        {/* Connecting lines */}
        <div className="absolute top-4 left-0 w-full h-[2px] -translate-y-1/2 z-0">
          <div className="relative w-full h-full">
            {steps.map((_, index) => (
              index < steps.length - 1 && (
                <div
                  key={index}
                  className={cn(
                    "absolute h-[2px] rounded-full transition-all duration-500",
                    index + 1 < currentStep 
                      ? "bg-white" 
                      : "bg-white/[0.08]"
                  )}
                  style={{ 
                    left: `calc(${(index / (steps.length - 1)) * 100}% + 16px)`,
                    width: `calc(${100 / (steps.length - 1)}% - 32px)`
                  }}
                />
              )
            ))}
          </div>
        </div>
      </div>
    </div>
  )
} 