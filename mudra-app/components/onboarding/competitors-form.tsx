"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { StarBorder } from "@/components/ui/star-border"
import { ArrowRight, Plus, X } from "lucide-react"

export function CompetitorsForm() {
  const router = useRouter()
  const [competitors, setCompetitors] = useState<string[]>(["", ""])

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

  const handleNext = () => {
    console.log("Competitors:", competitors.filter(c => c.trim() !== ""))
    router.push("/welcome/visibility")
  }

  const isFormValid = competitors.filter(c => c.trim() !== "").length >= 1

  return (
    <Card className="w-full max-w-md mx-auto bg-black border border-white/20 shadow-lg">
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
                  className="h-6 w-6 p-0 text-white/50 hover:text-white hover:bg-white/10"
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
              className="w-full bg-black border-white/20 text-white placeholder:text-white/50"
            />
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={addCompetitor}
          className="w-full border-white/20 text-white hover:bg-white/10 hover:text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Another Competitor
        </Button>

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