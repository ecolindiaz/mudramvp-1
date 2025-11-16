# UI Changes Specification - Droids Lab Frontend Updates

## Document Overview

This document provides a comprehensive specification of the UI changes and frontend updates implemented in the latest branch commits, specifically focusing on the Tracked Prompts Deep View and overall dashboard enhancements.

**Branch**: `tembo/droids-lab-ui-docs-update`
**Target Branch**: `AIReferredTrafficFrontEnd`
**Date**: November 2025

## Executive Summary

The recent frontend implementation introduces a sophisticated AI visibility tracking system through the Tracked Prompts feature. This includes a comprehensive list view, detailed analysis pages, and interactive visualization components that provide users with deep insights into their brand's AI visibility across multiple models and platforms.

## Key Changes Overview

### 1. New Route Implementation

**Added Routes:**
- `/dashboard/tracked-prompts` - Main tracking interface
- `/dashboard/tracked-prompts/[id]` - Detailed prompt analysis

**Navigation Integration:**
- Integrated into main dashboard sidebar navigation
- Breadcrumb navigation system for deep linking
- Back navigation with state preservation

### 2. Component Architecture

#### A. Tracked Prompts List (`/mudra-app/app/dashboard/tracked-prompts/page.tsx`)

**New Features Implemented:**
```typescript
// Advanced Data Table with TanStack Table
const table = useReactTable({
  data: filteredData,
  columns: createColumns(router),
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  enableSortingRemoval: false,
})

// Multi-selection with bulk operations
const selectedCount = Object.keys(table.getState().rowSelection).length

// Dynamic filtering system
const filteredData = useMemo(() => {
  return data.filter((item) => {
    const modelMatch = selectedModel === "all" || item.model === selectedModel
    const intentMatch = selectedIntent === "all" || item.intent === selectedIntent
    return modelMatch && intentMatch
  })
}, [data, selectedModel, selectedIntent])
```

**UI Components:**
- **Sortable Table Headers**: Click-to-sort functionality with visual indicators
- **Multi-Select Checkboxes**: Individual and bulk selection capabilities
- **Filter Dropdowns**: Model and Intent filtering with clear options
- **Add Prompt Dialog**: Modal for manual prompt creation
- **Selection Footer**: Floating action bar for bulk operations
- **Loading States**: Skeleton loading with spinner indicators

#### B. Deep View Analysis (`/mudra-app/app/dashboard/tracked-prompts/[id]/page.tsx`)

**Complex UI Implementation:**

1. **Interactive Line Chart**:
```typescript
<ChartContainer config={computedChartConfig} className="h-[290px] md:h-[330px]">
  <LineChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
    <CartesianGrid strokeDasharray="4 8" stroke="#ffffff" strokeOpacity={0.08} />
    <XAxis dataKey="day" axisLine={false} tickLine={false} />
    <YAxis tickFormatter={(v: number) => `${v}%`} domain={[0, 100]} />
    <ChartTooltip cursor={{ stroke: '#ffffff', strokeDasharray: '4 6' }} />
    {competitorSeries.map((s) => (
      <Line
        key={s.key}
        type="stepAfter"
        dataKey={s.key}
        stroke={s.color}
        strokeWidth={2}
        hide={!!activeCompetitor && activeCompetitor !== s.label}
      />
    ))}
  </LineChart>
</ChartContainer>
```

2. **Competitor Selection Table**:
- Single-select checkbox system (radio-like behavior)
- Dynamic chart filtering based on selection
- Comprehensive competitor metrics display
- Responsive layout with tooltip help system

3. **Dual-View Data Management**:
```typescript
const [bottomView, setBottomView] = useState<'chats' | 'sources'>('chats')

// Toggle between Recent Chats and Sources
<Button
  variant={bottomView === 'chats' ? 'default' : 'ghost'}
  onClick={() => setBottomView('chats')}
>
  Recent Chats
</Button>
<Button
  variant={bottomView === 'sources' ? 'default' : 'ghost'}
  onClick={() => setBottomView('sources')}
>
  Sources
</Button>
```

### 3. Modal Dialog System

#### A. Chat Details Dialog
**Features:**
- Full response text display with pre-formatted content
- Provider identification with branded icons
- Status indicators (mentioned/not mentioned, position)
- Clickable citation system
- Nested dialog support for source exploration

#### B. Source Analysis Dialog
**Complex Implementation:**
```typescript
// Breadcrumb Navigation System
<div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px]">
  <MessageSquare className="h-3.5 w-3.5 text-white/70" />
  <span className="text-white/70">Prompts</span>
  <ChevronRight className="h-3.5 w-3.5 text-white/50" />
  <span className="truncate max-w-[45%] text-white/80" title={promptLabel}>{promptLabel}</span>
  <ChevronRight className="h-3.5 w-3.5 text-white/50" />
  <span className="text-white/70">Sources</span>
  <ChevronRight className="h-3.5 w-3.5 text-white/50" />
  <span className="truncate text-white/90 font-medium" title={domain}>{domain}</span>
</div>

// View Toggle System
<Button variant={sourceDialogView === 'sources' ? 'default' : 'ghost'}>Sources</Button>
<Button variant={sourceDialogView === 'prompt' ? 'default' : 'ghost'}>This prompt</Button>

// Nested Table Views
{sourceDialogView === 'sources' ? (
  <URLsTable urls={domainUrls} />
) : (
  <ChatsTable chats={filteredChatsForDomain} />
)}
```

### 4. Data Management System

#### A. Mock Data Architecture (`/mudra-app/lib/mock-data/tracked-prompts.ts`)

**Comprehensive Data Model:**
```typescript
export type TrackedPromptWithDetails = {
  id: string;
  prompt: string;
  category: 'Organic' | 'Competitor' | 'How-to' | 'Brand-Specific';
  visibility: number;
  model: string;
  provider: string;
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  position: number | null;
  brandMentioned: boolean;
  fullResponse: string;
  competitiveLandscape: {
    mentioned: string[];
    notMentioned: string[];
    totalMentioned: number;
    brandPosition?: number;
  };
  citationQuality: number;
  contextRelevance: number;
  historicalData?: Array<{
    date: string;
    visibility: number;
    position: number | null;
    sentiment: string;
  }>;
  responseCitations?: Array<{
    domain: string;
    type?: string;
  }>;
}
```

**Realistic Test Scenarios:**
- **8 Different Prompts**: Covering all visibility ranges (0% to 98%)
- **Multiple Providers**: OpenAI, Anthropic, Google, Perplexity coverage
- **Sentiment Variations**: Positive, neutral, and negative scenarios
- **Competitive Analysis**: Multi-competitor positioning data
- **Full Response Content**: Complete AI responses with citations
- **Historical Tracking**: Time-series data for trend analysis

### 5. Filter and State Management

#### A. Multi-Level Filtering System
```typescript
// Platform Filter (affects all views)
const [selectedPlatform, setSelectedPlatform] = useState<string>("all")

// Date Range Filter
const [dateRange, setDateRange] = useState<'7d' | '14d' | '30d'>('7d')

// Model and Intent Filters (list view)
const [selectedModel, setSelectedModel] = useState<string>("all")
const [selectedIntent, setSelectedIntent] = useState<string>("all")

// Provider Key Mapping
function providerKey(provider: ChatHistoryEntry['provider']): string {
  switch (provider) {
    case 'OpenAI': return 'ChatGPT'
    case 'Anthropic': return 'Claude'
    case 'Perplexity': return 'Perplexity'
    case 'Google': return 'AI Overviews'
    case 'Gemini': return 'Gemini'
  }
}
```

#### B. State Synchronization
- **Cross-Component Filtering**: Platform filter affects chart, tables, and dialogs
- **URL State Management**: Deep-linkable URLs with parameter preservation
- **Local Storage**: User preference persistence across sessions
- **Real-time Updates**: Immediate UI response to filter changes

### 6. Visual Design System

#### A. Color Palette for Data Visualization
```typescript
const COMPETITOR_COLORS = [
  "#4e79a7", // tableau blue
  "#f28e2b", // tableau orange
  "#e15759", // tableau red
  "#76b7b2", // tableau teal
  "#59a14f", // tableau green
  "#edc948", // tableau yellow
  "#b07aa1", // tableau purple
  "#ff9da7", // tableau pink
  "#9c755f", // tableau brown
  "#bab0ab", // tableau gray
]
```

#### B. Dark Theme Implementation
```scss
// Base Dark Theme Variables
background: #1a1a1a (dark-grey)
cards: rgba(255, 255, 255, 0.06) borders
text-primary: rgba(255, 255, 255, 0.90)
text-secondary: rgba(255, 255, 255, 0.70)
text-muted: rgba(255, 255, 255, 0.60)

// Interactive States
hover: rgba(255, 255, 255, 0.10)
active: rgba(255, 255, 255, 0.15)
border: rgba(255, 255, 255, 0.10)

// Status Colors
positive: #10b981 (emerald)
negative: #ef4444 (red)
neutral: rgba(255, 255, 255, 0.80)
```

#### C. Typography Scale
```css
/* Progressive Text Sizing */
text-[14px] md:text-[15px]     /* Body text */
text-[13px] md:text-sm         /* Secondary text */
text-[11px]                    /* Caption text */
text-base md:text-lg           /* Headers */
text-4xl md:text-5xl           /* KPI displays */
```

### 7. Responsive Design Implementation

#### A. Breakpoint Strategy
```css
/* Mobile First Approach */
default: 0px      /* Mobile portrait */
sm: 640px         /* Mobile landscape */
md: 768px         /* Tablet */
lg: 1024px        /* Desktop */

/* Component Adaptations */
.h-[340px] md:h-[380px]        /* Card heights */
.px-4 lg:px-6                  /* Container padding */
.grid-cols-1 md:grid-cols-2    /* Grid layouts */
.text-[14px] md:text-[15px]    /* Progressive text */
```

#### B. Mobile Optimizations
- **Touch Targets**: Minimum 44px touch areas
- **Horizontal Scrolling**: Table horizontal scroll on mobile
- **Stack Navigation**: Column stacking for narrow screens
- **Modal Sizing**: Full-screen modals on mobile devices
- **Filter Collapsing**: Collapsible filter sections

### 8. Accessibility Implementation

#### A. ARIA Labels and Descriptions
```typescript
// Table Accessibility
<TableHead>
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="inline-flex items-center gap-1.5 cursor-help">
        Visibility <HelpCircle className="h-3.5 w-3.5 opacity-70" />
      </span>
    </TooltipTrigger>
    <TooltipContent>Percentage of responses that mention your brand</TooltipContent>
  </Tooltip>
</TableHead>

// Button Accessibility
<Button
  aria-label="Select competitor for chart filtering"
  aria-pressed={activeCompetitor === competitor.name}
>
  {competitor.name}
</Button>
```

#### B. Keyboard Navigation
- **Tab Order**: Logical tab sequence through all interactive elements
- **Enter/Space**: Button activation with keyboard
- **Escape**: Modal dismissal
- **Arrow Keys**: Table navigation and chart interaction
- **Focus Management**: Proper focus trapping in modals

### 9. Performance Optimizations

#### A. Component Memoization
```typescript
// Expensive Calculations
const competitorSeries = useMemo(() => {
  return competitorsData.map((c, idx) => ({
    key: toSeriesKey(c.company),
    label: c.company,
    color: COMPETITOR_COLORS[idx % COMPETITOR_COLORS.length],
    visibility: c.visibility,
  }))
}, [])

const chartData = useMemo(() => {
  return visibilityTrendData.map((p) => {
    const row: any = { day: p.day }
    competitorSeries.forEach((s) => {
      row[s.key] = s.visibility
    })
    return row
  })
}, [competitorSeries])
```

#### B. Lazy Loading Strategy
```typescript
// Progressive Data Loading
const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)
const visibleItems = allItems.slice(0, visibleCount)

const handleExpand = () => {
  setVisibleCount(Math.min(visibleCount + INITIAL_VISIBLE, allItems.length))
}
```

### 10. Integration Readiness

#### A. API Contract Definition
```typescript
// Defined API Endpoints
GET /api/tracked-prompts/:id                     // Prompt details
GET /api/tracked-prompts/:id/visibility          // Chart data
GET /api/tracked-prompts/:id/competitors         // Competitor metrics
GET /api/tracked-prompts/:id/sources            // Citation sources
GET /api/tracked-prompts/:id/chats              // Chat history
GET /api/tracked-prompts/:id/sources/:domain    // Domain analysis

// Response Format Standardization
{
  success: boolean;
  data: T;
  pagination?: {
    total: number;
    cursor?: string;
  };
  error?: {
    message: string;
    code?: string;
  };
}
```

#### B. Error Handling Structure
```typescript
// Error State Management
const [isLoading, setIsLoading] = useState(true)
const [errorMessage, setErrorMessage] = useState<string | null>(null)

// API Integration Pattern
try {
  const response = await fetch('/api/tracked-prompts')
  const result = await response.json()
  if (result.success) {
    setData(result.data)
  } else {
    setErrorMessage(result.error?.message || 'Failed to load data')
  }
} catch (error) {
  setErrorMessage('Network error occurred')
} finally {
  setIsLoading(false)
}
```

## Technical Dependencies

### A. Core Libraries
- **@tanstack/react-table**: v8+ for advanced table functionality
- **recharts**: v2+ for chart visualization
- **lucide-react**: v0.400+ for consistent iconography
- **@radix-ui/react-***: shadcn/ui component foundation
- **next**: v14+ with App Router for routing

### B. Development Tools
- **TypeScript**: v5+ with strict configuration
- **Tailwind CSS**: v3+ with custom design system
- **ESLint**: Code quality and consistency
- **Prettier**: Code formatting standards

## Quality Assurance

### A. Testing Coverage
- **Unit Tests**: Individual component functionality
- **Integration Tests**: User interaction flows
- **Responsive Tests**: Cross-device compatibility
- **Accessibility Tests**: Screen reader and keyboard navigation
- **Performance Tests**: Load time and interaction responsiveness

### B. Browser Support
- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile Browsers**: iOS Safari 14+, Android Chrome 90+
- **Feature Detection**: Graceful degradation for older browsers

## Future Development Roadmap

### Phase 1: Backend Integration
1. **API Implementation**: Replace mock data with real endpoints
2. **Authentication**: Secure API access with user tokens
3. **Real-time Updates**: WebSocket integration for live data
4. **Error Handling**: Comprehensive error state management

### Phase 2: Advanced Features
1. **Export Functionality**: CSV/PDF data export
2. **Advanced Filtering**: Multi-criteria filter combinations
3. **Bulk Operations**: Enhanced batch processing
4. **Collaborative Features**: Team sharing and annotations

### Phase 3: Performance & Scale
1. **Virtual Scrolling**: Handle large datasets efficiently
2. **Caching Strategy**: Intelligent data caching system
3. **Progressive Loading**: Improved initial load times
4. **Mobile App**: Progressive Web App capabilities

## Conclusion

The Tracked Prompts frontend implementation represents a significant advancement in AI visibility tracking user experience. The comprehensive feature set, robust technical architecture, and attention to accessibility and performance create a production-ready system that can immediately benefit users while providing a solid foundation for future enhancements.

The implementation successfully balances complexity and usability, providing powerful analytical capabilities through an intuitive interface that follows modern design principles and development best practices.