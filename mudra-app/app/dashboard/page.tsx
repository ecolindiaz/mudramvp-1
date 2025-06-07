import { AppSidebar } from "@/components/app-sidebar"
import { AiModelPerformance } from "@/components/ai-model-performance"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { CompetitiveShareChart } from "@/components/competitive-share-chart"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

import { dashboardData } from "@/app/dashboard/data"

export default function Page() {
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
          <div className="@container/main flex flex-1 flex-col gap-2 bg-black">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />
              <div className="px-4 lg:px-6">
                <ChartAreaInteractive />
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
                  <div className="min-w-0">
                    <DataTable data={dashboardData} />
                  </div>
                  <div className="min-w-0 flex flex-col gap-4">
                    <CompetitiveShareChart />
                    <AiModelPerformance />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
