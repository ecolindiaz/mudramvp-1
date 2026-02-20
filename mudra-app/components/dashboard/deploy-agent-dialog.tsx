"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, FileCode, Shield, Layers, Route, HelpCircle, Radio, Link2, Sparkles, Github, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"

interface DeploymentItem {
  id: string
  agentName: string
  agentDescription: string
  status: "Ready" | "Building" | "Queued"
  duration: string
  icon: React.ComponentType<{ className?: string }>
  impact: "High" | "Medium" | "Low"
  isActive: boolean
}

interface DeployAgentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeploy?: (deployment: DeploymentItem & { repoConfig?: { repo: string; branch: string } }) => Promise<void>
  deployedAgentIds?: string[]
}

interface GitHubRepo {
  id: number
  name: string
  fullName: string
  defaultBranch: string
  private: boolean
  description?: string
}

const mockDeployments: DeploymentItem[] = [
  {
    id: "content-optimizer",
    agentName: "Content Optimizer",
    agentDescription: "Identifies low-scoring pages and creates optimization PRs with schema markup, FAQs, and headers.",
    status: "Ready",
    duration: "~5m per 10 pages",
    icon: Sparkles,
    impact: "High",
    isActive: true,
  },
  {
    id: "1",
    agentName: "LLMs.txt Indexer",
    agentDescription: "Builds your AI-facing index (llms.txt / llms-full.txt).",
    status: "Ready",
    duration: "3m 16s",
    icon: FileCode,
    impact: "High",
    isActive: true,
  },
  {
    id: "6",
    agentName: "Conversation Radar",
    agentDescription: "Scans Reddit for brand-relevant threads.",
    status: "Ready",
    duration: "~4m initial scan",
    icon: Radio,
    impact: "High",
    isActive: true,
  },
  {
    id: "2",
    agentName: "Robots Gatekeeper",
    agentDescription: "Manages crawler access rules (robots.txt).",
    status: "Queued",
    duration: "Coming soon",
    icon: Shield,
    impact: "Low",
    isActive: false,
  },
  {
    id: "3",
    agentName: "Schema Architect",
    agentDescription: "Adds/validates/modifies structured data.",
    status: "Queued",
    duration: "Coming soon",
    icon: Layers,
    impact: "High",
    isActive: false,
  },
  {
    id: "4",
    agentName: "Content Router",
    agentDescription: "Routes markdown to the right page/section.",
    status: "Queued",
    duration: "Coming soon",
    icon: Route,
    impact: "Medium",
    isActive: false,
  },
  {
    id: "5",
    agentName: "FAQ Author",
    agentDescription: "Generates concise, trustworthy FAQs.",
    status: "Queued",
    duration: "Coming soon",
    icon: HelpCircle,
    impact: "High",
    isActive: false,
  },
  {
    id: "7",
    agentName: "Citations Outreach",
    agentDescription: "Tracks AI-cited sources and contacts authors for mentions.",
    status: "Queued",
    duration: "Coming soon",
    icon: Link2,
    impact: "Medium",
    isActive: false,
  },
]

export function DeploymentList({ onDeploy, deployedAgentIds = [] }: { onDeploy?: (deployment: DeploymentItem & { repoConfig?: { repo: string; branch: string } }) => Promise<void>, deployedAgentIds?: string[] }) {
  const [loadingDeploymentId, setLoadingDeploymentId] = useState<string | null>(null)
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([])
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)
  const [githubConnected, setGithubConnected] = useState(false)
  const [selectedRepos, setSelectedRepos] = useState<Record<string, string>>({})
  const [selectedBranches, setSelectedBranches] = useState<Record<string, string>>({})

  // Fetch GitHub repos on mount
  useEffect(() => {
    const fetchRepos = async () => {
      setIsLoadingRepos(true)
      try {
        const response = await fetch('/api/integrations/github/repositories')
        const result = await response.json()
        
        // Handle both response formats for compatibility
        const repos = result.data?.repos || result.repositories || []
        if (result.success && repos.length > 0) {
          setGithubRepos(repos)
          setGithubConnected(true)
        } else {
          setGithubConnected(false)
        }
      } catch (error) {
        console.error('Error fetching GitHub repos:', error)
        setGithubConnected(false)
      } finally {
        setIsLoadingRepos(false)
      }
    }

    fetchRepos()
  }, [])
  
  const sortedDeployments = [...mockDeployments]
    .map((deployment, index) => ({ deployment, index }))
    .sort((a, b) => {
      const impactOrder = { High: 0, Medium: 1, Low: 2 }

      // Active agents should always appear before inactive ones
      if (a.deployment.isActive !== b.deployment.isActive) {
        return a.deployment.isActive ? -1 : 1
      }

      // Then sort by impact level
      const impactDiff = impactOrder[a.deployment.impact] - impactOrder[b.deployment.impact]
      if (impactDiff !== 0) return impactDiff

      // Preserve original order as a final tiebreaker
      return a.index - b.index
    })
    .map(({ deployment }) => deployment)

  const getImpactChipColor = (impact: DeploymentItem["impact"]) => {
    switch (impact) {
      case "High":
        return "bg-red-500"
      case "Medium":
        return "bg-orange-500"
      case "Low":
        return "bg-[#45dec4]"
      default:
        return "bg-gray-500"
    }
  }

  const getImpactChips = (impact: DeploymentItem["impact"]) => {
    const activeColor = getImpactChipColor(impact)
    const impactOrder: Record<DeploymentItem["impact"], number> = { High: 0, Medium: 1, Low: 2 }
    const activeIndex = impactOrder[impact]
    
    return (
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((chipIndex) => (
          <div
            key={chipIndex}
            className={cn(
              "h-1 w-3 rounded-full",
              chipIndex === activeIndex ? activeColor : "bg-white/10"
            )}
          />
        ))}
      </div>
    )
  }

  const handleDeploy = async (deployment: DeploymentItem) => {
    if (!deployment.isActive || loadingDeploymentId) return
    
    // For Content Optimizer, require repo selection
    if (deployment.id === 'content-optimizer') {
      const selectedRepo = selectedRepos[deployment.id]
      const selectedBranch = selectedBranches[deployment.id]
      
      if (!selectedRepo || !selectedBranch) {
        alert('Please select a GitHub repository and branch for the Content Optimizer')
        return
      }
    }
    
    // Set loading state immediately
    setLoadingDeploymentId(deployment.id)
    
    try {
      if (onDeploy) {
        // Prepare deployment with repo config if Content Optimizer
        const deploymentData = deployment.id === 'content-optimizer' 
          ? {
              ...deployment,
              repoConfig: {
                repo: selectedRepos[deployment.id],
                branch: selectedBranches[deployment.id],
              }
            }
          : deployment
        
        // Wait for the deployment handler to complete
        // This ensures the loading state is visible in the popup
        await onDeploy(deploymentData)
        // Keep loading state visible briefly so user sees it
        await new Promise(resolve => setTimeout(resolve, 800))
        setLoadingDeploymentId(null)
      }
    } catch (error) {
      console.error("Error deploying agent:", error)
      setLoadingDeploymentId(null)
    }
  }

  return (
    <div className="rounded-xl bg-[#111111] overflow-hidden">
      {sortedDeployments.map((deployment, index) => {
        const Icon = deployment.icon
        const isDisabled = !deployment.isActive
        // Support either static deployment IDs OR agent names (Agent Lab uses runtime IDs for deployed agents)
        const isDeployed = deployedAgentIds.includes(deployment.id) || deployedAgentIds.includes(deployment.agentName)
        
        return (
          <div
            key={deployment.id}
            className={cn(
              "relative border-b border-white/[0.03] last:border-b-0 transition-all duration-200",
              isDisabled
                ? "opacity-50"
                : "hover:bg-white/[0.03] group"
            )}
          >
            <div className="px-6 py-5 flex items-center justify-between gap-6">
              {/* Left Section - Icon, Agent Name and Description */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className={cn(
                  "flex items-center justify-center size-10 rounded-lg transition-all duration-200 flex-shrink-0",
                  isDisabled
                    ? "bg-white/[0.03]"
                    : "bg-white/[0.05] group-hover:bg-white/[0.08]"
                )}>
                  <Icon className={cn(
                    "h-5 w-5 transition-colors",
                    isDisabled ? "text-white/40" : "text-white/90 group-hover:text-white"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-semibold leading-5 mb-1.5 transition-colors",
                    isDisabled ? "text-white/50" : "text-white group-hover:text-white"
                  )}>
                    {deployment.agentName}
                  </p>
                  <p className={cn(
                    "text-xs leading-relaxed",
                    isDisabled ? "text-white/40" : "text-white/60"
                  )}>
                    {deployment.agentDescription}
                  </p>
                  
                  {/* GitHub repo selector for Content Optimizer */}
                  {deployment.id === 'content-optimizer' && !isDisabled && (
                    <div className="mt-3 space-y-2">
                      {!githubConnected ? (
                        <div className="flex items-start gap-2 p-2.5 rounded-md bg-orange-500/10 border border-orange-500/20">
                          <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-orange-500 font-medium">GitHub not connected</p>
                            <p className="text-xs text-orange-500/80 mt-0.5">Connect GitHub in Settings → Integrations to deploy this agent</p>
                          </div>
                        </div>
                      ) : isLoadingRepos ? (
                        <div className="flex items-center gap-2 text-xs text-white/50">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Loading repositories...
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-white/50 mb-1 block">Repository</label>
                            <Select
                              value={selectedRepos[deployment.id] || ''}
                              onValueChange={(value) => setSelectedRepos(prev => ({ ...prev, [deployment.id]: value }))}
                            >
                              <SelectTrigger className="h-8 text-xs bg-white/5 border-white/[0.04]">
                                <SelectValue placeholder="Select repo" />
                              </SelectTrigger>
                              <SelectContent>
                                {githubRepos.map((repo) => (
                                  <SelectItem key={repo.id} value={repo.fullName} className="text-xs">
                                    <div className="flex items-center gap-2">
                                      <Github className="h-3 w-3" />
                                      {repo.fullName}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-xs text-white/50 mb-1 block">Branch</label>
                            <Select
                              value={selectedBranches[deployment.id] || ''}
                              onValueChange={(value) => setSelectedBranches(prev => ({ ...prev, [deployment.id]: value }))}
                              disabled={!selectedRepos[deployment.id]}
                            >
                              <SelectTrigger className="h-8 text-xs bg-white/5 border-white/[0.04]">
                                <SelectValue placeholder="Select branch" />
                              </SelectTrigger>
                              <SelectContent>
                                {selectedRepos[deployment.id] && (
                                  <SelectItem value={githubRepos.find(r => r.fullName === selectedRepos[deployment.id])?.defaultBranch || 'main'} className="text-xs">
                                    {githubRepos.find(r => r.fullName === selectedRepos[deployment.id])?.defaultBranch || 'main'}
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Impact Widget */}
              {isDisabled ? (
                <div className="flex items-center gap-2.5 flex-shrink-0 min-w-[95px] px-3 py-1.5 rounded-md">
                  <span className="text-xs text-white/50 font-medium uppercase tracking-wide">Impact</span>
                  {getImpactChips(deployment.impact)}
                </div>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2.5 flex-shrink-0 min-w-[95px] px-3 py-1.5 rounded-md cursor-help hover:bg-white/[0.03] transition-colors">
                      <span className="text-xs text-white/50 font-medium uppercase tracking-wide">Impact</span>
                      {getImpactChips(deployment.impact)}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p>Impact level is based on importance and expected effect on your AI visibility.</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Deploy Button */}
              <div className="flex-shrink-0">
                {isDeployed ? (
                  <div className="flex items-center gap-2 h-9 px-4 rounded-md border border-green-500/30 bg-green-500/10 shadow-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full shadow-sm shadow-green-500/50"></div>
                    <span className="text-xs font-medium text-green-500">Deployed</span>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeploy(deployment)
                    }}
                    disabled={isDisabled || loadingDeploymentId === deployment.id}
                    className={cn(
                      "h-9 px-5 text-xs font-medium transition-all duration-200",
                      isDisabled
                        ? "border-white/[0.06] bg-transparent text-white/40 cursor-not-allowed"
                        : "bg-white text-[#0a0a0a] hover:bg-white/90 hover:text-[#0a0a0a] shadow-sm hover:shadow-md border-0",
                      loadingDeploymentId === deployment.id && "opacity-75 cursor-wait"
                    )}
                  >
                    {loadingDeploymentId === deployment.id ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Deploying...
                      </>
                    ) : (
                      "Deploy"
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function DeployAgentDialog({ open, onOpenChange, onDeploy, deployedAgentIds = [] }: DeployAgentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-3xl sm:!max-w-3xl bg-[#1b1b1b] border-0 p-0 !rounded-[12px] overflow-hidden shadow-xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Deploy Agent</DialogTitle>
        </DialogHeader>
        <div className="bg-[#1b1b1b] px-6 pt-6 pb-6">
          {/* Title and Description */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white mb-2 tracking-tight">
              Choose an Agent
            </h2>
            <p className="text-sm text-white/60 leading-relaxed max-w-2xl">
              Once deployed, agents will work autonomously to fix structured data and improve your AI Search.
            </p>
          </div>

          {/* Nested Container - Deployment List */}
          <DeploymentList onDeploy={onDeploy} deployedAgentIds={deployedAgentIds} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

