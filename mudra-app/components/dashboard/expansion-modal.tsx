"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Search, Download, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ExpansionModalColumn<T> {
  key: keyof T | string
  header: string
  width?: string
  align?: "left" | "center" | "right"
  sortable?: boolean
  render?: (item: T, index: number) => React.ReactNode
}

interface ExpansionModalProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  data: T[]
  columns: ExpansionModalColumn<T>[]
  isLoading?: boolean
  emptyMessage?: string
  emptySubMessage?: string
  searchPlaceholder?: string
  searchKey?: keyof T
  onExport?: () => void
  onRowClick?: (item: T, index: number) => void
  className?: string
  maxHeight?: string
  initialLimit?: number
}

type SortDirection = "asc" | "desc" | null

export function ExpansionModal<T extends Record<string, unknown>>({
  open,
  onOpenChange,
  title,
  description,
  data,
  columns,
  isLoading = false,
  emptyMessage = "No data available",
  emptySubMessage,
  searchPlaceholder = "Search...",
  searchKey,
  onExport,
  onRowClick,
  className,
  maxHeight = "60vh",
  initialLimit = 10,
}: ExpansionModalProps<T>) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [sortColumn, setSortColumn] = React.useState<string | null>(null)
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(null)
  const [isExpanded, setIsExpanded] = React.useState(false)

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      if (sortDirection === "asc") {
        setSortDirection("desc")
      } else if (sortDirection === "desc") {
        setSortColumn(null)
        setSortDirection(null)
      } else {
        setSortDirection("asc")
      }
    } else {
      setSortColumn(columnKey)
      setSortDirection("asc")
    }
  }

  const filteredData = React.useMemo(() => {
    let result = [...data]

    if (searchQuery && searchKey) {
      const query = searchQuery.toLowerCase()
      result = result.filter((item) => {
        const value = item[searchKey]
        if (typeof value === "string") {
          return value.toLowerCase().includes(query)
        }
        if (typeof value === "number") {
          return value.toString().includes(query)
        }
        return false
      })
    }

    if (sortColumn && sortDirection) {
      result.sort((a, b) => {
        const aVal = a[sortColumn as keyof T]
        const bVal = b[sortColumn as keyof T]

        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortDirection === "asc" ? aVal - bVal : bVal - aVal
        }
        if (typeof aVal === "string" && typeof bVal === "string") {
          return sortDirection === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal)
        }
        return 0
      })
    }

    return result
  }, [data, searchQuery, searchKey, sortColumn, sortDirection])

  // Apply limit unless expanded
  const displayData = React.useMemo(() => {
    if (isExpanded || searchQuery) return filteredData
    return filteredData.slice(0, initialLimit)
  }, [filteredData, isExpanded, initialLimit, searchQuery])

  const hasMoreItems = filteredData.length > initialLimit && !isExpanded && !searchQuery

  const getSortIcon = (columnKey: string) => {
    if (sortColumn !== columnKey) {
      return <ArrowUpDown className="size-3 text-white/30" />
    }
    if (sortDirection === "asc") {
      return <ChevronUp className="size-3 text-white/70" />
    }
    return <ChevronDown className="size-3 text-white/70" />
  }

  // Reset expanded state when modal closes
  React.useEffect(() => {
    if (!open) {
      setIsExpanded(false)
      setSearchQuery("")
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "!max-w-3xl bg-[#161616] border-white/[0.08] p-0 !rounded-2xl overflow-hidden",
          className
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
            <div>
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              {description && (
                <p className="text-sm text-white/50 mt-0.5">{description}</p>
              )}
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="flex items-center justify-center size-8 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.04] transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-white/[0.06]">
            {searchKey ? (
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40" />
                <Input
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/40 rounded-lg focus-visible:ring-white/20"
                />
              </div>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40">
                {isExpanded || searchQuery
                  ? `${filteredData.length} ${filteredData.length === 1 ? "item" : "items"}`
                  : `Showing ${displayData.length} of ${filteredData.length}`
                }
              </span>
              {onExport && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onExport}
                  className="h-8 px-3 text-white/60 hover:text-white hover:bg-white/[0.04]"
                >
                  <Download className="size-3.5 mr-1.5" />
                  Export
                </Button>
              )}
            </div>
          </div>

          {/* Table */}
          <div
            className="overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
            style={{ maxHeight }}
          >
            {isLoading ? (
              <div className="divide-y divide-white/[0.06]">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 px-6 py-4"
                    style={{
                      gridTemplateColumns: columns
                        .map((c) => c.width || "1fr")
                        .join(" "),
                    }}
                  >
                    {columns.map((col, colIdx) => (
                      <div
                        key={colIdx}
                        className="h-5 rounded bg-white/[0.06] animate-pulse"
                        style={{
                          width:
                            col.width ||
                            (colIdx === 0 ? "40px" : colIdx === 1 ? "50%" : "60px"),
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ) : filteredData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <p className="text-sm text-white/60">{emptyMessage}</p>
                {emptySubMessage && (
                  <p className="text-xs text-white/40 mt-1">{emptySubMessage}</p>
                )}
              </div>
            ) : (
              <>
                {/* Table Header */}
                <div
                  className="grid items-center gap-4 px-6 py-3 border-b border-white/[0.06] bg-[#161616] sticky top-0 z-10"
                  style={{
                    gridTemplateColumns: columns
                      .map((c) => c.width || "1fr")
                      .join(" "),
                  }}
                >
                  {columns.map((col) => (
                    <div
                      key={String(col.key)}
                      className={cn(
                        "text-xs font-medium text-white/50",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                        col.sortable && "cursor-pointer select-none hover:text-white/70 transition-colors"
                      )}
                      onClick={() => col.sortable && handleSort(String(col.key))}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.header}
                        {col.sortable && getSortIcon(String(col.key))}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Table Body */}
                <div className="divide-y divide-white/[0.06]">
                  {displayData.map((item, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "grid items-center gap-4 px-6 py-3.5 hover:bg-white/[0.02] transition-colors",
                        onRowClick && "cursor-pointer"
                      )}
                      style={{
                        gridTemplateColumns: columns
                          .map((c) => c.width || "1fr")
                          .join(" "),
                      }}
                      onClick={() => onRowClick?.(item, idx)}
                    >
                      {columns.map((col) => (
                        <div
                          key={String(col.key)}
                          className={cn(
                            "text-sm text-white/80",
                            col.align === "right" && "text-right",
                            col.align === "center" && "text-center"
                          )}
                        >
                          {col.render
                            ? col.render(item, idx)
                            : String(item[col.key as keyof T] ?? "")}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Show more button */}
                {hasMoreItems && (
                  <div className="flex justify-center py-4 border-t border-white/[0.06]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsExpanded(true)}
                      className="h-8 px-4 text-white/60 hover:text-white hover:bg-white/[0.06] text-xs font-medium rounded-lg transition-all gap-1.5"
                    >
                      Show all {filteredData.length} items
                      <ChevronDown className="size-3.5" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.06]">
            <Button
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 bg-white text-black hover:bg-white/90 rounded-lg font-medium"
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
