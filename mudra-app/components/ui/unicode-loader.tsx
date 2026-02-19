"use client"

import React from "react"
import { cn } from "@/lib/utils"

const DEFAULT_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const

interface UnicodeLoaderProps {
  className?: string
  animate?: boolean
  staticGlyph?: string
  intervalMs?: number
  frames?: readonly string[]
}

export function UnicodeLoader({
  className,
  animate = true,
  staticGlyph,
  intervalMs = 80,
  frames = DEFAULT_FRAMES,
}: UnicodeLoaderProps) {
  const [frameIndex, setFrameIndex] = React.useState(0)

  React.useEffect(() => {
    if (!animate) return
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }

    const timer = window.setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % frames.length)
    }, intervalMs)

    return () => window.clearInterval(timer)
  }, [animate, frames.length, intervalMs])

  const glyph = animate ? frames[frameIndex] : (staticGlyph ?? frames[0])

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex items-center justify-center font-mono leading-none align-middle select-none",
        className
      )}
    >
      {glyph}
    </span>
  )
}
