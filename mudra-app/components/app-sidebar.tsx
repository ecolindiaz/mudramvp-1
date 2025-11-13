"use client"

import * as React from "react"
import { IconSearch, IconPhone, IconMessage } from "@tabler/icons-react"
import { LayoutDashboard, MessageSquare, CheckSquare, FileText, User, Sparkles } from "lucide-react"
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

// Interface for company data
interface CompanyData {
  name: string
  website?: string
  logo?: string
}

// Mock company data - this will be replaced with real data from onboarding
const mockCompanyData: CompanyData = {
  name: "Y Combinator",
  website: "ycombinator.com",
  logo: undefined // Will use first letter as fallback
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
      ]
    },
  ],
  navSecondary: [],
}

export const AppSidebar = React.memo(function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false)
  const [companyData, setCompanyData] = React.useState<CompanyData>(mockCompanyData)
  const [searchOpen, setSearchOpen] = React.useState(false)

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
            <button className="w-full h-8 px-3 text-xs text-white/60 hover:text-white/90 hover:bg-white/[0.03] transition-all duration-200 flex items-center gap-2 rounded-md group">
              <IconPhone className="w-3.5 h-3.5 text-white/40 group-hover:text-white/70 transition-colors" />
              <span className="font-medium">Live Support</span>
            </button>
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
          
          <NavUser user={data.user} />
        </SidebarFooter>
      </Sidebar>
    </>
  )
})
