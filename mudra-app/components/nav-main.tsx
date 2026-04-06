"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { memo, useState, useCallback, useRef, useLayoutEffect } from "react"
import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const iconAnimationMap: Record<string, string> = {
  "Overview": "animate-icon-overview",
  "Tracked Prompts": "animate-icon-track",
  "Issues": "animate-icon-alarm",
  "Content Lab": "animate-icon-bubble",
  "Conversation Radar": "animate-icon-radar",
  "Brand Profile": "animate-icon-wave",
  "Integrations": "animate-icon-link",
  "Answer Optimizer": "animate-icon-mixer",
}

// Optimized navigation item component
const NavigationItem = memo(({
  item,
  isActive
}: {
  item: { title: string; url: string; icon?: LucideIcon; badge?: string }
  isActive: boolean
}) => {
  const [animating, setAnimating] = useState(false)

  const handleClick = useCallback(() => {
    setAnimating(false)
    requestAnimationFrame(() => setAnimating(true))
  }, [])

  const animationClass = animating ? (iconAnimationMap[item.title] || "animate-icon-ping") : ""

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={item.title}
        isActive={isActive}
        asChild
        className={`h-8 px-3 text-sm font-medium relative transition-all duration-200 group rounded-lg ${
          isActive
            ? 'text-white !bg-white/[0.08]'
            : 'text-white hover:text-white hover:bg-white/10'
        }`}
      >
        <Link href={item.url} onClick={handleClick}>
          {item.icon && (
            <item.icon
              strokeWidth={2.5}
              className={`w-[25px] h-[25px] mr-1.25 transition-all duration-200 ${
                isActive ? 'text-white/70' : 'text-white/60 group-hover:text-white/80'
              } ${animationClass}`}
              onAnimationEnd={() => setAnimating(false)}
            />
          )}
          <span className={`transition-all duration-200 ${
            isActive ? 'text-white font-medium' : 'text-white font-normal'
          }`}>
            {item.title}
          </span>
          {item.badge && (
            <span className="ml-auto text-[10px] font-medium leading-none px-1.5 py-0.5 rounded-full border border-red-500/40 text-red-400">
              {item.badge}
            </span>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
})

NavigationItem.displayName = "NavigationItem"

// Floating active indicator that animates between items
function ActiveIndicator({ menuRef, activeUrl }: { menuRef: React.RefObject<HTMLDivElement | null>; activeUrl: string | null }) {
  const [rect, setRect] = useState<{ top: number; height: number } | null>(null)
  const isFirstRender = useRef(true)

  useLayoutEffect(() => {
    if (!menuRef.current || !activeUrl) {
      setRect(null)
      return
    }
    const container = menuRef.current
    const activeLink = container.querySelector<HTMLAnchorElement>(`a[href="${activeUrl}"]`)
    if (!activeLink) {
      setRect(null)
      return
    }
    const containerRect = container.getBoundingClientRect()
    const linkRect = activeLink.getBoundingClientRect()
    setRect({
      top: linkRect.top - containerRect.top,
      height: linkRect.height,
    })
    // After first render, allow animations
    requestAnimationFrame(() => { isFirstRender.current = false })
  }, [activeUrl, menuRef])

  if (!rect) return null

  return (
    <motion.div
      className="absolute left-0 right-0 rounded-lg !bg-white/[0.08] pointer-events-none"
      initial={isFirstRender.current ? { top: rect.top, height: rect.height } : undefined}
      animate={{ top: rect.top, height: rect.height }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 32,
      }}
    />
  )
}

export const NavMain = memo(function NavMain({
  items,
}: {
  items?: {
    title: string
    items: {
      title: string
      url: string
      icon?: LucideIcon
      isActive?: boolean
      badge?: string
    }[]
  }[]
}) {
  const pathname = usePathname()

  // Flatten all items to find the active URL
  const allItems = items?.flatMap(s => s.items) ?? []
  const activeUrl = allItems.find(item =>
    pathname === item.url || (item.url === "/dashboard/campaigns" && pathname?.startsWith("/dashboard/campaigns/"))
  )?.url ?? null

  const menuRef = useRef<HTMLDivElement>(null)

  return (
    <div className="px-2 space-y-3 relative" ref={menuRef}>
      <ActiveIndicator menuRef={menuRef} activeUrl={activeUrl} />
      {items?.map((section) => (
        <SidebarGroup key={section.title}>
          <SidebarGroupLabel className="text-sm font-medium text-white px-2 pb-1.5 pt-0">
            {section.title}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0">
              {section.items.map((item) => {
                const isActive = !!(pathname && (pathname === item.url || (item.url === "/dashboard/campaigns" && pathname.startsWith("/dashboard/campaigns/"))))
                return (
                  <NavigationItem
                    key={item.title}
                    item={item}
                    isActive={isActive}
                  />
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )) || null}
    </div>
  )
})
