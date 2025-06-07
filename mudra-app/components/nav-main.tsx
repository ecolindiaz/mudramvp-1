"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { IconCirclePlusFilled, IconMail, type Icon } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

// Client-only navigation component
function ClientNavigation({
  items,
  pathname,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
    isActive?: boolean
  }[]
  pathname: string
}) {
  return (
    <SidebarMenu className="space-y-1">
      {items.map((item, index) => {
        const isActive = pathname === item.url
        
        return (
          <div key={item.title}>
            <SidebarMenuItem>
              <SidebarMenuButton 
                tooltip={item.title} 
                isActive={isActive} 
                asChild
                className="h-9 px-3 text-sm font-medium"
              >
                <Link href={item.url}>
                  {item.icon && <item.icon className="w-4 h-4 mr-2" />}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {index < items.length - 1 && (
              <div className="mx-4 my-2 border-t border-white/10" />
            )}
          </div>
        )
      })}
    </SidebarMenu>
  )
}

// Server-safe navigation component
function ServerNavigation({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
    isActive?: boolean
  }[]
}) {
  return (
    <SidebarMenu className="space-y-1">
      {items.map((item, index) => (
        <div key={item.title}>
          <SidebarMenuItem>
            <SidebarMenuButton 
              tooltip={item.title} 
              isActive={false} 
              asChild
              className="h-9 px-3 text-sm font-medium"
            >
              <Link href={item.url}>
                {item.icon && <item.icon className="w-4 h-4 mr-2" />}
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {index < items.length - 1 && (
            <div className="mx-4 my-2 border-t border-white/10" />
          )}
        </div>
      ))}
    </SidebarMenu>
  )
}

export function NavMain({
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
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        {isHydrated ? (
          <ClientNavigation items={items} pathname={pathname} />
        ) : (
          <ServerNavigation items={items} />
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
