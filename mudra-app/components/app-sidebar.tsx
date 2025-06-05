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
      title: "My Scores",
      url: "/dashboard",
      icon: IconTrendingUp,
      isActive: true,
    },
    {
      title: "Analysis",
      url: "#",
      icon: IconChartBar,
    },
    {
      title: "Technical",
      url: "#",
      icon: IconBug,
    },
    {
      title: "Footprint",
      url: "#",
      icon: IconWorldWww,
    },
    {
      title: "Agent Chat",
      url: "/dashboard/chat",
      icon: IconRobot,
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
  navSecondary: [
    {
      title: "Brand Profile",
      url: "#",
      icon: IconUser,
    },
    {
      title: "Settings",
      url: "#",
      icon: IconSettings,
    },
    {
      title: "Get Help",
      url: "#",
      icon: IconHelp,
    },
    {
      title: "Search",
      url: "#",
      icon: IconSearch,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" className="bg-black" {...props}>
      <SidebarHeader className="pb-6 bg-black">
        <div className="flex justify-center w-full py-2 pointer-events-none select-none">
          <img src="/images/mudra-logo.png" alt="Mudra" className="!size-8" />
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 bg-black">
        <div className="mb-6">
          <NavMain items={data.navMain} />
        </div>
        
        {/* Magic Button */}
        <div className="px-2 py-4 mt-4">
          <StarBorder
            className="w-full bg-black border-white/20"
            color="white"
          >
            <div className="flex items-center justify-center gap-2 text-white">
              <IconSparkles className="w-4 h-4" />
              The Magic Button
            </div>
          </StarBorder>
        </div>
        
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter className="bg-black">
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
