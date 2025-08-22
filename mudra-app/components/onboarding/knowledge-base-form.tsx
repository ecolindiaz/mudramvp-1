"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { StarBorder } from "@/components/ui/star-border"
import { ArrowRight, Upload } from "lucide-react"

export function KnowledgeBaseForm() {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : []
    setFiles((prev) => [...prev, ...list])
  }

  const handleNext = () => {
    console.log("KB files:", files.map(f => f.name))
    router.push("/welcome/prompts")
  }

  const isFormValid = true
  const accepted = ".pdf,.doc,.docx,.txt,.md,.csv"

  return (
    <Card className="w-full max-w-md mx-auto bg-black border border-white/20 shadow-lg">
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
              <Button type="button" variant="outline" className="h-9 rounded-lg gap-2">
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

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push("/welcome/competitors")}
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


