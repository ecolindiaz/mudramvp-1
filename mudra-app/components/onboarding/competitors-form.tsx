"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ArrowRight, Plus, X } from "lucide-react"
import { useOnboarding } from "./onboarding-context"

// Validate URL format
function isValidUrl(url: string): boolean {
  if (!url.trim()) return false
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

export function CompetitorsForm() {
  const router = useRouter()
  const { data, updateData } = useOnboarding()

  // Initialize with empty slots - we'll sync from context in useEffect
  const [competitors, setCompetitors] = useState<string[]>(["", ""])
  const [isInitialized, setIsInitialized] = useState(false)

  // Sync competitors from context (extraction data or previously saved data)
  useEffect(() => {
    // Skip if already initialized with data
    if (isInitialized) return

    // Priority 1: Use existing user-entered competitors from context
    if (data.competitors.length > 0) {
      setCompetitors(data.competitors)
      setIsInitialized(true)
      return
    }

    // Priority 2: Use extracted competitor URLs if available
    const extracted = data.extractedCompanyInfo
    if (extracted && data.extractionStatus === 'completed' && extracted.competitorUrls.length > 0) {
      const validUrls = extracted.competitorUrls.filter(isValidUrl)
      if (validUrls.length > 0) {
        setCompetitors(validUrls.length >= 2 ? validUrls : [...validUrls, ""])
        setIsInitialized(true)
        console.log("📝 Competitors form populated with extracted data")
      }
    }
  }, [data.extractedCompanyInfo, data.extractionStatus, data.competitors, isInitialized])

  const handleCompetitorChange = (index: number, value: string) => {
    const updated = [...competitors]
    updated[index] = value
    setCompetitors(updated)
  }

  const addCompetitor = () => {
    setCompetitors([...competitors, ""])
  }

  const removeCompetitor = (index: number) => {
    if (competitors.length > 2) {
      const updated = competitors.filter((_, i) => i !== index)
      setCompetitors(updated)
    }
  }

  const handleNext = async () => {
    try {
      // Save competitors data to onboarding context
      updateData({
        competitors: competitors.filter(c => c.trim() !== "")
      })
      
      console.log("✅ Competitors form data saved successfully")
      router.push("/welcome/visibility")
    } catch (error) {
      console.error("❌ Failed to save competitors form data", error)
      alert("Failed to save data. Please try again.")
    }
  }

  // Allow proceeding without competitors - they're optional
  const isFormValid = true

  return (
    <Card className="w-full max-w-[480px] mx-auto bg-[#161616] border border-white/[0.06] rounded-2xl shadow-2xl">
      <CardHeader className="text-center pb-6">
        <CardTitle className="text-2xl font-semibold text-white">
          Competitors
        </CardTitle>
        <CardDescription className="text-white/70">
          Who are your main competitors?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {competitors.map((competitor, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={`competitor-${index}`} className="text-sm font-medium text-white/90">
                Competitor Website {index + 1}
              </Label>
              {competitors.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCompetitor(index)}
                  className="h-6 w-6 p-0 text-white/50 hover:text-white hover:bg-white/[0.06]"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <Input
              id={`competitor-${index}`}
              type="url"
              placeholder="https://competitor.com"
              value={competitor}
              onChange={(e) => handleCompetitorChange(index, e.target.value)}
              className="w-full bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/40 rounded-lg focus:ring-white/20 focus:border-white/20"
            />
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={addCompetitor}
          className="w-full border-white/[0.08] text-white hover:bg-white/[0.04] hover:text-white rounded-lg"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Another Competitor
        </Button>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push("/welcome/company")}
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