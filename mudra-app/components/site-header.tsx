"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

const getPageTitle = (pathname: string) => {
  if (pathname === "/dashboard") return "Overview"
  if (pathname === "/dashboard/campaigns") return "Campaigns"
  if (pathname === "/dashboard/tasks") return "Tasks"
  // Chat page removed; popup only
  if (pathname === "/dashboard/brand-profile") return "Brand Profile"
  return "Overview" // fallback
}

export function SiteHeader() {
  const pathname = usePathname()
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  const pageTitle = isHydrated ? getPageTitle(pathname || "/dashboard") : "Overview"

  return (
    <header className="flex h-[var(--header-height)] shrink-0 items-center gap-2 border-b border-white/10 bg-dark-grey transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-[var(--header-height)]">
      <div className="flex w-full items-center justify-between gap-1 px-4 lg:gap-2 lg:px-6">
        <div className="flex items-center">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mx-2 data-[orientation=vertical]:h-4"
          />
          <h1 className="text-base font-medium text-white" suppressHydrationWarning={true}>
            {pageTitle}
          </h1>
        </div>
      </div>
    </header>
  )
}
