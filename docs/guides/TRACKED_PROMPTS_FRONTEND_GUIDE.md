# Tracked Prompts Frontend Implementation Guide

## Overview

The Tracked Prompts feature is a comprehensive AI visibility tracking system that allows users to monitor how their brand appears across different AI models and prompts. This guide covers the complete frontend implementation including the list view, deep analysis view, and all interactive features.

## Architecture

### Route Structure
```
/dashboard/tracked-prompts          # Main list view
/dashboard/tracked-prompts/[id]     # Individual prompt analysis
```

### File Organization
```
mudra-app/
├── app/dashboard/tracked-prompts/
│   ├── page.tsx                    # List view with table and filters
│   └── [id]/page.tsx              # Deep view with charts and dialogs
├── lib/mock-data/
│   └── tracked-prompts.ts         # Comprehensive mock data system
└── components/ui/                  # Shared UI components
```

## Feature Implementation

### 1. Tracked Prompts List View (`/dashboard/tracked-prompts/page.tsx`)

**Core Features:**
- **Sortable Data Table**: Prompt text, visibility %, position, model, intent, sentiment
- **Multi-Selection**: Bulk operations with checkbox selection
- **Advanced Filtering**: Filter by AI model and prompt intent category
- **Add Prompt Dialog**: Manual prompt creation with category selection
- **Responsive Pagination**: Show all/collapse with expansion controls
- **Loading States**: Skeleton loading during data fetch

**Key Components Used:**
```typescript
import { useReactTable, getCoreRowModel, getSortedRowModel } from "@tanstack/react-table"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
```

**Data Flow:**
```
Mock Data → useState → Filtered Data → Table Rendering → User Interactions
```

**Table Columns:**
1. **Select**: Multi-select checkbox for bulk operations
2. **Prompt**: Clickable text that navigates to deep view
3. **Visibility**: Percentage with color-coded badges
4. **Position**: Average ranking position (lower is better)
5. **Model**: AI model icon and name (ChatGPT, Claude, etc.)
6. **Intent**: Category badge (Organic, Competitor, How-to, Brand-Specific)
7. **Sentiment**: Color-coded sentiment analysis (Positive/Neutral/Negative)

### 2. Deep View Analysis (`/dashboard/tracked-prompts/[id]/page.tsx`)

**Layout Structure:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Header: Back | Prompt Chip | Intent Chip | Platform | Date     │
├─────────────────────────────────────────────────────────────────┤
│ Chart: Visibility Trends    | Competitors Table              │
├─────────────────────────────────────────────────────────────────┤
│ Toggle: Recent Chats | Sources                                 │
│ Data Table (filtered by toggle selection)                      │
└─────────────────────────────────────────────────────────────────┘
```

#### A. Header Section
```typescript
// Navigation and Context
<Link href="/dashboard/tracked-prompts">
  <Button variant="ghost" size="sm" className="gap-2">
    <ArrowLeft className="h-4 w-4" />
    Back to Tracked Prompts
  </Button>
</Link>

// Prompt and Intent Display
<div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
  <MessageSquare className="h-4 w-4 text-white/80" />
  <span className="text-sm font-medium text-white/90">{promptLabel}</span>
</div>
```

#### B. Interactive Visualization
```typescript
// Line Chart with Competitor Filtering
<ChartContainer config={computedChartConfig} className="h-[290px] md:h-[330px]">
  <LineChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
    <CartesianGrid strokeDasharray="4 8" stroke="#ffffff" strokeOpacity={0.08} />
    <XAxis dataKey="day" axisLine={false} tickLine={false} />
    <YAxis tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
    <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
    {competitorSeries.map((s) => (
      <Line
        key={s.key}
        dataKey={s.key}
        stroke={s.color}
        strokeWidth={2}
        hide={!!activeCompetitor && activeCompetitor !== s.label}
      />
    ))}
  </LineChart>
</ChartContainer>
```

#### C. Competitors Analysis Table
```typescript
// Single-select competitor filtering
<TableCell className="px-4 align-middle">
  <Checkbox
    checked={activeCompetitor === row.company}
    onCheckedChange={() => setActiveCompetitor(
      activeCompetitor === row.company ? null : row.company
    )}
  />
</TableCell>
```

#### D. Dual-View Data Tables

**Recent Chats View:**
- Platform identification with icons
- Mentioned status (Yes/No badges)
- Position in response
- Response snippet with "View" action
- Date of query

**Sources View:**
- Domain ranking by citation frequency
- Citation frequency percentage
- Citation type categorization
- Clickable rows opening source dialogs

### 3. Interactive Dialog System

#### A. Chat Details Dialog
```typescript
<Dialog>
  <DialogContent className="sm:max-w-3xl rounded-xl border-0 bg-dark-grey">
    {/* Provider, Mentioned Status, Position, Date */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Status chips */}
    </div>

    {/* Full Response Display */}
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
        {chat.fullResponse}
      </div>
    </div>

    {/* Clickable Citations Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {citations.map((citation) => (
        <Dialog key={citation.domain}>
          <DialogTrigger asChild>
            <div className="cursor-pointer hover:bg-white/10">
              {citation.domain}
            </div>
          </DialogTrigger>
          {/* Nested Source Dialog */}
        </Dialog>
      ))}
    </div>
  </DialogContent>
</Dialog>
```

#### B. Source Details Dialog
```typescript
// Breadcrumb Navigation
<div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
  <MessageSquare className="h-3.5 w-3.5" />
  <span>Prompts</span>
  <ChevronRight className="h-3.5 w-3.5" />
  <span>{promptLabel}</span>
  <ChevronRight className="h-3.5 w-3.5" />
  <span>Sources</span>
  <ChevronRight className="h-3.5 w-3.5" />
  <span className="font-medium">{domain}</span>
</div>

// KPI Display
<div className="text-4xl md:text-5xl font-semibold">
  {citationFrequencyPercentage}%
</div>

// View Toggle: Sources | This Prompt
<Button variant={sourceDialogView === 'sources' ? 'default' : 'ghost'}>
  Sources
</Button>
<Button variant={sourceDialogView === 'prompt' ? 'default' : 'ghost'}>
  This prompt
</Button>
```

## Mock Data System

### Data Structure
```typescript
export type TrackedPromptWithDetails = {
  id: string;
  prompt: string;
  category: 'Organic' | 'Competitor' | 'How-to' | 'Brand-Specific';
  visibility: number;
  model: string;
  provider: string;
  intent: string;
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  position: number | null;
  brandMentioned: boolean;

  // Detailed analysis
  fullResponse: string;
  competitiveLandscape: {
    mentioned: string[];
    notMentioned: string[];
    totalMentioned: number;
    brandPosition?: number;
  };
  citationQuality: number;
  contextRelevance: number;

  // Historical tracking
  historicalData?: Array<{
    date: string;
    visibility: number;
    position: number | null;
    sentiment: string;
  }>;
}
```

### Test Scenarios Coverage
1. **High Visibility (95%+)**: Brand-specific prompts with positive sentiment
2. **Medium Visibility (65-88%)**: Competitive prompts with mixed sentiment
3. **Low Visibility (0-45%)**: Generic prompts where brand isn't mentioned
4. **Negative Sentiment**: Critical analysis scenarios
5. **Multi-Provider**: Coverage across OpenAI, Anthropic, Google, Perplexity
6. **Competitive Analysis**: Various competitor positioning scenarios

## Filtering and State Management

### Filter State Management
```typescript
const [selectedPlatform, setSelectedPlatform] = useState<string>("all")
const [selectedModel, setSelectedModel] = useState<string>("all")
const [selectedIntent, setSelectedIntent] = useState<string>("all")
const [dateRange, setDateRange] = useState<'7d' | '14d' | '30d'>('7d')

// Derived filtered data
const filteredData = useMemo(() => {
  return data.filter((item) => {
    const modelMatch = selectedModel === "all" || item.model === selectedModel
    const intentMatch = selectedIntent === "all" || item.intent === selectedIntent
    const platformMatch = selectedPlatform === "all" || providerKey(item.provider) === selectedPlatform
    return modelMatch && intentMatch && platformMatch
  })
}, [data, selectedModel, selectedIntent, selectedPlatform])
```

### Provider Mapping
```typescript
function getProviderDisplay(provider: string): string {
  switch (provider) {
    case 'OpenAI': return 'ChatGPT'
    case 'Anthropic': return 'Claude'
    case 'Perplexity': return 'Perplexity'
    case 'Google': return 'AI Overviews'
    case 'Gemini': return 'Gemini'
  }
}
```

## Styling and Theme

### Color System
```typescript
const COMPETITOR_COLORS = [
  "#4e79a7", // tableau blue
  "#f28e2b", // tableau orange
  "#e15759", // tableau red
  "#76b7b2", // tableau teal
  "#59a14f", // tableau green
  // ... additional colors for multiple competitors
]
```

### Dark Theme Implementation
- **Background**: `bg-dark-grey`
- **Cards**: `border-white/[0.06]` with `bg-transparent`
- **Text**: `text-white/90` for primary, `text-white/70` for secondary
- **Interactive**: `hover:bg-white/10` for buttons and rows
- **Borders**: `border-white/10` for subtle separations

### Responsive Design
```css
/* Breakpoints */
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */

/* Component sizing */
.table-fixed text-[14px] md:text-[15px]  /* Progressive text sizing */
.h-[290px] md:h-[330px]                  /* Chart responsive height */
.px-4 lg:px-6                           /* Container padding */
```

## Integration with Backend

### API Endpoint Structure
```
GET /api/tracked-prompts                    # List all prompts
POST /api/tracked-prompts                   # Create new prompt
DELETE /api/tracked-prompts/:id             # Delete prompt

GET /api/tracked-prompts/:id                # Prompt details
GET /api/tracked-prompts/:id/visibility     # Chart data
GET /api/tracked-prompts/:id/competitors    # Competitor analysis
GET /api/tracked-prompts/:id/sources        # Citation sources
GET /api/tracked-prompts/:id/chats          # Recent chats
GET /api/tracked-prompts/:id/sources/:domain # Domain analysis
```

### Data Loading Pattern
```typescript
useEffect(() => {
  async function fetchPrompts() {
    setIsLoading(true)
    try {
      const response = await fetch('/api/tracked-prompts')
      const data = await response.json()
      setPrompts(data.prompts)
    } catch (error) {
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }
  fetchPrompts()
}, [])
```

## Performance Optimizations

### Component Memoization
```typescript
const columns = useMemo(() => createColumns(router), [router])
const competitorSeries = useMemo(() => {
  return competitorsData.map((c, idx) => ({
    key: toSeriesKey(c.company),
    label: c.company,
    color: COMPETITOR_COLORS[idx % COMPETITOR_COLORS.length],
  }))
}, [])
```

### Pagination Strategy
```typescript
const [pagination, setPagination] = useState<PaginationState>({
  pageIndex: 0,
  pageSize: 50, // Show all prompts initially
})

// Expand functionality
const handleExpand = () => {
  setSourceVisibleCount(Math.min(
    sourceVisibleCount + INITIAL_VISIBLE,
    totalSources
  ))
}
```

## Testing Guidelines

### Component Testing
- **Table Interactions**: Sorting, filtering, selection
- **Chart Interactions**: Competitor selection, tooltip display
- **Dialog Navigation**: Modal opening, breadcrumb navigation
- **Responsive Behavior**: Mobile and desktop layouts

### Mock Data Testing
- **Scenario Coverage**: All visibility ranges and sentiment types
- **Edge Cases**: Empty states, error conditions
- **Provider Coverage**: All supported AI models
- **Filter Combinations**: Multiple filter interactions

### Integration Testing
- **Route Navigation**: List to deep view transitions
- **State Persistence**: Filter states across navigation
- **Error Handling**: Network failures, invalid data

## Future Enhancements

### Planned Features
1. **Export Functionality**: CSV/PDF export of prompt data
2. **Real-time Updates**: WebSocket integration for live data
3. **Advanced Analytics**: Trend analysis and forecasting
4. **Collaborative Features**: Team sharing and annotations
5. **Mobile App**: Progressive Web App capabilities

### Performance Improvements
1. **Virtual Scrolling**: For large prompt datasets
2. **Lazy Loading**: Progressive image and data loading
3. **Caching Strategy**: Intelligent data caching
4. **Bundle Splitting**: Code splitting for faster loads

This comprehensive frontend implementation provides a complete user experience for AI visibility tracking while maintaining high code quality, accessibility, and performance standards.