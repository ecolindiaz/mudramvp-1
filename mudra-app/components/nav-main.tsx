"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { memo } from "react"
import { IconCirclePlusFilled, IconMail, type Icon } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  SidebarGroup,
  SidebarGroupContent,
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
      className="h-9 px-3 text-sm font-medium relative"
    >
      <Link href={item.url}>
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-gray-400 rounded-full" />
        )}
        {item.icon && <item.icon className="w-4 h-4 mr-2" />}
        <span>{item.title}</span>
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>
))

NavigationItem.displayName = "NavigationItem"

export const NavMain = memo(function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
    isActive?: boolean
  }[]
}) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu className="space-y-1">
          {items.map((item) => (
            <NavigationItem
              key={item.title}
              item={item}
              isActive={pathname === item.url}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
})
