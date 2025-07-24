"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StarBorder } from "@/components/ui/star-border"
import { ArrowRight } from "lucide-react"

export function CompanyForm() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    companyDescription: "",
    companyIndustry: "",
    servicesProducts: "",
    companyICP: ""
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleNext = () => {
    console.log("Form data:", formData)
    router.push("/welcome/competitors")
  }

  const isFormValid = formData.companyDescription && formData.companyIndustry && formData.servicesProducts

  const industries = [
    "Technology", "Healthcare", "Finance", "Education", "E-commerce", "Manufacturing", 
    "Real Estate", "Marketing", "Consulting", "SaaS", "AI/ML", "Other"
  ]

  return (
    <Card className="w-full max-w-md mx-auto bg-black border border-white/20 shadow-lg">
      <CardHeader className="text-center pb-6">
        <CardTitle className="text-2xl font-semibold text-white">
          Company Profile
        </CardTitle>
        <CardDescription className="text-white/70">
          Tell us more about your company
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="companyDescription" className="text-sm font-medium text-white/90">
            Company Description
          </Label>
          <Textarea
            id="companyDescription"
            placeholder="Describe what your company does..."
            value={formData.companyDescription}
            onChange={(e) => handleInputChange("companyDescription", e.target.value)}
            className="w-full bg-black border-white/20 text-white placeholder:text-white/50 min-h-[80px]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="companyIndustry" className="text-sm font-medium text-white/90">
            Company Industry
          </Label>
          <Select value={formData.companyIndustry} onValueChange={(value) => handleInputChange("companyIndustry", value)}>
            <SelectTrigger className="w-full bg-black border-white/20 text-white">
              <SelectValue placeholder="Select your industry" />
            </SelectTrigger>
            <SelectContent className="bg-black border-white/20">
              {industries.map((industry) => (
                <SelectItem key={industry} value={industry} className="text-white hover:bg-white/10">
                  {industry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="servicesProducts" className="text-sm font-medium text-white/90">
            Services/Products of Company
          </Label>
          <Input
            id="servicesProducts"
            type="text"
            placeholder="e.g. Web design, AI tools, Consulting"
            value={formData.servicesProducts}
            onChange={(e) => handleInputChange("servicesProducts", e.target.value)}
            className="w-full bg-black border-white/20 text-white placeholder:text-white/50"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="companyICP" className="text-sm font-medium text-white/90">
            Company ICP (Ideal Customer Profile)
          </Label>
          <Input
            id="companyICP"
            type="text"
            placeholder="e.g. Startups, SMBs, Enterprise companies"
            value={formData.companyICP}
            onChange={(e) => handleInputChange("companyICP", e.target.value)}
            className="w-full bg-black border-white/20 text-white placeholder:text-white/50"
          />
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