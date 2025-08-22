"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StarBorder } from "@/components/ui/star-border"
import { Button } from "@/components/ui/button"
import { ArrowRight, Plus, X } from "lucide-react"

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
            className="flex-1 bg-black border-white/20 text-white placeholder:text-white/50"
          />
          {rows.length > 1 && (
            <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-lg" onClick={() => removeRow(i)}>
              <X className="size-4" />
            </Button>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg gap-2" onClick={addRow}>
        <Plus className="size-4" /> Add another
      </Button>
    </div>
  )
}

export function CompanyForm() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    companyDescription: "",
    companyIndustry: "",
    servicesProducts: [] as string[],
    companyICP: [] as string[]
  })

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleNext = () => {
    console.log("Form data:", formData)
    router.push("/welcome/competitors")
  }

  const isFormValid =
    !!formData.companyDescription &&
    !!formData.companyIndustry &&
    formData.servicesProducts.some((s) => s.trim() !== "")

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

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push("/welcome/profile")}
            className="h-9 rounded-lg border border-white/20 px-4 text-white/80 hover:text-white"
          >
            Back
          </button>
          <StarBorder
            onClick={handleNext}
            disabled={!isFormValid}
            className={`flex-1 ${!isFormValid ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            color="white"
          >
            <div className="flex items-center justify-center gap-2 text-white">
              Next
              <ArrowRight className="w-4 h-4" />
            </div>
          </StarBorder>
        </div>
      </CardContent>
    </Card>
  )
} 