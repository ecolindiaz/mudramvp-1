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
  Radio,
} from "lucide-react"
import { OverviewIcon, TrackedPromptsIcon, IssuesIcon, ContentLabIcon } from "@/components/icons"

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
  { title: "Conversation Radar", url: "/dashboard/conversation-radar", icon: Radio, keywords: ["conversations", "radar", "reddit", "social"] },
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

  const groupHeadingStyles = "[&_[cmdk-group-heading]]:text-white/30 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:pl-2.5"
  const itemStyles = "group px-2.5 py-[7px] rounded-[6px] text-white/60 data-[selected=true]:bg-white/[0.06] data-[selected=true]:text-white/90 cursor-pointer transition-all duration-150"

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      className="bg-[#141414] border border-white/[0.06] rounded-[16px] shadow-2xl max-w-sm backdrop-blur-xl overflow-hidden !top-[30%]"
      showCloseButton={false}
    >
      <CommandInput
        placeholder="Go to anything..."
        className="h-10 text-white/90 placeholder:text-white/25 text-[14px]"
      />
      <div className="px-1.5 pb-1.5">
        <CommandList className="max-h-[300px] bg-[#1e1e1e] rounded-[12px] border border-white/[0.04] p-1">
          <CommandEmpty className="py-10 text-center">
            <Search className="w-7 h-7 text-white/15 mx-auto mb-3" />
            <p className="text-sm text-white/35">No results found</p>
            <p className="text-xs text-white/20 mt-1">Try a different search term</p>
          </CommandEmpty>

          <CommandGroup heading="Quick Actions" className={groupHeadingStyles}>
            {navigationItems.map((item) => (
              <CommandItem
                key={item.url}
                onSelect={() => runCommand(() => router.push(item.url))}
                className={itemStyles}
                keywords={item.keywords}
              >
                <item.icon className="w-4 h-4 text-white/40 group-data-[selected=true]:text-white/60" />
                <span className="flex-1 text-[12px]">{item.title}</span>
                <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-data-[selected=true]:opacity-40 group-data-[selected=true]:translate-x-0 transition-all duration-150" />
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Help" className={`mt-1 ${groupHeadingStyles}`}>
            <CommandItem
              onSelect={() => runCommand(() => window.open("https://docs.mudra.com", "_blank", "noopener,noreferrer"))}
              className={itemStyles}
              keywords={["help", "docs", "support"]}
            >
              <HelpCircle className="w-4 h-4 text-white/40 group-data-[selected=true]:text-white/60" />
              <span className="flex-1 text-[12px]">Documentation</span>
              <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-data-[selected=true]:opacity-40 group-data-[selected=true]:translate-x-0 transition-all duration-150" />
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </div>
    </CommandDialog>
  )
}
