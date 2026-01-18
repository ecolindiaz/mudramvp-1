"use client"

import * as React from "react"
import { forwardRef } from "react"
import { useSession } from "next-auth/react"
import { IconSearch, IconPhone, IconMessage } from "@tabler/icons-react"
import { LayoutDashboard, MessageSquare, CheckSquare, FileText, User, Sparkles, Link as LinkIcon, Bell, CreditCard, Settings, Code2 } from "lucide-react"
import type { LucideProps } from "lucide-react"

// Custom Astromech Agent Icon Component - Fixed to match Lucide icon type
const AstromechIcon = forwardRef<SVGSVGElement, LucideProps>(
  ({ className, ...props }, ref) => (
    <svg 
      ref={ref}
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 512 512"
      className={className}
      fill="currentColor"
      {...props}
    >
      <path d="M256 0C185.3 0 128 57.3 128 128l0 16-40 0c-30.9 0-56 25.1-56 56l0 210.9-29.9 67.3c-3.3 7.4-2.6 16 1.8 22.8S15.9 512 24 512l112 0c13.3 0 24-10.7 24-24l0-72.9 22.1 24.8c4.6 5.1 11.1 8.1 17.9 8.1l112 0c6.9 0 13.4-2.9 17.9-8.1l22.1-24.8 0 72.9c0 13.3 10.7 24 24 24l112 0c8.1 0 15.7-4.1 20.1-10.9s5.1-15.4 1.8-22.8L480 410.9 480 200c0-30.9-25.1-56-56-56l-40 0 0-16C384 57.3 326.7 0 256 0zM192 96a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zm112 0a16 16 0 1 1 0 32 16 16 0 1 1 0-32zM88 192l24 0 0 272-51.1 0 17-38.3c1.4-3.1 2.1-6.4 2.1-9.7l0-216c0-4.4 3.6-8 8-8zm72 0l192 0 0 150.9-50.8 57.1-90.4 0-50.8-57.1 0-150.9zm240 0l24 0c4.4 0 8 3.6 8 8l0 216c0 3.4 .7 6.7 2.1 9.7l17 38.3-51.1 0 0-272zM208 224c-8.8 0-16 7.2-16 16s7.2 16 16 16l96 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-96 0zm0 64c-8.8 0-16 7.2-16 16s7.2 16 16 16l96 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-96 0z"/>
    </svg>
  )
)

AstromechIcon.displayName = "AstromechIcon"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { SearchCommand } from "@/components/search-command"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { useBrandProfile } from "@/components/brand-profile-context"

// Interface for company data
interface CompanyData {
  name: string
  website?: string
  logo?: string
}

// Utility function to get company initials
const getCompanyInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const data = {
  user: {
    name: "User",
    email: "user@example.com",
    avatar: "",
  },
  navMain: [
    {
      title: "Core",
      items: [
        {
          title: "Overview",
          url: "/dashboard",
          icon: LayoutDashboard,
        },
        {
          title: "Tracked Prompts",
          url: "/dashboard/tracked-prompts",
          icon: MessageSquare,
        },
        {
          title: "Tasks",
          url: "/dashboard/tasks",
          icon: CheckSquare,
        },
      ]
    },
    {
      title: "Presence Lab",
      items: [
        {
          title: "Content Lab",
          url: "/dashboard/campaigns",
          icon: Sparkles,
        },
        {
          title: "Agent Lab",
          url: "/dashboard/agents-lab",
          icon: AstromechIcon,
        },
        {
          title: "Technical Structure",
          url: "/dashboard/technical",
          icon: Code2,
        },
      ]
    },
    {
      title: "Knowledge Base",
      items: [
        {
          title: "Brand Profile",
          url: "/dashboard/brand-profile",
          icon: User,
        },
        {
          title: "Integrations",
          url: "/dashboard/integrations",
          icon: LinkIcon,
        },
      ]
    },
    {
      title: "Settings",
      items: [
        {
          title: "Account",
          url: "/dashboard/account",
          icon: Settings,
        },
        // Billing - hidden in production
        ...(process.env.NODE_ENV !== 'production' ? [{
          title: "Billing",
          url: "/dashboard/billing",
          icon: CreditCard,
        }] : []),
        // Notifications - hidden in production
        ...(process.env.NODE_ENV !== 'production' ? [{
          title: "Notifications",
          url: "/dashboard/notifications",
          icon: Bell,
        }] : []),
      ]
    },
    
  ],
  navSecondary: [],
}

export const AppSidebar = React.memo(function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [isMounted, setIsMounted] = React.useState(false)
  
  // Get session data from NextAuth
  const { data: session } = useSession()
  
  // Get brand profile data
  const { profile } = useBrandProfile()
  
  // Debug logging for profile loading
  React.useEffect(() => {
    if (isMounted) {
      console.log('🏢 [AppSidebar] Profile state:', { 
        id: profile?.id, 
        companyName: profile?.companyName,
        hasProfile: !!profile?.id 
      })
    }
  }, [profile, isMounted])
  
  // Prevent hydration mismatch by only using profile data after mount
  React.useEffect(() => {
    setIsMounted(true)
  }, [])
  
  // Use real company data from BrandProfile, but only after mounting
  // Shows "Loading..." while profile is being fetched
  const companyData: CompanyData = React.useMemo(() => ({
    name: isMounted 
      ? (profile?.companyName || (profile?.id ? "Unnamed Company" : "Loading..."))
      : "Your Company",
    website: isMounted && profile?.companyWebsite ? profile.companyWebsite : undefined,
    logo: isMounted && profile?.userAvatar ? profile.userAvatar : undefined
  }), [profile, isMounted])
  
  // Use real user data from session, fallback to mock data
  const userData = session?.user ? {
    name: session.user.name || "User",
    email: session.user.email || "user@example.com",
    avatar: session.user.image || "",
  } : data.user

  // Handle company menu interaction
  const handleCompanyMenuClick = React.useCallback(() => {
    setIsDropdownOpen(prev => !prev)
    // TODO: In future, this could open a company switcher dropdown or settings menu
  }, [])

  // Handle keyboard navigation for company menu
  const handleCompanyMenuKeyDown = React.useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleCompanyMenuClick()
    }
    if (event.key === 'Escape' && isDropdownOpen) {
      setIsDropdownOpen(false)
    }
  }, [handleCompanyMenuClick, isDropdownOpen])

  // Get company initials for avatar
  const companyInitials = React.useMemo(() => 
    getCompanyInitials(companyData.name), 
    [companyData.name]
  )

  return (
    <>
      <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} />
      <Sidebar 
        side="left"
        variant="sidebar"
        collapsible="offcanvas" 
        className="bg-dark-grey" 
        {...props}
      >
        <SidebarHeader className="pb-0 bg-dark-grey h-[var(--header-height)] flex items-center">
          {/* Company Header */}
          <div className="px-3 w-full">
            <button
              onClick={handleCompanyMenuClick}
              onKeyDown={handleCompanyMenuKeyDown}
              className="inline-flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-200 cursor-pointer group/company focus:outline-none hover:bg-white/[0.03] w-full"
              aria-label={`Company menu for ${companyData.name}${companyData.website ? ` (${companyData.website})` : ''}`}
              aria-expanded={isDropdownOpen}
              aria-haspopup="menu"
              type="button"
            >
              <div className="w-7 h-7 bg-gradient-to-br from-white/10 to-white/5 rounded-md flex items-center justify-center flex-shrink-0 transition-all duration-200 group-hover/company:from-white/15 group-hover/company:to-white/10 border border-white/[0.08]">
                {companyData.logo ? (
                  <img 
                    src={companyData.logo} 
                    alt={`${companyData.name} logo`}
                    className="w-4 h-4 rounded object-cover"
                  />
                ) : (
                  <span className="text-white/80 font-semibold text-[10px] transition-all duration-200 group-hover/company:text-white">
                    {companyInitials}
                  </span>
                )}
              </div>
              <div className="min-w-0 text-left flex-1">
                <p className="text-white/80 text-sm font-medium truncate transition-all duration-200 group-hover/company:text-white">
                  {companyData.name}
                </p>
              </div>
              <svg 
                className={`w-3 h-3 text-white/30 transition-all duration-200 flex-shrink-0 group-hover/company:text-white/50 ${
                  isDropdownOpen ? 'rotate-180' : ''
                }`}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </SidebarHeader>
        
        {/* Divider */}
        <Separator className="w-full border-white/[0.08]" />
        
        <SidebarContent className="px-0 bg-dark-grey pt-4">
          {/* Main Navigation */}
          <NavMain items={data.navMain} />
          
          <NavSecondary items={data.navSecondary} className="mt-auto" />
        </SidebarContent>
        <SidebarFooter className="bg-dark-grey space-y-3 pb-4">
          {/* Support & Feedback - Simplified */}
          <div className="px-3 space-y-1">
            {/* Live Support - hidden in production */}
            {process.env.NODE_ENV !== 'production' && (
              <button className="w-full h-8 px-3 text-xs text-white/60 hover:text-white/90 hover:bg-white/[0.03] transition-all duration-200 flex items-center gap-2 rounded-md group">
                <IconPhone className="w-3.5 h-3.5 text-white/40 group-hover:text-white/70 transition-colors" />
                <span className="font-medium">Live Support</span>
              </button>
            )}
            <button className="w-full h-8 px-3 text-xs text-white/60 hover:text-white/90 hover:bg-white/[0.03] transition-all duration-200 flex items-center gap-2 rounded-md group">
              <IconMessage className="w-3.5 h-3.5 text-white/40 group-hover:text-white/70 transition-colors" />
              <span className="font-medium">Feedback</span>
            </button>
          </div>
          
          {/* Divider */}
          <div className="px-3">
            <div className="h-px bg-white/[0.08]"></div>
          </div>
          
          {/* Search Bar - Refined */}
          <div className="px-3">
            <button
              onClick={() => setSearchOpen(true)}
              className="relative group w-full h-9 text-left transition-all rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12]"
            >
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 group-hover:text-white/60 transition-colors" />
              <div className="w-full h-full pl-9 pr-3 text-xs flex items-center justify-between text-white/40 group-hover:text-white/60">
                <span>Search</span>
                <kbd className="pointer-events-none inline-flex h-4 select-none items-center rounded border border-white/[0.08] bg-white/[0.05] px-1.5 font-mono text-[9px] font-medium text-white/50">
                  ⌘K
                </kbd>
              </div>
            </button>
          </div>
          
          <NavUser user={userData} />
        </SidebarFooter>
      </Sidebar>
    </>
  )
})