"use client"

import { useState } from "react"
import { IconSettings, IconCopy, IconCheck } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

export function TechnicalSettingsModal() {
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
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <IconSettings className="h-4 w-4" />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground">Analytics Settings</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Manage your analytics settings and tracking implementation.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Current Status</h3>
              <div className="grid gap-4">
                <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-background">
                  <div>
                    <p className="font-medium text-foreground">Tracking Status</p>
                    <p className="text-sm text-muted-foreground">Monitor AI crawler activity</p>
                  </div>
                  <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                    Pending Setup
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-background">
                  <div>
                    <p className="font-medium text-foreground">Data Collection</p>
                    <p className="text-sm text-muted-foreground">AI model performance tracking</p>
                  </div>
                  <Badge variant="secondary" className="bg-red-500/10 text-red-600 border-red-500/20">
                    Not Active
                  </Badge>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6 mt-6">
            <div className="space-y-6">
              <div className="bg-background border border-border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-2 text-foreground">Getting started</h3>
                <p className="text-muted-foreground mb-6">
                  Let Mudra analyze traffic on your website, to gain insights into AI traffic and usage.
                </p>

                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                      1
                    </div>
                    <div className="flex-1">
                      <p className="font-medium mb-3 text-foreground">
                        Paste this code into the head of <code className="bg-muted px-1.5 py-0.5 rounded text-sm">your-domain.com</code>:
                      </p>
                      <div className="relative bg-muted/50 border border-border rounded-lg p-4">
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

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                      2
                    </div>
                    <div className="flex-1">
                      <p className="font-medium mb-3 text-foreground">
                        Once implemented in your website, verify the implementation to start receiving data.
                      </p>
                      <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                        Verify
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-background border border-border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-2 text-foreground">Advanced Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">Real-time monitoring</p>
                      <p className="text-sm text-muted-foreground">Enable live AI crawler detection</p>
                    </div>
                    <Button variant="outline" size="sm">
                      Configure
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">Data retention</p>
                      <p className="text-sm text-muted-foreground">Set data storage duration</p>
                    </div>
                    <Button variant="outline" size="sm">
                      Configure
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
} 