"use client"

import React from "react"
import { Timer } from "lucide-react"
import { cn } from "@/lib/utils"

interface CountdownBadgeProps {
  /** Target time in milliseconds since epoch */
  targetMs?: number
  /** Optional className for container */
  className?: string
}

function formatHms(ms: number): string {
  if (ms <= 0) return "00:00:00"
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const hh = String(hours).padStart(2, "0")
  const mm = String(minutes).padStart(2, "0")
  const ss = String(seconds).padStart(2, "0")
  return `${hh}:${mm}:${ss}`
}

export function CountdownBadge({ targetMs, className }: CountdownBadgeProps) {
  // Ensure SSR/CSR markup matches by avoiding Date.now() in render on the server.
  // We render a stable fallback (20:00:00) until mounted, then start the client timer.
  const [mounted, setMounted] = React.useState(false)
  const targetRef = React.useRef<number | null>(null)
  const DEFAULT_DURATION_MS = 20 * 60 * 60 * 1000
  const [remaining, setRemaining] = React.useState<number>(DEFAULT_DURATION_MS)

  React.useEffect(() => {
    setMounted(true)

    // Initialize target time on client if not provided
    if (targetRef.current == null) {
      targetRef.current = targetMs ?? Date.now() + DEFAULT_DURATION_MS
    }

    const tick = () => {
      const target = targetMs ?? targetRef.current!
      setRemaining(Math.max(0, target - Date.now()))
    }

    // Tick immediately, then every second
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetMs])

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 h-9 rounded-xl border border-dashed px-3 text-sm font-medium",
        "bg-transparent text-white/90 border-white/40 hover:bg-white/5 transition-colors",
        className
      )}
      aria-label="Time until analysis"
      title="Time until analysis"
    >
      <Timer className="size-4" aria-hidden="true" />
      <span className="tabular-nums tracking-tight" suppressHydrationWarning>
        {mounted ? formatHms(remaining) : "20:00:00"}
      </span>
    </div>
  )}


