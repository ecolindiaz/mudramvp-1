"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StarBorder } from "@/components/ui/star-border"
import { ArrowRight } from "lucide-react"

export function WelcomeForm() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    companyName: "",
    companyWebsite: "",
    companySocialMedia: ""
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleNext = () => {
    console.log("Form data:", formData)
    router.push("/welcome/profile")
  }

  const isFormValid = formData.companyName.trim() !== "" && formData.companyWebsite.trim() !== ""

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
          onClick={isFormValid ? handleNext : undefined}
          disabled={!isFormValid}
          className={`w-full ${!isFormValid ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          color="white"
        >
          <div className="flex items-center justify-center gap-2 text-white">
            Next
            <ArrowRight className="w-4 h-4" />
          </div>
        </StarBorder>
      </CardContent>
    </Card>
  )
} 