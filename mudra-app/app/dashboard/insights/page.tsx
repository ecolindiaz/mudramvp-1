import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { FloatingMudraButton } from "@/components/floating-mudra-button"

export default function InsightsPage() {
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
            {/* Page Header */}
            <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-2 md:pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight text-white">Insights</h1>
                  <span className="text-muted-foreground">-</span>
                  <p className="text-muted-foreground">
                    Detailed view of all tracked metrics
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-4 pb-4 md:gap-6 md:pb-6">
              <div className="px-4 lg:px-6">
                {/* Content will be added here when ready */}
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
      
      <FloatingMudraButton />
    </SidebarProvider>
  )
} 