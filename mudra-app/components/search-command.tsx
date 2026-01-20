"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  User,
  Link as LinkIcon,
  HelpCircle,
  ArrowRight,
  Clock,
  Search,
  Bug,
} from "lucide-react"
import { OverviewIcon, TrackedPromptsIcon, IssuesIcon, ContentLabIcon, AgentLabIcon } from "@/components/icons"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

interface SearchCommandProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const navigationItems = [
  { title: "Overview", url: "/dashboard", icon: OverviewIcon, keywords: ["home", "dashboard"] },
  { title: "Tracked Prompts", url: "/dashboard/tracked-prompts", icon: TrackedPromptsIcon, keywords: ["prompts", "tracking"] },
  { title: "Issues", url: "/dashboard/issues", icon: IssuesIcon, keywords: ["bugs", "problems"] },
  { title: "Content Lab", url: "/dashboard/campaigns", icon: ContentLabIcon, keywords: ["campaigns", "content"] },
  { title: "Agent Lab", url: "/dashboard/agents-lab", icon: AgentLabIcon, keywords: ["agents", "ai"] },
  { title: "Brand Profile", url: "/dashboard/brand-profile", icon: User, keywords: ["brand", "profile", "settings"] },
  { title: "Integrations", url: "/dashboard/integrations", icon: LinkIcon, keywords: ["connect", "api"] },
]

export function SearchCommand({ open, onOpenChange }: SearchCommandProps) {
  const router = useRouter()
  const pathname = usePathname()
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

  const currentItem = navigationItems.find(item => pathname === item.url)
  const otherItems = navigationItems.filter(item => pathname !== item.url)

  const groupHeadingStyles = "[&_[cmdk-group-heading]]:text-white/35 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pl-3"
  const itemStyles = "group px-3 py-2 rounded-md text-white/60 data-[selected=true]:bg-white/[0.05] data-[selected=true]:text-white/90 cursor-pointer transition-all duration-150"

  return (
    <CommandDialog 
      open={open} 
      onOpenChange={onOpenChange}
      className="bg-[#161616] border border-white/[0.08] rounded-xl shadow-2xl max-w-md backdrop-blur-xl"
      showCloseButton={false}
    >
      <CommandInput 
        placeholder="Search..." 
        className="h-12 text-white/90 placeholder:text-white/25 text-[15px]"
      />
      <CommandList className="max-h-[340px] p-1.5 bg-[#161616]">
        <CommandEmpty className="py-12 text-center">
          <Search className="w-8 h-8 text-white/20 mx-auto mb-3" />
          <p className="text-sm text-white/40">No results found</p>
          <p className="text-xs text-white/25 mt-1">Try a different search term</p>
        </CommandEmpty>

        {currentItem && (
          <CommandGroup heading="Current" className={groupHeadingStyles}>
            <CommandItem
              onSelect={() => runCommand(() => router.push(currentItem.url))}
              className={itemStyles}
              keywords={currentItem.keywords}
            >
              <currentItem.icon className="w-4 h-4 text-white/40 group-data-[selected=true]:text-white/60" />
              <span className="flex-1 text-[13px]">{currentItem.title}</span>
              <Clock className="w-3 h-3 text-white/25" />
            </CommandItem>
          </CommandGroup>
        )}
        
        <CommandGroup heading="Go to" className={`${currentItem ? 'mt-1' : ''} ${groupHeadingStyles}`}>
          {otherItems.map((item) => (
            <CommandItem
              key={item.url}
              onSelect={() => runCommand(() => router.push(item.url))}
              className={itemStyles}
              keywords={item.keywords}
            >
              <item.icon className="w-4 h-4 text-white/40 group-data-[selected=true]:text-white/60" />
              <span className="flex-1 text-[13px]">{item.title}</span>
              <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-data-[selected=true]:opacity-40 group-data-[selected=true]:translate-x-0 transition-all duration-150" />
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Help" className={`mt-1 ${groupHeadingStyles}`}>
          <CommandItem
            onSelect={() => runCommand(() => window.open("https://docs.mudra.com", "_blank"))}
            className={itemStyles}
            keywords={["help", "docs", "support"]}
          >
            <HelpCircle className="w-4 h-4 text-white/40 group-data-[selected=true]:text-white/60" />
            <span className="flex-1 text-[13px]">Documentation</span>
            <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-data-[selected=true]:opacity-40 group-data-[selected=true]:translate-x-0 transition-all duration-150" />
          </CommandItem>
        </CommandGroup>
      </CommandList>
      
      <div className="flex items-center gap-4 border-t border-white/[0.05] px-3 py-2 bg-[#161616]/80 text-[10px] text-white/25">
        <span className="flex items-center gap-1.5">
          <kbd className="px-1 py-0.5 rounded bg-white/[0.05] text-white/35 font-mono text-[9px]">↑↓</kbd>
          navigate
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="px-1 py-0.5 rounded bg-white/[0.05] text-white/35 font-mono text-[9px]">↵</kbd>
          open
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="px-1 py-0.5 rounded bg-white/[0.05] text-white/35 font-mono text-[9px]">esc</kbd>
          close
        </span>
      </div>
    </CommandDialog>
  )
}
