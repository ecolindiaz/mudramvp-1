"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { memo } from "react"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

// Optimized navigation item component
const NavigationItem = memo(({ 
  item, 
  isActive 
}: { 
  item: { title: string; url: string; icon?: LucideIcon }
  isActive: boolean 
}) => (
  <SidebarMenuItem>
    <SidebarMenuButton
      tooltip={item.title}
      isActive={isActive}
      asChild
      className={`h-9 px-3 text-sm font-medium relative transition-all duration-200 group rounded ${
        isActive
          ? 'text-white/80 bg-white/10'
          : 'text-white/70 hover:text-white/80 hover:bg-white/10'
      }`}
    >
      <Link href={item.url}>
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-white/60 rounded-full" />
        )}
        {item.icon && (
          <item.icon className={`w-4 h-4 mr-2.5 transition-all duration-200 ${
            isActive ? 'text-white/70' : 'text-white/60 group-hover:text-white/80'
          }`} />
        )}
        <span className={`transition-all duration-200 ${
          isActive ? 'text-white/70 font-medium' : 'font-normal'
        }`}>
          {item.title}
        </span>
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>
))

NavigationItem.displayName = "NavigationItem"

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
    }[]
  }[]
}) {
  const pathname = usePathname()

  return (
    <div className="px-2 space-y-4">
      {items?.map((section, index) => (
        <SidebarGroup key={section.title}>
          <SidebarGroupLabel className="text-sm font-medium text-white/50 px-2 pb-2 pt-1">
            {section.title}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
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