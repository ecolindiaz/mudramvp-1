"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ArrowRight, Plus, X } from "lucide-react"
import { useOnboarding } from "./onboarding-context"
import { trackEvent } from "@/lib/analytics/posthog-events"

function MultiRowInput({
  values,
  onChange,
  placeholder,
  label,
}: {
  values: string[]
  onChange: (vals: string[]) => void
  placeholder?: string
  label?: string
}) {
  const rows = values.length > 0 ? values : [""]
  const update = (idx: number, val: string) => {
    const nv = [...rows]
    nv[idx] = val
    onChange(nv)
  }
  const addRow = () => onChange([...rows, ""]) 
  const removeRow = (idx: number) => {
    const nv = rows.filter((_, i) => i !== idx)
    onChange(nv.length ? nv : [""])
  }
  return (
    <div className="space-y-2">
      {rows.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={v}
            onChange={(e) => update(i, e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-white/[0.03] border-[1.5px] border-white/[0.06] text-white placeholder:text-white/40 rounded-lg focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:!border-blue-500"
          />
          {rows.length > 1 && (
            <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-full border-white/[0.08] hover:bg-white/[0.04]" onClick={() => removeRow(i)}>
              <X className="size-4" />
            </Button>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="h-9 rounded-full gap-2 border-white/[0.08] hover:bg-white/[0.04]" onClick={addRow}>
        <Plus className="size-4" /> Add another
      </Button>
    </div>
  )
}

// Predefined industries list
const INDUSTRIES = [
  "Technology", "Healthcare", "Finance", "Education", "E-commerce", "Manufacturing",
  "Real Estate", "Marketing", "Consulting", "SaaS", "AI/ML", "Other"
] as const

// Match extracted industry to predefined list
function matchIndustry(extractedIndustry: string): { matched: string; isCustom: boolean } {
  if (!extractedIndustry) return { matched: "", isCustom: false }

  const normalized = extractedIndustry.toLowerCase().trim()

  // Direct match
  const directMatch = INDUSTRIES.find(ind => ind.toLowerCase() === normalized)
  if (directMatch) return { matched: directMatch, isCustom: false }

  // Partial match / keyword matching
  const keywordMap: Record<string, typeof INDUSTRIES[number]> = {
    'tech': 'Technology',
    'software': 'Technology',
    'it': 'Technology',
    'health': 'Healthcare',
    'medical': 'Healthcare',
    'pharma': 'Healthcare',
    'fintech': 'Finance',
    'banking': 'Finance',
    'financial': 'Finance',
    'insurance': 'Finance',
    'edtech': 'Education',
    'learning': 'Education',
    'ecommerce': 'E-commerce',
    'retail': 'E-commerce',
    'shop': 'E-commerce',
    'manufacturing': 'Manufacturing',
    'industrial': 'Manufacturing',
    'real estate': 'Real Estate',
    'property': 'Real Estate',
    'marketing': 'Marketing',
    'advertising': 'Marketing',
    'agency': 'Marketing',
    'consulting': 'Consulting',
    'advisory': 'Consulting',
    'saas': 'SaaS',
    'cloud': 'SaaS',
    'ai': 'AI/ML',
    'artificial intelligence': 'AI/ML',
    'machine learning': 'AI/ML',
    'ml': 'AI/ML',
  }

  for (const [keyword, industry] of Object.entries(keywordMap)) {
    if (normalized.includes(keyword)) {
      return { matched: industry, isCustom: false }
    }
  }

  // No match found - use "Other" with custom value
  return { matched: "Other", isCustom: true }
}

export function CompanyForm() {
  const router = useRouter()
  const { data, updateData } = useOnboarding()

  // Initialize form with empty values - we'll sync from context in useEffect
  const [formData, setFormData] = useState({
    companyDescription: "",
    companyIndustry: "",
    servicesProducts: [""],
    companyICP: [""],
    websitePlatform: ""
  })
  const [customIndustry, setCustomIndustry] = useState("")
  const [isInitialized, setIsInitialized] = useState(false)

  // Sync form data from context (extraction data or previously saved data)
  useEffect(() => {
    // Skip if already initialized with data
    if (isInitialized) return

    const extracted = data.extractedCompanyInfo
    const hasExistingUserData = data.companyDescription || data.companyIndustry || data.servicesProducts.length > 0

    // Priority 1: Use existing user-entered data from context
    if (hasExistingUserData) {
      setFormData({
        companyDescription: data.companyDescription,
        companyIndustry: data.companyIndustry,
        servicesProducts: data.servicesProducts.length > 0 ? data.servicesProducts : [""],
        companyICP: data.companyICP.length > 0 ? data.companyICP : [""],
        websitePlatform: data.websitePlatform || ""
      })
      if (data.companyIndustry && !INDUSTRIES.includes(data.companyIndustry as any)) {
        setCustomIndustry(data.companyIndustry)
      }
      setIsInitialized(true)
      return
    }

    // Priority 2: Use extracted data if available
    if (extracted && data.extractionStatus === 'completed') {
      const industryMatch = matchIndustry(extracted.industry)
      setFormData({
        companyDescription: extracted.companyDescription || "",
        companyIndustry: industryMatch.matched,
        servicesProducts: extracted.servicesProducts.length > 0 ? extracted.servicesProducts : [""],
        companyICP: extracted.idealCustomerProfiles.length > 0 ? extracted.idealCustomerProfiles : [""],
        websitePlatform: data.websitePlatform || ""
      })
      if (industryMatch.isCustom) {
        setCustomIndustry(extracted.industry)
      }
      setIsInitialized(true)
      console.log("📝 Company form populated with extracted data")
    }
  }, [data.extractedCompanyInfo, data.extractionStatus, data.companyDescription, data.companyIndustry, data.servicesProducts, data.companyICP, isInitialized])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleNext = async () => {
    try {
      trackEvent.onboardingStepCompleted(3, 'company')
      // Determine final industry value - use custom if "Other" selected
      const finalIndustry = formData.companyIndustry === "Other" && customIndustry.trim()
        ? customIndustry.trim()
        : formData.companyIndustry
      
      // Save form data to onboarding context
      updateData({
        companyDescription: formData.companyDescription,
        companyIndustry: finalIndustry,
        servicesProducts: formData.servicesProducts.filter(s => s.trim() !== ""),
        companyICP: formData.companyICP.filter(s => s.trim() !== ""),
        websitePlatform: formData.websitePlatform
      })
      
      console.log("✅ Company form data saved successfully")
      router.push("/welcome/competitors")
    } catch (error) {
      console.error("❌ Failed to save company form data", error)
      alert("Failed to save data. Please try again.")
    }
  }

  const isFormValid =
    !!formData.companyDescription &&
    !!formData.companyIndustry &&
    (formData.companyIndustry !== "Other" || customIndustry.trim() !== "") &&
    formData.servicesProducts.some((s) => s.trim() !== "")

  return (
    <Card className="w-full max-w-[480px] mx-auto bg-[#161616] border border-white/[0.06] rounded-2xl shadow-2xl">
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
            className="w-full bg-white/[0.03] border-[1.5px] border-white/[0.06] text-white placeholder:text-white/40 rounded-lg focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:!border-blue-500 min-h-[80px]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="companyIndustry" className="text-sm font-medium text-white/90">
            Company Industry
          </Label>
          <Select value={formData.companyIndustry} onValueChange={(value) => handleInputChange("companyIndustry", value)}>
            <SelectTrigger className="w-full bg-white/[0.03] border-[1.5px] border-white/[0.06] text-white rounded-lg focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:!border-blue-500">
              <SelectValue placeholder="Select your industry" />
            </SelectTrigger>
            <SelectContent className="bg-[#161616] border-white/[0.06]">
              {INDUSTRIES.map((industry) => (
                <SelectItem key={industry} value={industry} className="text-white hover:bg-white/[0.06] focus:bg-white/[0.06]">
                  {industry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formData.companyIndustry === "Other" && (
            <Input
              placeholder="Enter your industry"
              value={customIndustry}
              onChange={(e) => setCustomIndustry(e.target.value)}
              className="w-full bg-white/[0.03] border-[1.5px] border-white/[0.06] text-white placeholder:text-white/40 rounded-lg focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:!border-blue-500 mt-2"
            />
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-white/90">Services / Products</Label>
          <MultiRowInput
            values={formData.servicesProducts}
            onChange={(vals) => handleInputChange("servicesProducts", vals)}
            placeholder="e.g. Web design, AI tools, Consulting"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-white/90">Ideal Customer Profiles</Label>
          <MultiRowInput
            values={formData.companyICP}
            onChange={(vals) => handleInputChange("companyICP", vals)}
            placeholder="e.g. Startup founders, SMB marketers, Enterprise IT"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="websitePlatform" className="text-sm font-medium text-white/90">
            Website Platform <span className="text-white/40 font-normal">(optional)</span>
          </Label>
          <Select value={formData.websitePlatform || undefined} onValueChange={(value) => handleInputChange("websitePlatform", value === "__none__" ? "" : value)}>
            <SelectTrigger className="w-full bg-white/[0.03] border-[1.5px] border-white/[0.06] text-white rounded-lg focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:!border-blue-500">
              <SelectValue placeholder="Select if you use a no-code platform" />
            </SelectTrigger>
            <SelectContent className="bg-[#161616] border-white/[0.06]">
              <SelectItem value="__none__" className="text-white/50 hover:bg-white/[0.06] focus:bg-white/[0.06]">None</SelectItem>
              <SelectItem value="framer" className="text-white hover:bg-white/[0.06] focus:bg-white/[0.06]">Framer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push("/welcome/profile")}
            className="h-9 rounded-lg border border-white/[0.08] bg-transparent px-4 text-white/70 hover:text-white hover:bg-white/[0.04] transition-colors"
          >
            Back
          </button>
          <Button
            type="button"
            onClick={handleNext}
            disabled={!isFormValid}
            className="flex-1 h-10 bg-white text-black border border-white hover:bg-white/90 shadow-none rounded-lg disabled:bg-white disabled:text-black disabled:border-white/60 disabled:cursor-not-allowed disabled:opacity-100"
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