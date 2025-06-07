import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { AnalysisView } from "@/components/analysis-view"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default function AnalysisPage() {
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
        <div className="flex flex-1 flex-col bg-black">
          <AnalysisView />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 