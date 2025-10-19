"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StarBorder } from "@/components/ui/star-border"
import { ArrowRight, Loader2 } from "lucide-react"
import { useOnboarding } from "./onboarding-context"

export function WelcomeForm() {
  const router = useRouter()
  const { data, updateData } = useOnboarding()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    companyName: data.companyName,
    companyWebsite: data.companyWebsite,
    companySocialMedia: data.companySocialMedia
  })

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

  return (
    <Card className="w-full max-w-md mx-auto bg-black border border-white/20 shadow-lg">
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
            className="w-full bg-black border-white/20 text-white placeholder:text-white/50"
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
            className="w-full bg-black border-white/20 text-white placeholder:text-white/50"
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
            className="w-full bg-black border-white/20 text-white placeholder:text-white/50"
          />
        </div>

        <StarBorder
          as="button"
          type="button"
          onClick={handleNext}
          disabled={!isFormValid || isLoading}
          className={`w-full ${(!isFormValid || isLoading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'}`}
          color="white"
        >
          <div className="flex items-center justify-center gap-2 text-white">
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
        </StarBorder>
      </CardContent>
    </Card>
  )
} 