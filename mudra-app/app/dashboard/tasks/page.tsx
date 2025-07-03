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

export default function TasksPage() {
  return (
    <SidebarProvider
      className="bg-black"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset className="bg-black m-0 shadow-none rounded-none border-none">
        <SiteHeader />
        <Separator className="w-full border-border" />
        <div className="flex flex-1 flex-col bg-black">
          <div className="@container/main flex flex-1 flex-col gap-2 bg-black">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6">
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