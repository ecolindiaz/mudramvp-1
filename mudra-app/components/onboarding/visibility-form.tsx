"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ArrowRight, Upload } from "lucide-react"
import { useOnboarding } from "./onboarding-context"
import { trackEvent } from "@/lib/analytics/posthog-events"

export function VisibilityForm() {
  const router = useRouter()
  const { data, updateData } = useOnboarding()
  const [files, setFiles] = useState<File[]>(data.knowledgeBaseFiles)

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : []
    setFiles((prev) => [...prev, ...list])
  }

  const handleNext = async () => {
    try {
      trackEvent.onboardingStepCompleted(5, 'visibility')
      // Save knowledge base files to onboarding context
      updateData({
        knowledgeBaseFiles: files
      })
      
      console.log("✅ Knowledge base files saved successfully")
      router.push("/welcome/prompts")
    } catch (error) {
      console.error("❌ Failed to save knowledge base files", error)
      alert("Failed to save data. Please try again.")
    }
  }

  const isFormValid = true

  const accepted = ".pdf,.doc,.docx,.txt,.md,.csv"

  return (
    <Card className="w-full max-w-[480px] mx-auto bg-[#161616] border border-white/[0.06] rounded-2xl shadow-2xl">
      <CardHeader className="text-center pb-6">
          <CardTitle className="text-2xl font-semibold text-white">
            Knowledge Base
          </CardTitle>
          <CardDescription className="text-white/70">
            Upload documents to use as context for better results (optional)
          </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-white/90">Upload Documents</Label>
          <div className="rounded-lg border border-white/20 bg-black/40 p-4">
            <input type="file" multiple accept={accepted} onChange={handleFiles} className="hidden" id="kb-files" />
            <label htmlFor="kb-files">
              <Button type="button" variant="outline" className="h-9 rounded-full gap-2">
                <Upload className="size-4" /> Select files
              </Button>
            </label>
            <p className="text-[11px] text-white/40 mt-2">Accepted: PDF, DOCX, TXT, MD, CSV. You can skip this step and add documents later.</p>
            {files.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-white/80">
                {files.map((f, i) => (
                  <li key={i} className="truncate">{f.name}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <Button
          type="button"
          onClick={handleNext}
          disabled={!isFormValid}
          className="w-full h-9 bg-white text-black border border-white hover:bg-white/90 shadow-none disabled:bg-white disabled:text-black disabled:border-white/60 disabled:cursor-not-allowed disabled:opacity-100"
        >
          <div className="flex items-center justify-center gap-2">
            Next
            <ArrowRight className="w-4 h-4" />
          </div>
        </Button>
      </CardContent>
    </Card>
  )
} 