import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { FloatingMudraButton } from "@/components/floating-mudra-button"
import { BrandProfileProvider } from "@/components/brand-profile-context"

export default function CampaignGeneratorLayout({ children }: { children: React.ReactNode }) {
  return (
    <BrandProfileProvider>
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
            <div className="@container/main flex flex-1 flex-col bg-dark-grey">
              <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-6 md:pb-8">
                {children}
              </div>
            </div>
          </div>
        </SidebarInset>
        <FloatingMudraButton siteId={typeof window !== 'undefined' ? (localStorage.getItem('mudra:siteId') || '') : ''} />
      </SidebarProvider>
    </BrandProfileProvider>
  )
}
