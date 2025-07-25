"use client"

import * as React from "react"
import {
  IconCamera,
  IconChartBar,
  IconDashboard,
  IconDatabase,
  IconFileAi,
  IconFileDescription,
  IconFileWord,
  IconFolder,
  IconHelp,
  IconInnerShadowTop,
  IconListDetails,
  IconReport,
  IconSearch,
  IconSettings,
  IconUsers,
  IconSparkles,
  IconRobot,
  IconBrandGoogle,
  IconTarget,
  IconBug,
  IconWorldWww,
  IconTrendingUp,
  IconUser,
  IconChecklist,
  IconMessageChatbot,
  IconPhone,
  IconMessage,
} from "@tabler/icons-react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { StarBorder } from "@/components/ui/star-border"
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
      title: "Overview",
      url: "/dashboard",
      icon: IconTrendingUp,
    },
    {
      title: "Insights",
      url: "/dashboard/insights",
      icon: IconChartBar,
    },
    {
      title: "Tasks",
      url: "/dashboard/tasks",
      icon: IconChecklist,
    },
    {
      title: "Agent Chat",
      url: "/dashboard/chat",
      icon: IconMessageChatbot,
    },
    {
      title: "Brand Profile",
      url: "/dashboard/brand-profile",
      icon: IconUser,
    },
    {
      title: "Campaign Generator",
      url: "/dashboard/campaign-generator",
      icon: IconSparkles,
    },
  ],
  navClouds: [
    {
      title: "Capture",
      icon: IconCamera,
      isActive: true,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Proposal",
      icon: IconFileDescription,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Prompts",
      icon: IconFileAi,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
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
      <Sidebar collapsible="offcanvas" className="bg-pure-black" {...props}>
        <SidebarHeader className="pb-3 bg-pure-black">
          {/* Mudra Logo */}
          <div className="flex justify-center w-full py-2 pointer-events-none select-none">
            <img 
              src="/images/mudra-logo.png" 
              alt="Mudra" 
              className="!size-10"
              loading="eager"
              decoding="sync"
            />
          </div>
          
          {/* Company Header */}
          <div className="px-3 py-1 isolate">
            <button
              onClick={handleCompanyMenuClick}
              onKeyDown={handleCompanyMenuKeyDown}
              className="inline-flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-all duration-200 cursor-pointer group/company focus:outline-none"
              aria-label={`Company menu for ${companyData.name}${companyData.website ? ` (${companyData.website})` : ''}`}
              aria-expanded={isDropdownOpen}
              aria-haspopup="menu"
              type="button"
            >
              <div className="w-7 h-7 bg-gradient-to-br from-white/10 to-white/5 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 group-hover/company:scale-110 group-hover/company:from-white/15 group-hover/company:to-white/10">
                {companyData.logo ? (
                  <img 
                    src={companyData.logo} 
                    alt={`${companyData.name} logo`}
                    className="w-5 h-5 rounded object-cover"
                  />
                ) : (
                  <span className="text-white/80 font-semibold text-xs transition-all duration-200 group-hover/company:text-white">
                    {companyInitials}
                  </span>
                )}
              </div>
              <div className="min-w-0 text-left">
                <p className="text-white/70 text-xs font-medium truncate transition-all duration-200 group-hover/company:text-white">
                  {companyData.name}
                </p>
                {companyData.website && (
                  <p className="text-white/40 text-[10px] truncate transition-all duration-200 group-hover/company:text-white/60">
                    {companyData.website}
                  </p>
                )}
              </div>
              <svg 
                className={`w-3 h-3 text-white/30 transition-all duration-200 ml-1 group-hover/company:text-white/60 ${
                  isDropdownOpen ? 'rotate-180' : 'group-hover/company:translate-y-0.5'
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
          
          {/* Divider */}
          <div className="mx-3 my-3">
            <div className="h-px bg-white/10"></div>
          </div>
          
          {/* Magic Button */}
          <div className="px-2 mb-4">
            <StarBorder
              className="w-full bg-pure-black border-white/20 [&>div:last-child]:py-2.5 [&>div:last-child]:px-4 transition-all duration-300 hover:scale-[1.02] hover:border-white/30 cursor-pointer group"
              color="white"
            >
              <div className="flex items-center justify-center gap-2 text-white text-sm font-medium transition-all duration-300 group-hover:text-white/90">
                <IconSparkles className="w-4 h-4 transition-transform duration-300 group-hover:rotate-12" />
                The Magic Button
              </div>
            </StarBorder>
          </div>
        </SidebarHeader>
        <SidebarContent className="px-2 bg-pure-black">
          {/* Main Navigation */}
          <NavMain items={data.navMain} />
          
          <NavSecondary items={data.navSecondary} className="mt-auto" />
        </SidebarContent>
        <SidebarFooter className="bg-pure-black space-y-3">
          {/* Support & Feedback */}
          <div className="px-2 space-y-1">
            <button className="w-full h-10 px-3 text-sm text-white/60 hover:text-white/90 hover:bg-white/5 transition-all duration-200 flex items-center gap-3 rounded-lg group">
              <IconPhone className="w-4 h-4 text-white/40 group-hover:text-white/60 transition-colors" />
              <span className="font-medium">Live Support</span>
            </button>
            <button className="w-full h-10 px-3 text-sm text-white/60 hover:text-white/90 hover:bg-white/5 transition-all duration-200 flex items-center gap-3 rounded-lg group">
              <IconMessage className="w-4 h-4 text-white/40 group-hover:text-white/60 transition-colors" />
              <span className="font-medium">Feedback</span>
            </button>
          </div>
          
          {/* Divider */}
          <div className="px-4">
            <div className="h-px bg-white/10"></div>
          </div>
          
          {/* Search Bar */}
          <div className="px-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="relative group w-full h-10 text-left transition-all"
            >
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-hover:text-white/50 transition-colors" />
              <div className="w-full h-full pl-10 pr-3 text-sm bg-white/5 border border-white/10 rounded-lg text-white/30 focus:outline-none focus:border-white/20 focus:bg-white/10 hover:bg-white/[0.07] transition-all flex items-center justify-between">
                <span>Search</span>
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[10px] font-medium text-white/50">
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
