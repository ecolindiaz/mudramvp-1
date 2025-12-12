"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { useOnboarding } from "./onboarding-context"

export function ProfileForm() {
  const router = useRouter()
  const { data, updateData } = useOnboarding()
  const [formData, setFormData] = useState({
    userName: data.userName,
    userRole: data.userRole
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleNext = async () => {
    try {
      // Save form data to onboarding context
      updateData({
        userName: formData.userName,
        userRole: formData.userRole
      })
      
      console.log("✅ Profile form data saved successfully")
      router.push("/welcome/company")
    } catch (error) {
      console.error("❌ Failed to save profile form data", error)
      alert("Failed to save data. Please try again.")
    }
  }

  const isFormValid = formData.userName.trim() !== "" && formData.userRole.trim() !== ""

  return (
    <Card className="w-full max-w-md mx-auto bg-black border border-white/20 shadow-lg">
      <CardHeader className="text-center pb-6">
        <CardTitle className="text-2xl font-semibold text-white">
          Tell us about you
        </CardTitle>
        <CardDescription className="text-white/70">
          Let's get to know you better
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="yourName" className="text-sm font-medium text-white/90">
            Your Name
          </Label>
          <Input
            id="yourName"
            type="text"
            placeholder="Enter your full name"
            value={formData.userName}
            onChange={(e) => handleInputChange("userName", e.target.value)}
            className="w-full bg-black border-white/20 text-white placeholder:text-white/50"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="yourRole" className="text-sm font-medium text-white/90">
            Your Role
          </Label>
          <Input
            id="yourRole"
            type="text"
            placeholder="e.g. CEO, Marketing Manager, Founder"
            value={formData.userRole}
            onChange={(e) => handleInputChange("userRole", e.target.value)}
            className="w-full bg-black border-white/20 text-white placeholder:text-white/50"
          />
        </div>

        {null}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push("/welcome")}
            className="h-9 rounded-lg border border-white/20 px-4 text-white/80 hover:text-white"
          >
            Back
          </button>
          <Button
            type="button"
            onClick={handleNext}
            disabled={!isFormValid}
            className="flex-1 h-9 bg-white text-black border border-white hover:bg-white/90 shadow-none disabled:bg-white disabled:text-black disabled:border-white/60 disabled:cursor-not-allowed disabled:opacity-100"
          >
            <div className="flex items-center justify-center gap-2">
              Next
              <ArrowRight className="w-4 h-4" />
            </div>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
} 