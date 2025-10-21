"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { memo } from "react"
import { IconCirclePlusFilled, IconMail, type Icon } from "@tabler/icons-react"

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
  item: { title: string; url: string; icon?: Icon }
  isActive: boolean 
}) => (
  <SidebarMenuItem>
    <SidebarMenuButton 
      tooltip={item.title} 
      isActive={isActive} 
      asChild
      className={`h-9 px-3 text-sm font-medium relative transition-all duration-200 group rounded ${
        isActive 
          ? 'text-white bg-white/5' 
          : 'text-white/70 hover:text-white/90 hover:bg-white/5'
      }`}
    >
      <Link href={item.url}>
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-white rounded-full animate-glow" />
        )}
        {item.icon && (
          <item.icon className={`w-4 h-4 mr-2.5 transition-all duration-200 ${
            isActive ? 'text-white' : 'text-white/60 group-hover:text-white/80'
          }`} />
        )}
        <span className={`transition-all duration-200 ${
          isActive ? 'text-white font-medium' : 'font-normal'
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
      icon?: Icon
      isActive?: boolean
    }[]
  }[]
}) {
  const pathname = usePathname()

  return (
    <div className="px-2 space-y-4">
      {items?.map((section, index) => (
        <SidebarGroup key={section.title}>
          <SidebarGroupLabel className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.1em] px-2 pb-2 pt-1">
            {section.title}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {section.items.map((item) => (
                <NavigationItem
                  key={item.title}
                  item={item}
                  isActive={pathname ? pathname === item.url : false}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )) || null}
    </div>
  )
})
