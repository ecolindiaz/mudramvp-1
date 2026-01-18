"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bot, Loader2, GitBranch, ChevronDown, GitPullRequest, Search, Check, Clock, Layers, Rocket, Radio, ChevronRight, ChevronLeft, ListChecks, BookOpen, XCircle, MoreHorizontal, Sparkles, type LucideProps } from "lucide-react"
import { BrowserWindowEmpty } from "@/components/empty-states/browser-window-empty"
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { BrandProfileProvider, useBrandProfile } from "@/components/brand-profile-context"
import { DeployAgentDialog } from "@/components/dashboard/deploy-agent-dialog"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

const RedditIcon = (props: LucideProps) => (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="9" cy="12" r="1" />
    <circle cx="15" cy="12" r="1" />
    <path d="M7.5 13.5c.8 1 2.3 1.7 4.5 1.7s3.7-.7 4.5-1.7" />
    <path d="M14.5 7.5 15 4.5l2.5.6" />
  </svg>
)

function AgentsLabPageInner() {
  const { profile } = useBrandProfile()
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // State for Technical Structure score
  const [technicalScore, setTechnicalScore] = useState(0)
  
  // State for Deploy Agent Dialog
  const [isDeployDialogOpen, setIsDeployDialogOpen] = useState(false)
  
  // State for Active/Inactive view
  const [viewMode, setViewMode] = useState<"active" | "inactive">("active")
  
  // State for branch selector
  const [selectedBranch, setSelectedBranch] = useState("main")
  const [branchSearchQuery, setBranchSearchQuery] = useState("")
  // PR sidebar
  const [isPrSheetOpen, setIsPrSheetOpen] = useState(false)
  const activePullRequests: Array<{ id: number; title: string; branch: string; updatedAt: string; status: "open" | "draft" }> = [
    { id: 142, title: "feat: improve LLMs.txt index generation", branch: "feature/llms-improve-index", updatedAt: "2m ago", status: "open" },
    { id: 139, title: "fix: robots rules for AI crawlers", branch: "fix/robots-ai-crawlers", updatedAt: "14m ago", status: "draft" },
    { id: 133, title: "docs: update GEO readme", branch: "docs/update-geo-readme", updatedAt: "38m ago", status: "open" },
  ]
  
  // State for GitHub connection
  const [isGithubConnected, setIsGithubConnected] = useState(false)
  const [isConnectingGithub, setIsConnectingGithub] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null)
  const [repoSearchQuery, setRepoSearchQuery] = useState("")
  const [isRepoDropdownOpen, setIsRepoDropdownOpen] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [taskFilter, setTaskFilter] = useState<"active" | "all">("active")
  const [taskSearchQuery, setTaskSearchQuery] = useState("")
  
  // Mock repos data - will be replaced with actual data
  const mockRepos = [
    { id: "1", name: "mudramvp", owner: "EmiCorleone", fullName: "EmiCorleone/mudramvp" },
    { id: "2", name: "company-website", owner: "EmiCorleone", fullName: "EmiCorleone/company-website" },
    { id: "3", name: "marketing-site", owner: "EmiCorleone", fullName: "EmiCorleone/marketing-site" },
    { id: "4", name: "portfolio", owner: "EmiCorleone", fullName: "EmiCorleone/portfolio" },
  ]
  
  // Mock branches data - will be replaced with actual data
  const mockBranches = [
    "main",
    "develop",
    "staging",
    "feature/safe-update-and-react",
    "hong/ai_philic_content",
    "TechnicalStructure",
    "AIReferredTrafficFrontEnd",
    "dev",
  ]
  
  // Mount state to prevent hydration mismatch
  const [isMounted, setIsMounted] = useState(false)
  
  // Content Optimizer state
  const [isOptimizerRunning, setIsOptimizerRunning] = useState(false)
  const [optimizerResults, setOptimizerResults] = useState<Array<{
    url: string
    originalScore: number
    improvements: Array<{ type: string; description: string; impact: string }>
    prUrl?: string
    error?: string
  }>>([])
  
  // Conversation Radar state
  const [radarOpportunities, setRadarOpportunities] = useState<any[]>([])
  const [isLoadingRadar, setIsLoadingRadar] = useState(false)
  const [radarStats, setRadarStats] = useState<{ total: number; new: number } | null>(null)

  const activeRadarOpportunitiesCount = radarOpportunities.filter((o: any) => {
    // API already maps DB "new" -> "queued" for the frontend.
    const isActive = o.status === "queued" || o.status === "running"
    const scoreOk = typeof o.relevanceScore === "number" && o.relevanceScore >= 70
    return isActive && scoreOk
  }).length
  
  useEffect(() => {
    setIsMounted(true)
  }, [])
  
  // State for deployed agents
  const [deployedAgents, setDeployedAgents] = useState<Array<{
    id: string
    agentName: string
    agentDescription: string
    icon: React.ComponentType<{ className?: string }>
    impact: "High" | "Medium" | "Low"
    deployedAt: Date
    lastActivity: Date
    status: "deploying" | "active" | "inactive"
  }>>([])

  // Handle agent selection from URL params (for back navigation from opportunity detail)
  useEffect(() => {
    const agentIdFromUrl = searchParams?.get("agent")
    // URL is the source of truth:
    // - If URL has an agent param, select that agent
    // - If URL has NO agent param, clear selection (go back to main Agent Lab)
    if (!agentIdFromUrl) {
      if (selectedAgentId !== null) setSelectedAgentId(null)
      return
    }

    if (deployedAgents.length > 0) {
      const agentExists = deployedAgents.some((agent) => agent.id === agentIdFromUrl)
      if (agentExists && selectedAgentId !== agentIdFromUrl) {
        setSelectedAgentId(agentIdFromUrl)
      }
    }
  }, [searchParams, deployedAgents, selectedAgentId])

  const agentMetricsMap: Record<string, { optimizations: number; activeTasks: number; totalTasks: number }> = {
    "Content Optimizer": { optimizations: 0, activeTasks: 0, totalTasks: 0 },
    "LLMs.txt Indexer": { optimizations: 24, activeTasks: 3, totalTasks: 5 },
    "Robots Gatekeeper": { optimizations: 18, activeTasks: 2, totalTasks: 4 },
    "Schema Architect": { optimizations: 31, activeTasks: 4, totalTasks: 6 },
    "Content Router": { optimizations: 12, activeTasks: 1, totalTasks: 3 },
    "FAQ Author": { optimizations: 9, activeTasks: 1, totalTasks: 2 },
    // Use real data for Conversation Radar - only count 70%+ relevance opportunities as "active"
    "Conversation Radar": { 
      optimizations: radarOpportunities.filter((o: any) =>
        (o.status === 'queued' || o.status === 'running') &&
        typeof o.relevanceScore === 'number' &&
        o.relevanceScore >= 70
      ).length || 0,
      activeTasks: radarOpportunities.filter((o: any) =>
        (o.status === 'queued' || o.status === 'running') &&
        typeof o.relevanceScore === 'number' &&
        o.relevanceScore >= 70
      ).length,
      totalTasks: radarOpportunities.length
    },
    "Citations Outreach": { optimizations: 11, activeTasks: 2, totalTasks: 3 },
  }

  // Fetch Technical Structure score
  const fetchTechnicalHistory = async () => {
    if (!profile.id) return

    try {
      const response = await fetch(`/api/analysis/technical-history?brandProfileId=${profile.id}&limit=1`)
      const result = await response.json()
      
      if (result.success && result.data && result.data.length > 0) {
        // Most recent score
        const current = result.data[0]
        setTechnicalScore(current.overallScore || 0)
        console.log('📊 Technical score updated:', current.overallScore)
      }
    } catch (error) {
      console.error('Error fetching technical history:', error)
    }
  }

  // Fetch Conversation Radar opportunities
  const fetchRadarOpportunities = async () => {
    if (!profile.id) return
    
    setIsLoadingRadar(true)
    try {
      // Fetch opportunities
      const response = await fetch(`/api/conversation-radar/opportunities?brandProfileId=${profile.id}&status=all&limit=50`)
      const result = await response.json()
      
      if (result.success && result.data) {
        setRadarOpportunities(result.data)
      }
      
      // Fetch stats
      const statsResponse = await fetch(`/api/conversation-radar/run?brandProfileId=${profile.id}`)
      const statsResult = await statsResponse.json()
      
      if (statsResult.success && statsResult.data) {
        setRadarStats({
          total: statsResult.data.counts.total,
          new: statsResult.data.counts.new,
        })
      }
    } catch (error) {
      console.error('Error fetching radar opportunities:', error)
    } finally {
      setIsLoadingRadar(false)
    }
  }

  // Fetch deployed agents from database
  const fetchDeployedAgents = async () => {
    if (!profile.id) return

    try {
      const response = await fetch(`/api/agents/deployed?brandProfileId=${profile.id}`)
      const result = await response.json()
      
      if (result.success && result.data) {
        // Map database records to UI state
        const agents = result.data.map((agent: any) => ({
          id: `${agent.agentType}-${agent.id}`,
          agentName: agent.agentType.split('_').map((w: string) => 
            w.charAt(0).toUpperCase() + w.slice(1)
          ).join(' '),
          agentDescription: 'Deployed agent',
          icon: Sparkles,
          impact: 'High' as const,
          deployedAt: new Date(agent.createdAt),
          lastActivity: new Date(agent.updatedAt),
          status: 'active' as const,
        }))
        setDeployedAgents(agents)
      }
    } catch (error) {
      console.error('Error fetching deployed agents:', error)
    }
  }

  // Initial data fetch
  useEffect(() => {
    if (profile.id) {
      fetchTechnicalHistory()
      fetchDeployedAgents()
      fetchRadarOpportunities()
    }
  }, [profile.id])

  // Listen for website analysis completion
  useEffect(() => {
    const handleWebsiteAnalyzed = async () => {
      console.log('🔄 Website analyzed, refreshing technical score')
      await fetchTechnicalHistory()
    }

    window.addEventListener('mudra:website-analyzed', handleWebsiteAnalyzed)
    return () => window.removeEventListener('mudra:website-analyzed', handleWebsiteAnalyzed)
  }, [profile.id])

  // Handle agent deployment
  const handleDeployAgent = async (deployment: {
    id: string
    agentName: string
    agentDescription: string
    icon: React.ComponentType<{ className?: string }>
    impact: "High" | "Medium" | "Low"
    repoConfig?: { repo: string; branch: string }
  }) => {
    // Generate unique ID for this deployment instance
    const uniqueId = `${deployment.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Wait to show loading state in popup first (allows user to see "Deploying..." button)
    // This delay ensures the loading state is visible before anything else happens
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // Close dialog now, but keep loading state in popup visible until this resolves
    setIsDeployDialogOpen(false)
    
    // Add deployed agent to the list with "deploying" status after popup closes
    // This ensures it shows in the main view with "Deploying..." status
    const now = new Date()
    const newAgent = {
      id: uniqueId,
      agentName: deployment.agentName,
      agentDescription: deployment.agentDescription,
      icon: deployment.icon,
      impact: deployment.agentName === "Conversation Radar" ? ("High" as const) : deployment.impact,
      deployedAt: now,
      lastActivity: now,
      status: "deploying" as const
    }
    
    // Wait a tiny bit after dialog closes before adding to list (better UX)
    await new Promise(resolve => setTimeout(resolve, 100))
    setDeployedAgents(prev => [...prev, newAgent])
    
    // Persist to database with repo config
    try {
      const agentType = deployment.agentName.toLowerCase().replace(/\s+/g, '_')
      const config: any = {}
      
      // Add GitHub repo config for Content Optimizer
      if (deployment.repoConfig) {
        config.githubRepo = deployment.repoConfig.repo
        config.githubBranch = deployment.repoConfig.branch
      }
      
      await fetch('/api/agents/deployed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandProfileId: profile.id,
          agentType,
          cronExpression: '0 9 * * *', // Daily at 9am
          config,
        }),
      })
    } catch (error) {
      console.error('Failed to persist agent deployment:', error)
    }
    
    // Special handling for Conversation Radar - actually run the search
    if (deployment.agentName === "Conversation Radar") {
      try {
        console.log('🔍 Starting Conversation Radar search...')
        setIsLoadingRadar(true)
        
        // Run the actual conversation radar search (proactive mode)
        // This calls the same backend that the terminal tests use
        const runResponse = await fetch('/api/conversation-radar/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brandProfileId: profile.id,
            mode: 'proactive', // Use proactive to search Reddit based on tracked prompts
            analyze: true,     // Run LLM analysis on found opportunities
            analyzeLimit: 15,  // Analyze up to 15 opportunities
          }),
        })
        
        const runResult = await runResponse.json()
        console.log('📊 Conversation Radar run result:', runResult)
        
        if (runResult.success) {
          // Fetch the new opportunities
          await fetchRadarOpportunities()
          
          // Update agent status to active
          setDeployedAgents(prev => prev.map(agent => 
            agent.id === uniqueId 
              ? { ...agent, status: "active" as const, lastActivity: new Date() }
              : agent
          ))
          
          console.log('✅ Conversation Radar deployed and running:', runResult.message)
        } else {
          console.error('❌ Conversation Radar run failed:', runResult.error)
          // Still mark as active - agent is deployed even if first run had issues
          setDeployedAgents(prev => prev.map(agent => 
            agent.id === uniqueId 
              ? { ...agent, status: "active" as const, lastActivity: new Date() }
              : agent
          ))
        }
      } catch (error) {
        console.error('❌ Error running Conversation Radar:', error)
        // Mark as inactive on error
        setDeployedAgents(prev => prev.map(agent => 
          agent.id === uniqueId 
            ? { ...agent, status: "inactive" as const }
            : agent
        ))
      } finally {
        setIsLoadingRadar(false)
      }
      return
    }
    
    // Default behavior for other agents
    // Simulate deployment delay - this will be replaced with actual backend call
    try {
      // Wait 5 seconds after popup closes for deployment to complete
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      // Update agent status to "active" after successful deployment
      setDeployedAgents(prev => prev.map(agent => 
        agent.id === uniqueId 
          ? { ...agent, status: "active" as const, lastActivity: new Date() }
          : agent
      ))
      
      console.log('✅ Agent deployed successfully:', deployment.agentName)
    } catch (error) {
      // Handle deployment error
      setDeployedAgents(prev => prev.map(agent => 
        agent.id === uniqueId 
          ? { ...agent, status: "inactive" as const }
          : agent
      ))
      console.error('❌ Error deploying agent:', error)
    }
  }

  // Get impact chip color
  const getImpactChipColor = (impact: "High" | "Medium" | "Low") => {
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

  // Get impact chips
  const renderChipRow = (activeColor: string, activeIndex = 1) => (
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

  const getImpactChips = (impact: "High" | "Medium" | "Low") => {
    const activeColor = getImpactChipColor(impact)
    const impactOrder: Record<"High" | "Medium" | "Low", number> = { High: 0, Medium: 1, Low: 2 }
    const activeIndex = impactOrder[impact]
    return renderChipRow(activeColor, activeIndex)
  }

  // Render opportunity-specific impact chips based on mode (proactive vs cited)
  const renderOpportunityImpactChips = (task: TaskRow) => {
    // For Conversation Radar opportunities:
    // - cited/tracked (AI cited source) => red (High priority - already in AI training data)
    // - proactive search => orange (Medium priority - potential opportunity)
    if (!task.platform) return getImpactChips(task.impact)
    const color = task.promptOrigin === "tracked" ? "bg-red-500" : "bg-orange-400"
    return renderChipRow(color, 0) // Always show first chip lit for opportunities
  }

  type RunStatusKey = "operational" | "down" | "not-deployed"

  const RUN_STATUS_DETAILS: Record<
    RunStatusKey,
    { label: string; color: string; activeIndex: number }
  > = {
    operational: { label: "Operational", color: "bg-emerald-500", activeIndex: 0 },
    down: { label: "Down", color: "bg-red-500", activeIndex: 1 },
    "not-deployed": { label: "Not Deployed", color: "bg-gray-500", activeIndex: 2 },
  }

  const getRunStatusFromAgentStatus = (status: "deploying" | "active" | "inactive"): RunStatusKey => {
    if (status === "active") return "operational"
    if (status === "inactive") return "down"
    return "not-deployed"
  }

  const getRunStatusChips = (status: RunStatusKey) => {
    const details = RUN_STATUS_DETAILS[status]
    return renderChipRow(details.color, details.activeIndex)
  }

  // Filter deployed agents based on view mode
  const filteredDeployedAgents = viewMode === "active" 
    ? deployedAgents.filter(agent => agent.status === "active" || agent.status === "deploying")
    : deployedAgents.filter(agent => agent.status === "inactive")
  
  // Format time ago
  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) {
      return "Just now"
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60)
      return `${minutes}m ago`
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600)
      return `${hours}h ago`
    } else {
      const days = Math.floor(diffInSeconds / 86400)
      return `${days}d ago`
    }
  }
  
  // Filter branches based on search query
  const filteredBranches = mockBranches.filter(branch =>
    branch.toLowerCase().includes(branchSearchQuery.toLowerCase())
  )
  
  // Filter repos based on search query
  const filteredRepos = mockRepos.filter(repo =>
    repo.name.toLowerCase().includes(repoSearchQuery.toLowerCase()) ||
    repo.fullName.toLowerCase().includes(repoSearchQuery.toLowerCase())
  )
  
  // Handle GitHub connection
  const handleGithubConnect = async () => {
    setIsConnectingGithub(true)
    // Simulate GitHub OAuth flow
    await new Promise(resolve => setTimeout(resolve, 2000))
    setIsGithubConnected(true)
    setIsConnectingGithub(false)
    setIsRepoDropdownOpen(true)
  }
  
  // Handle repo selection
  const handleRepoSelect = (repoId: string) => {
    const repo = mockRepos.find(r => r.id === repoId)
    if (repo) {
      setSelectedRepo(repoId)
      setIsRepoDropdownOpen(false)
      setRepoSearchQuery("")
    }
  }

  // Run Content Optimizer
  const runContentOptimizer = async (maxPages: number = 10) => {
    if (!profile.id) return

    setIsOptimizerRunning(true)
    setOptimizerResults([])

    try {
      const response = await fetch('/api/agents/content-optimizer/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandProfileId: profile.id,
          input: { maxPages },
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Optimization failed')
      }

      const optimizedPages = data.data?.optimizedPages || []
      setOptimizerResults(optimizedPages)

      // Update agent metrics
      const successCount = optimizedPages.filter((p: any) => p.prUrl).length
      agentMetricsMap["Content Optimizer"] = {
        optimizations: successCount,
        activeTasks: 0,
        totalTasks: optimizedPages.length,
      }
    } catch (error) {
      console.error('Content Optimizer error:', error)
    } finally {
      setIsOptimizerRunning(false)
    }
  }

  // Pause/Resume and Run Now handlers
  const handleTogglePause = (agentId: string) => {
    setDeployedAgents(prev =>
      prev.map(agent =>
        agent.id === agentId
          ? {
              ...agent,
              status: agent.status === "active" ? ("inactive" as const) : ("active" as const),
              lastActivity: new Date(),
            }
          : agent
      )
    )
    // If pausing/resuming currently selected agent, keep detail in sync
    if (selectedAgentId === agentId) {
      const updated = deployedAgents.find(a => a.id === agentId)
      if (updated && updated.status === "inactive") {
        // Exit detail view if it becomes inactive
        setSelectedAgentId(null)
      }
    }
  }

  // Removed Run Now functionality per request

  const selectedAgent = selectedAgentId ? deployedAgents.find(agent => agent.id === selectedAgentId) : null
  const isDetailView = Boolean(selectedAgent)
  const selectedAgentMetrics = selectedAgent ? agentMetricsMap[selectedAgent.agentName] ?? { optimizations: 0, activeTasks: 0, totalTasks: 0 } : null

  // Track analyzing state to force re-render after timeout
  const [analyzingAgents, setAnalyzingAgents] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!isDetailView) {
      setTaskFilter("active")
      setTaskSearchQuery("")
    }
  }, [isDetailView])

  // Handle analyzing state transitions
  useEffect(() => {
    if (!selectedAgent || selectedAgent.status !== "active" || !selectedAgent.deployedAt) {
      setAnalyzingAgents(prev => {
        const next = new Set(prev)
        if (selectedAgent) {
          next.delete(selectedAgent.id)
        }
        return next
      })
      return
    }

    const timeSinceDeployment = new Date().getTime() - selectedAgent.deployedAt.getTime()
    const shouldBeAnalyzing = timeSinceDeployment < 10000

    if (shouldBeAnalyzing) {
      // Add to analyzing set
      setAnalyzingAgents(prev => new Set(prev).add(selectedAgent.id))
      
      // Set timeout to remove from analyzing set after 10 seconds
      const remainingTime = 10000 - timeSinceDeployment
      const timeoutId = setTimeout(() => {
        setAnalyzingAgents(prev => {
          const next = new Set(prev)
          next.delete(selectedAgent.id)
          return next
        })
      }, remainingTime)

      return () => clearTimeout(timeoutId)
    } else {
      // Remove from analyzing set if time has passed
      setAnalyzingAgents(prev => {
        const next = new Set(prev)
        next.delete(selectedAgent.id)
        return next
      })
    }
  }, [selectedAgent?.id, selectedAgent?.status, selectedAgent?.deployedAt])

  type MetricCardConfig = {
    title: string
    value: number
    delta: number
    lastValue: number
    positive: boolean
    accentColor: string
    info: string
    icon: typeof Bot
    prefix?: string
    suffix?: string
    format?: (value: number) => string
  }

  type TaskStatus = "running" | "queued" | "completed" | "failed"

  interface TaskRow {
    id: string
    dbId?: number // Database ID for fetching full details
    title: string
    description: string
    impact: "High" | "Medium" | "Low"
    status: TaskStatus
    lastActivity: Date
    icon: React.ComponentType<{ className?: string }>
    url?: string
    platform?: "Reddit"
    postedAt?: Date
    engagement?: string
    promptOrigin?: "search" | "tracked"
    trackedPrompt?: string
    relevanceScore?: number // For filtering active opportunities
  }

  const buildTaskRows = (agent: (typeof deployedAgents)[number]): TaskRow[] => {
    if (agent.agentName === "Conversation Radar") {
      // Use real data from API
      // Return real opportunities from API - no more mock data
        return radarOpportunities.map((opp: any) => ({
          id: opp.id,
        dbId: opp.dbId, // Database ID for fetching full details
          title: opp.title,
          description: opp.description || 'Conversation opportunity',
          impact: opp.impact || 'Medium',
          // Status is already mapped for frontend by the API (queued/running/completed/failed)
          status: opp.status,
          lastActivity: new Date(opp.lastActivity),
        icon: RedditIcon,
          url: opp.url,
        platform: 'Reddit' as const,
          postedAt: opp.postedAt ? new Date(opp.postedAt) : undefined,
          engagement: opp.engagement,
          promptOrigin: opp.promptOrigin as "search" | "tracked",
          trackedPrompt: opp.trackedPrompt,
          relevanceScore: opp.relevanceScore,
        }))
    }

    // Special handling for Content Optimizer agent
    if (agent.agentName === "Content Optimizer") {
      return [] // Content Optimizer shows optimization results, not tasks
    }

    const now = new Date()
    const subtractMinutes = (minutes: number) => new Date(now.getTime() - minutes * 60 * 1000)

    return [
      {
        id: `${agent.id}-task-sync`,
        title: `${agent.agentName} sync`,
        description: "Live sync of AI-facing instructions & controls.",
        impact: agent.impact,
        status: "running",
        lastActivity: subtractMinutes(2),
        icon: agent.icon,
      },
      {
        id: `${agent.id}-task-audit`,
        title: "Audit + validation",
        description: "Validating structured output before publishing.",
        impact: agent.impact === "Low" ? "Medium" : agent.impact,
        status: "queued",
        lastActivity: subtractMinutes(14),
        icon: agent.icon,
      },
      {
        id: `${agent.id}-task-report`,
        title: "Visibility report",
        description: "Posting delivery summary to the GEO deck.",
        impact: "Low",
        status: "completed",
        lastActivity: subtractMinutes(38),
        icon: agent.icon,
      },
      {
        id: `${agent.id}-task-failed`,
        title: "Data validation",
        description: "Failed to validate data structure and format.",
        impact: "High",
        status: "failed",
        lastActivity: subtractMinutes(55),
        icon: agent.icon,
      },
    ]
  }

  // Check if agent is newly deployed and analyzing (active but no tasks generated yet)
  // For Conversation Radar, use isLoadingRadar to show loading state while searching
  // For other agents, use the analyzingAgents set
  const isConversationRadarAgent = selectedAgent?.agentName === "Conversation Radar"
  const isAnalyzing = selectedAgent 
    ? (isConversationRadarAgent ? isLoadingRadar : analyzingAgents.has(selectedAgent.id))
    : false
  
  const taskRows = selectedAgent && !isAnalyzing ? buildTaskRows(selectedAgent) : []
  const normalizedTaskQuery = taskSearchQuery.trim().toLowerCase()
  // For Conversation Radar: "active" means new opportunities with 70%+ relevance
  // For other agents: "active" means running or queued status
  const filteredTasks = (taskFilter === "active" 
    ? taskRows.filter((task) => {
        const isActive = task.status === "running" || task.status === "queued"
        // Conversation Radar active view: ONLY show 70%+ scored opportunities
        if (task.platform === "Reddit") {
          return isActive && typeof task.relevanceScore === "number" && task.relevanceScore >= 70
        }
        return isActive
      }) 
    : taskRows
  ).filter((task) => {
    if (!normalizedTaskQuery) return true
    return (
      task.title.toLowerCase().includes(normalizedTaskQuery) ||
      task.description.toLowerCase().includes(normalizedTaskQuery)
    )
  })

  const isConversationRadar = selectedAgent?.agentName === "Conversation Radar"

  const metricGridClass = cn(
    "grid grid-cols-1 gap-4 md:gap-5 px-4 lg:px-6",
    isDetailView
      ? isConversationRadar
        ? "md:grid-cols-2 @xl/main:grid-cols-2 @3xl/main:grid-cols-2"
        : "md:grid-cols-3 @xl/main:grid-cols-3 @3xl/main:grid-cols-3"
      : "@xl/main:grid-cols-2 @3xl/main:grid-cols-4"
  )

  const metricCards: MetricCardConfig[] = isDetailView && selectedAgentMetrics
    ? (
        isConversationRadar
          ? [
              {
                title: "Active Opportunities",
                value: selectedAgentMetrics.optimizations,
                delta: 0,
                lastValue: 0,
                positive: true,
                accentColor: "rgba(251, 191, 36, 0.9)",
                info: "How many conversations you can act on right now. Counts open Reddit opportunities with 70%+ relevance.",
                icon: Radio,
              },
            ]
          : [
              {
                title: "Optimizations Shipped",
                value: selectedAgentMetrics.optimizations,
                delta: 0,
                lastValue: 0,
                positive: true,
                accentColor: "rgba(52, 211, 153, 0.9)",
                info: `Automations deployed by ${selectedAgent?.agentName}`,
                icon: Rocket,
              },
              {
                title: "Active Tasks",
                value: selectedAgentMetrics.activeTasks,
                delta: 0,
                lastValue: selectedAgentMetrics.totalTasks,
                positive: true,
                format: (val: number) => `${val} of ${selectedAgentMetrics.totalTasks}`,
                accentColor: "rgba(167, 139, 250, 0.9)",
                info: "Tasks this agent is currently processing",
                icon: ListChecks,
              },
            ]
      )
    : [
        {
          title: "Technical Structure Score",
          value: technicalScore,
          suffix: "%",
          delta: 0,
          lastValue: 0,
          positive: true,
          accentColor: "rgba(167, 139, 250, 0.9)",
          info: "This score (0-100) measures the health of your technical structure: schema, LLMs/robots files, semantic HTML, and other crawlable signals that help AI models understand and cite your site.",
          icon: Layers,
        },
        {
          title: "Optimizations Shipped",
          value: 24,
          delta: 0,
          lastValue: 0,
          positive: true,
          accentColor: "rgba(52, 211, 153, 0.9)",
          info: "What your agents have already fixed. Counts the total number of technical optimizations successfully deployed by your agents, including PRs merged or live site changes to LLMs files, schema, robots.txt, headings, and more.",
          icon: Rocket,
        },
        {
          title: "Active Agents",
          value: deployedAgents.length,
          delta: 0,
          lastValue: 0,
          positive: true,
          accentColor: "rgba(255,255,255,0.9)",
          info: "How many agents are working for you. Shows the number of agents currently deployed and allowed to run automations for this brand. Paused or inactive agents aren't included.",
          icon: Bot,
        },
        {
          title: "Opportunity Radar",
          value: activeRadarOpportunitiesCount,
          delta: 0,
          lastValue: 0,
          positive: true,
          accentColor: "rgba(251, 191, 36, 0.9)",
          info: "Live opportunities discovered by your agents. For Conversation Radar, this counts open Reddit opportunities (70%+ relevance) you can act on right now.",
          icon: Radio,
        },
      ]

  return (
    <SidebarProvider
      className="bg-dark-grey"
      style={
        {
          "--sidebar-width": "16rem",
        } as React.CSSProperties
      }
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
                <div className="flex items-center gap-3">
                  {isDetailView ? (
                    <div className="flex items-center h-[50px]">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTaskFilter("active") // Reset filter when going back
                          // Clear URL params
                          router.push("/dashboard/agents-lab")
                        }}
                        className="h-9 px-4 text-sm font-medium transition-all duration-200 bg-white/15 border-white/25 text-white hover:bg-white/20 hover:border-white/30 shadow-sm shadow-white/5 gap-2"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Back to Agents
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight text-white">Agent Lab</h1>
                      <p className="text-muted-foreground">Deploy and manage agents to boost your AI Visibility</p>
                    </div>
                  )}
                </div>
                
                {/* Search widget in center for detail view */}
                {isDetailView && (
                  <div className="flex-1 flex justify-center">
                      <div className="relative w-full max-w-[240px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/50" />
                        <Input
                          value={taskSearchQuery}
                          onChange={(e) => setTaskSearchQuery(e.target.value)}
                          placeholder={isConversationRadar ? "Search Opportunity" : "Search Task"}
                          className="h-9 rounded-full !bg-[#1a1a1a] border border-white/[0.08] text-xs text-white/80 placeholder:text-white/50 pl-8 pr-3 focus-visible:ring-0 focus-visible:border-white/20 focus-visible:!bg-[#1a1a1a]"
                        />
                      </div>
                  </div>
                )}
                
                {/* Right side - buttons */}
                <div className="flex items-center gap-2">
                  {isDetailView && isConversationRadar && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (isLoadingRadar) return
                        setIsLoadingRadar(true)
                        try {
                          console.log('🔄 Running Conversation Radar search...')
                          const response = await fetch('/api/conversation-radar/run', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              brandProfileId: profile.id,
                              mode: 'proactive',
                              analyze: true,
                              analyzeLimit: 15,
                            }),
                          })
                          const result = await response.json()
                          console.log('📊 Radar run result:', result)
                          await fetchRadarOpportunities()
                        } catch (error) {
                          console.error('❌ Error running radar:', error)
                        } finally {
                          setIsLoadingRadar(false)
                        }
                      }}
                      disabled={isLoadingRadar}
                      className="h-8 px-3 rounded-md bg-white/5 text-white hover:bg-white/10 border-0 text-xs font-medium gap-1.5 disabled:opacity-50"
                    >
                      {isLoadingRadar ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <Search className="w-3.5 h-3.5" />
                          Run Radar
                        </>
                      )}
                    </Button>
                  )}
                  {isDetailView && !isConversationRadar && (
                    <Button
                      size="sm"
                      onClick={() => setIsPrSheetOpen(true)}
                      className="h-8 px-3 rounded-md bg-white/5 text-white hover:bg-white/10 border-0 text-xs font-medium gap-1.5"
                    >
                      <GitPullRequest className="w-3.5 h-3.5" />
                      View PR
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => {
                      const docsUrl = isConversationRadar 
                        ? "https://docs.trymudra.com/agentic-features/agent-lab/conversation-ragar-agent"
                        : "https://docs.trymudra.com/agentic-features/agent-lab/llms-txt-indexer-agent"
                      window.open(docsUrl, "_blank", "noopener")
                    }}
                    className="h-8 px-3 rounded-md bg-white/5 text-white hover:bg-white/10 border-0 text-xs font-medium gap-1.5"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Documentation
                  </Button>
                  {!isDetailView && (
                    <Button
                      size="sm"
                      className="h-8 px-3 rounded-md bg-white text-black hover:bg-white/90 text-xs font-medium shadow-sm hover:shadow transition-shadow gap-1.5"
                      onClick={() => setIsDeployDialogOpen(true)}
                    >
                      <Bot className="h-3.5 w-3.5" />
                      Deploy Agent
                    </Button>
                  )}
                </div>
              </div>
            </div>

          {/* Header Divider */}
          <div className="h-[1px] bg-white/10"></div>

            {/* Agent Metrics Section */}
            <div className="py-6 space-y-4">
              <div className={metricGridClass}>
                {metricCards.map((card) => (
                  <DashboardStatCard
                    key={card.title}
                    title={card.title}
                    value={card.value}
                    delta={card.delta}
                    lastValue={card.lastValue}
                    positive={card.positive}
                    prefix={card.prefix}
                    suffix={card.suffix}
                    format={card.format}
                    accentColor={card.accentColor}
                    info={card.info}
                    icon={card.icon}
                    showLastPeriod={!isDetailView}
                  />
                ))}
              {isDetailView && selectedAgent && (
                <Card className="group relative overflow-hidden bg-transparent backdrop-blur-sm rounded-lg border border-white/[0.08] hover:border-white/[0.12] transition-all duration-200 gap-3">
                  <CardHeader className="border-0 pb-0">
                    <CardTitle className="text-base font-semibold text-white tracking-tight">Run Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-2xl font-semibold text-white tracking-tight">
                        {RUN_STATUS_DETAILS[getRunStatusFromAgentStatus(selectedAgent.status)].label}
                      </span>
                      {getRunStatusChips(getRunStatusFromAgentStatus(selectedAgent.status))}
                    </div>
                    <p className="text-xs text-white/60 mt-2">Observability status for this agent</p>
                  </CardContent>
                </Card>
              )}
              </div>
            </div>

            {/* First Horizontal Divider Line - Full Width */}
            <div className="h-[1px] bg-white/10"></div>

            {/* Bottom Section with Vertical Divisions */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left Section */}
              <div className="flex-[0.62] flex flex-col border-r border-white/10">
                <div className="px-4 lg:px-6 py-6">
                  {/* Left content will be added here */}
                </div>
              </div>

              {/* Middle Section */}
              <div className="flex-[1.35] flex flex-col border-r border-white/10">
                <div className="px-4 lg:px-6 py-6 space-y-6">
                  {/* Title and Description with Branch Selector */}
                  <div className="space-y-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="space-y-1.5">
                        <h2 className="text-xl font-semibold tracking-tight text-white">
                          {isDetailView ? (isConversationRadar ? "Opportunities" : "Tasks") : "Agents"}
                        </h2>
                        <p className="text-sm text-white/60">
                          {isDetailView
                            ? isConversationRadar
                              ? "Opportunities the agent surfaced for you to join"
                              : "Tasks that agents are cooking"
                            : "Active Deployed Agents"}
                        </p>
                      </div>

                      {!isDetailView && (
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {!isMounted ? (
                              <Button
                                size="sm"
                                disabled
                                className="h-8 px-3 rounded-md bg-white/5 text-white hover:bg-white/10 border-0 text-xs font-medium gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                                </svg>
                                Connect
                              </Button>
                            ) : !isGithubConnected ? (
                              <Button
                                size="sm"
                                onClick={handleGithubConnect}
                                disabled={isConnectingGithub}
                                className="h-8 px-3 rounded-md bg-white/5 text-white hover:bg-white/10 border-0 text-xs font-medium gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isConnectingGithub ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Connecting...
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                                    </svg>
                                    Connect
                                  </>
                                )}
                              </Button>
                            ) : (
                              <DropdownMenu open={isRepoDropdownOpen} onOpenChange={setIsRepoDropdownOpen}>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="sm"
                                    className="h-8 px-3 rounded-md bg-white/5 text-white hover:bg-white/10 border-0 text-xs font-medium gap-1.5"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                                    </svg>
                                    {selectedRepo ? mockRepos.find(r => r.id === selectedRepo)?.name : "Select Repo"}
                                    <ChevronDown className="w-3 h-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-80 bg-[#1a1a1a] border-white/10 p-0" align="end">
                                  <div className="p-2 border-b border-white/10">
                                    <div className="relative">
                                      <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                                      <Input
                                        placeholder="Search repositories..."
                                        value={repoSearchQuery}
                                        onChange={(e) => setRepoSearchQuery(e.target.value)}
                                        className="h-8 pl-8 pr-3 bg-white/[0.03] border-white/10 text-white text-xs placeholder:text-white/40 focus-visible:ring-0 focus-visible:border-white/20"
                                      />
                                    </div>
                                  </div>
                                  <div className="max-h-64 overflow-y-auto">
                                    {filteredRepos.length > 0 ? (
                                      filteredRepos.map((repo) => (
                                        <DropdownMenuItem
                                          key={repo.id}
                                          onClick={() => handleRepoSelect(repo.id)}
                                          className="flex items-center gap-2 px-3 py-2 text-white hover:bg-white/10 cursor-pointer focus:bg-white/10"
                                        >
                                          <svg className="w-3.5 h-3.5 text-white/60" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                                          </svg>
                                          <span className="flex-1 text-xs">{repo.name}</span>
                                          {selectedRepo === repo.id && (
                                            <Check className="w-3.5 h-3.5 text-white" />
                                          )}
                                        </DropdownMenuItem>
                                      ))
                                    ) : (
                                      <div className="px-3 py-4 text-center text-xs text-white/50">No repositories found</div>
                                    )}
                                  </div>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                          <Select
                            value={selectedBranch}
                            onValueChange={(value) => {
                              setSelectedBranch(value)
                              setBranchSearchQuery("")
                            }}
                            onOpenChange={(open) => {
                              if (!open) {
                                setBranchSearchQuery("")
                              }
                            }}
                          >
                            <SelectTrigger
                              size="sm"
                              className="h-8 px-3 gap-2 max-w-[200px] rounded-md bg-white/5 text-white hover:bg-white/10 border border-white/[0.08] text-xs font-medium transition-colors focus-visible:ring-0 focus-visible:ring-offset-0 outline-none [&>*[data-slot='select-value']]:flex [&>*[data-slot='select-value']]:items-center [&>*[data-slot='select-value']]:gap-2 [&>svg:not(:first-child)]:hidden [&>span>svg]:hidden"
                            >
                              <GitBranch className="w-3.5 h-3.5 text-white/60 shrink-0 pointer-events-none" />
                              <SelectValue className="text-xs truncate" />
                            </SelectTrigger>
                            <SelectContent className="w-64 p-0">
                              <div className="p-2 border-b border-white/10">
                                <div className="relative">
                                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                                  <Input
                                    placeholder="Search branches..."
                                    value={branchSearchQuery}
                                    onChange={(e) => {
                                      e.stopPropagation()
                                      setBranchSearchQuery(e.target.value)
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => {
                                      e.stopPropagation()
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onFocus={(e) => e.stopPropagation()}
                                    className="h-8 pl-8 pr-3 bg-white/[0.03] border-white/10 text-white text-xs placeholder:text-white/40 focus-visible:ring-0 focus-visible:border-white/20"
                                  />
                                </div>
                              </div>
                              <div className="max-h-64 overflow-y-auto">
                                {filteredBranches.length > 0 ? (
                                  filteredBranches.map((branch) => (
                                    <SelectItem key={branch} value={branch} className="flex items-center gap-2">
                                      <GitPullRequest className="w-3.5 h-3.5 text-white/60" />
                                      <span>{branch}</span>
                                    </SelectItem>
                                  ))
                                ) : (
                                  <div className="px-3 py-4 text-center text-xs text-white/50">No branches found</div>
                                )}
                              </div>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    {/* View Mode Toggle */}
                    {isDetailView ? (
                      <div className="flex items-center gap-2.5 pb-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTaskFilter("active")}
                          className={cn(
                            "h-9 px-5 text-sm font-medium transition-all duration-200",
                            taskFilter === "active"
                              ? "bg-white/15 border-white/25 text-white hover:bg-white/20 hover:border-white/30 shadow-sm shadow-white/5"
                              : "border-white/[0.08] bg-transparent text-white/50 hover:bg-white/5 hover:text-white/80 hover:border-white/[0.12]"
                          )}
                        >
                          {isConversationRadar ? "Active Opportunities" : "Active Tasks"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTaskFilter("all")}
                          className={cn(
                            "h-9 px-5 text-sm font-medium transition-all duration-200",
                            taskFilter === "all"
                              ? "bg-white/15 border-white/25 text-white hover:bg-white/20 hover:border-white/30 shadow-sm shadow-white/5"
                              : "border-white/[0.08] bg-transparent text-white/50 hover:bg-white/5 hover:text-white/80 hover:border-white/[0.12]"
                          )}
                        >
                          {isConversationRadar ? "All Opportunities" : "All Tasks"}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 pb-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewMode("active")}
                          className={cn(
                            "h-9 px-5 text-sm font-medium transition-all duration-200",
                            viewMode === "active"
                              ? "bg-white/15 border-white/25 text-white hover:bg-white/20 hover:border-white/30 shadow-sm shadow-white/5"
                              : "border-white/[0.08] bg-transparent text-white/50 hover:bg-white/5 hover:text-white/80 hover:border-white/[0.12]"
                          )}
                        >
                          Active Agents
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewMode("inactive")}
                          className={cn(
                            "h-9 px-5 text-sm font-medium transition-all duration-200",
                            viewMode === "inactive"
                              ? "bg-white/15 border-white/25 text-white hover:bg-white/20 hover:border-white/30 shadow-sm shadow-white/5"
                              : "border-white/[0.08] bg-transparent text-white/50 hover:bg-white/5 hover:text-white/80 hover:border-white/[0.12]"
                          )}
                        >
                          Inactive Agents
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Main Content */}
                  {isDetailView && selectedAgent ? (
                    <div className="space-y-4">
                      {/* Content Optimizer Special UI */}
                      {selectedAgent.agentName === "Content Optimizer" ? (
                        <div className="space-y-4">
                          {/* Run Optimizer Buttons */}
                          <div className="rounded-xl border border-white/[0.08] bg-[#1a1a1a] p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                              <div>
                                <h3 className="text-lg font-semibold text-white mb-1">Run Optimization</h3>
                                <p className="text-sm text-white/60">Identify low-scoring pages and create optimization PRs</p>
                              </div>
                            </div>
                            <div className="flex gap-3">
                              <Button
                                onClick={() => runContentOptimizer(10)}
                                disabled={isOptimizerRunning}
                                size="lg"
                                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white border-0"
                              >
                                {isOptimizerRunning ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Optimizing...
                                  </>
                                ) : (
                                  <>
                                    <Bot className="mr-2 h-4 w-4" />
                                    Optimize Top 10 Pages
                                  </>
                                )}
                              </Button>
                              <Button
                                onClick={() => runContentOptimizer(50)}
                                disabled={isOptimizerRunning}
                                size="lg"
                                variant="outline"
                                className="flex-1"
                              >
                                Optimize Top 50 Pages
                              </Button>
                            </div>
                          </div>

                          {/* Optimization Results */}
                          {optimizerResults.length > 0 && (
                            <div className="rounded-xl border border-white/[0.08] bg-[#1a1a1a] overflow-hidden shadow-sm">
                              <div className="px-6 py-4 border-b border-white/[0.06]">
                                <h3 className="text-sm font-semibold text-white">
                                  Optimization Results ({optimizerResults.filter(r => r.prUrl).length} of {optimizerResults.length} successful)
                                </h3>
                              </div>
                              <div className="divide-y divide-white/[0.06]">
                                {optimizerResults.map((result, idx) => (
                                  <div key={idx} className="px-6 py-5">
                                    <div className="flex items-start justify-between mb-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          {result.prUrl ? (
                                            <Check className="h-4 w-4 text-green-500 shrink-0" />
                                          ) : (
                                            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                                          )}
                                          <p className="text-sm font-medium text-white truncate">{result.url}</p>
                                        </div>
                                        <p className="text-xs text-white/60">Original GEO Score: {result.originalScore}%</p>
                                      </div>
                                      {result.prUrl && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          asChild
                                          className="shrink-0 ml-4"
                                        >
                                          <a href={result.prUrl} target="_blank" rel="noopener noreferrer">
                                            <GitPullRequest className="mr-2 h-3 w-3" />
                                            View PR
                                          </a>
                                        </Button>
                                      )}
                                    </div>
                                    {result.error && (
                                      <p className="text-xs text-red-400 mb-2">{result.error}</p>
                                    )}
                                    {result.improvements.length > 0 && (
                                      <div className="flex flex-wrap gap-2 mt-3">
                                        {result.improvements.map((imp, impIdx) => (
                                          <span
                                            key={impIdx}
                                            className={cn(
                                              "inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium",
                                              imp.impact === "high"
                                                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                                : imp.impact === "medium"
                                                ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                                                : "bg-white/5 text-white/60 border border-white/10"
                                            )}
                                          >
                                            {imp.description}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Regular Task View for Other Agents */
                      <div className="rounded-xl border border-white/[0.08] bg-[#1a1a1a] overflow-hidden shadow-sm">
                        {filteredTasks.length > 0 ? (
                          filteredTasks.map((task, index) => {
                            const Icon = task.icon
                            // Map task status to deep view status format
                            const statusMap: Record<string, string> = {
                              "running": "in_progress",
                              "queued": "queued",
                              "completed": "completed",
                              "failed": "failed"
                            }
                            const taskStatus = statusMap[task.status] || "queued"
                            
                            // Build query params - include opportunity-specific params if present
                            const queryParams = new URLSearchParams({
                              title: task.title,
                              desc: task.description,
                              status: taskStatus,
                            })
                            if (task.dbId) queryParams.set("dbId", task.dbId.toString())
                            if (task.platform) queryParams.set("platform", task.platform)
                            if (task.url) queryParams.set("url", task.url)
                            if (task.engagement) queryParams.set("engagement", task.engagement)
                            if (task.postedAt) queryParams.set("postedAt", task.postedAt.toISOString())
                            if (task.promptOrigin) queryParams.set("promptOrigin", task.promptOrigin)
                            if (task.trackedPrompt) queryParams.set("trackedPrompt", task.trackedPrompt)
                            // Store agent ID for back navigation (simpler than full URL)
                            if (selectedAgent) {
                              queryParams.set("returnAgentId", selectedAgent.id)
                            }

                            return (
                              <Link
                                key={task.id}
                                href={`/dashboard/agents-lab/tasks/${encodeURIComponent(task.id)}?${queryParams.toString()}`}
                                className="block"
                              >
                                <div
                                  className="px-6 py-5 flex items-center justify-between gap-6 transition-colors duration-200 hover:bg-white/[0.02] border-b border-white/[0.06] last:border-b-0"
                                >
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                  <div className="flex items-center justify-center size-10 rounded-lg border bg-white/[0.05] border-white/[0.08] shadow-sm">
                                    <Icon className="h-5 w-5 text-white/85" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className={cn(
                                      "text-sm font-semibold text-white mb-1.5",
                                      // Allow full titles for Conversation Radar opportunities
                                      isConversationRadar ? "whitespace-normal break-words" : "truncate"
                                    )}>
                                      {task.title}
                                    </p>
                                    <p className="text-xs text-white/60 line-clamp-2">
                                      {task.description}
                                    </p>
                                  </div>
                                </div>

                                {!isConversationRadar || !task.platform ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center gap-2.5 flex-shrink-0 min-w-[100px] px-3 py-1.5 rounded-md hover:bg-white/[0.03] transition-colors cursor-help">
                                        <Clock className="w-3.5 h-3.5 text-white/50 shrink-0" />
                                        <span className="text-xs text-white/70 font-medium whitespace-nowrap">
                                          {formatTimeAgo(task.lastActivity)}
                                        </span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs"></TooltipContent>
                                  </Tooltip>
                                ) : null}

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-2.5 flex-shrink-0 min-w-[95px] cursor-help px-3 py-1.5 rounded-md hover:bg-white/[0.03] transition-colors">
                                      <span className="text-xs text-white/50 font-medium uppercase tracking-wide">Impact</span>
                                      {isConversationRadar && task.platform
                                        ? renderOpportunityImpactChips(task)
                                        : getImpactChips(task.impact)}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs">
                                    <p>{isConversationRadar && task.platform
                                      ? (task.promptOrigin === "tracked" 
                                        ? "Cited opportunity - This Reddit post was cited in AI model responses (High priority)" 
                                        : "Proactive opportunity - Found via search based on your tracked prompts")
                                      : "How important it is for your brand to join this conversation."}</p>
                                  </TooltipContent>
                                </Tooltip>

                                <div className="flex items-center gap-2.5 flex-shrink-0 px-3 py-1.5 rounded-md bg-white/[0.02] border border-white/[0.05]">
                                  {task.status === "running" || task.status === "queued" ? (
                                    <>
                                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                                      <span className="text-xs text-orange-400 font-medium">Active Opportunity</span>
                                    </>
                                  ) : task.status === "failed" ? (
                                    <>
                                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                                      <span className="text-xs text-red-400 font-medium">Failed</span>
                                    </>
                                  ) : (
                                    <>
                                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                      <span className="text-xs text-white/70 font-medium">Completed</span>
                                    </>
                                  )}
                                </div>
                                </div>
                              </Link>
                            )
                          })
                        ) : isAnalyzing ? (
                          // Analyzing State - Agent is generating tasks
                          <div className="flex flex-col items-center justify-center min-h-[400px] px-6 py-10">
                            <div className="relative w-full max-w-md bg-transparent backdrop-blur-sm rounded-xl border border-white/[0.08] p-6 shadow-xl overflow-hidden">
                              {/* Title Section */}
                              <div className="text-center mb-5">
                                <div className="flex items-center justify-center mb-4">
                                  <div className="flex items-center justify-center size-10 rounded-lg bg-white/[0.05] border border-white/[0.08]">
                                    <Loader2 className="h-5 w-5 text-orange-500 animate-spin" />
                                  </div>
                                </div>
                                <h3 className="text-xl font-semibold text-white tracking-tight mb-2">
                                  {isConversationRadar ? "Searching Reddit for Opportunities" : "Analyzing & Generating Tasks"}
                                </h3>
                                <p className="text-sm text-white/60 leading-relaxed">
                                  {isConversationRadar
                                    ? `Searching relevant subreddits based on your tracked prompts and running AI analysis to find the best conversations to join. This may take 1-2 minutes...`
                                    : `${selectedAgent?.agentName} is analyzing your repository and defining the tasks it needs to accomplish.`}
                                </p>
                              </div>
                              
                              {/* Analyzing Preview */}
                              <div className="bg-[#1a1a1a] rounded-lg border border-white/[0.06] p-4 space-y-3">
                                {/* Header Section */}
                                <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
                                  <div className="flex items-center justify-center size-10 rounded-lg bg-white/[0.05] border border-white/[0.08]">
                                    <Bot className="h-5 w-5 text-orange-500" />
                                  </div>
                                  <div className="flex-1 space-y-1.5">
                                    <div className="h-2 bg-white/10 rounded-full w-3/4 animate-pulse"></div>
                                    <div className="h-1.5 bg-white/10 rounded-full w-1/2 animate-pulse"></div>
                                  </div>
                                </div>
                                
                                {/* Task Preview Lines */}
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500/40"></div>
                                    <div className="h-1.5 bg-white/10 rounded-full w-full animate-pulse"></div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-white/10"></div>
                                    <div className="h-1.5 bg-white/10 rounded-full w-5/6 animate-pulse" style={{ animationDelay: '100ms' }}></div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-white/10"></div>
                                    <div className="h-1.5 bg-white/10 rounded-full w-4/5 animate-pulse" style={{ animationDelay: '200ms' }}></div>
                                  </div>
                                </div>
                                
                                {/* Status Indicator */}
                                <div className="flex items-center gap-2 pt-3 border-t border-white/[0.06]">
                                  <Loader2 className="w-3.5 h-3.5 text-orange-500 animate-spin" />
                                  <div className="h-1.5 bg-white/10 rounded-full flex-1"></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="px-6 py-10 text-center">
                            <div className="space-y-2">
                              <p className="text-sm text-white/60">
                                {isConversationRadar 
                                  ? "No opportunities found yet." 
                                  : "No tasks found for this filter."}
                              </p>
                              {isConversationRadar && (
                                <p className="text-xs text-white/40">
                                  Make sure you have tracked prompts configured in your brand profile.
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      )}
                    </div>
                  ) : filteredDeployedAgents.length > 0 ? (
                    <div className="space-y-2">
                      <div className="rounded-xl border border-white/[0.08] bg-[#1a1a1a] overflow-hidden shadow-sm">
                        {filteredDeployedAgents.map((agent) => {
                          const Icon = agent.icon
                          const isLocked = agent.status !== "active"
                          return (
                            <div
                              key={agent.id}
                              className={cn(
                                "relative border-b border-white/[0.06] last:border-b-0 transition-all duration-200 group",
                                isLocked ? "opacity-50 cursor-not-allowed" : "hover:bg-white/[0.03] cursor-pointer"
                              )}
                              onClick={() => {
                                if (isLocked) return
                                // URL-driven selection (prevents needing 2 clicks / prevents auto-clear)
                                router.push(`/dashboard/agents-lab?agent=${agent.id}`)
                              }}
                              aria-disabled={isLocked}
                            >
                              <div className="px-6 py-5 flex items-center justify-between gap-4">
                                {/* Left Section - Icon, Agent Name and Description */}
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                  <div className="flex items-center justify-center size-10 rounded-lg border bg-white/[0.05] border-white/[0.08] group-hover:bg-white/[0.08] group-hover:border-white/[0.15] transition-all duration-200 flex-shrink-0 shadow-sm group-hover:shadow">
                                    <Icon className="h-5 w-5 text-white/90 group-hover:text-white transition-colors" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold leading-5 mb-1.5 text-white group-hover:text-white transition-colors">
                                      {agent.agentName}
                                    </p>
                                    <p className="text-xs leading-relaxed text-white/60">
                                      {agent.agentDescription}
                                    </p>
                                  </div>
                                </div>

                                {/* Last Activity */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-2 flex-shrink-0 min-w-[84px] px-2.5 py-1 rounded-md hover:bg-white/[0.03] transition-colors cursor-help">
                                      <Clock className="w-3.5 h-3.5 text-white/50 shrink-0" />
                                      <span className="text-xs text-white/70 font-medium whitespace-nowrap max-[1100px]:hidden">
                                        {formatTimeAgo(agent.lastActivity)}
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs">
                                    <p>Last activity timestamp for this agent.</p>
                                  </TooltipContent>
                                </Tooltip>

                                {/* Impact Widget */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-2 flex-shrink-0 min-w-[80px] cursor-help px-2.5 py-1 rounded-md hover:bg-white/[0.03] transition-colors">
                                      <span className="text-xs text-white/50 font-medium uppercase tracking-wide max-[1200px]:hidden">Impact</span>
                                      {getImpactChips(agent.impact)}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs">
                                    <p>Impact level is based on importance and expected effect on your AI visibility.</p>
                                  </TooltipContent>
                                </Tooltip>

                                {/* Status Indicator */}
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/[0.02] border border-white/[0.05]">
                                    {agent.status === "deploying" ? (
                                      <>
                                        <Loader2 className="w-3.5 h-3.5 text-orange-500 animate-spin" />
                                        <span className="text-xs text-orange-500 font-medium max-[1150px]:hidden">Deploying...</span>
                                      </>
                                    ) : agent.status === "active" ? (
                                      <>
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-sm shadow-green-500/50"></div>
                                        <span className="text-xs text-white/70 font-medium max-[1150px]:hidden">Active</span>
                                      </>
                                    ) : (
                                      <>
                                        <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                                        <span className="text-xs text-white/60 font-medium max-[1150px]:hidden">Inactive</span>
                                      </>
                                    )}
                                  </div>

                                  {/* Actions Menu */}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => e.stopPropagation()}
                                        className="h-8 w-8 rounded hover:bg-white/[0.06] text-white/70 hover:text-white"
                                        aria-label="Agent actions"
                                      >
                                        <MoreHorizontal className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="end"
                                      className="w-44 bg-[#1a1a1a] border-white/10"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {agent.status === "active" || agent.status === "deploying" ? (
                                        <DropdownMenuItem
                                          className="text-sm text-white/90 focus:bg-white/10 cursor-pointer"
                                          onClick={() => handleTogglePause(agent.id)}
                                          disabled={agent.status === "deploying"}
                                        >
                                          Pause agent
                                        </DropdownMenuItem>
                                      ) : (
                                        <DropdownMenuItem
                                          className="text-sm text-white/90 focus:bg-white/10 cursor-pointer"
                                          onClick={() => handleTogglePause(agent.id)}
                                        >
                                          Resume agent
                                        </DropdownMenuItem>
                                      )}
                                      {/* Run now removed */}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 px-6">
                      <div className="flex flex-col items-center max-w-md text-center w-full">
                        {/* Dashboard Preview Card */}
                        <div className="relative w-full max-w-md bg-transparent backdrop-blur-sm rounded-xl border border-white/[0.08] p-6 shadow-xl overflow-hidden group">
                          {/* Title Section */}
                          <div className="text-center mb-5">
                            <h3 className="text-xl font-semibold text-white tracking-tight mb-2">
                              {viewMode === "active" ? "No Active Agents" : "No Inactive Agents"}
                            </h3>
                            <p className="text-sm text-white/60 leading-relaxed">
                              {viewMode === "active" 
                                ? "You will see active deployed agents here"
                                : "You will see inactive agents here"}
                            </p>
                          </div>
                          
                          {/* Dashboard Preview */}
                          <div className="mb-5">
                            {/* Header Section */}
                            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/[0.06]">
                              <div className="flex items-center justify-center size-10 rounded-lg bg-white/[0.05] border border-white/[0.08] flex-shrink-0">
                                <Bot className="h-5 w-5 text-orange-500" />
                              </div>
                              <div className="flex-1 space-y-1.5">
                                <div className="h-2 bg-white/10 rounded-full w-3/4"></div>
                                <div className="h-1.5 bg-white/10 rounded-full w-1/2"></div>
                              </div>
                            </div>
                            
                            {/* Dashboard Grid */}
                            <div className="grid grid-cols-2 gap-3 mb-4">
                              {/* Stat Card 1 */}
                              <div className="bg-white/[0.03] rounded-lg border border-white/[0.06] p-3 space-y-2">
                                <div className="h-1.5 bg-white/10 rounded-full w-2/3"></div>
                                <div className="h-3 bg-white/10 rounded-full w-1/2"></div>
                                <div className="h-1 bg-white/10 rounded-full w-full"></div>
                              </div>
                              
                              {/* Stat Card 2 */}
                              <div className="bg-white/[0.03] rounded-lg border border-white/[0.06] p-3 space-y-2">
                                <div className="h-1.5 bg-white/10 rounded-full w-2/3"></div>
                                <div className="h-3 bg-white/10 rounded-full w-1/2"></div>
                                <div className="h-1 bg-white/10 rounded-full w-full"></div>
                              </div>
                            </div>
                            
                            {/* Status Bar */}
                            <div className="flex items-center gap-2 pt-3 border-t border-white/[0.06]">
                              <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                              <div className="h-1.5 bg-white/10 rounded-full flex-1"></div>
                              <div className="h-2 w-12 bg-white/10 rounded"></div>
                            </div>
                          </div>
                          
                          {/* Action Button - Only show for active view */}
                          {viewMode === "active" && (
                            <Button
                              onClick={() => setIsDeployDialogOpen(true)}
                              size="sm"
                              className="w-full h-9 px-5 rounded-md bg-white text-[#0a0a0a] hover:bg-white/90 hover:text-[#0a0a0a] text-sm font-medium gap-2 transition-all shadow-sm hover:shadow-md border-0"
                            >
                              Deploy Agent
                              <Bot className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Section */}
              <div className="flex-[0.62] flex flex-col">
                <div className="px-4 lg:px-6 py-6">
                  {/* Right content will be added here */}
                </div>
              </div>
            </div>

            {/* Second Horizontal Divider Line - Full Width */}
            <div className="h-[1px] bg-white/10"></div>
          </div>
        </div>
      </SidebarInset>
      {/* Active PRs Sheet */}
      <Sheet open={isPrSheetOpen} onOpenChange={setIsPrSheetOpen}>
        <SheetContent 
          side="right" 
          className="w-full sm:max-w-xl bg-dark-grey border-white/10 p-0 overflow-hidden flex flex-col [&>button]:text-white/60 [&>button]:hover:text-white/80 [&>button]:hover:bg-white/[0.05]"
        >
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-white/10">
            <SheetTitle className="text-xl font-semibold text-white tracking-tight">
              Active Pull Requests
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {activePullRequests.length === 0 ? (
              <div className="rounded-lg border border-white/[0.08] bg-[#1a1a1a] p-6 text-center">
                <p className="text-sm text-white/60">No active PRs for this agent.</p>
              </div>
            ) : (
              activePullRequests.map((pr) => (
                <div
                  key={pr.id}
                  className="rounded-lg border border-white/[0.08] bg-[#1a1a1a] p-4 hover:border-white/[0.12] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <GitPullRequest className="w-4 h-4 text-white/70" />
                        <span className="text-sm font-semibold text-white truncate">#{pr.id} {pr.title}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/60">
                        <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-mono">{pr.branch}</span>
                        <span className="text-white/30">•</span>
                        <span>{pr.updatedAt}</span>
                      </div>
                    </div>
                    <span className={cn(
                      "text-[11px] font-medium px-2 py-0.5 rounded-md border",
                      pr.status === "open" 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-white/10 text-white/70 border-white/15"
                    )}>
                      {pr.status === "open" ? "Open" : "Draft"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
      
      {/* Deploy Agent Dialog */}
      <DeployAgentDialog 
        open={isDeployDialogOpen} 
        onOpenChange={setIsDeployDialogOpen}
        onDeploy={handleDeployAgent}
        deployedAgentIds={deployedAgents
          .filter(agent => agent.status === "active" || agent.status === "deploying")
          .map(agent => agent.agentName)}
      />
    </SidebarProvider>
  )
}

export default function AgentsLabPage() {
  return (
    <BrandProfileProvider>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
        <AgentsLabPageInner />
      </Suspense>
    </BrandProfileProvider>
  )
}

