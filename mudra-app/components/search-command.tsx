"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  IconTrendingUp,
  IconChartBar,
  IconChecklist,
  IconMessageChatbot,
  IconUser,
  IconSparkles,
  IconSearch,
  IconCommand,
  IconBrandGoogle,
  IconRobot,
  IconWorldWww,
  IconTarget,
  IconFileDescription,
  IconSettings,
  IconHelp,
  IconReport,
} from "@tabler/icons-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"

interface SearchCommandProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchCommand({ open, onOpenChange }: SearchCommandProps) {
  const router = useRouter()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!mounted) return

    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [open, onOpenChange, mounted])

  const runCommand = React.useCallback((command: () => void) => {
    onOpenChange(false)
    command()
  }, [onOpenChange])

  return (
    <CommandDialog 
      open={open} 
      onOpenChange={onOpenChange}
      className="bg-dark-grey border-white/[0.06]"
      showCloseButton={false}
    >
      <CommandInput 
        placeholder="Search Mudra..." 
        className="h-12 border-0 bg-transparent text-white placeholder:text-white/30 focus:ring-0"
      />
      <CommandList className="max-h-[400px] overflow-y-auto overflow-x-hidden bg-dark-grey">
        <CommandEmpty className="py-6 text-center text-sm text-white/50">
          No results found.
        </CommandEmpty>
        
        <CommandGroup heading="Core" className="text-white/70">
          <CommandItem
            onSelect={() => runCommand(() => router.push("/dashboard"))}
            className="text-white/70 hover:text-white data-[selected=true]:bg-white/10 data-[selected=true]:text-white cursor-pointer"
          >
            <IconTrendingUp className="mr-2 h-4 w-4" />
            <span>Overview</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/dashboard/tracked-prompts"))}
            className="text-white/70 hover:text-white data-[selected=true]:bg-white/10 data-[selected=true]:text-white cursor-pointer"
          >
            <IconMessageChatbot className="mr-2 h-4 w-4" />
            <span>Tracked Prompts</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/dashboard/tasks"))}
            className="text-white/70 hover:text-white data-[selected=true]:bg-white/10 data-[selected=true]:text-white cursor-pointer"
          >
            <IconChecklist className="mr-2 h-4 w-4" />
            <span>Tasks</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator className="bg-white/[0.06]" />

        <CommandGroup heading="Presence Lab" className="text-white/70">
          <CommandItem
            onSelect={() => runCommand(() => router.push("/dashboard/campaigns"))}
            className="text-white/70 hover:text-white data-[selected=true]:bg-white/10 data-[selected=true]:text-white cursor-pointer"
          >
            <IconChartBar className="mr-2 h-4 w-4" />
            <span>Campaigns</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator className="bg-white/[0.06]" />

        <CommandGroup heading="Knowledge Base" className="text-white/70">
          <CommandItem
            onSelect={() => runCommand(() => router.push("/dashboard/brand-profile"))}
            className="text-white/70 hover:text-white data-[selected=true]:bg-white/10 data-[selected=true]:text-white cursor-pointer"
          >
            <IconUser className="mr-2 h-4 w-4" />
            <span>Brand Profile</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator className="bg-white/[0.06]" />

        <CommandGroup heading="Support" className="text-white/70">
          <CommandItem
            onSelect={() => runCommand(() => console.log("Help & Documentation"))}
            className="text-white/70 hover:text-white data-[selected=true]:bg-white/10 data-[selected=true]:text-white cursor-pointer"
          >
            <IconHelp className="mr-2 h-4 w-4" />
            <span>Help & Documentation</span>
            <CommandShortcut className="text-white/30">⌘?</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => console.log("Contact Support"))}
            className="text-white/70 hover:text-white data-[selected=true]:bg-white/10 data-[selected=true]:text-white cursor-pointer"
          >
            <IconReport className="mr-2 h-4 w-4" />
            <span>Contact Support</span>
          </CommandItem>
        </CommandGroup>

        {/* AI Analysis and Actions removed per IA simplification */}
      </CommandList>
      
      <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2 bg-dark-grey">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[10px] font-medium text-white/50">
              <IconCommand className="h-3 w-3" />K
            </kbd>
            <span className="text-xs text-white/30">to open</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[10px] font-medium text-white/50">
              ESC
            </kbd>
            <span className="text-xs text-white/30">to close</span>
          </div>
        </div>
        <span className="text-xs text-white/30">Mudra Search</span>
      </div>
    </CommandDialog>
  )
} 