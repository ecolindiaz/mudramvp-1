"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StarBorder } from "@/components/ui/star-border"
import { ArrowRight, Sparkles, CheckCircle } from "lucide-react"

export function PromptsForm() {
  const router = useRouter()
  const [isGenerating, setIsGenerating] = useState(true)
  const [generatedCount, setGeneratedCount] = useState(0)

  useEffect(() => {
    if (isGenerating) {
      const interval = setInterval(() => {
        setGeneratedCount(prev => {
          if (prev >= 100) {
            setIsGenerating(false)
            clearInterval(interval)
            return 100
          }
          return prev + Math.floor(Math.random() * 8) + 1
        })
      }, 200)

      return () => clearInterval(interval)
    }
  }, [isGenerating])

  const handleFinish = () => {
    console.log("Onboarding completed!")
    router.push("/dashboard")
  }

  return (
    <Card className="w-full max-w-md mx-auto bg-black border border-white/20 shadow-lg">
      <CardHeader className="text-center pb-6">
        <CardTitle className="text-2xl font-semibold text-white">
          {isGenerating ? "Generating Prompts" : "Prompts Ready!"}
        </CardTitle>
        <CardDescription className="text-white/70">
          {isGenerating 
            ? "We're automatically creating 100 custom prompts for you"
            : "Your personalized prompts have been generated"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center space-y-4">
          {isGenerating ? (
            <>
              <div className="relative">
                <Sparkles className="w-16 h-16 mx-auto text-white animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-4xl font-bold text-white">{generatedCount}</p>
                <p className="text-white/70 text-sm">prompts generated</p>
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div 
                    className="bg-white h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${generatedCount}%` }}
                  ></div>
                </div>
              </div>
            </>
          ) : (
            <>
              <CheckCircle className="w-16 h-16 mx-auto text-green-400" />
              <div className="space-y-2">
                <p className="text-4xl font-bold text-white">100</p>
                <p className="text-white/70 text-sm">prompts ready to use</p>
                <p className="text-white/60 text-xs">
                  Your custom prompts are now available in your dashboard
                </p>
              </div>
            </>
          )}
        </div>

        {!isGenerating && (
          <StarBorder
            onClick={handleFinish}
            className="w-full cursor-pointer"
            color="white"
          >
            <div className="flex items-center justify-center gap-2 text-white">
              Complete Onboarding
              <ArrowRight className="w-4 h-4" />
            </div>
          </StarBorder>
        )}
      </CardContent>
    </Card>
  )
} 