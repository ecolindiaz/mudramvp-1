"use client"

import { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { CrawlerHealthScore } from "@/components/analysis/crawler-detection/crawler-health-score"
import { BotActivity } from "@/components/analysis/crawler-detection/bot-activity"
import { StructurePageScore } from "@/components/analysis/crawler-detection/structure-page-score"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { IconSettings, IconArrowLeft, IconCopy, IconCheck } from "@tabler/icons-react"
import { toast } from "sonner"

// Simplified Settings Component - Only "Getting started"
function TechnicalSettings() {
  const [copied, setCopied] = useState(false)
  
  const trackingCode = `<script
  data-project-id="c10e7966-db70-4b2d-8147-4311107554a0"
  src="https://mudra.ai/tracking/client.min.js">
</script>`

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(trackingCode)
      setCopied(true)
      toast.success("Tracking code copied to clipboard!")
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error("Failed to copy to clipboard")
    }
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-2 bg-black">
      <div className="flex flex-col gap-8 p-6 md:gap-12 md:p-8 max-w-4xl mx-auto w-full">
        <Card className="bg-card border-border min-h-[600px]">
          <CardHeader className="pb-8">
            <CardTitle className="text-foreground text-xl">Getting started</CardTitle>
            <CardDescription className="text-muted-foreground text-base">
              Let Mudra analyze traffic on your website, to gain insights into AI traffic and usage.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="flex gap-6">
              <div className="flex-shrink-0 w-10 h-10 bg-white text-black rounded-full flex items-center justify-center text-sm font-medium">
                1
              </div>
              <div className="flex-1">
                <p className="font-medium mb-4 text-foreground text-base">
                  Paste this code into the head of <code className="bg-muted px-1.5 py-0.5 rounded text-sm">your-domain.com</code>:
                </p>
                <div className="relative bg-muted/50 border border-border rounded-lg p-6">
                  <pre className="text-sm text-foreground overflow-x-auto">
                    <code>{trackingCode}</code>
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 h-8 w-8 p-0"
                    onClick={copyToClipboard}
                  >
                    {copied ? (
                      <IconCheck className="h-4 w-4 text-green-600" />
                    ) : (
                      <IconCopy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex-shrink-0 w-10 h-10 bg-white text-black rounded-full flex items-center justify-center text-sm font-medium">
                2
              </div>
              <div className="flex-1">
                <p className="font-medium mb-4 text-foreground text-base">
                  Once implemented in your website, verify the implementation to start receiving data.
                </p>
                <Button className="bg-white hover:bg-gray-100 text-black px-6 py-2">
                  Verify
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function TechnicalPage() {
  const [showSettings, setShowSettings] = useState(false)

  return (
    <SidebarProvider
      className="bg-black"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset className="bg-black m-0 shadow-none rounded-none border-none">
        <SiteHeader />
        <div className="flex flex-1 flex-col bg-black">
          <div className="@container/main flex flex-1 flex-col gap-2 bg-black">
            <div className="flex flex-col gap-6 p-4 md:gap-8 md:p-6">
              
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    {showSettings ? "Technical Settings" : "Technical Analysis"}
                  </h1>
                  <p className="text-gray-400">
                    {showSettings 
                      ? "Configure your tracking and analytics settings" 
                      : "Monitor AI crawler activity and technical performance"
                    }
                  </p>
                </div>
                {showSettings ? (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2 border-gray-800 text-white hover:bg-gray-900 rounded-xl"
                    onClick={() => setShowSettings(false)}
                  >
                    <IconArrowLeft className="h-4 w-4" />
                    Back to Analysis
                  </Button>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2 border-gray-800 text-white hover:bg-gray-900 rounded-xl"
                    onClick={() => setShowSettings(true)}
                  >
                    <IconSettings className="h-4 w-4" />
                    Settings
                  </Button>
                )}
              </div>

              {/* Main Content */}
              {showSettings ? (
                <TechnicalSettings />
              ) : (
                <>
                  <div className="grid gap-6 md:grid-cols-2">
                    <CrawlerHealthScore />
                    <StructurePageScore />
                  </div>
                  <BotActivity />
                </>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 