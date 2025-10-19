"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { IconSparkles, IconLoader } from "@tabler/icons-react"
import { StarBorder } from "@/components/ui/star-border"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { useAnalysisPipeline } from "@/hooks/use-analysis-pipeline"
import { useBrandProfile } from "@/components/brand-profile-context"

export function MagicButton() {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [isRunning, setIsRunning] = useState(false)
  const router = useRouter()
  const { runPipeline } = useAnalysisPipeline()
  const { brandProfile, refreshBrandProfile } = useBrandProfile()

  const handleAnalysis = async () => {
    if (!url.trim()) {
      toast.error("Please enter a website URL")
      return
    }

    // Basic URL validation
    let normalizedUrl = url.trim()
    try {
      new URL(normalizedUrl.startsWith('http') ? normalizedUrl : `https://${normalizedUrl}`)
    } catch {
      toast.error("Please enter a valid URL")
      return
    }

    if (!companyName.trim()) {
      toast.error("Please enter a company name")
      return
    }

    setIsRunning(true)
    setOpen(false)

    try {
      toast.info("🎯 Magic Button Activated!", {
        description: `Starting Full Analysis Pipeline...`
      })

      // Ensure we have a brand profile
      let profileId = brandProfile?.id
      if (!profileId) {
        // Create a temporary brand profile if none exists
        const response = await fetch('/api/brand-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyName: companyName.trim(),
            companyWebsite: normalizedUrl,
            stage: 'magic',
          }),
        })
        
        if (response.ok) {
          const data = await response.json()
          profileId = data.id
          await refreshBrandProfile()
        } else {
          throw new Error('Failed to create brand profile')
        }
      }

      // Trigger the full analysis pipeline
      await runPipeline({
        brandProfileId: profileId,
        brandName: companyName.trim(),
        website: normalizedUrl,
        description: `${companyName} - AI visibility analysis`,
        industry: 'technology',
        competitors: [],
      })

      toast.success("✅ Analysis Complete!", {
        description: "View your results on the dashboard"
      })

      // Dispatch refresh event
      console.log("🎯 [Magic Button] Dispatching refresh event")
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('mudra:analysis-complete'));
      }

      // Navigate to dashboard to see results
      router.push('/dashboard')
    } catch (error) {
      console.error('Analysis error:', error)
      toast.error("Failed to complete analysis", {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsRunning(false)
    }
  }

  const handleQuickAnalysis = (sampleUrl: string, name: string) => {
    setUrl(sampleUrl)
    setCompanyName(name)
    toast.info(`🚀 Quick Analysis: ${name}`, {
      description: "Company and URL loaded, click Analyze to start"
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <StarBorder
          className="w-full bg-pure-black border-white/20 [&>div:last-child]:py-2.5 [&>div:last-child]:px-4 transition-all duration-300 hover:scale-[1.02] hover:border-white/30 cursor-pointer group"
          color="white"
        >
          <div className="flex items-center justify-center gap-2 text-white text-sm font-medium transition-all duration-300 group-hover:text-white/90">
            <IconSparkles className="w-4 h-4 transition-transform duration-300 group-hover:rotate-12" />
            The Magic Button
          </div>
        </StarBorder>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconSparkles className="w-5 h-5 text-yellow-500" />
            Magic GEO Analysis
          </DialogTitle>
          <DialogDescription>
            Run full analysis: AI Visibility + Traffic Metrics + Technical SEO + AI Report
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="magic-company">Company Name</Label>
            <Input
              id="magic-company"
              placeholder="e.g., OpenAI, Y Combinator"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isRunning && handleAnalysis()}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="magic-url">Website URL</Label>
            <Input
              id="magic-url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAnalysis()
                }
              }}
            />
          </div>
          
          {/* Quick Examples */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Quick Examples:</Label>
            <div className="flex flex-wrap gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickAnalysis("https://www.ycombinator.com", "Y Combinator")}
                className="h-7 px-2 text-xs"
              >
                Y Combinator
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickAnalysis("https://www.stripe.com", "Stripe")}
                className="h-7 px-2 text-xs"
              >
                Stripe
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickAnalysis("https://www.openai.com", "OpenAI")}
                className="h-7 px-2 text-xs"
              >
                OpenAI
              </Button>
            </div>
          </div>
          
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleAnalysis}
              disabled={isRunning || !url.trim()}
              className="flex-1"
            >
              {isRunning ? (
                <>
                  <IconLoader className="w-4 h-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <IconSparkles className="w-4 h-4 mr-2" />
                  Analyze Website
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}