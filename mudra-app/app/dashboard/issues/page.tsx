"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { BrandProfileProvider, useBrandProfile } from "@/components/brand-profile-context"

function IssuesPageInner() {
  const { profile } = useBrandProfile()

  return (
    <SidebarProvider
      className="bg-dark-grey"
      style={
        {
          "--sidebar-width": "16rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <Separator className="w-full border-border" />
        <div className="flex flex-1 flex-col bg-dark-grey">
          <div className="container-type-inline-size container-name-main flex flex-1 flex-col gap-3 md:gap-4 bg-dark-grey">
            {/* Page Header */}
            <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">Issues</h1>
                  <p className="text-muted-foreground">Track and manage issues across your brand</p>
                </div>
              </div>
            </div>

            {/* Clean Divider Line - Full Width */}
            <div className="h-[0.25px] bg-white/10"></div>

            {/* Content Area */}
            <div className="flex flex-col flex-1">
              <div className="px-4 lg:px-6 pt-6 pb-6 md:pb-8 space-y-4">
                {/* Page content goes here */}
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function IssuesPage() {
  return (
    <BrandProfileProvider>
      <IssuesPageInner />
    </BrandProfileProvider>
  )
}
