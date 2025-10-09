"use client"

import { useEffect, useState } from 'react'
import { Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface AnalysisCooldownProps {
  brandProfileId: number
  className?: string
  onCooldownChange?: (canRun: boolean) => void
}

export function AnalysisCooldown({ brandProfileId, className, onCooldownChange }: AnalysisCooldownProps) {
  const [status, setStatus] = useState<{
    allowed: boolean
    timeUntilNext?: number
    lastRunAt?: Date
  } | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<string>('')

  useEffect(() => {
    checkCooldown()
    const interval = setInterval(checkCooldown, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [brandProfileId])

  useEffect(() => {
    if (!status || status.allowed) return

    const updateTimer = () => {
      if (!status.timeUntilNext) return

      const hours = Math.floor(status.timeUntilNext / (1000 * 60 * 60))
      const minutes = Math.floor((status.timeUntilNext % (1000 * 60 * 60)) / (1000 * 60))
      
      setTimeRemaining(`${hours}h ${minutes}m`)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 60000)
    return () => clearInterval(interval)
  }, [status])

  const checkCooldown = async () => {
    try {
      const response = await fetch(`/api/analysis/cooldown?brandProfileId=${brandProfileId}`)
      const data = await response.json()

      if (data.success) {
        setStatus(data)
        if (onCooldownChange) {
          onCooldownChange(data.allowed)
        }
      }
    } catch (error) {
      console.error('Error checking cooldown:', error)
    }
  }

  if (!status) {
    return null
  }

  const isDev = process.env.NODE_ENV === 'development'

  if (status.allowed) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "flex items-center gap-2 px-3 py-1",
          "bg-green-500/10 text-green-400 border-green-400/40",
          className
        )}
      >
        <CheckCircle className="w-4 h-4" />
        <span>Analysis Available</span>
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "flex items-center gap-2 px-3 py-1",
        isDev 
          ? "bg-yellow-500/10 text-yellow-400 border-yellow-400/40"
          : "bg-red-500/10 text-red-400 border-red-400/40",
        className
      )}
    >
      {isDev ? (
        <>
          <AlertCircle className="w-4 h-4" />
          <span>Dev Mode: Cooldown Bypassed</span>
        </>
      ) : (
        <>
          <Clock className="w-4 h-4" />
          <span>Next analysis in {timeRemaining}</span>
        </>
      )}
    </Badge>
  )
}
