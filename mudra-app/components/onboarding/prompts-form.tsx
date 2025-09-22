"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StarBorder } from "@/components/ui/star-border"
import { ArrowRight, Sparkles, CheckCircle, Target, BarChart3 } from "lucide-react"
import { useDirectGEOAnalysis } from "@/hooks/use-direct-geo-analysis"
import { useBrandProfile } from "@/components/brand-profile-context"
import { useOnboarding } from "./onboarding-context"

export function PromptsForm() {
  const router = useRouter()
  const { profile } = useBrandProfile()
  const { data: onboardingData, saveToProfile } = useOnboarding()
  const { state, runAnalysis } = useDirectGEOAnalysis()
  const [analysisStarted, setAnalysisStarted] = useState(false)

  useEffect(() => {
    // First save onboarding data to brand profile, then start analysis
    if (!analysisStarted && onboardingData.companyName) {
      const saveAndAnalyze = async () => {
        console.log("Saving onboarding data to brand profile...")
        
        // Save to profile and wait for completion
        await saveToProfile()
        
        setAnalysisStarted(true)
        
        // Start GEO analysis with onboarding data
        setTimeout(() => {
          runAnalysis({
            brandName: onboardingData.companyName,
            website: onboardingData.companyWebsite || undefined,
            industry: onboardingData.companyIndustry || undefined,
            description: onboardingData.companyDescription || undefined,
            competitors: onboardingData.competitors || [],
          })
        }, 500) // Small delay to ensure profile is saved
      }
      
      saveAndAnalyze()
    }
  }, [onboardingData, analysisStarted, runAnalysis, saveToProfile])

  const handleFinish = () => {
    console.log("Onboarding completed with GEO analysis!")
    router.push("/dashboard")
  }

  const isAnalysisComplete = state.results !== null && !state.isRunning
  const hasError = state.error !== null

  return (
    <Card className="w-full max-w-md mx-auto bg-black border border-white/20 shadow-lg">
      <CardHeader className="text-center pb-6">
        <CardTitle className="text-2xl font-semibold text-white">
          {hasError ? "Analysis Failed" : 
           isAnalysisComplete ? "AI Visibility Analysis Complete!" : 
           "Analyzing Your AI Visibility"}
        </CardTitle>
        <CardDescription className="text-white/70">
          {hasError ? "We encountered an issue with the analysis" :
           isAnalysisComplete ? "Your brand's AI visibility has been analyzed across major models" :
           "Testing how AI models like ChatGPT, Claude, and Gemini rank your brand"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center space-y-4">
          {hasError ? (
            <>
              <div className="relative">
                <div className="w-16 h-16 mx-auto bg-red-500/20 rounded-full flex items-center justify-center">
                  <div className="w-8 h-8 text-red-400">⚠️</div>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-red-400 text-sm">{state.error}</p>
                <p className="text-white/60 text-xs">
                  Don't worry - you can run analysis later from your dashboard
                </p>
              </div>
            </>
          ) : isAnalysisComplete ? (
            <>
              <CheckCircle className="w-16 h-16 mx-auto text-green-400" />
              <div className="space-y-2">
                <p className="text-4xl font-bold text-white">{state.results?.overallScore}</p>
                <p className="text-white/70 text-sm">AI Visibility Score</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/10 rounded-lg p-2">
                    <div className="flex items-center gap-1 text-white/60">
                      <Target className="w-3 h-3" />
                      Providers
                    </div>
                    <div className="text-white font-medium">{state.results?.analyses.length || 0}</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2">
                    <div className="flex items-center gap-1 text-white/60">
                      <BarChart3 className="w-3 h-3" />
                      Tests Run
                    </div>
                    <div className="text-white font-medium">
                      {state.results?.analyses.reduce((sum, a) => sum + a.promptTests.length, 0) || 0}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="relative">
                <Sparkles className="w-16 h-16 mx-auto text-white animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-4xl font-bold text-white">{state.progress}%</p>
                <p className="text-white/70 text-sm">{state.stage}</p>
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div 
                    className="bg-white h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${state.progress}%` }}
                  ></div>
                </div>
              </div>
            </>
          )}
        </div>

        {(isAnalysisComplete || hasError) && (
          <StarBorder
            onClick={handleFinish}
            className="w-full cursor-pointer"
            color="white"
          >
            <div className="flex items-center justify-center gap-2 text-white">
              {isAnalysisComplete ? "View Dashboard" : "Continue to Dashboard"}
              <ArrowRight className="w-4 h-4" />
            </div>
          </StarBorder>
        )}
      </CardContent>
    </Card>
  )
} 