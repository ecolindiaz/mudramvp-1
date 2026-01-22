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
      className={`h-8 px-3 text-sm font-medium relative transition-all duration-200 group rounded ${
        isActive
          ? 'text-white bg-white/10'
          : 'text-white hover:text-white hover:bg-white/10'
      }`}
    >
      <Link href={item.url}>
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-white/60 rounded-full" />
        )}
        {item.icon && (
          <item.icon strokeWidth={2.5} className={`w-[25px] h-[25px] mr-1.25 transition-all duration-200 ${
            isActive ? 'text-white/70' : 'text-white/60 group-hover:text-white/80'
          }`} />
        )}
        <span className={`transition-all duration-200 ${
          isActive ? 'text-white font-medium' : 'text-white font-normal'
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
<<<<<<< Updated upstream
    <div className="px-2 space-y-3">
      {items?.map((section, index) => (
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
=======
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu className="space-y-1">
          {items?.map((item, index) => (
            <NavigationItem
              key={`nav-${index}-${item.title}-${item.url}`}
              item={item}
              isActive={pathname === item.url}
            />
          )) || null}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
>>>>>>> Stashed changes
  )
})