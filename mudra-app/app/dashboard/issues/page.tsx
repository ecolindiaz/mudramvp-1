"use client"

import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { BrandProfileProvider } from "@/components/brand-profile-context"
import { IconPlus } from "@tabler/icons-react"

// Custom status icons
const IdentifiedIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M10.1 2.182a10 10 0 0 1 3.8 0"/>
    <path d="M13.9 21.818a10 10 0 0 1-3.8 0"/>
    <path d="M17.609 3.721a10 10 0 0 1 2.69 2.7"/>
    <path d="M2.182 13.9a10 10 0 0 1 0-3.8"/>
    <path d="M20.279 17.609a10 10 0 0 1-2.7 2.69"/>
    <path d="M21.818 10.1a10 10 0 0 1 0 3.8"/>
    <path d="M3.721 6.391a10 10 0 0 1 2.7-2.69"/>
    <path d="M6.391 20.279a10 10 0 0 1-2.69-2.7"/>
  </svg>
)

const InProgressIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="19" r="2"/>
    <circle cx="12" cy="5" r="2"/>
    <circle cx="16" cy="12" r="2"/>
    <circle cx="20" cy="19" r="2"/>
    <circle cx="4" cy="19" r="2"/>
    <circle cx="8" cy="12" r="2"/>
  </svg>
)

const CompletedIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21.801 10A10 10 0 1 1 17 3.335"/>
    <path d="m9 11 3 3L22 4"/>
  </svg>
)

const MergedIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="18" cy="18" r="3"/>
    <circle cx="6" cy="6" r="3"/>
    <path d="M6 21V9a9 9 0 0 0 9 9"/>
  </svg>
)

// Issue type definition
interface Issue {
  id: string
  title: string
  type: "bug" | "improvement" | "feature"
  status: "identified" | "in_progress" | "completed" | "merged"
}

// Mock issues data
const mockIssues: Issue[] = [
  {
    id: "ISS-01",
    title: "Brand mentions not being tracked on Reddit",
    type: "bug",
    status: "identified",
  },
  {
    id: "ISS-02",
    title: "Sentiment analysis accuracy improvements",
    type: "improvement",
    status: "identified",
  },
  {
    id: "ISS-03",
    title: "Missing competitor tracking for Twitter/X",
    type: "feature",
    status: "in_progress",
  },
  {
    id: "ISS-04",
    title: "Dashboard loading performance optimization",
    type: "improvement",
    status: "in_progress",
  },
  {
    id: "ISS-05",
    title: "Email notification system implemented",
    type: "feature",
    status: "completed",
  },
  {
    id: "ISS-06",
    title: "Fixed duplicate mention detection",
    type: "bug",
    status: "completed",
  },
  {
    id: "ISS-07",
    title: "API rate limiting implementation",
    type: "feature",
    status: "merged",
  },
]

// Issue card component
function IssueCard({ issue }: { issue: Issue }) {
  const typeConfig = {
    bug: { color: "bg-red-500", label: "Bug" },
    improvement: { color: "bg-blue-500", label: "Improvement" },
    feature: { color: "bg-purple-500", label: "Feature" },
  }

  const statusConfig = {
    identified: { icon: IdentifiedIcon, color: "text-white/60" },
    in_progress: { icon: InProgressIcon, color: "text-amber-400" },
    completed: { icon: CompletedIcon, color: "text-white" },
    merged: { icon: MergedIcon, color: "text-sky-400" },
  }

  const typeConf = typeConfig[issue.type]
  const statusConf = statusConfig[issue.status]
  const StatusIcon = statusConf.icon

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all cursor-pointer group">
      <div className="flex items-start gap-3 mb-3">
        <StatusIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${statusConf.color}`} />
        <p className="text-[13px] text-white/90 font-medium leading-relaxed">
          {issue.title}
        </p>
      </div>
      <div className="flex items-center justify-between pl-7">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.05]">
          <span className={`w-1.5 h-1.5 rounded-full ${typeConf.color}`} />
          <span className="text-[11px] text-white/50">{typeConf.label}</span>
        </span>
        <span className="text-[11px] text-white/30 group-hover:text-white/50 transition-colors">
          {issue.id}
        </span>
      </div>
    </div>
  )
}

// Column component
function IssueColumn({
  title,
  issues,
  status
}: {
  title: string
  issues: Issue[]
  status: "identified" | "in_progress" | "completed" | "merged"
}) {
  const statusConfig = {
    identified: { icon: IdentifiedIcon, color: "text-white/60", bg: "bg-white/5" },
    in_progress: { icon: InProgressIcon, color: "text-amber-400", bg: "bg-amber-400/10" },
    completed: { icon: CompletedIcon, color: "text-white", bg: "bg-white/10" },
    merged: { icon: MergedIcon, color: "text-sky-400", bg: "bg-sky-400/10" },
  }

  const config = statusConfig[status]
  const StatusIcon = config.icon

  return (
    <div className="flex-1 min-w-[260px] max-w-[300px]">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg ${config.bg}`}>
            <StatusIcon className={`w-3.5 h-3.5 ${config.color}`} />
          </div>
          <span className="text-[13px] font-medium text-white/80">{title}</span>
          <span className="text-[11px] text-white/40 bg-white/[0.05] px-1.5 py-0.5 rounded-md">
            {issues.length}
          </span>
        </div>
        <button className="p-1.5 hover:bg-white/[0.05] rounded-lg transition-colors opacity-0 group-hover:opacity-100">
          <IconPlus className="w-3.5 h-3.5 text-white/40" />
        </button>
      </div>

      {/* Issues List */}
      <div className="space-y-3">
        {issues.map((issue) => (
          <IssueCard key={issue.id} issue={issue} />
        ))}
        {issues.length === 0 && (
          <div className="text-[13px] text-white/30 py-8 text-center border border-dashed border-white/[0.08] rounded-xl">
            No issues
          </div>
        )}
      </div>
    </div>
  )
}

function IssuesPageInner() {
  const [issues] = React.useState<Issue[]>(mockIssues)
  const [viewMode, setViewMode] = React.useState<"issues" | "analysis">("issues")
  const [activeTab, setActiveTab] = React.useState<"all" | "active" | "identified">("all")

  // Apply tab filters
  const filteredIssues = issues.filter(issue => {
    if (activeTab === "active" && (issue.status === "completed" || issue.status === "merged")) {
      return false
    }
    if (activeTab === "identified" && issue.status !== "identified") {
      return false
    }
    return true
  })

  const identifiedIssues = filteredIssues.filter(i => i.status === "identified")
  const inProgressIssues = filteredIssues.filter(i => i.status === "in_progress")
  const completedIssues = filteredIssues.filter(i => i.status === "completed")
  const mergedIssues = filteredIssues.filter(i => i.status === "merged")

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
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">Issues</h1>
                  <p className="text-sm text-white/60 mt-1">Track and manage issues across your brand</p>
                </div>
              </div>
            </div>

            {/* Divider Line - Full Width */}
            <div className="h-[0.5px] bg-white/10" />

            {/* Tabs Row */}
            <div className="px-4 lg:px-6 py-3.5 flex items-center justify-between">
              {/* Left side - Filter tags */}
              {viewMode === "issues" && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveTab("all")}
                    className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors ${
                      activeTab === "all"
                        ? "bg-white/[0.08] text-white"
                        : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
                    }`}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                      <circle cx="12" cy="12" r="10"/>
                    </svg>
                    All
                  </button>
                  <button
                    onClick={() => setActiveTab("active")}
                    className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors ${
                      activeTab === "active"
                        ? "bg-white/[0.08] text-white"
                        : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
                    }`}
                  >
                    <InProgressIcon className="w-3.5 h-3.5 opacity-70" />
                    Active
                  </button>
                  <button
                    onClick={() => setActiveTab("identified")}
                    className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors ${
                      activeTab === "identified"
                        ? "bg-white/[0.08] text-white"
                        : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
                    }`}
                  >
                    <IdentifiedIcon className="w-3.5 h-3.5 opacity-70" />
                    Backlog
                  </button>
                </div>
              )}

              {/* Right side - View Mode Selector */}
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  onClick={() => setViewMode("issues")}
                  className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors ${
                    viewMode === "issues"
                      ? "bg-white/[0.08] text-white"
                      : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
                  }`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  Issues
                </button>
                <button
                  onClick={() => setViewMode("analysis")}
                  className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors ${
                    viewMode === "analysis"
                      ? "bg-white/[0.08] text-white"
                      : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
                  }`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                    <line x1="18" y1="20" x2="18" y2="10"/>
                    <line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/>
                  </svg>
                  Analysis
                </button>
              </div>
            </div>

            {/* Divider Line - Full Width */}
            <div className="h-[0.5px] bg-white/10" />

            {/* Kanban Board - Issues View */}
            {viewMode === "issues" && (
              <div className="flex-1 overflow-x-auto">
                <div className="px-4 lg:px-6 py-6">
                  <div className="flex gap-6 min-w-max">
                    <IssueColumn
                      title="Identified"
                      issues={identifiedIssues}
                      status="identified"
                    />
                    <IssueColumn
                      title="In Progress"
                      issues={inProgressIssues}
                      status="in_progress"
                    />
                    <IssueColumn
                      title="Completed"
                      issues={completedIssues}
                      status="completed"
                    />
                    <IssueColumn
                      title="Merged"
                      issues={mergedIssues}
                      status="merged"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Analysis View */}
            {viewMode === "analysis" && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/40">
                      <line x1="18" y1="20" x2="18" y2="10"/>
                      <line x1="12" y1="20" x2="12" y2="4"/>
                      <line x1="6" y1="20" x2="6" y2="14"/>
                    </svg>
                  </div>
                  <p className="text-white/50 text-sm">Analysis view coming soon</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function IssuesPage() {
  return (
    <BrandProfileProvider>
      <IssuesPageInner />
    </BrandProfileProvider>
  )
}
