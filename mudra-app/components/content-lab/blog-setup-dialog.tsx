"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
  Globe,
  GitPullRequest,
  FileCode,
  Rocket,
} from "lucide-react"

interface BlogSetupStatus {
  canPublish: boolean
  setupStatus: "not_started" | "pr_open" | "ready"
  message: string
  actionRequired?: string
  issueId?: number
  prUrl?: string
}

interface BlogSetupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called when blog setup status changes (e.g. agent started, PR created, ready) */
  onStatusChange?: (status: BlogSetupStatus) => void
}

type AgentPhase =
  | "idle"
  | "creating_issue"
  | "deploying"
  | "analyzing"
  | "generating"
  | "creating_pr"
  | "completed"
  | "failed"

const PHASE_STEPS: { phase: AgentPhase; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { phase: "analyzing", label: "Analyzing your website tech stack", icon: Globe },
  { phase: "generating", label: "Generating blog infrastructure files", icon: FileCode },
  { phase: "creating_pr", label: "Creating Pull Request", icon: GitPullRequest },
]

export function BlogSetupDialog({ open, onOpenChange, onStatusChange }: BlogSetupDialogProps) {
  const [status, setStatus] = useState<BlogSetupStatus | null>(null)
  const [agentPhase, setAgentPhase] = useState<AgentPhase>("idle")
  const [error, setError] = useState<string | null>(null)
  const [prUrl, setPrUrl] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)

  // Fetch current blog status when dialog opens
  useEffect(() => {
    if (!open) return
    fetchStatus()
  }, [open])

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/content-lab/blog-status")
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          const newStatus: BlogSetupStatus = {
            canPublish: data.canPublish,
            setupStatus: data.setupStatus,
            message: data.message,
            actionRequired: data.actionRequired,
            issueId: data.issueId,
            prUrl: data.prUrl,
          }
          setStatus(newStatus)
          onStatusChange?.(newStatus)

          if (data.canPublish) {
            setAgentPhase("completed")
          } else if (data.setupStatus === "pr_open") {
            setAgentPhase("completed")
            setPrUrl(data.prUrl || null)
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch blog status:", err)
    }
  }

  // Poll for issue completion after deploy
  const pollIssueStatus = useCallback(
    async (issueId: number) => {
      setPolling(true)
      let attempts = 0
      const maxAttempts = 60 // 5 minutes at 5s intervals

      const poll = async () => {
        attempts++
        try {
          const res = await fetch(`/api/issues/${issueId}`)
          if (res.ok) {
            const data = await res.json()
            const issue = data.data || data

            if (issue.status === "completed" || issue.status === "merged" || issue.prUrl) {
              // Agent finished
              setAgentPhase("completed")
              setPrUrl(issue.prUrl || null)
              setPolling(false)

              // Refresh overall status
              await fetchStatus()
              return
            }

            if (issue.status === "failed") {
              setAgentPhase("failed")
              setError("Blog setup agent failed. Please try again.")
              setPolling(false)
              return
            }

            // Still in progress — animate through phases
            if (attempts < 8) {
              setAgentPhase("analyzing")
            } else if (attempts < 20) {
              setAgentPhase("generating")
            } else {
              setAgentPhase("creating_pr")
            }
          }
        } catch (err) {
          console.error("Poll error:", err)
        }

        if (attempts < maxAttempts) {
          setTimeout(poll, 5000)
        } else {
          setAgentPhase("failed")
          setError("Timed out waiting for blog setup agent. Check Issues page for status.")
          setPolling(false)
        }
      }

      poll()
    },
    [onStatusChange]
  )

  const handleSetupBlog = async () => {
    setError(null)
    setAgentPhase("creating_issue")

    try {
      // Step 1: Create issue + deploy agent via our new API
      const res = await fetch("/api/content-lab/blog-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const data = await res.json()

      if (!data.success) {
        // If already has a PR open, treat as success
        if (data.setupStatus === "pr_open") {
          setAgentPhase("completed")
          setPrUrl(data.prUrl || null)
          setStatus({
            canPublish: false,
            setupStatus: "pr_open",
            message: data.message || "PR is waiting to be merged",
            issueId: data.issueId,
            prUrl: data.prUrl,
          })
          return
        }
        throw new Error(data.error || "Failed to start blog setup")
      }

      // If already ready
      if (data.setupStatus === "ready") {
        setAgentPhase("completed")
        const newStatus: BlogSetupStatus = {
          canPublish: true,
          setupStatus: "ready",
          message: "Blog is set up!",
        }
        setStatus(newStatus)
        onStatusChange?.(newStatus)
        return
      }

      // Agent deployment started — begin polling
      setAgentPhase("deploying")
      const issueId = data.issueId
      if (issueId) {
        // Simulate initial analyzing phase, then start polling
        setTimeout(() => {
          setAgentPhase("analyzing")
          pollIssueStatus(issueId)
        }, 2000)
      }
    } catch (err) {
      console.error("Blog setup failed:", err)
      setAgentPhase("failed")
      setError(err instanceof Error ? err.message : "Something went wrong")
    }
  }

  const handleRetry = () => {
    setAgentPhase("idle")
    setError(null)
    setPrUrl(null)
  }

  const isRunning =
    agentPhase === "creating_issue" ||
    agentPhase === "deploying" ||
    agentPhase === "analyzing" ||
    agentPhase === "generating" ||
    agentPhase === "creating_pr"

  // Determine what to render
  const renderContent = () => {
    // Blog is already set up
    if (status?.canPublish) {
      return (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex items-center justify-center size-14 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="size-7 text-emerald-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white">Blog is ready!</p>
            <p className="text-xs text-white/50 mt-1">
              You can publish content directly from Content Lab.
            </p>
          </div>
          <Button
            onClick={() => onOpenChange(false)}
            size="sm"
            className="mt-2 bg-white/10 text-white hover:bg-white/15 border-0"
          >
            Done
          </Button>
        </div>
      )
    }

    // PR is open — waiting for merge
    if (agentPhase === "completed" && prUrl) {
      return (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex items-center justify-center size-14 rounded-full bg-blue-500/10 border border-blue-500/20">
            <GitPullRequest className="size-7 text-blue-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white">Pull Request Created!</p>
            <p className="text-xs text-white/50 mt-1 max-w-xs">
              Merge the PR to enable publishing. Once merged, all your blog posts will go live.
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Button
              asChild
              size="sm"
              className="bg-blue-600 text-white hover:bg-blue-700 gap-2"
            >
              <a href={prUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" />
                View Pull Request
              </a>
            </Button>
            <Button
              onClick={() => onOpenChange(false)}
              size="sm"
              variant="outline"
              className="bg-white/5 text-white hover:bg-white/10 border-white/[0.08]"
            >
              Close
            </Button>
          </div>
        </div>
      )
    }

    // Agent completed but no PR url (edge case)
    if (agentPhase === "completed" && !prUrl) {
      return (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex items-center justify-center size-14 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="size-7 text-emerald-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white">Blog setup complete!</p>
            <p className="text-xs text-white/50 mt-1">
              Check the Issues page for the Pull Request link.
            </p>
          </div>
          <Button
            onClick={() => {
              onOpenChange(false)
              fetchStatus()
            }}
            size="sm"
            className="mt-2 bg-white/10 text-white hover:bg-white/15 border-0"
          >
            Done
          </Button>
        </div>
      )
    }

    // Failed state
    if (agentPhase === "failed") {
      return (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex items-center justify-center size-14 rounded-full bg-red-500/10 border border-red-500/20">
            <AlertCircle className="size-7 text-red-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white">Setup failed</p>
            <p className="text-xs text-red-400/80 mt-1 max-w-xs">{error}</p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Button
              onClick={handleRetry}
              size="sm"
              className="bg-white/10 text-white hover:bg-white/15 border-0"
            >
              Try Again
            </Button>
            <Button
              onClick={() => onOpenChange(false)}
              size="sm"
              variant="outline"
              className="bg-white/5 text-white/60 hover:bg-white/10 border-white/[0.08]"
            >
              Close
            </Button>
          </div>
        </div>
      )
    }

    // Agent is running — show progress
    if (isRunning) {
      return (
        <div className="py-4 space-y-4">
          <div className="text-center mb-2">
            <p className="text-sm text-white/60">
              Setting up blog infrastructure for your website...
            </p>
          </div>

          <div className="space-y-2.5">
            {PHASE_STEPS.map(({ phase, label, icon: Icon }, idx) => {
              const phaseOrder: AgentPhase[] = [
                "analyzing",
                "generating",
                "creating_pr",
              ]
              const currentIdx = phaseOrder.indexOf(agentPhase)
              const stepIdx = phaseOrder.indexOf(phase)
              const done = stepIdx < currentIdx
              const active = stepIdx === currentIdx

              return (
                <div
                  key={phase}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-all duration-300 ${
                    done
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : active
                        ? "border-white/15 ring-1 ring-white/10 bg-white/[0.03]"
                        : "border-white/[0.04] bg-transparent"
                  }`}
                >
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    {done ? (
                      <CheckCircle2 className="size-5 text-emerald-400" />
                    ) : active ? (
                      <Loader2 className="size-4 text-primary animate-spin" />
                    ) : (
                      <div className="size-2 rounded-full bg-white/20" />
                    )}
                  </div>
                  <Icon
                    className={`size-4 flex-shrink-0 ${
                      done
                        ? "text-emerald-400/70"
                        : active
                          ? "text-white/80"
                          : "text-white/30"
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      done
                        ? "text-white/80"
                        : active
                          ? "text-white"
                          : "text-white/40"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              )
            })}
          </div>

          <p className="text-center text-[11px] text-white/30 mt-3">
            This usually takes 1–2 minutes. You can close this dialog — setup will continue in the background.
          </p>
        </div>
      )
    }

    // Initial idle state — show setup CTA
    // Check if there's already an issue in_progress (from previous attempt)
    if (status?.setupStatus === "pr_open") {
      return (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex items-center justify-center size-14 rounded-full bg-blue-500/10 border border-blue-500/20">
            <GitPullRequest className="size-7 text-blue-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white">Pull Request Waiting</p>
            <p className="text-xs text-white/50 mt-1 max-w-xs">
              A blog setup PR was already created. Merge it to enable publishing.
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            {status?.prUrl && (
              <Button
                asChild
                size="sm"
                className="bg-blue-600 text-white hover:bg-blue-700 gap-2"
              >
                <a href={status.prUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" />
                  View Pull Request
                </a>
              </Button>
            )}
            <Button
              onClick={() => onOpenChange(false)}
              size="sm"
              variant="outline"
              className="bg-white/5 text-white hover:bg-white/10 border-white/[0.08]"
            >
              Close
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center gap-5 py-4">
        <div className="flex items-center justify-center size-14 rounded-full bg-white/[0.04] border border-white/[0.06]">
          <Rocket className="size-7 text-white/60" />
        </div>
        <div className="text-center max-w-xs">
          <p className="text-sm font-medium text-white">Set up your blog</p>
          <p className="text-xs text-white/50 mt-1.5 leading-relaxed">
            Our AI agent will analyze your website, generate blog infrastructure files, and create a Pull Request. Once merged, you can publish directly from Content Lab.
          </p>
        </div>
        <div className="w-full space-y-2.5 px-2">
          <div className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-4 py-2.5">
            <Globe className="size-4 text-white/40 flex-shrink-0" />
            <span className="text-xs text-white/60">Detects your tech stack (Next.js, HTML, React, etc.)</span>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-4 py-2.5">
            <FileCode className="size-4 text-white/40 flex-shrink-0" />
            <span className="text-xs text-white/60">Generates blog page, post templates & data structure</span>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-4 py-2.5">
            <GitPullRequest className="size-4 text-white/40 flex-shrink-0" />
            <span className="text-xs text-white/60">Opens a Pull Request — you review and merge</span>
          </div>
        </div>
        <Button
          onClick={handleSetupBlog}
          size="sm"
          className="mt-1 bg-white text-black hover:bg-white/90 gap-2 font-medium px-6"
        >
          <Rocket className="size-3.5" />
          Set Up Blog
        </Button>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={isRunning ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#111] border-white/[0.06] text-white">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-white">
            Blog Setup
          </DialogTitle>
          <DialogDescription className="text-white/50 text-sm">
            {isRunning
              ? "Agent is configuring your blog..."
              : "Enable publishing from Content Lab to your website"}
          </DialogDescription>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  )
}
