"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { TasksView } from "@/components/tasks-view"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { FloatingMudraButton } from "@/components/floating-mudra-button"
import { Button } from "@/components/ui/button"


export default function TasksPage() {
  return (
    <SidebarProvider
      className="bg-dark-grey"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 52)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset className="bg-dark-grey m-0 shadow-none rounded-none border-none">
        <SiteHeader />
        <Separator className="w-full border-border" />
        <div className="flex flex-1 flex-col bg-dark-grey">
          <div className="@container/main flex flex-1 flex-col gap-3 md:gap-4 bg-dark-grey">
            {/* Page Header (matches Overview format) */}
            <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">Tasks</h1>
                  <p className="text-muted-foreground">Manage and track optimization tasks</p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    className="h-9 rounded-xl"
                    variant="outline"
                    onClick={async () => {
                      // Get latest snapshot from database and generate tasks
                      try {
                        console.log('🚀 Generating tasks from latest snapshot...')
                        
                        // Fetch latest snapshot from database
                        const siteId = typeof window !== 'undefined' ? (localStorage.getItem('mudra:siteId') || '') : ''
                        const response = await fetch(`/api/tasks?siteId=${encodeURIComponent(siteId)}`)
                        const result = await response.json()
                        
                        if (!result.success || !result.data.latestSnapshot) {
                          alert('No website data found. Please analyze a website first from the Overview page.')
                          return
                        }
                        
                        const snapshot = result.data.latestSnapshot
                        console.log('✅ Using latest snapshot for task generation')
                        
                        // Generate tasks using the latest snapshot
                        const generateResponse = await fetch('/api/tasks/generate', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ snapshot, siteId })
                        })
                        
                        if (!generateResponse.ok) {
                          throw new Error(`Task generation failed: ${generateResponse.status}`)
                        }
                        
                        const generateResult = await generateResponse.json()
                        console.log('✅ Tasks generated:', generateResult.data.tasks.length)
                        
                        // Refresh tasks list
                        window.dispatchEvent(new CustomEvent('mudra:refresh-tasks'))
                        
                      } catch (error) {
                        console.error('❌ Error generating tasks:', error)
                        alert(`Task generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
                      }
                    }}
                  >
                    Generate Tasks
                  </Button>

                </div>
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

            <div className="flex flex-col gap-5 md:gap-6 pb-6 md:pb-8">
              <div>
                <TasksView />
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
      
      <FloatingMudraButton siteId={typeof window !== 'undefined' ? (localStorage.getItem('mudra:siteId') || '') : ''} />
    </SidebarProvider>
  )
} 