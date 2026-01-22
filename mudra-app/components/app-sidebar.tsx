"use client"

import * as React from "react"
<<<<<<< Updated upstream
import { forwardRef } from "react"
import { IconSearch, IconCreditCard, IconLogout, IconNotification, IconUserCircle, IconQuestionMark, IconCalendar, IconFileText, IconExternalLink } from "@tabler/icons-react"
import { User, Link as LinkIcon, Code2 } from "lucide-react"
import type { LucideProps } from "lucide-react"
import { useRouter } from "next/navigation"

// Custom Overview Icon Component
const OverviewIcon = forwardRef<SVGSVGElement, LucideProps>(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path
        d="M7.75432 0.819537C7.59742 0.726821 7.4025 0.726821 7.24559 0.819537L1.74559 4.06954C1.59336 4.15949 1.49996 4.32317 1.49996 4.5C1.49996 4.67683 1.59336 4.84051 1.74559 4.93046L7.24559 8.18046C7.4025 8.27318 7.59742 8.27318 7.75432 8.18046L13.2543 4.93046C13.4066 4.84051 13.5 4.67683 13.5 4.5C13.5 4.32317 13.4066 4.15949 13.2543 4.06954L7.75432 0.819537ZM7.49996 7.16923L2.9828 4.5L7.49996 1.83077L12.0171 4.5L7.49996 7.16923ZM1.5695 7.49564C1.70998 7.2579 2.01659 7.17906 2.25432 7.31954L7.49996 10.4192L12.7456 7.31954C12.9833 7.17906 13.2899 7.2579 13.4304 7.49564C13.5709 7.73337 13.4921 8.03998 13.2543 8.18046L7.75432 11.4305C7.59742 11.5232 7.4025 11.5232 7.24559 11.4305L1.74559 8.18046C1.50786 8.03998 1.42901 7.73337 1.5695 7.49564ZM1.56949 10.4956C1.70998 10.2579 2.01658 10.1791 2.25432 10.3195L7.49996 13.4192L12.7456 10.3195C12.9833 10.1791 13.2899 10.2579 13.4304 10.4956C13.5709 10.7334 13.4921 11.04 13.2543 11.1805L7.75432 14.4305C7.59742 14.5232 7.4025 14.5232 7.24559 14.4305L1.74559 11.1805C1.50785 11.04 1.42901 10.7334 1.56949 10.4956Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.5"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  )
)

OverviewIcon.displayName = "OverviewIcon"

// Custom Tracked Prompts Icon Component
const TrackedPromptsIcon = forwardRef<SVGSVGElement, LucideProps>(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path
        d="M12.5 3L2.5 3.00002C1.67157 3.00002 1 3.6716 1 4.50002V9.50003C1 10.3285 1.67157 11 2.5 11H7.50003C7.63264 11 7.75982 11.0527 7.85358 11.1465L10 13.2929V11.5C10 11.2239 10.2239 11 10.5 11H12.5C13.3284 11 14 10.3285 14 9.50003V4.5C14 3.67157 13.3284 3 12.5 3ZM2.49999 2.00002L12.5 2C13.8807 2 15 3.11929 15 4.5V9.50003C15 10.8807 13.8807 12 12.5 12H11V14.5C11 14.7022 10.8782 14.8845 10.6913 14.9619C10.5045 15.0393 10.2894 14.9965 10.1464 14.8536L7.29292 12H2.5C1.11929 12 0 10.8807 0 9.50003V4.50002C0 3.11931 1.11928 2.00003 2.49999 2.00002Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.5"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  )
)

TrackedPromptsIcon.displayName = "TrackedPromptsIcon"

// Custom Issues Icon Component
const IssuesIcon = forwardRef<SVGSVGElement, LucideProps>(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path
        d="M7.28856 0.796908C7.42258 0.734364 7.57742 0.734364 7.71144 0.796908L13.7114 3.59691C13.8875 3.67906 14 3.85574 14 4.05V10.95C14 11.1443 13.8875 11.3209 13.7114 11.4031L7.71144 14.2031C7.57742 14.2656 7.42258 14.2656 7.28856 14.2031L1.28856 11.4031C1.11252 11.3209 1 11.1443 1 10.95V4.05C1 3.85574 1.11252 3.67906 1.28856 3.59691L7.28856 0.796908ZM2 4.80578L7 6.93078V12.9649L2 10.6316V4.80578ZM8 12.9649L13 10.6316V4.80578L8 6.93078V12.9649ZM7.5 6.05672L12.2719 4.02866L7.5 1.80176L2.72809 4.02866L7.5 6.05672Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.5"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  )
)

IssuesIcon.displayName = "IssuesIcon"

// Custom Content Lab Icon Component
const ContentLabIcon = forwardRef<SVGSVGElement, LucideProps>(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path
        d="M4.2 1H4.17741H4.1774C3.86936 0.999988 3.60368 0.999978 3.38609 1.02067C3.15576 1.04257 2.92825 1.09113 2.71625 1.22104C2.51442 1.34472 2.34473 1.51442 2.22104 1.71625C2.09113 1.92825 2.04257 2.15576 2.02067 2.38609C1.99998 2.60367 1.99999 2.86935 2 3.17738V3.1774V3.2V11.8V11.8226V11.8226C1.99999 12.1307 1.99998 12.3963 2.02067 12.6139C2.04257 12.8442 2.09113 13.0717 2.22104 13.2837C2.34473 13.4856 2.51442 13.6553 2.71625 13.779C2.92825 13.9089 3.15576 13.9574 3.38609 13.9793C3.60368 14 3.86937 14 4.17741 14H4.2H10.8H10.8226C11.1306 14 11.3963 14 11.6139 13.9793C11.8442 13.9574 12.0717 13.9089 12.2837 13.779C12.4856 13.6553 12.6553 13.4856 12.779 13.2837C12.9089 13.0717 12.9574 12.8442 12.9793 12.6139C13 12.3963 13 12.1306 13 11.8226V11.8V3.2V3.17741C13 2.86936 13 2.60368 12.9793 2.38609C12.9574 2.15576 12.9089 1.92825 12.779 1.71625C12.6553 1.51442 12.4856 1.34472 12.2837 1.22104C12.0717 1.09113 11.8442 1.04257 11.6139 1.02067C11.3963 0.999978 11.1306 0.999988 10.8226 1H10.8H4.2ZM3.23875 2.07368C3.26722 2.05623 3.32362 2.03112 3.48075 2.01618C3.64532 2.00053 3.86298 2 4.2 2H10.8C11.137 2 11.3547 2.00053 11.5193 2.01618C11.6764 2.03112 11.7328 2.05623 11.7613 2.07368C11.8285 2.11491 11.8851 2.17147 11.9263 2.23875C11.9438 2.26722 11.9689 2.32362 11.9838 2.48075C11.9995 2.64532 12 2.86298 12 3.2V11.8C12 12.137 11.9995 12.3547 11.9838 12.5193C11.9689 12.6764 11.9438 12.7328 11.9263 12.7613C11.8851 12.8285 11.8285 12.8851 11.7613 12.9263C11.7328 12.9438 11.6764 12.9689 11.5193 12.9838C11.3547 12.9995 11.137 13 10.8 13H4.2C3.86298 13 3.64532 12.9995 3.48075 12.9838C3.32362 12.9689 3.26722 12.9438 3.23875 12.9263C3.17147 12.8851 3.11491 12.8285 3.07368 12.7613C3.05624 12.7328 3.03112 12.6764 3.01618 12.5193C3.00053 12.3547 3 12.137 3 11.8V3.2C3 2.86298 3.00053 2.64532 3.01618 2.48075C3.03112 2.32362 3.05624 2.26722 3.07368 2.23875C3.11491 2.17147 3.17147 2.11491 3.23875 2.07368ZM5 10C4.72386 10 4.5 10.2239 4.5 10.5C4.5 10.7761 4.72386 11 5 11H8C8.27614 11 8.5 10.7761 8.5 10.5C8.5 10.2239 8.27614 10 8 10H5ZM4.5 7.5C4.5 7.22386 4.72386 7 5 7H10C10.2761 7 10.5 7.22386 10.5 7.5C10.5 7.77614 10.2761 8 10 8H5C4.72386 8 4.5 7.77614 4.5 7.5ZM5 4C4.72386 4 4.5 4.22386 4.5 4.5C4.5 4.77614 4.72386 5 5 5H10C10.2761 5 10.5 4.77614 10.5 4.5C10.5 4.22386 10.2761 4 10 4H5Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.5"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  )
)

ContentLabIcon.displayName = "ContentLabIcon"

// Custom Agent Lab Icon Component
const AgentLabIcon = forwardRef<SVGSVGElement, LucideProps>(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path
        d="M8.69667 0.0403541C8.90859 0.131038 9.03106 0.354857 8.99316 0.582235L8.0902 6.00001H12.5C12.6893 6.00001 12.8625 6.10701 12.9472 6.27641C13.0319 6.4458 13.0136 6.6485 12.8999 6.80001L6.89997 14.8C6.76167 14.9844 6.51521 15.0503 6.30328 14.9597C6.09135 14.869 5.96888 14.6452 6.00678 14.4178L6.90974 9H2.49999C2.31061 9 2.13748 8.893 2.05278 8.72361C1.96809 8.55422 1.98636 8.35151 2.09999 8.2L8.09997 0.200038C8.23828 0.0156255 8.48474 -0.0503301 8.69667 0.0403541ZM3.49999 8.00001H7.49997C7.64695 8.00001 7.78648 8.06467 7.88148 8.17682C7.97648 8.28896 8.01733 8.43723 7.99317 8.5822L7.33027 12.5596L11.5 7.00001H7.49997C7.353 7.00001 7.21347 6.93534 7.11846 6.8232C7.02346 6.71105 6.98261 6.56279 7.00678 6.41781L7.66968 2.44042L3.49999 8.00001Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.5"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  )
)

AgentLabIcon.displayName = "AgentLabIcon"

// Custom Astromech Agent Icon Component - Fixed to match Lucide icon type
const AstromechIcon = forwardRef<SVGSVGElement, LucideProps>(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className={className}
      fill="currentColor"
      {...props}
    >
      <path d="M256 0C185.3 0 128 57.3 128 128l0 16-40 0c-30.9 0-56 25.1-56 56l0 210.9-29.9 67.3c-3.3 7.4-2.6 16 1.8 22.8S15.9 512 24 512l112 0c13.3 0 24-10.7 24-24l0-72.9 22.1 24.8c4.6 5.1 11.1 8.1 17.9 8.1l112 0c6.9 0 13.4-2.9 17.9-8.1l22.1-24.8 0 72.9c0 13.3 10.7 24 24 24l112 0c8.1 0 15.7-4.1 20.1-10.9s5.1-15.4 1.8-22.8L480 410.9 480 200c0-30.9-25.1-56-56-56l-40 0 0-16C384 57.3 326.7 0 256 0zM192 96a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zm112 0a16 16 0 1 1 0 32 16 16 0 1 1 0-32zM88 192l24 0 0 272-51.1 0 17-38.3c1.4-3.1 2.1-6.4 2.1-9.7l0-216c0-4.4 3.6-8 8-8zm72 0l192 0 0 150.9-50.8 57.1-90.4 0-50.8-57.1 0-150.9zm240 0l24 0c4.4 0 8 3.6 8 8l0 216c0 3.4 .7 6.7 2.1 9.7l17 38.3-51.1 0 0-272zM208 224c-8.8 0-16 7.2-16 16s7.2 16 16 16l96 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-96 0zm0 64c-8.8 0-16 7.2-16 16s7.2 16 16 16l96 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-96 0z"/>
    </svg>
  )
)

AstromechIcon.displayName = "AstromechIcon"

// Custom Inbox Icon Component
const InboxIcon = forwardRef<SVGSVGElement, LucideProps>(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path
        d="M8.60124 1.25086C8.60124 1.75459 8.26278 2.17927 7.80087 2.30989C10.1459 2.4647 12 4.41582 12 6.79999V10.25C12 11.0563 12.0329 11.7074 12.7236 12.0528C12.931 12.1565 13.0399 12.3892 12.9866 12.6149C12.9333 12.8406 12.7319 13 12.5 13H8.16144C8.36904 13.1832 8.49997 13.4513 8.49997 13.75C8.49997 14.3023 8.05226 14.75 7.49997 14.75C6.94769 14.75 6.49997 14.3023 6.49997 13.75C6.49997 13.4513 6.63091 13.1832 6.83851 13H2.49999C2.2681 13 2.06664 12.8406 2.01336 12.6149C1.96009 12.3892 2.06897 12.1565 2.27638 12.0528C2.96708 11.7074 2.99999 11.0563 2.99999 10.25V6.79999C2.99999 4.41537 4.85481 2.46396 7.20042 2.3098C6.73867 2.17908 6.40036 1.75448 6.40036 1.25086C6.40036 0.643104 6.89304 0.150421 7.5008 0.150421C8.10855 0.150421 8.60124 0.643104 8.60124 1.25086ZM7.49999 3.29999C5.56699 3.29999 3.99999 4.86699 3.99999 6.79999V10.25L4.00002 10.3009C4.0005 10.7463 4.00121 11.4084 3.69929 12H11.3007C10.9988 11.4084 10.9995 10.7463 11 10.3009L11 10.25V6.79999C11 4.86699 9.43299 3.29999 7.49999 3.29999Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.5"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  )
)

InboxIcon.displayName = "InboxIcon"
=======
import {
  IconCamera,
  IconChartBar,
  IconDashboard,
  IconDatabase,
  IconFileAi,
  IconFileDescription,
  IconFileWord,
  IconFolder,
  IconHelp,
  IconInnerShadowTop,
  IconListDetails,
  IconReport,
  IconSearch,
  IconSettings,
  IconUsers,
  IconSparkles,
  IconRobot,
  IconBrandGoogle,
  IconTarget,
  IconBug,
  IconWorldWww,
  IconTrendingUp,
  IconUser,
  IconChecklist,
  IconPhone,
  IconMessage,
} from "@tabler/icons-react"
>>>>>>> Stashed changes

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { SearchCommand } from "@/components/search-command"
import { InboxPanel } from "@/components/inbox-panel"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useBrandProfile } from "@/components/brand-profile-context"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"

// Interface for company data
interface CompanyData {
  name: string
  website?: string
  logo?: string
}

// Utility function to get company initials
const getCompanyInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const data = {
  user: {
    name: "User",
    email: "user@example.com",
    avatar: "",
  },
  navMain: [
    {
<<<<<<< Updated upstream
      title: "Core",
=======
      title: "Overview",
      url: "/dashboard",
      icon: IconTrendingUp,
    },
    {
      title: "AI Visibility",
      url: "/ai-visibility",
      icon: IconTarget,
    },
    {
      title: "Report",
      url: "/report",
      icon: IconReport,
    },
    {
      title: "Insights",
      url: "/dashboard/insights",
      icon: IconChartBar,
    },
    {
      title: "Tasks",
      url: "/dashboard/tasks",
      icon: IconChecklist,
    },
    {
      title: "Brand Profile",
      url: "/dashboard/brand-profile",
      icon: IconUser,
    },
    {
      title: "Campaign Generator",
      url: "/dashboard/campaign-generator",
      icon: IconSparkles,
    },
  ],
  navClouds: [
    {
      title: "Capture",
      icon: IconCamera,
      isActive: true,
      url: "#",
>>>>>>> Stashed changes
      items: [
        {
          title: "Overview",
          url: "/dashboard",
          icon: OverviewIcon,
        },
        {
          title: "Tracked Prompts",
          url: "/dashboard/tracked-prompts",
          icon: TrackedPromptsIcon,
        },
        {
          title: "Issues",
          url: "/dashboard/issues",
          icon: IssuesIcon,
        },
      ]
    },
    {
      title: "Presence",
      items: [
        {
          title: "Content Lab",
          url: "/dashboard/campaigns",
          icon: ContentLabIcon,
        },
        {
          title: "Agent Lab",
          url: "/dashboard/agents-lab",
          icon: AgentLabIcon,
        },
        {
          title: "Technical Structure",
          url: "/dashboard/technical",
          icon: Code2,
        },
      ]
    },
    {
      title: "Knowledge Base",
      items: [
        {
          title: "Brand Profile",
          url: "/dashboard/brand-profile",
          icon: User,
        },
        {
          title: "Integrations",
          url: "/dashboard/integrations",
          icon: LinkIcon,
        },
      ]
    },
    
  ],
  navSecondary: [],
}

// Export custom icons for use in other components
export { OverviewIcon, TrackedPromptsIcon, IssuesIcon, ContentLabIcon, AgentLabIcon, InboxIcon }

export const AppSidebar = React.memo(function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [inboxOpen, setInboxOpen] = React.useState(false)
  const [isMounted, setIsMounted] = React.useState(false)

  // Get brand profile data
  const { profile } = useBrandProfile()

  // Get router and sidebar state
  const router = useRouter()
  const { isMobile } = useSidebar()

  // Handle sign out
  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    console.log('Signing out...')

    // Clear localStorage cache first to prevent data leakage between users
    try {
      localStorage.removeItem('mudra_brand_profile')
      console.log('Cleared mudra_brand_profile from localStorage')
    } catch (storageError) {
      console.warn('Failed to clear localStorage:', storageError)
    }

    try {
      // Get CSRF token first
      const csrfResponse = await fetch('/api/auth/csrf')
      const { csrfToken } = await csrfResponse.json()

      // Call signout with CSRF token
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `csrfToken=${csrfToken}`,
      })

      console.log('Sign out response:', response.status)

      // Redirect to login
      window.location.href = '/login'
    } catch (error) {
      console.error('Sign out error:', error)
      // Force redirect even if there's an error
      window.location.href = '/login'
    }
  }
  
  // Debug logging for profile loading
  React.useEffect(() => {
    if (isMounted) {
      console.log('🏢 [AppSidebar] Profile state:', { 
        id: profile?.id, 
        companyName: profile?.companyName,
        hasProfile: !!profile?.id 
      })
    }
  }, [profile, isMounted])
  
  // Prevent hydration mismatch by only using profile data after mount
  React.useEffect(() => {
    setIsMounted(true)
  }, [])
  
  // Use real company data from BrandProfile, but only after mounting
  // Shows "Loading..." while profile is being fetched
  const companyData: CompanyData = React.useMemo(() => ({
    name: isMounted 
      ? (profile?.companyName || (profile?.id ? "Unnamed Company" : "Loading..."))
      : "Your Company",
    website: isMounted && profile?.companyWebsite ? profile.companyWebsite : undefined,
    logo: isMounted && profile?.userAvatar ? profile.userAvatar : undefined
  }), [profile, isMounted])

  // Get company initials for avatar
  const companyInitials = React.useMemo(() => 
    getCompanyInitials(companyData.name), 
    [companyData.name]
  )

  return (
    <>
      <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} />
      <Sidebar
        side="left"
        variant="sidebar"
        collapsible="offcanvas"
        className="bg-sidebar-grey"
        {...props}
      >
        <SidebarHeader className="pb-0 bg-sidebar-grey h-[var(--header-height)] flex items-center">
          {/* Company Header */}
          <div className="px-2.5 w-full">
            <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className="inline-flex items-center gap-2.5 px-0 py-2 rounded-lg cursor-pointer group/company w-full outline-none ring-0 border-0 focus:outline-none focus:ring-0 focus:border-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:border-0 data-[state=open]:outline-none data-[state=open]:ring-0 data-[state=closed]:outline-none data-[state=closed]:ring-0"
                  aria-label={`Company menu for ${companyData.name}${companyData.website ? ` (${companyData.website})` : ''}`}
                  aria-expanded={isDropdownOpen}
                  aria-haspopup="menu"
                  type="button"
                >
                  <div className="inline-flex items-center gap-2.5 px-0 py-0 rounded-lg hover:bg-white/[0.03] flex-1 min-w-0">
                    <div className="w-7 h-7 bg-black rounded-full flex items-center justify-center flex-shrink-0 border border-white/[0.08]">
                      {companyData.logo ? (
                        <img
                          src={companyData.logo}
                          alt={`${companyData.name} logo`}
                          className="w-4 h-4 rounded object-cover"
                        />
                      ) : (
                        <span className="text-white/80 font-semibold text-[10px] transition-all duration-200 group-hover/company:text-white">
                          {companyInitials}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 text-left flex-1">
                      <p className="text-white/80 text-sm font-medium truncate transition-all duration-200 group-hover/company:text-white">
                        {companyData.name}
                      </p>
                    </div>
                  </div>
                  <svg
                    className={`w-3 h-3 text-white/30 flex-shrink-0 ${
                      isDropdownOpen ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg bg-dark-grey border-white/[0.08] backdrop-blur-sm [&[data-state=closed]]:!hidden"
                side={isMobile ? "bottom" : "right"}
                align="start"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2.5 px-3 py-2.5 text-left text-sm">
                    <div className="w-7 h-7 bg-black rounded-full flex items-center justify-center flex-shrink-0 border border-white/[0.08]">
                      {companyData.logo ? (
                        <img
                          src={companyData.logo}
                          alt={`${companyData.name} logo`}
                          className="w-4 h-4 rounded object-cover"
                        />
                      ) : (
                        <span className="text-white/80 font-semibold text-[10px]">
                          {companyInitials}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 text-left text-sm">
                      <span className="truncate font-medium text-white/90">{companyData.name}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="!bg-white/[0.08] my-2 mx-2" />
                <DropdownMenuGroup className="px-2 py-1 space-y-0.5">
                  <DropdownMenuItem
                    onClick={() => router.push('/dashboard/account')}
                    className="rounded-md text-white/80 hover:text-white hover:bg-white/[0.05] focus:bg-white/[0.05] focus:text-white cursor-pointer px-3 h-9 outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none border-0">
                    <IconUserCircle className="w-4 h-4" />
                    Account
                  </DropdownMenuItem>
                  {process.env.NODE_ENV !== 'production' && (
                    <DropdownMenuItem
                      onClick={() => router.push('/dashboard/billing')}
                      className="rounded-md text-white/80 hover:text-white hover:bg-white/[0.05] focus:bg-white/[0.05] focus:text-white cursor-pointer px-3 h-9 outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none border-0">
                      <IconCreditCard className="w-4 h-4" />
                      Billing
                    </DropdownMenuItem>
                  )}
                  {process.env.NODE_ENV !== 'production' && (
                    <DropdownMenuItem
                      onClick={() => router.push('/dashboard/notifications')}
                      className="rounded-md text-white/80 hover:text-white hover:bg-white/[0.05] focus:bg-white/[0.05] focus:text-white cursor-pointer px-3 h-9 outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none border-0">
                      <IconNotification className="w-4 h-4" />
                      Notifications
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="!bg-white/[0.08] my-2 mx-2" />
                <div className="px-2 py-1">
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    onSelect={(e) => e.preventDefault()}
                    className="rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-300 cursor-pointer outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none border-0">
                    <IconLogout className="w-4 h-4" />
                    Log out
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-0 bg-sidebar-grey pt-3">
          {/* Search Bar - Moved to top */}
          <div className="px-3 pb-1.5">
            <button
              onClick={() => setSearchOpen(true)}
              className="relative group w-full h-9 text-left transition-all rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12]"
            >
              <IconSearch strokeWidth={2.5} className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 group-hover:text-white/60 transition-colors" />
              <div className="w-full h-full pl-9 pr-3 text-sm flex items-center justify-between text-white/40 group-hover:text-white/60">
                <span>Search</span>
                <kbd className="pointer-events-none inline-flex h-4 select-none items-center rounded border border-white/[0.08] bg-white/[0.05] px-1.5 font-mono text-[9px] font-medium text-white/50">
                  ⌘K
                </kbd>
              </div>
            </button>
          </div>

          {/* Inbox Button */}
          <div className="px-2 pb-1">
            <SidebarMenu>
              <SidebarMenuItem>
                <InboxPanel open={inboxOpen} onOpenChange={setInboxOpen}>
                  <SidebarMenuButton
                    tooltip="Inbox"
                    className="h-8 px-3 text-sm font-medium relative transition-all duration-200 group rounded text-white hover:text-white hover:bg-white/10 cursor-pointer"
                  >
                    <InboxIcon strokeWidth={2.5} className="w-[25px] h-[25px] mr-1.25 transition-all duration-200 text-white/60 group-hover:text-white/80" />
                    <span className="transition-all duration-200 font-normal">
                      Inbox
                    </span>
                  </SidebarMenuButton>
                </InboxPanel>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>

          {/* Main Navigation */}
          <NavMain items={data.navMain} />

          <NavSecondary items={data.navSecondary} className="mt-auto" />
        </SidebarContent>
        <SidebarFooter className="bg-sidebar-grey pb-4">
          <div className="px-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-9 h-9 flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.05] rounded-md transition-colors outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0">
                  <IconQuestionMark strokeWidth={2} className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-52 rounded-lg bg-dark-grey border-white/[0.08] backdrop-blur-sm [&[data-state=closed]]:!hidden"
                side="top"
                align="start"
                sideOffset={8}
              >
                <DropdownMenuGroup className="px-2 py-2 space-y-0.5">
                  <DropdownMenuItem
                    onClick={() => window.open('https://cal.com/nano-mudra/quick-30-min', '_blank')}
                    className="rounded-md text-white/80 hover:text-white hover:bg-white/[0.05] focus:bg-white/[0.05] focus:text-white cursor-pointer px-3 h-10 outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none border-0 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <IconCalendar className="w-4 h-4 text-white/50" />
                      <span>Book a demo</span>
                    </div>
                    <IconExternalLink className="w-3.5 h-3.5 text-white/30" />
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => window.open('https://docs.trymudra.com/', '_blank')}
                    className="rounded-md text-white/80 hover:text-white hover:bg-white/[0.05] focus:bg-white/[0.05] focus:text-white cursor-pointer px-3 h-10 outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none border-0 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <IconFileText className="w-4 h-4 text-white/50" />
                      <span>Docs</span>
                    </div>
                    <IconExternalLink className="w-3.5 h-3.5 text-white/30" />
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SidebarFooter>
      </Sidebar>
    </>
  )
})