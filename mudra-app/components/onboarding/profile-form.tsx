"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StarBorder } from "@/components/ui/star-border"
import { ArrowRight } from "lucide-react"

export function ProfileForm() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    yourName: "",
    yourRole: "",
    avatar: ""
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleNext = () => {
    console.log("Form data:", formData)
    router.push("/welcome/company")
  }

  const isFormValid = formData.yourName.trim() !== "" && formData.yourRole.trim() !== ""

  const avatarOptions = [
    "👨‍💼", "👩‍💼", "👨‍💻", "👩‍💻", "🧑‍💼", "👨‍🎨", "👩‍🎨", "🧑‍🎨"
  ]

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
            value={formData.yourName}
            onChange={(e) => handleInputChange("yourName", e.target.value)}
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
            value={formData.yourRole}
            onChange={(e) => handleInputChange("yourRole", e.target.value)}
            className="w-full bg-black border-white/20 text-white placeholder:text-white/50"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-white/90">
            Choose your Avatar
          </Label>
          <div className="grid grid-cols-4 gap-3">
            {avatarOptions.map((avatar, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleInputChange("avatar", avatar)}
                className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-2xl transition-colors ${
                  formData.avatar === avatar
                    ? "border-white bg-white/10"
                    : "border-white/20 hover:border-white/40"
                }`}
              >
                {avatar}
              </button>
            ))}
          </div>
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