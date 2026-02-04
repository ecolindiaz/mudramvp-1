"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Image from "next/image"
import { useState, useEffect } from "react"
import { Check, Link2, GitBranch, RefreshCw } from "lucide-react"
import { BrandProfileProvider } from "@/components/brand-profile-context"

function IntegrationsPageInner() {
  const [githubConnected, setGithubConnected] = useState(false)
  const [githubUsername, setGithubUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // GitHub account linking state (separate from app installation)
  const [githubLinked, setGithubLinked] = useState(false)
  const [linkedGithubUsername, setLinkedGithubUsername] = useState<string | null>(null)

  // Filter state for All/Installed toggle
  const [filterView, setFilterView] = useState<'all' | 'installed'>('all')

  // Check GitHub connection status on load
  useEffect(() => {
    checkGitHubStatus()
    checkGitHubLinkStatus()
    
    // Check for URL params (success/error messages from OAuth callbacks)
    const params = new URLSearchParams(window.location.search)
    if (params.get('github_linked') === 'true') {
      setSyncMessage({ type: 'success', text: '✓ GitHub account linked successfully!' })
      // Clean up URL
      window.history.replaceState({}, '', '/dashboard/integrations')
      // Refresh status
      checkGitHubLinkStatus()
    }
    const error = params.get('error')
    if (error) {
      const errorMessages: Record<string, string> = {
        'github_already_linked': 'This GitHub account is already linked to another Mudra account.',
        'github_state_mismatch': 'Security check failed. Please try again.',
        'github_not_configured': 'GitHub OAuth is not configured. Please contact support.',
        'github_link_failed': 'Failed to link GitHub account. Please try again.',
      }
      setSyncMessage({ 
        type: 'error', 
        text: errorMessages[error] || `GitHub error: ${error}` 
      })
      window.history.replaceState({}, '', '/dashboard/integrations')
    }
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

  const checkGitHubLinkStatus = async () => {
    try {
      const response = await fetch('/api/auth/github/link/status')
      const data = await response.json()
      
      if (data.success && data.linked) {
        setGithubLinked(true)
        setLinkedGithubUsername(data.githubUsername)
      }
    } catch (error) {
      console.error('Failed to check GitHub link status:', error)
    }
  }

  const handleGitHubLink = () => {
    // Redirect to GitHub OAuth to link account
    window.location.href = '/api/auth/github/link'
  }

  const handleGitHubUnlink = async () => {
    try {
      const response = await fetch('/api/auth/github/link/status', {
        method: 'DELETE',
      })
      
      if (response.ok) {
        setGithubLinked(false)
        setLinkedGithubUsername(null)
        setSyncMessage({ type: 'success', text: 'GitHub account unlinked successfully.' })
      }
    } catch (error) {
      console.error('Failed to unlink GitHub:', error)
      setSyncMessage({ type: 'error', text: 'Failed to unlink GitHub account.' })
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
        // Check if it requires linking
        if (data.requiresLinking) {
          setSyncMessage({ 
            type: 'error', 
            text: 'Please link your GitHub account first (Step 1), then install the GitHub App.' 
          })
        } else {
          setSyncMessage({ 
            type: 'error', 
            text: data.error || 'Failed to sync GitHub installations' 
          })
        }
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
                  <Button
                    variant={filterView === 'all' ? 'default' : 'ghost'}
                    size="sm"
                    className={filterView === 'all' ? 'h-8 rounded-lg bg-white text-black hover:bg-white/90 transition-all duration-200' : 'h-8 rounded-lg bg-[#161616] hover:bg-[#1c1c1c] text-white/70 hover:text-white border-0 transition-all duration-200'}
                    onClick={() => setFilterView('all')}
                  >
                    All
                  </Button>
                  <Button
                    variant={filterView === 'installed' ? 'default' : 'ghost'}
                    size="sm"
                    className={filterView === 'installed' ? 'h-8 rounded-lg bg-white text-black hover:bg-white/90 transition-all duration-200' : 'h-8 rounded-lg bg-[#161616] hover:bg-[#1c1c1c] text-white/70 hover:text-white border-0 transition-all duration-200'}
                    onClick={() => setFilterView('installed')}
                  >
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
                <Card className="group relative overflow-hidden bg-[#161616] rounded-lg border border-white/[0.04]">
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
                  <CardContent className="space-y-4">
                    <p className="text-[15px] text-white/80 leading-relaxed">
                      Connect your repositories so Mudra can open Pull Requests for issues that it finds
                    </p>
                    
                    {/* Sync Message - show at top if present */}
                    {syncMessage && (
                      <div className={`p-2 rounded-lg text-xs ${
                        syncMessage.type === 'success' 
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {syncMessage.text}
                      </div>
                    )}
                    
                    {githubConnected ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                          <Check className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-green-400">Connected as @{githubUsername}</span>
                        </div>
                        <Button 
                          onClick={handleGitHubDisconnect}
                          className="w-full h-10 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium"
                        >
                          Disconnect
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Step 1: Link GitHub Account */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className={`flex items-center justify-center size-5 rounded-full text-xs font-bold ${
                              githubLinked 
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                : 'bg-white/10 text-white/60 border border-white/20'
                            }`}>
                              {githubLinked ? <Check className="h-3 w-3" /> : '1'}
                            </div>
                            <span className="text-sm text-white/80 font-medium">Link GitHub Account</span>
                          </div>
                          
                          {githubLinked ? (
                            <div className="ml-7 flex items-center justify-between p-2 bg-green-500/5 rounded-lg border border-green-500/10">
                              <div className="flex items-center gap-2">
                                <Link2 className="h-3.5 w-3.5 text-green-400" />
                                <span className="text-xs text-green-400">@{linkedGithubUsername}</span>
                              </div>
                              <button 
                                onClick={handleGitHubUnlink}
                                className="text-xs text-white/40 hover:text-white/60"
                              >
                                Unlink
                              </button>
                            </div>
                          ) : (
                            <Button 
                              onClick={handleGitHubLink}
                              disabled={loading}
                              className="ml-7 w-[calc(100%-1.75rem)] h-9 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium"
                            >
                              <Link2 className="h-4 w-4 mr-2" />
                              Link Account
                            </Button>
                          )}
                        </div>
                        
                        {/* Step 2: Install GitHub App */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className={`flex items-center justify-center size-5 rounded-full text-xs font-bold ${
                              githubConnected 
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                : githubLinked 
                                  ? 'bg-white/10 text-white/60 border border-white/20'
                                  : 'bg-white/5 text-white/30 border border-white/10'
                            }`}>
                              {githubConnected ? <Check className="h-3 w-3" /> : '2'}
                            </div>
                            <span className={`text-sm font-medium ${githubLinked ? 'text-white/80' : 'text-white/40'}`}>
                              Install GitHub App
                            </span>
                          </div>
                          
                          <Button 
                            onClick={handleGitHubConnect}
                            disabled={loading || !githubLinked}
                            className="ml-7 w-[calc(100%-1.75rem)] h-9 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <GitBranch className="h-4 w-4 mr-2" />
                            Install App
                          </Button>
                        </div>
                        
                        {/* Sync Button - for existing installations */}
                        {githubLinked && (
                          <div className="pt-2 border-t border-white/5">
                            <Button 
                              onClick={handleGitHubSync}
                              disabled={syncing}
                              variant="ghost"
                              className="w-full h-8 text-xs text-white/50 hover:text-white/80 hover:bg-white/5"
                            >
                              <RefreshCw className={`h-3 w-3 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
                              {syncing ? 'Syncing...' : 'Sync existing installation'}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* GitLab */}
                <Card className="group relative overflow-hidden bg-[#161616] rounded-lg border border-white/[0.04]">
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
                <Card className="group relative overflow-hidden bg-[#161616] rounded-lg border border-white/[0.04]">
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
