"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { getLogoUrl, getCompanyDomain } from "@/lib/logo"

interface CompanyLogoProps {
  /** Company name or domain */
  company: string
  /** Size in pixels */
  size?: number
  /** Additional CSS classes */
  className?: string
  /** Show fallback initial if logo fails */
  showFallback?: boolean
}

/**
 * Displays a company logo from Logo.dev with fallback handling
 */
export function CompanyLogo({
  company,
  size = 20,
  className,
  showFallback = true,
}: CompanyLogoProps) {
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const logoUrl = getLogoUrl(company, {
    size: size * 2, // Request 2x for retina
    format: 'png',
    theme: 'dark',
    fallback: 'monogram',
    retina: true,
  })

  // Get initial for fallback
  const getInitial = (name: string) => {
    const cleaned = name.replace(/^www\./, '').replace(/\.(com|io|dev|org|net|co)$/, '')
    return cleaned.charAt(0).toUpperCase()
  }

  if (!logoUrl || hasError) {
    if (!showFallback) return null

    return (
      <div
        className={cn(
          "flex items-center justify-center rounded bg-white/10 text-white/60 text-xs font-medium flex-shrink-0",
          className
        )}
        style={{ width: size, height: size }}
      >
        {getInitial(company)}
      </div>
    )
  }

  return (
    <div
      className={cn("relative flex-shrink-0 rounded overflow-hidden", className)}
      style={{ width: size, height: size }}
    >
      {isLoading && (
        <div
          className="absolute inset-0 bg-white/5 animate-pulse rounded"
          style={{ width: size, height: size }}
        />
      )}
      <img
        src={logoUrl}
        alt={`${company} logo`}
        width={size}
        height={size}
        className={cn(
          "object-contain transition-opacity duration-200",
          isLoading ? "opacity-0" : "opacity-100"
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true)
          setIsLoading(false)
        }}
        loading="lazy"
      />
    </div>
  )
}

/**
 * Displays a domain logo (for sources table)
 */
export function DomainLogo({
  domain,
  size = 16,
  className,
}: {
  domain: string
  size?: number
  className?: string
}) {
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Clean domain (remove www. prefix)
  const cleanDomain = domain.replace(/^www\./, '')

  const logoUrl = getLogoUrl(cleanDomain, {
    size: size * 2,
    format: 'png',
    theme: 'dark',
    fallback: 'monogram',
    retina: true,
  })

  if (!logoUrl || hasError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded bg-white/10 text-white/50 text-[10px] font-medium flex-shrink-0",
          className
        )}
        style={{ width: size, height: size }}
      >
        {cleanDomain.charAt(0).toUpperCase()}
      </div>
    )
  }

  return (
    <div
      className={cn("relative flex-shrink-0 rounded overflow-hidden", className)}
      style={{ width: size, height: size }}
    >
      {isLoading && (
        <div
          className="absolute inset-0 bg-white/5 animate-pulse rounded"
        />
      )}
      <img
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        className={cn(
          "object-contain transition-opacity duration-200",
          isLoading ? "opacity-0" : "opacity-100"
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true)
          setIsLoading(false)
        }}
        loading="lazy"
      />
    </div>
  )
}
