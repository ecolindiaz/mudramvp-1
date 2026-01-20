"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import Image from "next/image"
import { useState, useEffect } from "react"
import { Check } from "lucide-react"
import { BrandProfileProvider } from "@/components/brand-profile-context"

function IntegrationsPageInner() {
  const [githubConnected, setGithubConnected] = useState(false)
  const [githubUsername, setGithubUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Check GitHub connection status on load
  useEffect(() => {
    checkGitHubStatus()
  }, [])

  const checkGitHubStatus = async () => {
    try {
      const response = await fetch('/api/integrations/github')
      const data = await response.json()
      
      if (data.success && data.connected) {
        setGithubConnected(true)
        setGithubUsername(data.integration?.githubUsername || null)
      }
    } catch (error) {
      console.error('Failed to check GitHub status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGitHubConnect = () => {
    // Start GitHub App installation flow (allows repository selection)
    const appName = process.env.NEXT_PUBLIC_GITHUB_APP_NAME || 'mudra-content-optimizer'
    
    // GitHub will redirect to the Setup URL configured in the GitHub App settings
    // That should be: http://localhost:3000/api/auth/github/installation/callback
    // or: https://yourdomain.com/api/auth/github/installation/callback
    const githubAuthUrl = `https://github.com/apps/${appName}/installations/new`
    
    // Store a flag to show we're expecting a callback
    sessionStorage.setItem('github_app_connecting', 'true')
    
    window.location.href = githubAuthUrl
  }

  const handleGitHubDisconnect = async () => {
    try {
      const response = await fetch('/api/integrations/github', {
        method: 'DELETE',
      })
      
      if (response.ok) {
        setGithubConnected(false)
        setGithubUsername(null)
      }
    } catch (error) {
      console.error('Failed to disconnect GitHub:', error)
    }
  }

  const handleGitHubSync = async () => {
    setSyncing(true)
    setSyncMessage(null)
    
    try {
      const response = await fetch('/api/integrations/github/sync', {
        method: 'POST',
      })
      
      const data = await response.json()
      
      if (data.success) {
        setSyncMessage({ 
          type: 'success', 
          text: `✓ Synced successfully! Found ${data.data.repositories} repositories.` 
        })
        // Refresh the connection status
        await checkGitHubStatus()
      } else {
        setSyncMessage({ 
          type: 'error', 
          text: data.error || 'Failed to sync GitHub installations' 
        })
      }
    } catch (error) {
      console.error('Failed to sync GitHub:', error)
      setSyncMessage({ 
        type: 'error', 
        text: 'Failed to sync GitHub installations' 
      })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <SidebarProvider
      className="bg-dark-grey"
      style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
    >
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <Separator className="w-full border-border" />

        <div className="flex flex-1 flex-col bg-dark-grey">
          <div className="@container/main flex flex-1 flex-col bg-dark-grey">
            {/* Page Header */}
            <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">Integrations</h1>
                  <p className="text-sm text-white/60 mt-1">
                    Connect your stack to Mudra
                  </p>
                </div>
              </div>
            </div>

            {/* Divider line layout */}
            <div className="h-[0.25px] bg-white/10"></div>

            {/* Toolbar */}
            <div className="px-4 lg:px-6 pt-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="inline-flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-8 rounded-full bg-white text-black hover:bg-white/90 px-3 text-xs font-medium">
                    All
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 rounded-full border border-white/10 bg-white/5 text-white/80 hover:text-white px-3 text-xs font-medium">
                    Installed {githubConnected ? 1 : 0}
                  </Button>
                </div>
                
              </div>
            </div>

            {/* Section - Source Control */}
            <div className="px-4 lg:px-6 pt-6">
              <div className="text-sm text-white/70 mb-3">Source Control</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* GitHub */}
                <Card className="group relative overflow-hidden bg-transparent backdrop-blur-sm rounded-lg border border-white/[0.04] hover:border-white/[0.12] transition-all duration-200">
                  <CardHeader className="border-0 pb-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center size-8 rounded-md bg-white/5 border border-white/10">
                          <Image src="/github.svg" alt="GitHub" width={16} height={16} />
                        </div>
                        <CardTitle className="text-white text-base font-semibold">GitHub</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-[15px] text-white/80 leading-relaxed">
                      Connect your repositories so Mudra can open Pull Requests for issues that it finds
                    </p>
                    {githubConnected ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                          <Check className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-white/90">Connected as @{githubUsername}</span>
                        </div>
                        <Button 
                          onClick={handleGitHubDisconnect}
                          className="w-full h-10 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium"
                        >
                          Disconnect
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Button 
                          onClick={handleGitHubConnect}
                          disabled={loading}
                          className="w-full h-10 rounded-lg bg-white/15 hover:bg-white/20 text-white text-sm font-medium"
                        >
                          {loading ? 'Checking...' : 'Install'}
                        </Button>
                        
                        {/* Manual Sync Button */}
                        <div className="relative">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-px bg-white/10"></div>
                            <span className="text-xs text-white/40">OR</span>
                            <div className="flex-1 h-px bg-white/10"></div>
                          </div>
                          <Button 
                            onClick={handleGitHubSync}
                            disabled={syncing}
                            variant="outline"
                            className="w-full h-9 mt-2 rounded-lg border-white/10 bg-white/5 hover:bg-white/10 text-white/80 text-xs font-medium"
                          >
                            {syncing ? 'Syncing...' : 'Sync Existing Installation'}
                          </Button>
                          
                          {/* Sync Message */}
                          {syncMessage && (
                            <div className={`mt-2 p-2 rounded-lg text-xs ${
                              syncMessage.type === 'success' 
                                ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                              {syncMessage.text}
                            </div>
                          )}
                          
                          <p className="text-xs text-white/40 mt-2">
                            Already installed the GitHub App? Click sync to connect it.
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* GitLab */}
                <Card className="group relative overflow-hidden bg-transparent backdrop-blur-sm rounded-lg border border-white/[0.04] hover:border-white/[0.12] transition-all duration-200">
                  <CardHeader className="border-0 pb-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center size-8 rounded-md bg-white/5 border border-white/10">
                          <Image src="/gitlab-3.svg" alt="GitLab" width={18} height={18} />
                        </div>
                        <CardTitle className="text-white text-base font-semibold">GitLab</CardTitle>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-white/60">Soon</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-[15px] text-white/80 leading-relaxed">
                      Connect your repositories so Mudra can open Pull Requests for issues that it finds
                    </p>
                    <div>
                      <Button disabled className="w-full h-10 rounded-lg bg-white/10 text-white/60 text-sm font-medium">
                        Install
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Slack */}
                <Card className="group relative overflow-hidden bg-transparent backdrop-blur-sm rounded-lg border border-white/[0.04] hover:border-white/[0.12] transition-all duration-200">
                  <CardHeader className="border-0 pb-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center size-8 rounded-md bg-white/5 border border-white/10">
                          <Image src="/slack-logo-thumb.png" alt="Slack" width={18} height={18} />
                        </div>
                        <CardTitle className="text-white text-base font-semibold">Slack</CardTitle>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-white/60">Soon</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-[15px] text-white/80 leading-relaxed">
                      Connect Slack to receive Mudra notifications in your workspace.
                    </p>
                    <div>
                      <Button
                        disabled
                        className="w-full h-10 rounded-lg bg-white/10 text-white/60 text-sm font-medium"
                      >
                        Connect to Slack
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function IntegrationsPage() {
  return (
    <BrandProfileProvider>
      <IntegrationsPageInner />
    </BrandProfileProvider>
  )
}
