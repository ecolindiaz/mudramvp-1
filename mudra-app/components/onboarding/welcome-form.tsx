"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ArrowRight, Loader2 } from "lucide-react"
import { useOnboarding } from "./onboarding-context"
import { useCompanyExtraction } from "@/hooks/use-company-extraction"

export function WelcomeForm() {
  const router = useRouter()
  const { data, updateData } = useOnboarding()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    companyName: data.companyName,
    companyWebsite: data.companyWebsite,
    companySocialMedia: data.companySocialMedia
  })

  // Company extraction hook
  const { isExtracting, extractedData, failed, startExtraction } = useCompanyExtraction()

  // Track if we started extraction in this session (to know when to auto-redirect)
  const [startedExtractionThisSession, setStartedExtractionThisSession] = useState(false)

  // Update context when extraction completes and auto-redirect
  useEffect(() => {
    if (extractedData && startedExtractionThisSession) {
      // Save extracted data to context
      updateData({
        extractedCompanyInfo: extractedData,
        extractionStatus: 'completed',
        // Also save form data
        companyName: formData.companyName,
        companyWebsite: formData.companyWebsite,
        companySocialMedia: formData.companySocialMedia
      })
      // Auto-redirect after extraction completes
      router.push("/welcome/profile")
    }
  }, [extractedData, startedExtractionThisSession, formData, updateData, router])

  // Update extraction status in context
  useEffect(() => {
    if (isExtracting) {
      updateData({ extractionStatus: 'extracting' })
      setStartedExtractionThisSession(true)
    }
  }, [isExtracting, updateData])

  // Update context when extraction fails - allow user to proceed manually
  useEffect(() => {
    if (failed && startedExtractionThisSession) {
      updateData({ extractionStatus: 'failed' })
    }
  }, [failed, startedExtractionThisSession, updateData])

  // Handle website URL blur to trigger extraction
  const handleWebsiteBlur = () => {
    const url = formData.companyWebsite.trim()
    if (url) {
      startExtraction(url)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleNext = async () => {
    console.log("🚀 handleNext called")
    console.log("Form data:", formData)
    setIsLoading(true)
    
    try {
      // Save form data to onboarding context
      updateData({
        companyName: formData.companyName,
        companyWebsite: formData.companyWebsite,
        companySocialMedia: formData.companySocialMedia
      })
      
      console.log("✅ Welcome form data saved successfully")
      router.push("/welcome/profile")
    } catch (error) {
      console.error("❌ Failed to save welcome form data", error)
      alert("Failed to save data. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const isFormValid = formData.companyName.trim() !== "" && formData.companyWebsite.trim() !== ""
  
  useEffect(() => {
    console.log("Form validation state:", {
      companyName: formData.companyName,
      companyWebsite: formData.companyWebsite,
      isFormValid
    })
  }, [formData, isFormValid])

  // Show loading overlay when extracting
  if (isExtracting) {
    return (
      <Card className="w-full max-w-[480px] mx-auto bg-[#161616] border border-white/[0.06] rounded-2xl shadow-2xl">
        <CardContent className="py-16">
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="relative">
              <div className="w-16 h-16 border-2 border-white/10 rounded-full"></div>
              <div className="absolute inset-0 w-16 h-16 border-2 border-white/10 border-t-white rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse shadow-[0_0_12px_rgba(255,255,255,0.4)]"></div>
              </div>
            </div>
            <div className="text-center space-y-2">
              <p className="text-white font-medium">Analyzing your website</p>
              <p className="text-white/50 text-sm">Extracting company information...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-[480px] mx-auto bg-[#161616] border border-white/[0.06] rounded-2xl shadow-2xl">
      <CardHeader className="text-center pb-6">
        <CardTitle className="text-2xl font-semibold text-white">
          Welcome
        </CardTitle>
        <CardDescription className="text-white/70">
          Let's start with your brand information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="companyName" className="text-sm font-medium text-white/90">
            Company Name
          </Label>
          <Input
            id="companyName"
            type="text"
            placeholder="Enter your company name"
            value={formData.companyName}
            onChange={(e) => handleInputChange("companyName", e.target.value)}
            className="w-full bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/40 rounded-lg focus:ring-white/20 focus:border-white/20"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="companyWebsite" className="text-sm font-medium text-white/90">
            Company Website
          </Label>
          <Input
            id="companyWebsite"
            type="url"
            placeholder="https://yourcompany.com"
            value={formData.companyWebsite}
            onChange={(e) => handleInputChange("companyWebsite", e.target.value)}
            onBlur={handleWebsiteBlur}
            className="w-full bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/40 rounded-lg focus:ring-white/20 focus:border-white/20"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="companySocialMedia" className="text-sm font-medium text-white/90">
            Company Social Media
          </Label>
          <Input
            id="companySocialMedia"
            type="url"
            placeholder="https://twitter.com/yourcompany"
            value={formData.companySocialMedia}
            onChange={(e) => handleInputChange("companySocialMedia", e.target.value)}
            className="w-full bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/40 rounded-lg focus:ring-white/20 focus:border-white/20"
          />
        </div>

        <Button
          type="button"
          onClick={handleNext}
          disabled={!isFormValid || isLoading}
          className="w-full h-10 bg-white text-black border border-white hover:bg-white/90 shadow-none rounded-lg disabled:bg-white disabled:text-black disabled:border-white/60 disabled:cursor-not-allowed disabled:opacity-100"
        >
          <div className="flex items-center justify-center gap-2">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Next
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </div>
        </Button>
      </CardContent>
    </Card>
  )
} 