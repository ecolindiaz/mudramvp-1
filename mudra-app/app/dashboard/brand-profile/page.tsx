import { AppSidebar } from "@/components/app-sidebar"
import { BrandProfileForm } from "@/components/brand-profile-form"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { BrandProfileProvider } from "@/components/brand-profile-context"

export default function BrandProfilePage() {
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
            <div className="@container/main flex flex-1 flex-col gap-2 bg-dark-grey">
              <div className="py-8 px-4 lg:px-8">
                <BrandProfileForm />
              </div>
            </div>
          </div>
        </SidebarInset>

      </SidebarProvider>
    </BrandProfileProvider>
  )
}
