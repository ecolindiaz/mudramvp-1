"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { IconLoader, IconSparkles } from "@tabler/icons-react"
import { toast } from "sonner"

export function GenerateReportButton() {
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerateReport = async () => {
    try {
      const siteId = typeof window !== 'undefined' ? (localStorage.getItem('mudra:siteId') || '') : ''
      if (!siteId) {
        toast.error('Analyze a website first to set a site context.')
        return
      }

      setIsGenerating(true)
      toast.info('🔄 Generating NLR Report...', {
        description: 'This may take 30-60 seconds'
      })

      const resp = await fetch('/api/internal/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId })
      })
      
      const js = await resp.json()
      
      if (!resp.ok || !js?.success) {
        throw new Error(js?.error?.message || 'Failed to generate report')
      }

      toast.success('✅ Report Generated Successfully!', {
        description: 'Natural Language Report has been updated'
      })

      // Trigger NLR component refresh
      window.dispatchEvent(new CustomEvent('mudra:nlr-refresh'))
      
    } catch (e: any) {
      toast.error('❌ Report Generation Failed', {
        description: e?.message || 'Please try again'
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Button
      variant="outline"
      className="h-9 rounded-lg"
      onClick={handleGenerateReport}
      disabled={isGenerating}
    >
      {isGenerating ? (
        <>
          <IconLoader className="size-4 mr-2 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <IconSparkles className="size-4 mr-2" />
          Generate Report
        </>
      )}
    </Button>
  )
}
