"use client"

import * as React from "react"
import { IconLoader2, IconRadar, IconExternalLink, IconX } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"

interface DiscoveredPageItem {
  url: string
  pageType: string
  priority: number
  title: string | null
  reason: string | null
  importance: number | null
}

interface DiscoverPagesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  brandProfileId: number
  companyWebsite: string
  trackedCount: number
  onPagesAdded: () => void
}

type DiscoveryState = "idle" | "discovering" | "done" | "error"

const PAGE_GROUPS = [
  { key: "core", label: "Core Pages", types: new Set(["home", "pricing", "features"]) },
  { key: "product", label: "Product & Solutions", types: new Set(["product", "solutions", "use-cases", "integrations"]) },
  { key: "company", label: "Company", types: new Set(["about", "contact", "customers", "careers", "demo"]) },
  { key: "content", label: "Content", types: new Set(["blog", "resources", "changelog", "documentation"]) },
] as const

function groupPages(pages: DiscoveredPageItem[]) {
  const groups: Array<{ key: string; label: string; pages: DiscoveredPageItem[] }> = []
  const assigned = new Set<string>()

  for (const group of PAGE_GROUPS) {
    const matching = pages.filter((p) => group.types.has(p.pageType))
    if (matching.length > 0) {
      groups.push({ key: group.key, label: group.label, pages: matching })
      matching.forEach((p) => assigned.add(p.url))
    }
  }

  const remaining = pages.filter((p) => !assigned.has(p.url))
  if (remaining.length > 0) {
    groups.push({ key: "other", label: "Other", pages: remaining })
  }

  return groups
}

export function DiscoverPagesModal({
  open,
  onOpenChange,
  brandProfileId,
  companyWebsite,
  trackedCount,
  onPagesAdded,
}: DiscoverPagesModalProps) {
  const [state, setState] = React.useState<DiscoveryState>("idle")
  const [pages, setPages] = React.useState<DiscoveredPageItem[]>([])
  const [selectedUrls, setSelectedUrls] = React.useState<Set<string>>(new Set())
  const [isAdding, setIsAdding] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)

  const domain = React.useMemo(() => {
    try {
      const raw = companyWebsite.startsWith("http")
        ? companyWebsite
        : `https://${companyWebsite}`
      return new URL(raw).hostname
    } catch {
      return companyWebsite
    }
  }, [companyWebsite])

  // Run discovery when modal opens
  React.useEffect(() => {
    if (!open) {
      // Reset state on close
      setState("idle")
      setPages([])
      setSelectedUrls(new Set())
      setIsAdding(false)
      setErrorMessage(null)
      if (abortRef.current) abortRef.current.abort()
      return
    }

    runDiscovery()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const runDiscovery = async () => {
    setState("discovering")
    setErrorMessage(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch("/api/sitemap-pages/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandProfileId }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Discovery failed")
      }

      const data = await res.json()
      const discovered: DiscoveredPageItem[] = data.pages ?? []

      // Sort: lower priority number = more important, then by importance score desc
      discovered.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority
        return (b.importance ?? 0) - (a.importance ?? 0)
      })

      setPages(discovered)
      // Pre-select only high-priority pages (priority <= 5)
      setSelectedUrls(
        new Set(discovered.filter((p) => p.priority <= 5).map((p) => p.url))
      )
      setState("done")
    } catch (err) {
      if (controller.signal.aborted) return
      setErrorMessage(err instanceof Error ? err.message : "Discovery failed")
      setState("error")
    }
  }

  const toggleUrl = (url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev)
      if (next.has(url)) {
        next.delete(url)
      } else {
        next.add(url)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (selectedUrls.size === pages.length) {
      setSelectedUrls(new Set())
    } else {
      setSelectedUrls(new Set(pages.map((p) => p.url)))
    }
  }

  const groups = React.useMemo(() => groupPages(pages), [pages])

  const toggleGroup = (groupPages: DiscoveredPageItem[]) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev)
      const allSelected = groupPages.every((p) => next.has(p.url))
      if (allSelected) {
        groupPages.forEach((p) => next.delete(p.url))
      } else {
        groupPages.forEach((p) => next.add(p.url))
      }
      return next
    })
  }

  const handleAdd = async () => {
    if (selectedUrls.size === 0) return

    setIsAdding(true)
    try {
      const res = await fetch("/api/sitemap-pages/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandProfileId,
          urls: Array.from(selectedUrls),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Failed to add pages")
        return
      }

      const count = data.totalAdded ?? 0
      toast.success(
        `${count} page${count !== 1 ? "s" : ""} added — scraping in progress`
      )
      onPagesAdded()
      onOpenChange(false)
    } catch {
      toast.error("Failed to add pages")
    } finally {
      setIsAdding(false)
    }
  }

  const getDisplayPath = (url: string): string => {
    try {
      const parsed = new URL(url)
      return parsed.pathname === "/" ? "/" : parsed.pathname
    } catch {
      return url
    }
  }

  const pageTypeDotColor = (type: string): string => {
    switch (type) {
      case "home":
        return "bg-orange-500"
      case "pricing":
      case "features":
        return "bg-yellow-500"
      case "product":
      case "solutions":
      case "use-cases":
      case "integrations":
        return "bg-blue-400"
      case "blog":
      case "resources":
      case "changelog":
      case "documentation":
        return "bg-purple-400"
      case "about":
      case "customers":
      case "careers":
        return "bg-green-400"
      default:
        return "bg-gray-400"
    }
  }

  const importanceDot = (importance: number | null) => {
    if (importance == null) return null
    const color =
      importance >= 7
        ? "bg-emerald-400"
        : importance >= 4
          ? "bg-amber-400"
          : "bg-white/30"
    return <span className={`w-1.5 h-1.5 rounded-full ${color} shrink-0`} />
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-2xl bg-[#1b1b1b] border-white/[0.08] p-0 overflow-hidden gap-0"
      >
        <DialogTitle className="sr-only">Discover New Pages</DialogTitle>

        {/* ── Header ── */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-white/[0.06]">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Discover New Pages
            </h2>
            <p className="text-sm text-white/50 mt-0.5">
              {state === "discovering"
                ? `Scanning ${domain} for pages...`
                : state === "done" && pages.length > 0
                  ? `Found ${pages.length} new page${pages.length !== 1 ? "s" : ""} on ${domain}`
                  : state === "done"
                    ? `No new pages found on ${domain}`
                    : state === "error"
                      ? "Something went wrong"
                      : `Discover pages on ${domain}`}
            </p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="size-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.04] transition-colors shrink-0"
          >
            <IconX className="size-4" />
          </button>
        </div>

        {/* ── Discovering state ── */}
        {state === "discovering" && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="size-12 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
              <IconRadar className="size-5 text-white/30 animate-pulse" />
            </div>
            <div className="text-center">
              <p className="text-sm text-white/50">
                Scanning website for new pages...
              </p>
              <p className="text-xs text-white/30 mt-1">
                This may take up to 30 seconds
              </p>
            </div>
          </div>
        )}

        {/* ── Error state ── */}
        {state === "error" && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
              <p className="text-sm text-red-400">{errorMessage}</p>
            </div>
            <Button
              onClick={runDiscovery}
              variant="outline"
              className="h-9 rounded-full text-sm text-white/70 hover:text-white hover:bg-white/[0.06] border-0 bg-white/[0.04]"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* ── Empty state ── */}
        {state === "done" && pages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <div className="size-12 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-2">
              <IconRadar className="size-5 text-white/20" />
            </div>
            <p className="text-sm text-white/50">
              All discoverable pages are already being tracked.
            </p>
            <p className="text-xs text-white/30">
              You can still add pages manually using the input above.
            </p>
          </div>
        )}

        {/* ── Results ── */}
        {state === "done" && pages.length > 0 && (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-white/[0.06]">
              <div
                role="button"
                tabIndex={0}
                onClick={toggleAll}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    toggleAll()
                  }
                }}
                className="flex items-center gap-2 text-xs text-white/50 hover:text-white/70 transition-colors cursor-pointer"
              >
                <Checkbox
                  checked={
                    selectedUrls.size === pages.length
                      ? true
                      : selectedUrls.size > 0
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={toggleAll}
                  className="pointer-events-none"
                />
                {selectedUrls.size === pages.length
                  ? "Deselect all"
                  : "Select all"}
              </div>
              <span className="text-xs text-white/40">
                {selectedUrls.size} selected
              </span>
            </div>

            {/* Grouped page list */}
            <div className="overflow-y-auto max-h-[400px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              <div className="px-6 py-4 space-y-4">
                {groups.map((group) => {
                  const allSelected = group.pages.every((p) =>
                    selectedUrls.has(p.url)
                  )
                  const someSelected =
                    !allSelected &&
                    group.pages.some((p) => selectedUrls.has(p.url))

                  return (
                    <div key={group.key}>
                      {/* Group header */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleGroup(group.pages)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            toggleGroup(group.pages)
                          }
                        }}
                        className="flex items-center gap-2.5 py-1.5 mb-1 cursor-pointer group/header"
                      >
                        <Checkbox
                          checked={
                            allSelected
                              ? true
                              : someSelected
                                ? "indeterminate"
                                : false
                          }
                          onCheckedChange={() => toggleGroup(group.pages)}
                          className="pointer-events-none"
                        />
                        <span className="text-xs font-medium text-white/60 group-hover/header:text-white/80 transition-colors">
                          {group.label}
                        </span>
                        <span className="text-xs text-white/25 tabular-nums">
                          {group.pages.length}
                        </span>
                      </div>

                      {/* Group pages */}
                      <div className="space-y-px ml-1.5 pl-4 border-l border-white/[0.04]">
                        {group.pages.map((page) => (
                          <div
                            key={page.url}
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleUrl(page.url)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                toggleUrl(page.url)
                              }
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors text-left group/row cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedUrls.has(page.url)}
                              onCheckedChange={() => toggleUrl(page.url)}
                              className="pointer-events-none"
                            />

                            {importanceDot(page.importance)}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-white/80 truncate">
                                  {getDisplayPath(page.url)}
                                </span>
                                <a
                                  href={page.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="opacity-0 group-hover/row:opacity-100 transition-opacity"
                                >
                                  <IconExternalLink className="size-3.5 text-white/30 hover:text-white/50" />
                                </a>
                              </div>
                              {page.title && (
                                <p className="text-xs text-white/30 truncate mt-0.5">
                                  {page.title}
                                </p>
                              )}
                            </div>

                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 shrink-0 text-gray-400"
                            >
                              <span className={`size-1.5 rounded-full ${pageTypeDotColor(page.pageType)}`} />
                              {page.pageType}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06]">
          <span className="text-xs text-white/30">
            {trackedCount} page{trackedCount !== 1 ? "s" : ""} currently tracked
          </span>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="h-9 rounded-full text-sm text-white/70 hover:text-white hover:bg-white/[0.06] border-0 bg-white/[0.04]"
            >
              Cancel
            </Button>
            {state === "done" && pages.length > 0 && (
              <Button
                onClick={handleAdd}
                disabled={selectedUrls.size === 0 || isAdding}
                className="h-9 rounded-full bg-white text-black hover:bg-white/90 text-sm font-medium disabled:opacity-40"
              >
                {isAdding ? (
                  <IconLoader2 className="size-3.5 animate-spin mr-1.5" />
                ) : null}
                Add {selectedUrls.size} Page{selectedUrls.size !== 1 ? "s" : ""}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
