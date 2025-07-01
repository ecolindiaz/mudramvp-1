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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

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
  return (
    <Sidebar collapsible="offcanvas" className="bg-pure-black" {...props}>
      <SidebarHeader className="pb-3 bg-pure-black">
        <div className="flex justify-center w-full py-2 pointer-events-none select-none">
          <img 
            src="/images/mudra-logo.png" 
            alt="Mudra" 
            className="!size-12"
            loading="eager"
            decoding="sync"
          />
        </div>
        
        {/* Magic Button */}
        <div className="px-2 mt-4">
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
      <SidebarFooter className="bg-pure-black">
        {/* Support & Feedback */}
        <div className="px-2 pb-2 space-y-1">
          <button className="w-full h-9 px-3 text-sm font-medium text-white/70 hover:text-white hover:pl-4 transition-all duration-200 flex items-center gap-2 rounded-md">
            <IconPhone className="w-4 h-4" />
            <span>Live Support</span>
          </button>
          <button className="w-full h-9 px-3 text-sm font-medium text-white/70 hover:text-white hover:pl-4 transition-all duration-200 flex items-center gap-2 rounded-md">
            <IconMessage className="w-4 h-4" />
            <span>Feedback</span>
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="px-2 pb-2">
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Search"
              className="w-full h-9 pl-10 pr-3 text-sm bg-transparent border border-white/20 rounded-md text-white placeholder-white/40 focus:outline-none focus:border-white/30 transition-all"
            />
          </div>
        </div>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
})
