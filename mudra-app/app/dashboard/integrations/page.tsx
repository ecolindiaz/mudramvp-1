"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import Image from "next/image"

export default function IntegrationsPage() {
  return (
    <SidebarProvider
      className="bg-dark-grey"
      style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
    >
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <Separator className="w-full border-border" />

        <div className="flex flex-1 flex-col bg-dark-grey">
          <div className="@container/main flex flex-1 flex-col bg-dark-grey">
            {/* Page Header */}
            <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">Integrations</h1>
                  <p className="text-sm text-white/60 mt-1">
                    Connect your stack to Mudra
                  </p>
                </div>
              </div>
            </div>

            {/* Divider line layout */}
            <div className="h-[1px] bg-white/10"></div>

            {/* Toolbar */}
            <div className="px-4 lg:px-6 pt-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="inline-flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-8 rounded-full bg-white text-black hover:bg-white/90 px-3 text-xs font-medium">
                    All
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 rounded-full border border-white/10 bg-white/5 text-white/80 hover:text-white px-3 text-xs font-medium">
                    Installed 0
                  </Button>
                </div>
                
              </div>
            </div>

            {/* Section - Source Control */}
            <div className="px-4 lg:px-6 pt-6">
              <div className="text-sm text-white/70 mb-3">Source Control</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* GitHub */}
                <Card className="group relative overflow-hidden bg-transparent backdrop-blur-sm rounded-lg border border-white/[0.08] hover:border-white/[0.12] transition-all duration-200">
                  <CardHeader className="border-0 pb-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center size-8 rounded-md bg-white/5 border border-white/10">
                          <Image src="/github.svg" alt="GitHub" width={16} height={16} />
                        </div>
                        <CardTitle className="text-white text-base font-semibold">GitHub</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-[15px] text-white/80 leading-relaxed">
                      Connect your repositories so Mudra can open Pull Requests for issues that it finds
                    </p>
                    <div>
                      <Button className="w-full h-10 rounded-lg bg-white/15 hover:bg-white/20 text-white text-sm font-medium">
                        Install
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* GitLab */}
                <Card className="group relative overflow-hidden bg-transparent backdrop-blur-sm rounded-lg border border-white/[0.08] hover:border-white/[0.12] transition-all duration-200">
                  <CardHeader className="border-0 pb-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center size-8 rounded-md bg-white/5 border border-white/10">
                          <Image src="/gitlab-3.svg" alt="GitLab" width={18} height={18} />
                        </div>
                        <CardTitle className="text-white text-base font-semibold">GitLab</CardTitle>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-white/60">Soon</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-[15px] text-white/80 leading-relaxed">
                      Connect your repositories so Mudra can open Pull Requests for issues that it finds
                    </p>
                    <div>
                      <Button disabled className="w-full h-10 rounded-lg bg-white/10 text-white/60 text-sm font-medium">
                        Install
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Slack */}
                <Card className="group relative overflow-hidden bg-transparent backdrop-blur-sm rounded-lg border border-white/[0.08] hover:border-white/[0.12] transition-all duration-200">
                  <CardHeader className="border-0 pb-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center size-8 rounded-md bg-white/5 border border-white/10">
                          <Image src="/slack-logo-thumb.png" alt="Slack" width={18} height={18} />
                        </div>
                        <CardTitle className="text-white text-base font-semibold">Slack</CardTitle>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-white/60">Soon</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-[15px] text-white/80 leading-relaxed">
                      Assign tasks to Tembo directly from Slack
                    </p>
                    <div>
                      <Button disabled className="w-full h-10 rounded-lg bg-white/10 text-white/60 text-sm font-medium">
                        Install
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}


