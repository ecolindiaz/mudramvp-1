"use client"

import * as React from "react"
import { IconPlus, IconTrash, IconLoader2, IconExternalLink, IconRadar, IconSearch } from "@tabler/icons-react"
import { DiscoverPagesModal } from "@/components/issues/discover-pages-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { useBrandProfile } from "@/components/brand-profile-context"

interface TrackedPage {
  id: string
  page_url: string
  page_type: string | null
  scrape_status: string
  last_scraped_at: string | null
  score: number | null
}

interface SitemapUrlsPanelProps {
  brandProfileId: number
  companyWebsite: string
}

export function SitemapUrlsPanel({ brandProfileId, companyWebsite }: SitemapUrlsPanelProps) {
  const { selectedCountry } = useBrandProfile()
  const [pages, setPages] = React.useState<TrackedPage[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [urlInput, setUrlInput] = React.useState("")
  const [isAdding, setIsAdding] = React.useState(false)
  const [removingId, setRemovingId] = React.useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [discoverOpen, setDiscoverOpen] = React.useState(false)
  const pendingIdsRef = React.useRef<Set<string>>(new Set())

  // Derive domain prefix for display
  const domainPrefix = React.useMemo(() => {
    try {
      const raw = companyWebsite.startsWith("http")
        ? companyWebsite
        : `https://${companyWebsite}`
      return new URL(raw).origin
    } catch {
      return companyWebsite
    }
  }, [companyWebsite])

  // Fetch tracked pages
  const fetchPages = React.useCallback(async () => {
    try {
      const countryParam = selectedCountry ? `&country=${selectedCountry}` : ''
      const res = await fetch(`/api/sitemap-pages?brandProfileId=${brandProfileId}${countryParam}`)
      if (!res.ok) return
      const data = await res.json()
      const incoming: TrackedPage[] = data.pages ?? []

      // Detect pending → scraped/failed transitions to refresh dashboard
      if (pendingIdsRef.current.size > 0) {
        const hasResolved = incoming.some(
          (p) => pendingIdsRef.current.has(p.id) && p.scrape_status !== "pending"
        )
        if (hasResolved) {
          window.dispatchEvent(new CustomEvent("mudra:website-analyzed"))
        }
      }

      // Update pending IDs ref
      pendingIdsRef.current = new Set(
        incoming.filter((p) => p.scrape_status === "pending").map((p) => p.id)
      )

      setPages(incoming)
    } catch {
      // Silently fail — user sees stale data
    } finally {
      setIsLoading(false)
    }
  }, [brandProfileId, selectedCountry])

  // Initial fetch
  React.useEffect(() => {
    fetchPages()
  }, [fetchPages])

  // Poll while any page is pending
  React.useEffect(() => {
    const hasPending = pages.some((p) => p.scrape_status === "pending")
    if (!hasPending) return

    const interval = setInterval(fetchPages, 5000)
    return () => clearInterval(interval)
  }, [pages, fetchPages])

  // Add URL handler
  const handleAdd = async () => {
    const path = urlInput.trim()
    if (!path) return

    // Build full URL
    const fullUrl = path.startsWith("http") ? path : `${domainPrefix}${path.startsWith("/") ? "" : "/"}${path}`

    // Client-side URL validation
    try {
      new URL(fullUrl)
    } catch {
      toast.error("Invalid URL format")
      return
    }

    setIsAdding(true)
    try {
      const res = await fetch("/api/sitemap-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandProfileId, url: fullUrl }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Failed to add URL")
        return
      }

      // Optimistically insert pending row (skip if poll already added it)
      pendingIdsRef.current = new Set([...pendingIdsRef.current, data.sitemapPageId])
      setPages((prev) => {
        if (prev.some((p) => p.id === data.sitemapPageId)) return prev
        return [
          ...prev,
          {
            id: data.sitemapPageId,
            page_url: fullUrl.toLowerCase().trim(),
            page_type: null,
            scrape_status: "pending",
            last_scraped_at: null,
            score: null,
          },
        ]
      })
      setUrlInput("")
      toast.success("URL added — scraping in progress")
    } catch {
      toast.error("Failed to add URL")
    } finally {
      setIsAdding(false)
    }
  }

  // Remove URL handler
  const handleRemove = async (sitemapPageId: string) => {
    setRemovingId(sitemapPageId)
    try {
      const res = await fetch("/api/sitemap-pages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandProfileId, sitemapPageId }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Failed to remove URL")
        return
      }

      // Optimistically remove row
      setPages((prev) => prev.filter((p) => p.id !== sitemapPageId))
      setConfirmRemoveId(null)
      toast.success("URL removed")

      // Dispatch event to refresh issue stats
      window.dispatchEvent(new CustomEvent("mudra:website-analyzed"))
    } catch {
      toast.error("Failed to remove URL")
    } finally {
      setRemovingId(null)
    }
  }

  // Status badge — matches issue card tag style
  const StatusBadge = ({ status }: { status: string }) => {
    const dotColor = status === "scraped" ? "bg-emerald-400"
      : status === "pending" ? "bg-amber-400"
      : (status === "failed" || status === "unreachable") ? "bg-red-400"
      : "bg-white/40"
    const label = status === "unreachable" ? "Failed" : status.charAt(0).toUpperCase() + status.slice(1)

    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.05]">
        {status === "pending" ? (
          <IconLoader2 className="w-3 h-3 text-white/40 animate-spin" />
        ) : (
          <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        )}
        <span className="text-[11px] text-white/50">{label}</span>
      </span>
    )
  }

  // Filter pages by search query
  const filteredPages = React.useMemo(() => {
    if (!searchQuery.trim()) return pages
    const q = searchQuery.toLowerCase()
    return pages.filter((p) => p.page_url.toLowerCase().includes(q) || (p.page_type?.toLowerCase().includes(q)))
  }, [pages, searchQuery])

  // Extract display path from full URL
  const getDisplayPath = (url: string): string => {
    try {
      const parsed = new URL(url)
      return parsed.pathname === "/" ? "/" : parsed.pathname
    } catch {
      return url
    }
  }

  if (isLoading) {
    return (
      <div className="bg-[#1b1b1b] rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <IconLoader2 className="w-4 h-4 text-white/40 animate-spin" />
          <span className="text-sm text-white/50">Loading tracked pages...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#1b1b1b] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white/80">Tracked Pages</h3>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setDiscoverOpen(true)}
            size="sm"
            variant="ghost"
            className="text-[11px] text-white/40 hover:text-white/60 h-7 px-2"
          >
            <IconRadar className="w-3.5 h-3.5 mr-1" />
            Discover
          </Button>
          <span className="text-[11px] text-white/40">{pages.length} pages</span>
        </div>
      </div>

      {/* Add URL input */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 flex items-center bg-white/[0.03] border border-white/[0.06] rounded-lg overflow-hidden">
          <span className="text-[12px] text-white/30 px-3 whitespace-nowrap select-none border-r border-white/[0.06]">
            {domainPrefix}
          </span>
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="/path/to/page"
            className="border-0 bg-transparent text-[13px] text-white/80 placeholder:text-white/20 focus-visible:ring-0 h-9"
          />
        </div>
        <Button
          onClick={handleAdd}
          disabled={isAdding || !urlInput.trim()}
          size="sm"
          className="bg-white/[0.08] hover:bg-white/[0.12] text-white/80 border border-white/[0.06] h-9 px-3"
        >
          {isAdding ? (
            <IconLoader2 className="w-4 h-4 animate-spin" />
          ) : (
            <IconPlus className="w-4 h-4" />
          )}
          <span className="ml-1.5 text-[12px]">Add</span>
        </Button>
      </div>

      {/* Search filter */}
      {pages.length > 0 && (
        <div className="relative mb-3">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pages..."
            className="pl-8 border border-white/[0.06] bg-white/[0.03] text-[13px] text-white/80 placeholder:text-white/20 focus-visible:ring-0 h-8 rounded-lg"
          />
        </div>
      )}

      {/* Pages table */}
      {pages.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-[13px] text-white/40">No tracked pages yet</p>
          <p className="text-[11px] text-white/25 mt-1">Add a URL above to start tracking</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filteredPages.length === 0 && searchQuery.trim() ? (
            <div className="text-center py-6">
              <p className="text-[13px] text-white/40">No pages matching &ldquo;{searchQuery}&rdquo;</p>
            </div>
          ) : filteredPages.map((page) => (
            <div
              key={page.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.02] group"
            >
              {/* URL path */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-white/70 truncate">
                    {getDisplayPath(page.page_url)}
                  </span>
                  <a
                    href={page.page_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <IconExternalLink className="w-3 h-3 text-white/30 hover:text-white/50" />
                  </a>
                </div>
                {page.page_type && (
                  <span className="text-[10px] text-white/30 uppercase tracking-wider">
                    {page.page_type}
                  </span>
                )}
              </div>

              {/* Status */}
              <StatusBadge status={page.scrape_status} />

              {/* Score */}
              <div className="w-12 text-right">
                {page.score !== null ? (
                  <span
                    className={`text-[13px] font-medium ${
                      page.score >= 70
                        ? "text-emerald-400"
                        : page.score >= 50
                          ? "text-amber-400"
                          : "text-red-400"
                    }`}
                  >
                    {page.score}
                  </span>
                ) : (
                  <span className="text-[11px] text-white/20">—</span>
                )}
              </div>

              {/* Remove button */}
              <div className="w-8">
                {confirmRemoveId === page.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleRemove(page.id)}
                      disabled={removingId === page.id}
                      className="text-[10px] text-red-400 hover:text-red-300 font-medium"
                    >
                      {removingId === page.id ? (
                        <IconLoader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        "Yes"
                      )}
                    </button>
                    <button
                      onClick={() => setConfirmRemoveId(null)}
                      className="text-[10px] text-white/40 hover:text-white/60"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmRemoveId(page.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/[0.05]"
                  >
                    <IconTrash className="w-3.5 h-3.5 text-white/30 hover:text-red-400" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <DiscoverPagesModal
        open={discoverOpen}
        onOpenChange={setDiscoverOpen}
        brandProfileId={brandProfileId}
        companyWebsite={companyWebsite}
        trackedCount={pages.length}
        onPagesAdded={fetchPages}
      />
    </div>
  )
}
