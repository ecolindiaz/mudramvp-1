# Droids Lab Frontend Architecture Documentation

**Branch**: `tembo/droids-lab-ui-docs`
**Generated**: November 16, 2024
**Platform**: Next.js 15+ Monorepo with Dual Frontend Applications

---

## 🎯 Overview

This document outlines the **Droids Lab Frontend Architecture** based on the comprehensive dual-application monorepo structure. The codebase demonstrates advanced React/Next.js patterns, modern UI frameworks, and sophisticated dashboard implementations that can serve as the foundation for the Droids Lab UI system.

---

## 🏗️ Monorepo Architecture

### **Dual Application Structure**

```
├── mudra-app/          # Production GEO Dashboard (Next.js 15)
│   ├── app/            # App Router with RSC
│   ├── components/     # 50+ React components
│   │   ├── ui/         # 27 shadcn/ui components
│   │   ├── dashboard/  # 8 dashboard-specific components
│   │   ├── onboarding/ # 7-step wizard components
│   │   └── analysis/   # Analysis display components
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Business logic & utilities
│   └── contexts/       # React Context providers
│
├── firegeo/           # SaaS Starter Kit (Next.js 15)
│   ├── app/           # App Router architecture
│   ├── components/    # Reusable SaaS components
│   │   ├── brand-monitor/  # Real-time analysis UI
│   │   ├── dashboard/      # Demo dashboard
│   │   └── ui/            # Base UI components
│   ├── lib/           # Utilities & integrations
│   └── hooks/         # Feature-specific hooks
│
└── llm/               # Python FAISS API
```

---

## 🎨 Design System Foundations

### **Technology Stack**
- **Framework**: Next.js 15 with App Router + Server Components
- **Styling**: Tailwind CSS with Container Queries (`@container`)
- **UI Library**: shadcn/ui (Radix UI + Tailwind)
- **Icons**: Lucide React (500+ icons)
- **Charts**: Recharts for data visualization
- **Animations**: Framer Motion for micro-interactions
- **Forms**: React Hook Form + Zod validation

### **Design Tokens**

#### Color Palette
```css
/* Core Colors */
--background: black (onboarding), dark-grey (dashboard)
--card: bg-dark-grey border-white/10
--text: text-white, text-white/60 (muted)
--accent: bg-white text-black (primary buttons)
--border: border-white/[0.08] (subtle borders)

/* Semantic Colors */
--success: green-500
--warning: yellow-500
--error: red-500
--info: blue-500
```

#### Typography Scale
```css
/* Headings */
--text-2xl: 1.5rem (Page titles)
--text-xl: 1.25rem (Section titles)
--text-lg: 1.125rem (Card titles)
--text-base: 1rem (Body text)
--text-sm: 0.875rem (Labels)
--text-xs: 0.75rem (Captions)

/* Fonts */
font-family: "Geist Sans", sans-serif
font-mono: "Geist Mono", monospace
```

#### Spacing System
```css
/* Container Spacing */
container mx-auto px-4 lg:px-6

/* Component Spacing */
gap-3 md:gap-4 (small gaps)
gap-5 md:gap-6 (large gaps)
p-4 md:p-6 (card padding)

/* Layout Spacing */
space-y-4 (vertical stack)
space-x-4 (horizontal stack)
```

---

## 🧩 Component Architecture

### **1. UI Component Hierarchy**

```
Base Layer (shadcn/ui):
├── button.tsx        # Primary interaction element
├── card.tsx          # Content container
├── dialog.tsx        # Modal overlays
├── input.tsx         # Form inputs
├── tabs.tsx          # Navigation tabs
├── badge.tsx         # Status indicators
├── chart.tsx         # Data visualization wrapper
├── sidebar.tsx       # Navigation sidebar (726 lines)
└── ... 20+ more base components

Feature Layer:
├── dashboard-stat-card.tsx    # Metric display with sparklines
├── analysis-results.tsx       # GEO + Technical scores
├── brand-monitor.tsx          # Real-time analysis orchestrator
├── natural-language-report.tsx # AI-generated insights
└── onboarding-stepper.tsx     # Multi-step wizard

Layout Layer:
├── app-sidebar.tsx    # Main navigation
├── site-header.tsx    # Page header
├── nav-main.tsx       # Primary navigation
└── floating-mudra-button.tsx # AI assistant trigger
```

### **2. Component Patterns**

#### Server vs Client Components
```typescript
// Server Component (default)
export function MetricsOverview({ data }: Props) {
  return <div>Server-rendered content</div>
}

// Client Component (interactive)
"use client"
export function InteractiveChart({ data }: Props) {
  const [selected, setSelected] = useState(null)
  return <div>Interactive content</div>
}
```

#### Props Interface Pattern
```typescript
interface ComponentNameProps {
  // Required props
  data: AnalysisResult
  onAction: (id: string) => Promise<void>

  // Optional props with defaults
  showAll?: boolean
  className?: string

  // Event handlers
  onSelect?: (item: Item) => void
  onError?: (error: Error) => void
}
```

#### Component Structure Template
```typescript
"use client" // Only for interactive components

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ComponentProps } from '@/types'

interface ComponentNameProps extends ComponentProps {
  data: DataType
  onAction: (id: string) => Promise<void>
}

export function ComponentName({
  data,
  onAction,
  className,
  ...props
}: ComponentNameProps) {
  // State management
  const [loading, setLoading] = useState(false)

  // Event handlers
  const handleClick = useCallback(async (id: string) => {
    setLoading(true)
    try {
      await onAction(id)
    } catch (error) {
      console.error('Action failed:', error)
    } finally {
      setLoading(false)
    }
  }, [onAction])

  return (
    <div className={cn("base-styles", className)} {...props}>
      {/* Component content */}
      <Button onClick={() => handleClick(data.id)} disabled={loading}>
        {loading ? 'Processing...' : 'Action'}
      </Button>
    </div>
  )
}
```

---

## 📊 Dashboard Implementation Patterns

### **1. Overview Dashboard Architecture**

**File**: `mudra-app/app/dashboard/page.tsx`

```typescript
// Layout Structure
<BrandProfileProvider>
  <AppSidebar />
  <SiteHeader />
  <SidebarInset>
    <OverviewMetrics />        // 4-card metric grid
    <NaturalLanguageReport />  // AI insights
    <GenerateReportButton />   // Action trigger
    <GeoMetricsCard />        // AI visibility
    <TrafficMetricsCard />    // Website analytics
    <TechStructureCard />     // Technical health
    <ReportCard />            // Full analysis
  </SidebarInset>
</BrandProfileProvider>
```

#### Dashboard Stat Card Pattern
**File**: `mudra-app/components/dashboard/dashboard-stat-card.tsx`

```typescript
interface DashboardStatCardProps {
  title: string           // "AI Visibility Score"
  value: number          // 72.5
  delta: number          // 15.2 (percentage change)
  lastValue: number      // Previous period value
  positive: boolean      // Delta direction
  prefix?: string        // "$", "%"
  suffix?: string        // "pts", "visitors"
  sparkline?: number[]   // Mini chart data
  accentColor?: string   // Theme color
  info?: string         // Tooltip description
}

// Features:
// - Animated delta badges with trend arrows
// - SVG sparkline charts (hover to reveal)
// - Tooltip info popovers
// - Dropdown action menus
// - Responsive typography scaling
```

### **2. Real-time Analysis Dashboard**

**File**: `firegeo/components/brand-monitor/brand-monitor.tsx` (674 lines)

```typescript
// State Management with useReducer
const [state, dispatch] = useReducer(brandMonitorReducer, {
  url: '',
  urlValid: null,
  loading: false,
  analyzing: false,
  company: null,
  identifiedCompetitors: [],
  analysis: null,
  activeResultsTab: 'visibility',
  analysisProgress: {
    stage: 'idle',
    completedPrompts: 0,
    totalPrompts: 0,
    completedProviders: {},
    error: null
  }
})

// SSE Integration for Real-time Updates
const { connectionStatus } = useSSEHandler({
  url: `/api/brand-monitor/analyze`,
  onMessage: (data) => {
    dispatch({ type: 'UPDATE_ANALYSIS_PROGRESS', payload: data })
  },
  onComplete: (result) => {
    dispatch({ type: 'ANALYSIS_COMPLETE', payload: result })
  },
  enabled: state.analyzing
})

// UI Features:
// - URL validation with real-time feedback
// - Company card with logo/favicon display
// - Progress tracking with stage indicators
// - Tabbed results navigation (4 views)
// - Competitor management interface
// - Provider status indicators (ChatGPT, Claude, etc.)
```

---

## 🔄 State Management Patterns

### **1. Context Providers**

#### Brand Profile Context
```typescript
// File: mudra-app/components/brand-profile-context.tsx
interface BrandProfileContextType {
  profile: BrandProfile | null
  loading: boolean
  error: string | null
  updateProfile: (data: Partial<BrandProfile>) => Promise<void>
  refreshProfile: () => Promise<void>
}

const BrandProfileContext = createContext<BrandProfileContextType | undefined>(undefined)

export function useBrandProfile() {
  const context = useContext(BrandProfileContext)
  if (!context) {
    throw new Error('useBrandProfile must be used within BrandProfileProvider')
  }
  return context
}
```

#### Onboarding Context
```typescript
// Multi-step wizard state management
interface OnboardingState {
  currentStep: number
  totalSteps: number
  stepData: Record<string, any>
  isValid: Record<number, boolean>
  errors: Record<string, string>
}

// Actions for step navigation and data updates
type OnboardingAction =
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SET_STEP_DATA'; step: number; data: any }
  | { type: 'SET_STEP_VALID'; step: number; valid: boolean }
```

### **2. Custom Hooks Patterns**

#### Data Fetching Hook
```typescript
// File: mudra-app/hooks/use-analysis-results.ts
export function useAnalysisResults(brandProfileId: number) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/analysis/latest?brandProfileId=${brandProfileId}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        setError(result.error.message)
      }
    } catch (err) {
      setError('Failed to fetch analysis results')
    } finally {
      setLoading(false)
    }
  }, [brandProfileId])

  useEffect(() => {
    if (brandProfileId) {
      fetchData()
    }
  }, [brandProfileId, fetchData])

  // Listen for real-time updates
  useEffect(() => {
    const handleUpdate = () => fetchData()
    window.addEventListener('mudra:website-analyzed', handleUpdate)
    return () => window.removeEventListener('mudra:website-analyzed', handleUpdate)
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
```

#### SSE Hook for Real-time Updates
```typescript
// File: firegeo/components/brand-monitor/hooks/use-sse-handler.ts
interface UseSSEHandlerProps {
  url: string
  onMessage: (data: any) => void
  onComplete: (result: any) => void
  onError?: (error: string) => void
  enabled: boolean
}

export function useSSEHandler({
  url,
  onMessage,
  onComplete,
  onError,
  enabled
}: UseSSEHandlerProps) {
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')

  useEffect(() => {
    if (!enabled) return

    const eventSource = new EventSource(url)
    setConnectionStatus('connecting')

    eventSource.onopen = () => {
      setConnectionStatus('connected')
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === 'complete') {
          onComplete(data.result)
          eventSource.close()
        } else {
          onMessage(data)
        }
      } catch (err) {
        console.error('SSE message parsing error:', err)
      }
    }

    eventSource.onerror = () => {
      setConnectionStatus('error')
      onError?.('Connection lost')
      eventSource.close()
    }

    return () => {
      eventSource.close()
      setConnectionStatus('idle')
    }
  }, [url, enabled, onMessage, onComplete, onError])

  return { connectionStatus }
}
```

---

## 🎯 Form Patterns & Validation

### **1. React Hook Form Integration**

```typescript
// Onboarding form pattern
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const companySchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  website: z.string().url('Please enter a valid URL'),
  industry: z.string().min(1, 'Please select an industry'),
  description: z.string().min(10, 'Description must be at least 10 characters')
})

type CompanyFormData = z.infer<typeof companySchema>

export function CompanyForm() {
  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      companyName: '',
      website: '',
      industry: '',
      description: ''
    }
  })

  const onSubmit = async (data: CompanyFormData) => {
    try {
      await updateBrandProfile(data)
      // Navigate to next step
    } catch (error) {
      form.setError('root', { message: 'Failed to save company information' })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="companyName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Name</FormLabel>
              <FormControl>
                <Input placeholder="Acme Corp" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Additional fields... */}

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Saving...' : 'Continue'}
        </Button>
      </form>
    </Form>
  )
}
```

### **2. Dynamic Form Elements**

#### Tag Input Pattern
```typescript
// Multi-select tag input for competitors, keywords
export function TagInput({ value, onChange, placeholder }: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [tags, setTags] = useState<string[]>(value || [])

  const addTag = (tag: string) => {
    if (tag.trim() && !tags.includes(tag.trim())) {
      const newTags = [...tags, tag.trim()]
      setTags(newTags)
      onChange(newTags)
      setInputValue('')
    }
  }

  const removeTag = (index: number) => {
    const newTags = tags.filter((_, i) => i !== index)
    setTags(newTags)
    onChange(newTags)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      removeTag(tags.length - 1)
    }
  }

  return (
    <div className="border rounded-md p-2 min-h-[40px] flex flex-wrap gap-1">
      {tags.map((tag, index) => (
        <Badge key={index} variant="secondary" className="flex items-center gap-1">
          {tag}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeTag(index)}
            className="h-auto p-0 hover:bg-transparent"
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}

      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 border-none shadow-none focus-visible:ring-0 min-w-[120px]"
      />
    </div>
  )
}
```

---

## 📱 Responsive Design System

### **1. Breakpoint Strategy**

```css
/* Tailwind Breakpoints */
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet portrait */
lg: 1024px  /* Tablet landscape */
xl: 1280px  /* Desktop */
2xl: 1536px /* Large desktop */

/* Container Queries (advanced) */
@container (min-width: 320px) /* @container/sm */
@container (min-width: 768px) /* @container/md */
@container (min-width: 1024px) /* @container/lg */
```

### **2. Grid System Patterns**

```typescript
// Responsive metric cards
<div className="grid grid-cols-1 gap-4 md:gap-5 @xl/main:grid-cols-2 @4xl/main:grid-cols-4">
  <MetricCard />
  <MetricCard />
  <MetricCard />
  <MetricCard />
</div>

// Campaign cards with responsive columns
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {campaigns.map(campaign => (
    <CampaignCard key={campaign.id} campaign={campaign} />
  ))}
</div>

// Sidebar responsive behavior
<div className="flex">
  <AppSidebar className="hidden lg:block w-64" />
  <main className="flex-1 lg:ml-64">
    <Content />
  </main>
</div>
```

### **3. Mobile-First Patterns**

```typescript
// Mobile navigation
export function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <div className="lg:hidden">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="md:hidden"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64">
          <nav className="flex flex-col space-y-2">
            {navItems.map(item => (
              <NavLink key={item.href} {...item} />
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// Responsive typography
<h1 className="text-xl md:text-2xl lg:text-3xl font-bold">
  Dashboard Title
</h1>

// Responsive spacing
<div className="p-4 md:p-6 lg:p-8">
  <div className="space-y-4 md:space-y-6 lg:space-y-8">
    {/* Content */}
  </div>
</div>
```

---

## 🎨 Animation & Interaction Patterns

### **1. Micro-interactions**

```typescript
// Hover effects with Tailwind
<Card className="transition-all duration-200 hover:shadow-md hover:scale-[1.02]">
  <CardContent />
</Card>

// Loading states with CSS animations
<Button disabled={loading}>
  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {loading ? 'Processing...' : 'Submit'}
</Button>

// Progress indicators
<div className="w-full bg-gray-200 rounded-full h-2">
  <div
    className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
    style={{ width: `${progress}%` }}
  />
</div>
```

### **2. Framer Motion Integration**

```typescript
import { motion, AnimatePresence } from 'framer-motion'

// Page transitions
<AnimatePresence mode="wait">
  <motion.div
    key={pathname}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.2 }}
  >
    {children}
  </motion.div>
</AnimatePresence>

// Stagger animations for lists
<motion.div
  initial="hidden"
  animate="visible"
  variants={{
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }}
>
  {items.map((item, index) => (
    <motion.div
      key={item.id}
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 }
      }}
    >
      <ItemCard item={item} />
    </motion.div>
  ))}
</motion.div>
```

---

## 🔄 Data Visualization Patterns

### **1. Chart Components with Recharts**

```typescript
// Sparkline component for metric cards
export function Sparkline({ data, color = '#3B82F6' }: SparklineProps) {
  return (
    <div className="w-full h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            animationDuration={300}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// Comprehensive dashboard chart
export function VisibilityTrendChart({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Visibility Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="visibilityScore"
              stroke="#8884d8"
              name="Visibility Score"
            />
            <Line
              type="monotone"
              dataKey="competitorAvg"
              stroke="#82ca9d"
              name="Competitor Average"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
```

### **2. Real-time Chart Updates**

```typescript
// Chart with live data updates
export function LiveMetricsChart() {
  const [data, setData] = useState([])

  useEffect(() => {
    const interval = setInterval(async () => {
      const newData = await fetchLatestMetrics()
      setData(current => [...current.slice(-20), newData]) // Keep last 20 points
    }, 30000) // Update every 30 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <ResponsiveContainer width="100%" height={400}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <XAxis dataKey="timestamp" />
        <YAxis />
        <CartesianGrid strokeDasharray="3 3" />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="score"
          stroke="#8884d8"
          fillOpacity={1}
          fill="url(#colorScore)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
```

---

## 🚀 Performance Optimization Patterns

### **1. Code Splitting & Lazy Loading**

```typescript
// Dynamic imports for heavy components
import dynamic from 'next/dynamic'

const HeavyChart = dynamic(
  () => import('@/components/charts/heavy-chart'),
  {
    loading: () => <ChartSkeleton />,
    ssr: false // Client-side only if needed
  }
)

// Route-based code splitting (automatic with App Router)
// Each page.tsx creates its own bundle

// Component-based lazy loading
const LazyModal = lazy(() => import('@/components/modals/heavy-modal'))

export function App() {
  return (
    <Suspense fallback={<ModalSkeleton />}>
      <LazyModal />
    </Suspense>
  )
}
```

### **2. Optimistic Updates**

```typescript
// Optimistic task updates
export function useOptimisticTasks() {
  const [tasks, setTasks] = useState([])
  const [optimisticTasks, setOptimisticTasks] = useOptimistic(
    tasks,
    (state, action) => {
      switch (action.type) {
        case 'UPDATE_STATUS':
          return state.map(task =>
            task.id === action.id
              ? { ...task, status: action.status, _optimistic: true }
              : task
          )
        default:
          return state
      }
    }
  )

  const updateTaskStatus = async (id: string, status: string) => {
    // Optimistic update
    setOptimisticTasks({ type: 'UPDATE_STATUS', id, status })

    try {
      // API call
      await updateTask(id, { status })
      // Refresh data
      await refetchTasks()
    } catch (error) {
      // Revert on error
      console.error('Failed to update task:', error)
      toast.error('Failed to update task status')
    }
  }

  return { tasks: optimisticTasks, updateTaskStatus }
}
```

### **3. Virtualization for Large Lists**

```typescript
import { FixedSizeList as List } from 'react-window'

// Virtual scrolling for large prompt lists
export function VirtualizedPromptList({ prompts }: Props) {
  const Row = ({ index, style }) => (
    <div style={style}>
      <PromptCard prompt={prompts[index]} />
    </div>
  )

  return (
    <List
      height={600}
      itemCount={prompts.length}
      itemSize={120}
      overscanCount={5}
    >
      {Row}
    </List>
  )
}
```

---

## 🔒 Security & Accessibility Patterns

### **1. Accessibility Best Practices**

```typescript
// Semantic HTML with ARIA labels
<Button
  aria-label="Delete prompt"
  aria-describedby="delete-tooltip"
  onClick={handleDelete}
>
  <Trash className="h-4 w-4" />
</Button>

// Keyboard navigation support
const handleKeyDown = (e: KeyboardEvent) => {
  switch (e.key) {
    case 'Enter':
    case ' ':
      e.preventDefault()
      onSelect()
      break
    case 'Escape':
      onClose()
      break
  }
}

// Focus management
const [focusedIndex, setFocusedIndex] = useState(0)

useEffect(() => {
  const handleKeyNav = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      setFocusedIndex(i => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      setFocusedIndex(i => Math.max(i - 1, 0))
    }
  }

  document.addEventListener('keydown', handleKeyNav)
  return () => document.removeEventListener('keydown', handleKeyNav)
}, [items.length])
```

### **2. Input Sanitization**

```typescript
// URL validation and sanitization
export function sanitizeUrl(url: string): string {
  try {
    // Remove protocol if present, then add https://
    const cleanUrl = url.replace(/^https?:\/\//, '')
    const parsed = new URL(`https://${cleanUrl}`)

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol')
    }

    return parsed.toString()
  } catch {
    throw new Error('Invalid URL format')
  }
}

// XSS prevention in user content
import DOMPurify from 'isomorphic-dompurify'

export function sanitizeHtml(content: string): string {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href']
  })
}
```

---

## 📚 Testing Patterns

### **1. Component Testing**

```typescript
// Test utilities setup
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrandProfileProvider } from '@/components/brand-profile-context'

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrandProfileProvider>
      {component}
    </BrandProfileProvider>
  )
}

// Component test example
describe('DashboardStatCard', () => {
  const mockProps = {
    title: 'AI Visibility',
    value: 72.5,
    delta: 15.2,
    lastValue: 57.3,
    positive: true,
    suffix: '%'
  }

  it('displays the correct value and delta', () => {
    renderWithProviders(<DashboardStatCard {...mockProps} />)

    expect(screen.getByText('72.5%')).toBeInTheDocument()
    expect(screen.getByText('+15.2%')).toBeInTheDocument()
  })

  it('shows positive trend indicator', () => {
    renderWithProviders(<DashboardStatCard {...mockProps} />)

    const deltaElement = screen.getByText('+15.2%')
    expect(deltaElement).toHaveClass('text-green-600')
  })

  it('handles click interactions', async () => {
    const onAction = jest.fn()
    renderWithProviders(
      <DashboardStatCard {...mockProps} onAction={onAction} />
    )

    fireEvent.click(screen.getByRole('button', { name: /more options/i }))
    await waitFor(() => {
      expect(onAction).toHaveBeenCalled()
    })
  })
})
```

### **2. Integration Testing**

```typescript
// API integration test
describe('Analysis API Integration', () => {
  it('fetches and displays analysis results', async () => {
    // Mock API response
    const mockAnalysis = {
      visibilityScore: 75,
      technicalScore: 88,
      lastUpdated: '2024-11-16T10:00:00Z'
    }

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockAnalysis })
    } as Response)

    renderWithProviders(<AnalysisResults brandProfileId={1} />)

    await waitFor(() => {
      expect(screen.getByText('75')).toBeInTheDocument() // Visibility score
      expect(screen.getByText('88')).toBeInTheDocument() // Technical score
    })

    expect(fetch).toHaveBeenCalledWith('/api/analysis/latest?brandProfileId=1')
  })
})
```

---

## 🎯 Developer Experience Patterns

### **1. TypeScript Configuration**

```typescript
// Strict type checking setup
interface StrictComponentProps {
  // Required properties
  id: string
  title: string
  data: AnalysisData

  // Optional with defaults
  showDetails?: boolean
  className?: string

  // Event handlers with specific signatures
  onUpdate: (id: string, data: Partial<AnalysisData>) => Promise<void>
  onDelete?: (id: string) => Promise<boolean>

  // Children patterns
  children?: React.ReactNode

  // Render props
  renderHeader?: (data: AnalysisData) => React.ReactNode
}

// Type utility helpers
type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>

// API response typing
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    message: string
    code?: string
    field?: string
  }
}
```

### **2. Development Utilities**

```typescript
// Debug helpers
const DEBUG = process.env.NODE_ENV === 'development'

export const debug = {
  log: (...args: any[]) => DEBUG && console.log('[DEBUG]', ...args),
  error: (...args: any[]) => DEBUG && console.error('[ERROR]', ...args),
  time: (label: string) => DEBUG && console.time(label),
  timeEnd: (label: string) => DEBUG && console.timeEnd(label)
}

// Performance monitoring
export function withPerformanceMonitoring<T extends any[], R>(
  fn: (...args: T) => R,
  name: string
) {
  return (...args: T): R => {
    debug.time(name)
    const result = fn(...args)
    debug.timeEnd(name)
    return result
  }
}

// Error boundary with logging
export class ErrorBoundary extends Component<PropsWithChildren, { hasError: boolean }> {
  constructor(props: PropsWithChildren) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    debug.error('Component error:', error, errorInfo)

    // Send to error reporting service in production
    if (!DEBUG) {
      reportError(error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />
    }

    return this.props.children
  }
}
```

---

## 🔮 Future Enhancements

### **1. Advanced Features Roadmap**

1. **Real-time Collaboration**
   - WebSocket integration for multi-user editing
   - Cursor tracking and presence indicators
   - Conflict resolution for simultaneous edits

2. **Advanced Analytics**
   - Machine learning insights
   - Predictive trend analysis
   - Automated anomaly detection

3. **Accessibility Improvements**
   - Screen reader optimization
   - High contrast mode
   - Voice navigation support

4. **Performance Optimizations**
   - Service Worker implementation
   - Advanced caching strategies
   - Bundle size optimization

### **2. Design System Evolution**

1. **Theme System**
   - Multiple color themes
   - User preference persistence
   - Brand customization options

2. **Component Library**
   - Storybook documentation
   - Design token automation
   - Component variants expansion

3. **Motion Design**
   - Advanced animations
   - Gesture recognition
   - Haptic feedback support

---

## 📖 Related Documentation

- **Architecture Overview**: `/docs/architecture/SYSTEM_ARCHITECTURE.md`
- **Component Library**: `/docs/guides/dashboard-frontend.md`
- **API Integration**: `/docs/implementation/UNIFIED_ANALYSIS_IMPLEMENTATION.md`
- **Development Setup**: `/docs/mudra-app/SETUP.md`
- **Deployment Guide**: `/docs/deployment/DOCKER_COMPLETE_GUIDE.md`

---

**Document Status**: ✅ Complete
**Last Updated**: November 16, 2024
**Maintainer**: Droids Lab Development Team
**Version**: 1.0.0

---

*This document serves as the comprehensive frontend architecture guide for the Droids Lab UI system, based on the production-ready patterns found in the mudra-app and firegeo applications.*