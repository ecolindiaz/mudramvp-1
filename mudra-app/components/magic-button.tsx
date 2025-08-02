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

export function MagicButton() {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [isRunning, setIsRunning] = useState(false)
  const router = useRouter()

  const handleAnalysis = async () => {
    if (!url.trim()) {
      toast.error("Please enter a website URL")
      return
    }

    // Basic URL validation
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`)
    } catch {
      toast.error("Please enter a valid URL")
      return
    }

    setIsRunning(true)
    setOpen(false)

    try {
      // Store URL in sessionStorage for the report page
      sessionStorage.setItem('magicAnalysisUrl', url.trim())
      
      toast.info("🎯 Magic Button Activated!", {
        description: `Starting Enhanced GEO Analysis...`
      })

      // Navigate to report page with magic parameter
      router.push('/report?magic=true')
    } catch (error) {
      console.error('Navigation error:', error)
      toast.error("Failed to start analysis")
    } finally {
      setIsRunning(false)
    }
  }

  const handleQuickAnalysis = (sampleUrl: string, name: string) => {
    setUrl(sampleUrl)
    toast.info(`🚀 Quick Analysis: ${name}`, {
      description: "URL loaded, click Analyze to start"
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
            Enter a website URL to analyze its AI visibility and generate optimization tasks
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
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