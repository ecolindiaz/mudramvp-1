import { AppSidebar } from "@/components/app-sidebar"
import { AnalysisView } from "@/components/analysis-view"
import { FootprintView } from "@/components/footprint-view"
import { SiteHeader } from "@/components/site-header"
import { TasksView } from "@/components/tasks-view"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { FloatingMudraButton } from "@/components/floating-mudra-button"
import { Button } from "@/components/ui/button"
import { IconPlus } from "@tabler/icons-react"

export default function TasksPage() {
  return (
    <SidebarProvider
      className="bg-dark-grey"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 60)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset className="bg-dark-grey m-0 shadow-none rounded-none border-none">
        <SiteHeader />
        <Separator className="w-full border-border" />
        <div className="flex flex-1 flex-col bg-dark-grey">
          <div className="@container/main flex flex-1 flex-col gap-2 bg-dark-grey">
            {/* Page Header (matches Overview format) */}
            <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">Tasks</h1>
                  <p className="text-muted-foreground">Manage and track optimization tasks</p>
                </div>
                <Button size="sm" className="h-9 rounded-xl">
                  <IconPlus className="size-4 mr-2" />
                  Add Task
                </Button>
              </div>
              <div className="mt-4">
                <div className="relative">
                  <div className="h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                  <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 pb-4 md:gap-6 md:pb-6">
              <div className="px-0 lg:px-0">
                <TasksView />
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
      
      <FloatingMudraButton />
    </SidebarProvider>
  )
} 