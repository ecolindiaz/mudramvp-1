# Droids Lab UI Components Guide

**Branch**: `tembo/droids-lab-ui-docs`
**Generated**: November 16, 2024
**Framework**: Next.js 15 + shadcn/ui + Tailwind CSS

---

## 🎯 Component Library Overview

This guide documents the comprehensive UI component library found in the Droids Lab codebase, consisting of **77+ production-ready components** across two applications. These components demonstrate advanced patterns for building modern SaaS dashboards and user interfaces.

---

## 🏗️ Component Architecture

### **Component Hierarchy**

```
Foundation Layer (shadcn/ui):
├── button.tsx           # Primary interaction element
├── card.tsx            # Content containers
├── input.tsx           # Form inputs
├── dialog.tsx          # Modal overlays
├── tabs.tsx            # Navigation tabs
├── badge.tsx           # Status indicators
├── select.tsx          # Dropdown selectors
├── tooltip.tsx         # Contextual help
└── ... 19+ more base components

Feature Layer:
├── dashboard-stat-card.tsx     # Advanced metric display
├── brand-monitor.tsx           # Real-time analysis UI
├── analysis-results.tsx        # Score visualization
├── natural-language-report.tsx # AI-generated insights
├── onboarding-stepper.tsx      # Multi-step wizard
├── floating-mudra-button.tsx   # AI assistant trigger
└── ... 40+ specialized components

Layout Layer:
├── app-sidebar.tsx             # Main navigation
├── site-header.tsx             # Page headers
├── nav-main.tsx               # Navigation menus
└── search-command.tsx         # Global search
```

---

## 🎨 Base UI Components (shadcn/ui)

### **1. Button Component**

**Location**: `components/ui/button.tsx`

```typescript
interface ButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  asChild?: boolean
}

// Usage Examples:
<Button variant="default">Primary Action</Button>
<Button variant="outline" size="sm">Secondary</Button>
<Button variant="ghost" size="icon">
  <Search className="h-4 w-4" />
</Button>
```

**Visual Variants**:
- `default`: White background, black text (primary)
- `destructive`: Red background (danger actions)
- `outline`: Transparent with border
- `secondary`: Muted background
- `ghost`: No background, hover effect
- `link`: Text-only appearance

### **2. Card Component System**

**Location**: `components/ui/card.tsx`

```typescript
// Component Structure
<Card className="overflow-hidden">
  <CardHeader>
    <CardTitle>Dashboard Metrics</CardTitle>
    <CardDescription>Last 30 days performance</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      {/* Card content */}
    </div>
  </CardContent>
  <CardFooter>
    <Button variant="outline">View Details</Button>
  </CardFooter>
</Card>

// Advanced Usage with Custom Styling
<Card className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 border-blue-500/20">
  <CardContent className="pt-6">
    <div className="flex items-center space-x-2">
      <Activity className="h-4 w-4 text-blue-500" />
      <span className="text-sm font-medium">Live Metrics</span>
    </div>
  </CardContent>
</Card>
```

### **3. Form Components**

**Input Component**: `components/ui/input.tsx`
```typescript
// Basic input
<Input
  type="email"
  placeholder="Enter your email"
  className="max-w-sm"
/>

// Input with icon
<div className="relative">
  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
  <Input placeholder="Search..." className="pl-10" />
</div>
```

**Select Component**: `components/ui/select.tsx`
```typescript
<Select defaultValue="option1">
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="Select an option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
    <SelectItem value="option3">Option 3</SelectItem>
  </SelectContent>
</Select>
```

### **4. Navigation Components**

**Tabs Component**: `components/ui/tabs.tsx`
```typescript
<Tabs defaultValue="overview" className="w-full">
  <TabsList className="grid w-full grid-cols-4">
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="analytics">Analytics</TabsTrigger>
    <TabsTrigger value="reports">Reports</TabsTrigger>
    <TabsTrigger value="settings">Settings</TabsTrigger>
  </TabsList>

  <TabsContent value="overview" className="space-y-4">
    <OverviewContent />
  </TabsContent>

  <TabsContent value="analytics" className="space-y-4">
    <AnalyticsContent />
  </TabsContent>
</Tabs>
```

**Command Component**: `components/ui/command.tsx`
```typescript
// Advanced search/command palette
<Command>
  <CommandInput placeholder="Type a command or search..." />
  <CommandList>
    <CommandEmpty>No results found.</CommandEmpty>
    <CommandGroup heading="Suggestions">
      <CommandItem onSelect={() => navigate('/dashboard')}>
        <Home className="mr-2 h-4 w-4" />
        Dashboard
      </CommandItem>
      <CommandItem onSelect={() => navigate('/analytics')}>
        <BarChart className="mr-2 h-4 w-4" />
        Analytics
      </CommandItem>
    </CommandGroup>
  </CommandList>
</Command>
```

---

## 📊 Advanced Dashboard Components

### **1. Dashboard Stat Card**

**Location**: `mudra-app/components/dashboard/dashboard-stat-card.tsx`

```typescript
interface DashboardStatCardProps {
  title: string
  value: number
  delta: number
  lastValue: number
  positive: boolean
  prefix?: string
  suffix?: string
  sparkline?: number[]
  accentColor?: string
  info?: string
}

// Advanced Features:
// - Animated sparkline charts (SVG-based)
// - Delta badges with trend indicators
// - Tooltip info popovers
// - Dropdown action menus
// - Responsive typography scaling
// - Custom accent color theming

<DashboardStatCard
  title="AI Visibility Score"
  value={72.5}
  delta={15.2}
  lastValue={57.3}
  positive={true}
  suffix="%"
  sparkline={[45, 52, 48, 61, 67, 72.5]}
  accentColor="blue"
  info="Percentage of AI queries mentioning your brand"
/>
```

**Visual Design**:
```css
/* Card styling */
.stat-card {
  @apply bg-dark-grey border-white/10 rounded-lg p-6;
  @apply transition-all duration-200 hover:shadow-md;
}

/* Sparkline container */
.sparkline {
  @apply w-full h-8 opacity-0 group-hover:opacity-100;
  @apply transition-opacity duration-200;
}

/* Delta badge */
.delta-positive {
  @apply bg-green-500/10 text-green-500 px-2 py-1 rounded-md text-xs font-medium;
}

.delta-negative {
  @apply bg-red-500/10 text-red-500 px-2 py-1 rounded-md text-xs font-medium;
}
```

### **2. Analysis Results Component**

**Location**: `mudra-app/components/analysis-results.tsx`

```typescript
interface AnalysisResultsProps {
  geoScore: number
  technicalScore: number
  lastUpdated: string
  loading?: boolean
  onRefresh: () => Promise<void>
}

// Features:
// - Real-time score visualization
// - Progress ring animations
// - Historical comparison
// - Refresh capability
// - Loading states

export function AnalysisResults({ geoScore, technicalScore, lastUpdated, onRefresh }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Analysis Results</CardTitle>
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* GEO Score */}
        <div className="flex items-center space-x-4">
          <div className="relative">
            <CircularProgress value={geoScore} size={60} />
            <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
              {geoScore}
            </span>
          </div>
          <div>
            <h3 className="font-medium">AI Visibility</h3>
            <p className="text-sm text-muted-foreground">
              How often AI mentions your brand
            </p>
          </div>
        </div>

        {/* Technical Score */}
        <div className="flex items-center space-x-4">
          <div className="relative">
            <CircularProgress value={technicalScore} size={60} color="green" />
            <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
              {technicalScore}
            </span>
          </div>
          <div>
            <h3 className="font-medium">Technical Health</h3>
            <p className="text-sm text-muted-foreground">
              Website optimization score
            </p>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Last updated: {formatDistanceToNow(new Date(lastUpdated))} ago
        </div>
      </CardContent>
    </Card>
  )
}
```

### **3. Natural Language Report Component**

**Location**: `mudra-app/components/dashboard/natural-language-report.tsx`

```typescript
// AI-generated insights display with markdown support
export function NaturalLanguageReport({ brandProfileId }: Props) {
  const [report, setReport] = useState<NLRReport | null>(null)
  const [loading, setLoading] = useState(false)

  const generateReport = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/nlr/generate?brandProfileId=${brandProfileId}`)
      const result = await response.json()

      if (result.success) {
        setReport(result.data)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>AI Analysis Summary</CardTitle>
            <CardDescription>
              Human-readable insights from your latest analysis
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={generateReport}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate Report
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {report ? (
          <div className="prose prose-invert max-w-none">
            <ReactMarkdown>{report.content}</ReactMarkdown>
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Generate an AI summary of your latest analysis results
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

---

## 🔄 Real-time Components

### **1. Brand Monitor Component**

**Location**: `firegeo/components/brand-monitor/brand-monitor.tsx` (674 lines)

```typescript
// Complex real-time analysis orchestrator
interface BrandMonitorState {
  url: string
  urlValid: boolean | null
  loading: boolean
  analyzing: boolean
  company: Company | null
  identifiedCompetitors: IdentifiedCompetitor[]
  analysis: AnalysisData | null
  activeResultsTab: 'visibility' | 'matrix' | 'rankings' | 'prompts'
  analysisProgress: {
    stage: 'idle' | 'initializing' | 'analyzing' | 'complete' | 'error'
    completedPrompts: number
    totalPrompts: number
    completedProviders: Record<string, boolean>
    error: string | null
  }
}

// Key Features:
// - URL validation and company scraping
// - Real-time analysis progress tracking
// - Server-Sent Events (SSE) integration
// - Multi-provider AI testing (OpenAI, Anthropic, Google)
// - Competitor identification and management
// - Tabbed results visualization

export function BrandMonitor() {
  const [state, dispatch] = useReducer(brandMonitorReducer, initialState)

  // SSE connection for real-time updates
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

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8">
        {/* URL Input Section */}
        <URLInputSection
          url={state.url}
          urlValid={state.urlValid}
          loading={state.loading}
          onUrlChange={(url) => dispatch({ type: 'SET_URL', payload: url })}
          onScrape={handleScrape}
        />

        {/* Company Card */}
        {state.company && (
          <CompanyCard
            company={state.company}
            competitors={state.identifiedCompetitors}
            onAddCompetitor={handleAddCompetitor}
            onRemoveCompetitor={handleRemoveCompetitor}
          />
        )}

        {/* Analysis Progress */}
        {state.analyzing && (
          <AnalysisProgressSection
            progress={state.analysisProgress}
            connectionStatus={connectionStatus}
          />
        )}

        {/* Results */}
        {state.analysis && (
          <ResultsNavigation
            analysis={state.analysis}
            activeTab={state.activeResultsTab}
            onTabChange={(tab) => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab })}
          />
        )}
      </div>
    </div>
  )
}
```

### **2. Analysis Progress Component**

```typescript
// Real-time progress tracking with visual indicators
export function AnalysisProgressSection({ progress, connectionStatus }: Props) {
  const progressPercentage = progress.totalPrompts > 0
    ? (progress.completedPrompts / progress.totalPrompts) * 100
    : 0

  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="pt-6">
        <div className="flex items-center space-x-4 mb-4">
          <div className="relative">
            {connectionStatus === 'connected' ? (
              <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
            ) : (
              <div className="h-3 w-3 bg-gray-500 rounded-full" />
            )}
          </div>
          <div>
            <h3 className="font-medium">Analysis in Progress</h3>
            <p className="text-sm text-white/60">
              Stage: {progress.stage} • {progress.completedPrompts}/{progress.totalPrompts} prompts
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-white/10 rounded-full h-2 mb-4">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Provider Status Grid */}
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(progress.completedProviders).map(([provider, completed]) => (
            <div key={provider} className="flex items-center space-x-2">
              <div className={`h-2 w-2 rounded-full ${
                completed ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
              }`} />
              <span className="text-sm">{provider}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## 📊 Data Visualization Components

### **1. Visibility Score Tab Component**

```typescript
// Share of voice metrics with interactive charts
export function VisibilityScoreTab({ analysis }: Props) {
  const shareOfVoiceData = analysis.competitors.map(comp => ({
    name: comp.name,
    value: comp.shareOfVoice,
    isOwn: comp.isOwn
  }))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Share of Voice</CardTitle>
          <CardDescription>
            How often each brand is mentioned across all prompts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={shareOfVoiceData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#8884d8"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {shareOfVoiceData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isOwn ? '#10B981' : `hsl(${index * 45}, 70%, 60%)`}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Competitor Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Competitor Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Brand</TableHead>
                <TableHead>Visibility Score</TableHead>
                <TableHead>Mentions</TableHead>
                <TableHead>Avg Position</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analysis.competitors
                .sort((a, b) => b.visibilityScore - a.visibilityScore)
                .map((competitor) => (
                  <TableRow key={competitor.name}>
                    <TableCell className="font-medium">
                      {competitor.name}
                      {competitor.isOwn && (
                        <Badge variant="secondary" className="ml-2">You</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-white/10 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              competitor.isOwn ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${competitor.visibilityScore}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">
                          {competitor.visibilityScore.toFixed(1)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{competitor.mentions}</TableCell>
                    <TableCell>{competitor.averagePosition.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
```

### **2. Provider Comparison Matrix**

```typescript
// Cross-provider performance comparison grid
export function ProviderComparisonMatrix({ analysis }: Props) {
  const providers = ['OpenAI', 'Anthropic', 'Google']
  const competitors = analysis.competitors

  return (
    <Card>
      <CardHeader>
        <CardTitle>Provider × Competitor Matrix</CardTitle>
        <CardDescription>
          Performance breakdown across different AI providers
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left p-3 border-b border-white/10">Competitor</th>
                {providers.map(provider => (
                  <th key={provider} className="text-center p-3 border-b border-white/10">
                    {provider}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {competitors.map(competitor => (
                <tr key={competitor.name} className="hover:bg-white/5">
                  <td className="p-3 font-medium border-b border-white/5">
                    {competitor.name}
                    {competitor.isOwn && (
                      <Badge variant="outline" className="ml-2">You</Badge>
                    )}
                  </td>
                  {providers.map(provider => {
                    const score = competitor.providerScores?.[provider] || 0
                    return (
                      <td key={provider} className="p-3 text-center border-b border-white/5">
                        <div className="flex items-center justify-center">
                          <div className={`px-2 py-1 rounded text-xs font-medium ${
                            score >= 80 ? 'bg-green-500/20 text-green-400' :
                            score >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                            score >= 40 ? 'bg-orange-500/20 text-orange-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {score.toFixed(0)}%
                          </div>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## 🎭 Layout Components

### **1. App Sidebar Component**

**Location**: `mudra-app/components/app-sidebar.tsx`

```typescript
// Main application navigation sidebar
export function AppSidebar({ className, ...props }: SidebarProps) {
  const { profile } = useBrandProfile()

  const navItems = [
    {
      title: "Core",
      items: [
        { title: "Overview", url: "/dashboard", icon: Home },
        { title: "Tasks", url: "/dashboard/tasks", icon: CheckSquare },
        { title: "Campaigns", url: "/dashboard/campaigns", icon: PenTool },
      ]
    },
    {
      title: "Knowledge Base",
      items: [
        { title: "Brand Profile", url: "/dashboard/brand-profile", icon: User },
        { title: "Prompts", url: "/dashboard/prompts", icon: MessageSquare },
      ]
    }
  ]

  return (
    <Sidebar className={cn("border-r border-white/10", className)} {...props}>
      <SidebarHeader>
        <div className="flex items-center space-x-2 px-4 py-2">
          <div className="h-8 w-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">
              {profile?.companyName?.[0] || 'M'}
            </span>
          </div>
          <span className="font-semibold">{profile?.companyName || 'Mudra'}</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {navItems.map((section) => (
            <SidebarMenuButton key={section.title} asChild>
              <div>
                <SidebarMenuSub>
                  <div className="px-4 py-2 text-xs font-medium text-white/60 uppercase tracking-wider">
                    {section.title}
                  </div>
                  {section.items.map((item) => (
                    <SidebarMenuSubButton key={item.url} asChild>
                      <Link href={item.url} className="flex items-center space-x-3 px-4 py-2 hover:bg-white/5 rounded-md mx-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  ))}
                </SidebarMenuSub>
              </div>
            </SidebarMenuButton>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={session?.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
```

### **2. Search Command Component**

```typescript
// Global command palette (Cmd+K)
export function SearchCommand() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(open => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const runCommand = useCallback((command: () => void) => {
    setOpen(false)
    command()
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>

            <CommandGroup heading="Navigation">
              <CommandItem onSelect={() => runCommand(() => router.push('/dashboard'))}>
                <Home className="mr-2 h-4 w-4" />
                Dashboard
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push('/dashboard/tasks'))}>
                <CheckSquare className="mr-2 h-4 w-4" />
                Tasks
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push('/dashboard/campaigns'))}>
                <PenTool className="mr-2 h-4 w-4" />
                Campaigns
              </CommandItem>
            </CommandGroup>

            <CommandGroup heading="Actions">
              <CommandItem onSelect={() => runCommand(() => {/* Run analysis */})}>
                <Play className="mr-2 h-4 w-4" />
                Run Analysis
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => {/* Generate report */})}>
                <FileText className="mr-2 h-4 w-4" />
                Generate Report
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
```

---

## 🔄 Form Components

### **1. Onboarding Stepper Component**

```typescript
// Multi-step wizard navigation
interface OnboardingStepperProps {
  currentStep: number
  totalSteps: number
  steps: Array<{
    id: number
    title: string
    description?: string
  }>
}

export function OnboardingStepper({ currentStep, totalSteps, steps }: Props) {
  return (
    <div className="flex items-center justify-center space-x-4 mb-8">
      {steps.map((step, index) => {
        const isActive = step.id === currentStep
        const isCompleted = step.id < currentStep

        return (
          <div key={step.id} className="flex items-center">
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all",
              isCompleted
                ? "bg-green-500 border-green-500 text-white"
                : isActive
                  ? "bg-blue-500 border-blue-500 text-white"
                  : "border-gray-600 text-gray-400"
            )}>
              {isCompleted ? (
                <Check className="h-4 w-4" />
              ) : (
                <span className="text-sm font-medium">{step.id}</span>
              )}
            </div>

            <div className="ml-2 hidden sm:block">
              <div className={cn(
                "text-sm font-medium",
                isActive ? "text-white" : "text-gray-400"
              )}>
                {step.title}
              </div>
              {step.description && (
                <div className="text-xs text-gray-500">
                  {step.description}
                </div>
              )}
            </div>

            {index < steps.length - 1 && (
              <div className={cn(
                "w-8 h-0.5 mx-4",
                isCompleted ? "bg-green-500" : "bg-gray-600"
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}
```

### **2. Tag Input Component**

```typescript
// Multi-select tag input for dynamic lists
interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  maxTags?: number
  allowDuplicates?: boolean
}

export function TagInput({
  value = [],
  onChange,
  placeholder = "Add tags...",
  maxTags,
  allowDuplicates = false
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim()
    if (!trimmed) return

    if (maxTags && value.length >= maxTags) {
      toast.error(`Maximum ${maxTags} tags allowed`)
      return
    }

    if (!allowDuplicates && value.includes(trimmed)) {
      toast.error('Tag already exists')
      return
    }

    onChange([...value, trimmed])
    setInputValue('')
  }, [value, onChange, maxTags, allowDuplicates])

  const removeTag = useCallback((indexToRemove: number) => {
    onChange(value.filter((_, index) => index !== indexToRemove))
  }, [value, onChange])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Enter':
      case ',':
        e.preventDefault()
        addTag(inputValue)
        break
      case 'Backspace':
        if (inputValue === '' && value.length > 0) {
          removeTag(value.length - 1)
        }
        break
    }
  }

  return (
    <div
      className="min-h-[40px] border rounded-md p-2 flex flex-wrap gap-1 cursor-text focus-within:ring-2 focus-within:ring-blue-500"
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag, index) => (
        <Badge key={index} variant="secondary" className="flex items-center gap-1">
          {tag}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              removeTag(index)
            }}
            className="h-auto p-0 hover:bg-transparent"
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}

      <Input
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 border-none shadow-none focus-visible:ring-0 min-w-[120px] px-0"
      />
    </div>
  )
}
```

---

## 🎯 Specialized Components

### **1. Floating Action Button**

```typescript
// AI assistant trigger button
export function FloatingMudraButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Floating Button */}
      <Button
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 hover:scale-110 z-50"
        onClick={() => setIsOpen(true)}
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>

      {/* AI Chat Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl h-[600px]">
          <DialogHeader>
            <DialogTitle>AI Assistant</DialogTitle>
            <DialogDescription>
              Get insights about your brand visibility and optimization recommendations
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <AIChatInterface />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

### **2. Countdown Badge Component**

```typescript
// Analysis cooldown timer display
export function CountdownBadge({ nextAnalysisTime }: Props) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date()
      const next = new Date(nextAnalysisTime)
      const diff = next.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeLeft('')
        return
      }

      const minutes = Math.floor(diff / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      setTimeLeft(`${minutes}m ${seconds}s`)
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [nextAnalysisTime])

  if (!timeLeft) return null

  return (
    <Badge variant="outline" className="flex items-center space-x-1">
      <Clock className="h-3 w-3" />
      <span>Next analysis in {timeLeft}</span>
    </Badge>
  )
}
```

---

## 🎨 Styling Patterns & Best Practices

### **1. Consistent Color System**

```css
/* CSS Variables for Theming */
:root {
  --background: 220 13% 9%;          /* Dark background */
  --foreground: 220 13% 91%;         /* Light text */
  --card: 220 13% 9%;                /* Card background */
  --card-foreground: 220 13% 91%;    /* Card text */
  --border: 220 13% 91%;             /* Border color */
  --primary: 220 100% 50%;           /* Primary blue */
  --primary-foreground: 0 0% 100%;   /* Primary text */
  --secondary: 220 13% 18%;          /* Secondary background */
  --muted: 220 13% 18%;              /* Muted background */
  --muted-foreground: 220 13% 60%;   /* Muted text */
  --accent: 220 13% 18%;             /* Accent background */
  --destructive: 0 100% 50%;         /* Error red */
  --ring: 220 100% 50%;              /* Focus ring */
}

/* Component-specific patterns */
.card-gradient {
  @apply bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10;
}

.glass-effect {
  @apply bg-white/10 backdrop-blur-sm border-white/20;
}

.metric-positive {
  @apply text-green-500 bg-green-500/10;
}

.metric-negative {
  @apply text-red-500 bg-red-500/10;
}
```

### **2. Animation Utilities**

```css
/* Custom animations */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse-slow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* Utility classes */
.animate-fade-in-up {
  animation: fadeInUp 0.3s ease-out;
}

.animate-pulse-slow {
  animation: pulse-slow 3s ease-in-out infinite;
}

.loading-shimmer {
  position: relative;
  overflow: hidden;
}

.loading-shimmer::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent
  );
  animation: shimmer 2s infinite;
}
```

---

## 📱 Responsive Component Patterns

### **1. Responsive Grid Systems**

```typescript
// Adaptive grid components
export function ResponsiveGrid({ children, minWidth = "300px" }: Props) {
  return (
    <div
      className="grid gap-4 md:gap-6"
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}, 1fr))`
      }}
    >
      {children}
    </div>
  )
}

// Container query example
export function AdaptiveCard({ children }: Props) {
  return (
    <div className="@container">
      <Card className="@sm:p-6 @md:p-8 p-4">
        <div className="@lg:flex @lg:space-x-6 space-y-4 @lg:space-y-0">
          {children}
        </div>
      </Card>
    </div>
  )
}
```

### **2. Mobile-Optimized Navigation**

```typescript
// Responsive navigation pattern
export function ResponsiveNavigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden lg:flex items-center space-x-8">
        {navItems.map(item => (
          <Link key={item.href} href={item.href} className="hover:text-blue-400 transition-colors">
            {item.title}
          </Link>
        ))}
      </nav>

      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="sm"
        className="lg:hidden"
        onClick={() => setIsMobileMenuOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile Sheet Menu */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="right" className="w-64">
          <nav className="flex flex-col space-y-4 mt-8">
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="text-lg hover:text-blue-400 transition-colors py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.title}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  )
}
```

---

## 🔧 Component Development Guidelines

### **1. Component Structure Template**

```typescript
// Complete component template
"use client" // Only if interactive

import { useState, useCallback, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface ComponentNameProps {
  // Required props
  data: DataType
  onAction: (value: string) => void

  // Optional props with defaults
  variant?: 'default' | 'compact'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  className?: string

  // Event handlers
  onSelect?: (item: Item) => void
  onError?: (error: Error) => void

  // Render props
  renderCustom?: (data: DataType) => React.ReactNode

  // Children
  children?: React.ReactNode
}

export const ComponentName = forwardRef<
  HTMLDivElement,
  ComponentNameProps
>(({
  data,
  onAction,
  variant = 'default',
  size = 'md',
  disabled = false,
  className,
  onSelect,
  onError,
  renderCustom,
  children,
  ...props
}, ref) => {
  // State
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Handlers
  const handleAction = useCallback(async (value: string) => {
    if (disabled) return

    setLoading(true)
    setError(null)

    try {
      await onAction(value)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
      onError?.(err as Error)
    } finally {
      setLoading(false)
    }
  }, [onAction, disabled, onError])

  // Computed styles
  const baseStyles = "flex items-center justify-center rounded-md transition-colors"
  const variantStyles = {
    default: "bg-blue-500 text-white hover:bg-blue-600",
    compact: "bg-gray-500 text-white hover:bg-gray-600 text-sm px-2 py-1"
  }
  const sizeStyles = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4",
    lg: "h-12 px-6 text-lg"
  }

  return (
    <div
      ref={ref}
      className={cn(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      {...props}
    >
      {renderCustom ? renderCustom(data) : (
        <>
          {loading && <Loader className="mr-2 h-4 w-4 animate-spin" />}
          {error && <AlertCircle className="mr-2 h-4 w-4 text-red-400" />}
          <Button onClick={() => handleAction('test')} disabled={loading || disabled}>
            {loading ? 'Processing...' : 'Action'}
          </Button>
          {children}
        </>
      )}
    </div>
  )
})

ComponentName.displayName = "ComponentName"
```

### **2. Testing Pattern**

```typescript
// Component test template
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ComponentName } from './component-name'

describe('ComponentName', () => {
  const defaultProps = {
    data: { id: '1', name: 'Test' },
    onAction: jest.fn()
  }

  it('renders correctly', () => {
    render(<ComponentName {...defaultProps} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('handles user interactions', async () => {
    const onAction = jest.fn()
    render(<ComponentName {...defaultProps} onAction={onAction} />)

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(onAction).toHaveBeenCalledWith('test')
    })
  })

  it('handles error states', async () => {
    const onAction = jest.fn().mockRejectedValue(new Error('Test error'))
    const onError = jest.fn()

    render(<ComponentName {...defaultProps} onAction={onAction} onError={onError} />)

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(onError).toHaveBeenCalled()
    })
  })
})
```

---

## 📚 Component Documentation

### **Quick Reference Table**

| Category | Component | File Location | Key Features |
|----------|-----------|---------------|--------------|
| **Base UI** | Button | `components/ui/button.tsx` | 6 variants, responsive sizing |
| **Base UI** | Card | `components/ui/card.tsx` | Header/Content/Footer structure |
| **Base UI** | Input | `components/ui/input.tsx` | Form validation, icon support |
| **Base UI** | Select | `components/ui/select.tsx` | Dropdown with search |
| **Dashboard** | DashboardStatCard | `components/dashboard/dashboard-stat-card.tsx` | Sparklines, delta indicators |
| **Dashboard** | AnalysisResults | `components/analysis-results.tsx` | Circular progress, scores |
| **Dashboard** | NaturalLanguageReport | `components/dashboard/natural-language-report.tsx` | AI insights, markdown |
| **Real-time** | BrandMonitor | `components/brand-monitor/brand-monitor.tsx` | SSE, progress tracking |
| **Real-time** | AnalysisProgress | `components/brand-monitor/analysis-progress-section.tsx` | Live updates, provider status |
| **Layout** | AppSidebar | `components/app-sidebar.tsx` | Navigation, user menu |
| **Layout** | SearchCommand | `components/search-command.tsx` | Cmd+K palette |
| **Forms** | OnboardingStepper | `components/ui/onboarding-stepper.tsx` | Multi-step wizard |
| **Forms** | TagInput | Custom implementation | Dynamic tag management |

---

**Document Status**: ✅ Complete
**Last Updated**: November 16, 2024
**Components Documented**: 77+
**Applications Covered**: mudra-app + firegeo
**Framework**: Next.js 15 + shadcn/ui

---

*This guide provides comprehensive documentation of all UI components found in the Droids Lab codebase, serving as both a reference and implementation guide for building consistent, accessible user interfaces.*