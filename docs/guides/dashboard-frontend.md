## Mudra Dashboard Frontend Guide

## Overview

This guide documents the frontend implementation of the Mudra dashboard - the main interface users see after completing onboarding. The dashboard provides comprehensive AI visibility analytics and GEO (Generative Engine Optimization) insights.

**Main Dashboard Route**: `/dashboard`

## Architecture Principles

- **Test-Driven Development**: Test code continuously, identify bugs and errors early
- **Code Structure**: Maintain clean, optimized, and consistent code patterns
- **Component Modularity**: Reusable components following shadcn/ui patterns
- **Dark Theme First**: Consistent dark theme across all components
- **Responsive Design**: Mobile-first approach with desktop enhancements

---

## Core Dashboard Sections

### 1. My Scores
**Overview metrics providing instant health check of AI visibility**

- **AI Visibility Metric + Models**: Percentage visibility across ChatGPT, Claude, Gemini, Perplexity
- **Crawler Health Score**: Technical accessibility for AI crawlers
- **Competitive Share**: Brand positioning vs competitors in AI responses
- **Content Quality Score**: Content optimization for AI citations
- **Footprint Score**: Overall digital presence in AI knowledge
- **Technical Structure Score**: Website technical GEO readiness

### 2. Prompts & Insights
**Detailed analysis of prompt performance and competitive intelligence**

- **Competitive Share**: Visual comparison against industry competitors
- **Referrals from AI Search**: Traffic attribution from AI-powered searches
- **Top 10 Prompts**: Highest performing prompts by visibility and sentiment

### 3. Technical Analysis
**Deep technical audit and health metrics**

- **Crawler Health Score**: AI bot accessibility and indexing status
- **Technical Structure Score**: Schema markup, robots.txt, llms.txt optimization
- **Content Quality Score**: Content relevance and citation-worthiness
- **Bot Activity**: AI crawler behavior and frequency patterns

### 4. Footprint Analysis
**Brand presence and opportunity identification**

- **Total Citations**: Aggregate count across all AI models
- **Footprint Score**: Overall brand authority in AI responses
- **High Impact Opportunities**: Prioritized optimization recommendations
- **Brand Voice Analysis**: Sentiment and tone analysis across citations

### 5. Interactive Features
**Advanced functionality for optimization and insights**

- **Agent Chat**: AI-powered recommendation system with execution capabilities (Premium)
- **The Magic Button**: One-click optimization execution based on analysis (Premium)
- **Brand Profile**: Editable company details (description, services, industry, ICP, competitors)

---

## Recent Frontend Updates (November 2025)

### ✅ Tracked Prompts Deep View Implementation

**New Pages Added:**
- `/dashboard/tracked-prompts` - Main tracked prompts list with filtering
- `/dashboard/tracked-prompts/[id]` - Individual prompt deep analysis

**Key Features Implemented:**

#### 1. Tracked Prompts List (`/dashboard/tracked-prompts/page.tsx`)
- **Data Table**: Sortable columns for prompt, visibility, position, model, intent, sentiment
- **Multi-Select**: Checkbox selection with bulk delete functionality
- **Filtering**: Model and Intent filters with clear functionality
- **Add Prompt Dialog**: Manual prompt addition with category selection
- **Pagination Ready**: Show all/collapse functionality with expansion controls
- **Mock Integration**: Fully functional with realistic sample data

#### 2. Tracked Prompts Deep View (`/dashboard/tracked-prompts/[id]/page.tsx`)
- **Header Navigation**: Back button, prompt chip, intent chip, platform/date filters
- **Visibility Chart**: Interactive line chart with competitor comparison
- **Competitors Table**: Selectable competitor analysis with metrics
- **Dual Bottom View**: Toggle between Recent Chats and Sources
- **Interactive Dialogs**: Chat details and source analysis modals
- **Citation Linking**: Clickable citations connecting chats to sources

### Technical Implementation Details

#### Component Structure
```
app/dashboard/tracked-prompts/
├── page.tsx                    # Main list view
├── [id]/page.tsx              # Deep view implementation
lib/mock-data/
├── tracked-prompts.ts         # Comprehensive mock data
```

#### Key UI Components Used
- **@tanstack/react-table**: Advanced data tables with sorting/pagination
- **Recharts**: Interactive charts with custom styling
- **shadcn/ui**: Button, Badge, Card, Dialog, Select, Tooltip, Table components
- **Lucide React**: Consistent iconography
- **Next.js Image**: Optimized provider icons

#### Data Flow Architecture
```
Mock Data → Component State → Filtered Display → User Interactions → State Updates
```

#### Styling Approach
- **Dark Theme Consistency**: Matching main dashboard styling
- **Color Palette**: High-contrast colors for data visualization
- **Responsive Breakpoints**: Mobile-first with desktop enhancements
- **Component Variants**: Light/dark mode support built-in

### Mock Data System

**Comprehensive Test Scenarios:**
- **High Visibility**: 95% visibility with positive sentiment (Brand-specific prompts)
- **Medium Visibility**: 65-88% visibility with neutral/positive sentiment
- **Low Visibility**: 0-45% visibility including negative sentiment cases
- **Provider Coverage**: OpenAI, Anthropic, Google, Perplexity with realistic responses
- **Competitive Analysis**: Multi-competitor scenarios with positioning data
- **Citation Analysis**: Realistic source domains and citation frequencies

### Integration Readiness

**API Endpoints Prepared:**
```
GET /api/tracked-prompts/:id                     # Prompt details
GET /api/tracked-prompts/:id/visibility          # Visibility trends
GET /api/tracked-prompts/:id/competitors         # Competitor analysis
GET /api/tracked-prompts/:id/sources            # Citation sources
GET /api/tracked-prompts/:id/chats              # Recent chat history
GET /api/tracked-prompts/:id/sources/:domain    # Domain-specific chats
```

**Ready for Production:**
- Mock data easily swappable with real API calls
- Loading states prepared for all data fetches
- Error handling structure in place
- Cursor pagination support ready
- Real-time data update capability

---

## Development Guidelines

### Code Quality Standards
- **TypeScript First**: Strict typing for all components and data
- **Component Separation**: Presentational vs container component patterns
- **State Management**: React hooks with context providers for global state
- **Error Boundaries**: Comprehensive error handling at component level
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support

### Testing Approach
- **Unit Tests**: Individual component functionality
- **Integration Tests**: Data flow and user interaction patterns
- **Mock Data Tests**: Comprehensive scenario coverage
- **Responsive Tests**: Cross-device compatibility verification

### Performance Optimization
- **Code Splitting**: Dynamic imports for large components
- **Lazy Loading**: Progressive data loading for large datasets
- **Memoization**: React.memo and useMemo for expensive calculations
- **Bundle Optimization**: Tree shaking and minimal bundle sizes

### Future Enhancements
- **Real-time Updates**: WebSocket integration for live data
- **Advanced Filtering**: More granular filter options
- **Export Functionality**: Data export to CSV/PDF formats
- **Collaborative Features**: Team sharing and commenting
- **Mobile App Integration**: Progressive Web App capabilities

---

## Component Examples

### Tracked Prompts Table
```typescript
// Features: Sorting, filtering, selection, responsive design
<Table className="table-fixed text-[14px] md:text-[15px]">
  <TableHeader className="bg-white/[0.03]">
    {/* Sortable headers with tooltips */}
  </TableHeader>
  <TableBody>
    {/* Dynamic row rendering with click handlers */}
  </TableBody>
</Table>
```

### Interactive Chart
```typescript
// Features: Competitor filtering, responsive sizing, dark theme
<ChartContainer config={computedChartConfig} className="h-[290px] md:h-[330px]">
  <LineChart data={chartData}>
    <CartesianGrid strokeDasharray="4 8" stroke="#ffffff" strokeOpacity={0.08} />
    {/* Dynamic line rendering based on competitor selection */}
  </LineChart>
</ChartContainer>
```

### Modal Dialogs
```typescript
// Features: Nested dialogs, breadcrumb navigation, data tables
<Dialog open={sourceDialogOpen} onOpenChange={setSourceDialogOpen}>
  <DialogContent className="sm:max-w-4xl rounded-xl border-0 bg-dark-grey">
    {/* Breadcrumb navigation */}
    {/* KPI display */}
    {/* Nested data tables with pagination */}
  </DialogContent>
</Dialog>
```

This guide serves as both documentation and specification for continued development of the Mudra dashboard frontend.


