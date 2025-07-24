"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StarBorder } from "@/components/ui/star-border"
import { ArrowRight } from "lucide-react"

export function VisibilityForm() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    monthlySearchVolume: "",
    aiRecommendation: ""
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleNext = () => {
    console.log("Form data:", formData)
    router.push("/welcome/prompts")
  }

  const isFormValid = formData.monthlySearchVolume && formData.aiRecommendation

  const searchVolumeRanges = [
    "0 - 1,000",
    "1,000 - 10,000", 
    "10,000 - 50,000",
    "50,000 - 100,000",
    "100,000 - 500,000",
    "500,000+",
    "I don't know"
  ]

  const aiRecommendationOptions = [
    "Yes, frequently",
    "Yes, occasionally", 
    "Rarely",
    "Never",
    "I don't know"
  ]

  return (
    <Card className="w-full max-w-md mx-auto bg-black border border-white/20 shadow-lg">
      <CardHeader className="text-center pb-6">
        <CardTitle className="text-2xl font-semibold text-white">
          Current Visibility
        </CardTitle>
        <CardDescription className="text-white/70">
          Help us understand your current presence
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="monthlySearchVolume" className="text-sm font-medium text-white/90">
            Website Monthly Search Volume?
          </Label>
          <Select value={formData.monthlySearchVolume} onValueChange={(value) => handleInputChange("monthlySearchVolume", value)}>
            <SelectTrigger className="w-full bg-black border-white/20 text-white">
              <SelectValue placeholder="Select search volume range" />
            </SelectTrigger>
            <SelectContent className="bg-black border-white/20">
              {searchVolumeRanges.map((range) => (
                <SelectItem key={range} value={range} className="text-white hover:bg-white/10">
                  {range}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="aiRecommendation" className="text-sm font-medium text-white/90">
            Do AI Recommend you?
          </Label>
          <Select value={formData.aiRecommendation} onValueChange={(value) => handleInputChange("aiRecommendation", value)}>
            <SelectTrigger className="w-full bg-black border-white/20 text-white">
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent className="bg-black border-white/20">
              {aiRecommendationOptions.map((option) => (
                <SelectItem key={option} value={option} className="text-white hover:bg-white/10">
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <StarBorder
          onClick={handleNext}
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