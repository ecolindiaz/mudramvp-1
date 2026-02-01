"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles, CheckCircle, Target, BarChart3, Activity, Code } from "lucide-react"
import { useAnalysisPipeline } from "@/hooks/use-analysis-pipeline"
import { useBrandProfile } from "@/components/brand-profile-context"
import { useOnboarding } from "./onboarding-context"

export function PromptsForm() {
  const router = useRouter()
  const { profile, refreshBrandProfile } = useBrandProfile()
  const { data: onboardingData, saveToProfile } = useOnboarding()
  const { state, progress, results, error, simulatedProgress, runPipeline } = useAnalysisPipeline()
  const [analysisStarted, setAnalysisStarted] = useState(false)
  const hasSaved = useRef(false) // Track if we've already saved
  const hasTriggeredAnalysis = useRef(false) // Track if we've already triggered analysis

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
        console.log("🔵 [PromptsForm] Profile saved, refreshing to get ID...")
        
        // Refresh the profile to ensure we have the latest data with ID
        await refreshBrandProfile()
        console.log("🔵 [PromptsForm] Profile refreshed, waiting for state update...")
        
        // Wait a bit more for the profile state to update with the ID
        await new Promise(resolve => setTimeout(resolve, 500))
        
        console.log("🔵 [PromptsForm] Setting analysisStarted to true")
        setAnalysisStarted(true)
      }
      
      saveAndAnalyze()
    }
  }, [onboardingData.companyName, analysisStarted, saveToProfile, refreshBrandProfile]) // Add refreshBrandProfile to dependencies

  useEffect(() => {
    // Start analysis once we have analysisStarted flag AND a valid profile ID
    console.log("🟢 [PromptsForm] Profile ID check - analysisStarted:", analysisStarted, "profile.id:", profile?.id, "companyName:", onboardingData.companyName, "hasTriggeredAnalysis:", hasTriggeredAnalysis.current)
    
    if (analysisStarted && onboardingData.companyName && profile?.id && profile.id > 0 && !hasTriggeredAnalysis.current) {
      // Validate required fields before triggering analysis
      if (!onboardingData.companyWebsite) {
        console.error("🔴 [PromptsForm] Cannot trigger analysis - missing website URL")
        return;
      }
      
      hasTriggeredAnalysis.current = true // Mark as triggered to prevent duplicate runs
      
      console.log("🟢 🟢 🟢 [PromptsForm] ✅✅✅ TRIGGERING ANALYSIS NOW WITH PROFILE ID:", profile.id)
      
      const config = {
        brandProfileId: profile.id, // ✅ Use actual profile ID from database
        brandName: onboardingData.companyName,
        website: onboardingData.companyWebsite,
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
        profileIdValid: profile?.id && profile.id > 0,
        alreadyTriggered: hasTriggeredAnalysis.current
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
    
    // Unified analysis stages (runs in parallel, but shown sequentially for UX)
    if (simulatedProgress < 30) return 'Testing AI Visibility (ChatGPT, Claude, Gemini)...';
    if (simulatedProgress < 60) return 'Analyzing Technical Structure & SEO...';
    if (simulatedProgress < 90) return 'Generating Your Custom Report...';
    if (progress.report === 'pending') return 'Finalizing Analysis...';

    
    return 'Processing...';
  }

  const currentProgress = calculateProgress()
  const currentStage = getCurrentStage()

  if (isAnalysisComplete) {
    return (
      <Card className="w-full max-w-[400px] mx-auto bg-[#161616] border border-white/[0.06] rounded-2xl shadow-2xl">
        <CardContent className="pt-8 pb-6 px-6 text-center space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-white">
              AI Visibility Analysis Complete!
            </h2>
            <p className="text-sm text-white/60">
              Your brand's AI visibility has been analyzed across major models
            </p>
          </div>
          <Button
            type="button"
            onClick={handleFinish}
            className="w-full h-11 bg-white text-black hover:bg-white/90 rounded-lg font-medium"
          >
            View Dashboard
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (hasError) {
    return (
      <Card className="w-full max-w-[400px] mx-auto bg-[#161616] border border-white/[0.06] rounded-2xl shadow-2xl">
        <CardContent className="pt-8 pb-6 px-6 text-center space-y-6">
          <div className="space-y-3">
            <div className="w-12 h-12 mx-auto bg-red-500/10 rounded-full flex items-center justify-center">
              <span className="text-xl">⚠️</span>
            </div>
            <h2 className="text-xl font-semibold text-white">Analysis Failed</h2>
            <p className="text-sm text-red-400">{error || 'An error occurred during analysis'}</p>
            <p className="text-xs text-white/50">
              You can run analysis later from your dashboard
            </p>
          </div>
          <Button
            type="button"
            onClick={handleFinish}
            className="w-full h-11 bg-white text-black hover:bg-white/90 rounded-lg font-medium"
          >
            Continue to Dashboard
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-[400px] mx-auto bg-[#161616] border border-white/[0.06] rounded-2xl shadow-2xl">
      <CardContent className="pt-8 pb-6 px-6 text-center space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-white">
            Analyzing Your AI Visibility
          </h2>
          <p className="text-sm text-white/60">
            Testing how AI models rank your brand
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="relative h-20 flex items-center justify-center">
            <div className="absolute w-16 h-16 border-2 border-white/10 rounded-full" />
            <div className="absolute w-16 h-16 border-2 border-transparent border-t-white rounded-full animate-spin" />
            <Sparkles className="w-6 h-6 text-white animate-pulse" />
          </div>
          
          <div className="space-y-2">
            <p className="text-3xl font-bold text-white">{Math.round(currentProgress)}%</p>
            <p className="text-xs text-white/50">{currentStage}</p>
          </div>
          
          <div className="w-full bg-white/[0.08] rounded-full h-1 overflow-hidden">
            <div 
              className="bg-white h-1 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${currentProgress}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 