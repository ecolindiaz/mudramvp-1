"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StarBorder } from "@/components/ui/star-border"
import { ArrowRight, Sparkles, CheckCircle, Target, BarChart3, Activity, Code } from "lucide-react"
import { useAnalysisPipeline } from "@/hooks/use-analysis-pipeline"
import { useBrandProfile } from "@/components/brand-profile-context"
import { useOnboarding } from "./onboarding-context"

export function PromptsForm() {
  const router = useRouter()
  const { profile } = useBrandProfile()
  const { data: onboardingData, saveToProfile } = useOnboarding()
  const { state, progress, results, error, simulatedProgress, runPipeline } = useAnalysisPipeline()
  const [analysisStarted, setAnalysisStarted] = useState(false)
  const hasSaved = useRef(false) // Track if we've already saved

  // Debug: Log when component mounts
  useEffect(() => {
    console.log("🟣 [PromptsForm] Component mounted")
    console.log("🟣 [PromptsForm] Initial onboardingData:", onboardingData)
    console.log("🟣 [PromptsForm] Initial profile:", profile)
  }, [])

  useEffect(() => {
    // First save onboarding data to brand profile, then start full analysis pipeline
    // Only run once when we have company name and haven't saved yet
    if (!hasSaved.current && !analysisStarted && onboardingData.companyName) {
      hasSaved.current = true // Mark as saved to prevent re-runs
      
      const saveAndAnalyze = async () => {
        console.log("🔵 [PromptsForm] Starting save process...")
        console.log("🔵 [PromptsForm] Onboarding data:", onboardingData)
        
        // Save to profile and wait for completion
        await saveToProfile()
        console.log("🔵 [PromptsForm] Profile saved, waiting for state update...")
        
        // Wait a bit more for the profile state to update with the ID
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        console.log("🔵 [PromptsForm] Setting analysisStarted to true")
        setAnalysisStarted(true)
      }
      
      saveAndAnalyze()
    }
  }, [onboardingData.companyName, analysisStarted, saveToProfile]) // Only depend on companyName, not whole object

  useEffect(() => {
    // Start analysis once we have analysisStarted flag AND a valid profile ID
    console.log("🟢 [PromptsForm] Profile ID check - analysisStarted:", analysisStarted, "profile.id:", profile?.id, "companyName:", onboardingData.companyName)
    
    if (analysisStarted && onboardingData.companyName && profile?.id && profile.id > 0) {
      console.log("🟢 🟢 🟢 [PromptsForm] ✅✅✅ TRIGGERING ANALYSIS NOW WITH PROFILE ID:", profile.id)
      
      const config = {
        brandProfileId: profile.id, // ✅ Use actual profile ID from database
        brandName: onboardingData.companyName,
        website: onboardingData.companyWebsite || '',
        industry: onboardingData.companyIndustry || undefined,
        description: onboardingData.companyDescription || undefined,
        competitors: onboardingData.competitors || [],
      }
      
      console.log("🟢 [PromptsForm] Pipeline config:", config)
      runPipeline(config)
    } else {
      console.log("🔴 [PromptsForm] Analysis NOT triggered - Waiting for:", {
        analysisStarted,
        hasCompanyName: !!onboardingData.companyName,
        profileId: profile?.id,
        profileIdValid: profile?.id && profile.id > 0
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisStarted, profile?.id]) // ✅ Trigger when analysisStarted OR profile.id changes

  const handleFinish = () => {
    console.log("Onboarding completed with full analysis pipeline!")
    // Clear onboarding data from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('onboardingData')
    }
    router.push("/dashboard")
  }

  const isAnalysisComplete = state === 'completed'
  const hasError = state === 'error'
  const isRunning = state === 'running'

  // Calculate overall progress using simulated progress for smoother UX
  const calculateProgress = () => {
    if (state === 'completed') return 100;
    if (state === 'error') return 0;
    if (state === 'idle') return 0;
    
    // Use simulated progress for smoother UX while analysis runs
    return Math.round(simulatedProgress);
  }

  const getCurrentStage = () => {
    if (state === 'completed') return 'Analysis Complete';
    if (state === 'error') return 'Analysis Failed';
    if (state === 'idle') return 'Preparing analysis...';
    
    if (progress.geoAnalysis === 'pending') return 'Analyzing AI Visibility...';
    if (progress.trafficMetrics === 'pending') return 'Collecting Traffic Metrics...';
    if (progress.technicalStructure === 'pending') return 'Running Technical Analysis...';
    if (progress.report === 'pending') return 'Generating Report...';
    
    return 'Processing...';
  }

  const currentProgress = calculateProgress()
  const currentStage = getCurrentStage()

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
                <p className="text-red-400 text-sm">{error || 'An error occurred during analysis'}</p>
                <p className="text-white/60 text-xs">
                  Don't worry - you can run analysis later from your dashboard
                </p>
              </div>
            </>
          ) : isAnalysisComplete ? (
            <>
              <CheckCircle className="w-16 h-16 mx-auto text-green-400" />
              <div className="space-y-2">
                <p className="text-2xl font-bold text-white">Analysis Complete!</p>
                <p className="text-white/70 text-sm">Your brand analysis is ready</p>
                <div className="grid grid-cols-2 gap-2 text-xs mt-4">
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="flex items-center gap-1 text-white/60 mb-1">
                      <Target className="w-3 h-3" />
                      AI Visibility
                    </div>
                    <div className="text-white font-medium">
                      {progress.geoAnalysis === 'completed' ? '✓' : '○'}
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="flex items-center gap-1 text-white/60 mb-1">
                      <Activity className="w-3 h-3" />
                      Traffic
                    </div>
                    <div className="text-white font-medium">
                      {progress.trafficMetrics === 'completed' ? '✓' : '○'}
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="flex items-center gap-1 text-white/60 mb-1">
                      <Code className="w-3 h-3" />
                      Technical
                    </div>
                    <div className="text-white font-medium">
                      {progress.technicalStructure === 'completed' ? '✓' : '○'}
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="flex items-center gap-1 text-white/60 mb-1">
                      <BarChart3 className="w-3 h-3" />
                      Report
                    </div>
                    <div className="text-white font-medium">
                      {progress.report === 'completed' ? '✓' : '○'}
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
                <p className="text-4xl font-bold text-white">{Math.round(currentProgress)}%</p>
                <p className="text-white/70 text-sm">{currentStage}</p>
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div 
                    className="bg-white h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${currentProgress}%` }}
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