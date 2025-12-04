"use client"

import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  IconCreditCard,
  IconDotsVertical,
  IconLogout,
  IconNotification,
  IconUserCircle,
} from "@tabler/icons-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()

  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    console.log('Signing out...')
    
    try {
      // Get CSRF token first
      const csrfResponse = await fetch('/api/auth/csrf')
      const { csrfToken } = await csrfResponse.json()
      
      // Call signout with CSRF token
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `csrfToken=${csrfToken}`,
      })
      
      console.log('Sign out response:', response.status)
      
      // Redirect to login
      window.location.href = '/login'
    } catch (error) {
      console.error('Sign out error:', error)
      // Force redirect even if there's an error
      window.location.href = '/login'
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg grayscale">
                <AvatarImage src={user.avatar || undefined} alt={user.name} />
                <AvatarFallback className="rounded-lg">CN</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {user.email}
                </span>
              </div>
              <IconDotsVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg bg-dark-grey border-white/[0.08] backdrop-blur-sm"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2.5 px-3 py-2.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg border border-white/[0.08]">
                  <AvatarImage src={user.avatar || undefined} alt={user.name} />
                  <AvatarFallback className="rounded-lg bg-white/10 text-white/80 text-xs">CN</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium text-white/90">{user.name}</span>
                  <span className="text-white/60 truncate text-xs">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="!bg-white/[0.08] my-2 mx-2" />
            <DropdownMenuGroup className="px-2 py-1 space-y-0.5">
              <DropdownMenuItem className="rounded-md text-white/80 hover:text-white hover:bg-white/[0.05] focus:bg-white/[0.05] focus:text-white cursor-pointer px-3 h-9">
                <IconUserCircle className="w-4 h-4" />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-md text-white/80 hover:text-white hover:bg-white/[0.05] focus:bg-white/[0.05] focus:text-white cursor-pointer px-3 h-9">
                <IconCreditCard className="w-4 h-4" />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-md text-white/80 hover:text-white hover:bg-white/[0.05] focus:bg-white/[0.05] focus:text-white cursor-pointer px-3 h-9">
                <IconNotification className="w-4 h-4" />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="!bg-white/[0.08] my-2 mx-2" />
            <div className="px-2 py-1">
              <DropdownMenuItem 
                onClick={handleSignOut}
                onSelect={(e) => e.preventDefault()}
                className="rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-300 cursor-pointer">
                <IconLogout className="w-4 h-4" />
              Log out
            </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
