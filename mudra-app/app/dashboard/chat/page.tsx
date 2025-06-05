import { AppSidebar } from "@/components/app-sidebar"
import { ChatInterface } from "@/components/chat-interface"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default function ChatPage() {
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
          <div className="@container/main flex flex-1 flex-col gap-2 bg-black h-[calc(100vh-var(--header-height))]">
            <ChatInterface />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 