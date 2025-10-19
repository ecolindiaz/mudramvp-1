# Mudra App Frontend Flow & Features Documentation

**Generated**: October 16, 2025  
**Platform**: Next.js 15 (App Router) with React Server Components

---

## 🎯 Application Architecture

### **Design System**
- **Theme**: Dark mode (forced) with custom dark-grey color scheme
- **Fonts**: Geist Sans & Geist Mono
- **UI Library**: shadcn/ui components
- **Notifications**: Sonner toast system
- **Icons**: Tabler Icons + custom SVG icons

### **State Management**
- **Brand Profile Context**: Global brand profile data via React Context
- **Onboarding Context**: Multi-step onboarding state management
- **Session Management**: NextAuth session provider

---

## 📱 User Journey Flow

```
1. Landing (/) → Redirects to /dashboard
2. Auth Flow: /login or /signup → /welcome (onboarding)
3. Onboarding: 7-step wizard → /dashboard (main app)
4. Dashboard: Sidebar navigation to all features
```

---

## 🔐 Authentication Pages

### **1. Login Page** (`/login`)
**Component**: `<Login />`

**Features**:
- Email/password authentication
- Google OAuth integration
- Link to signup page
- Dark theme with hero image

**UI Elements**:
- Left: Hero image with gradient overlay
- Right: Login form with Mudra logo
- Height: Full screen (h-screen)

---

### **2. Signup Page** (`/signup`)
**Component**: Custom signup form

**Features**:
- Full name, email, password fields
- Google OAuth option
- Form validation
- "OR CONTINUE WITH" divider with Google button

**Layout**:
- Left: Hero image (`/images/hero.png`)
- Right: Signup form with Mudra logo (80x80px)
- Responsive grid (lg:grid-cols-2)

---

## 🎓 Onboarding Flow

**Base Path**: `/welcome/*`  
**Wrapper**: `<OnboardingProvider>` + `<BrandProfileProvider>`  
**UI Pattern**: Stepper navigation + centered form on black background

### **Step 1: Account Setup** (`/welcome/account`)
**Component**: `<AccountForm />`

**Collects**:
- User account information
- Email verification (if needed)

**Navigation**: OnboardingStepper shows progress (Step 1/7)

---

### **Step 2: Welcome** (`/welcome`)
**Component**: `<WelcomeForm />`

**Purpose**: Introduction and goal setting  
**Stepper**: Step 2/7

---

### **Step 3: Company Profile** (`/welcome/company`)
**Component**: `<CompanyForm />`

**Collects**:
- Company name
- Industry
- Website URL
- Company description

**Stepper**: Step 4/7  
**Context**: Saves to BrandProfile context

---

### **Step 4: Brand Profile** (`/welcome/profile`)
**Component**: `<ProfileForm />`

**Collects**:
- Brand positioning
- Target audience
- Value proposition
- Unique selling points

**Stepper**: Step 3/7 (custom order)

---

### **Step 5: Competitors** (`/welcome/competitors`)
**Component**: `<CompetitorsForm />`

**Collects**:
- List of competitor brands/websites
- Competitive positioning notes

**Stepper**: Step 5/7  
**Used For**: Competitive analysis in GEO tests

---

### **Step 6: Prompts Configuration** (`/welcome/prompts`)
**Component**: `<PromptsForm />`

**Collects**:
- Custom test prompts (optional)
- Prompt categories selection
- AI model preferences

**Stepper**: Step 6/7  
**Purpose**: Configure AI visibility test prompts

---

### **Step 7: AI Visibility Analysis** (`/welcome/visibility`)
**Component**: `<VisibilityForm />`

**Features**:
- Triggers initial unified analysis
- Shows analysis progress
- Generates first AI visibility report
- Completes onboarding

**Stepper**: Step 6/7  
**API Call**: `/api/analysis/pipeline` (full analysis + report generation)

**On Complete**: Redirects to `/dashboard`

---

## 🏠 Dashboard Pages

**Layout**: Sidebar + Header + Content  
**Wrapper**: `<SidebarProvider>` + `<BrandProfileProvider>`

### **Sidebar Navigation** (`<AppSidebar>`)

**Core Navigation**:
- 🏠 **Overview** - `/dashboard`
- ✅ **Tasks** - `/dashboard/tasks`
- 📝 **Campaigns** - `/dashboard/campaigns`

**Knowledge Base**:
- 👤 **Brand Profile** - `/dashboard/brand-profile`

**Footer**: User profile dropdown with logout

---

## 📊 1. Overview Page (`/dashboard`)

**Primary Purpose**: Main dashboard showing AI visibility & technical health

### **Header Section**
- **Title**: "Overview"
- **Subtitle**: "Your brands performance across AI Search Engines"
- **Actions**:
  - `<CountdownBadge />` - Shows cooldown timer for analysis
  - Website URL input field
  - "Run Analysis" button

### **Analysis Input**
```tsx
<Input 
  placeholder="Enter website URL" 
  value={websiteUrl}
/>
<Button onClick={handleAnalyzeWebsite}>
  Run Analysis
</Button>
```

### **Metrics Cards** (4-column grid)
1. **`<GeoMetricsCard />`** - AI Visibility Score
   - Overall visibility score (0-100)
   - Provider coverage (OpenAI, Anthropic, Google)
   - Number of prompt tests

2. **`<TrafficMetricsCard />`** - Traffic Metrics
   - Monthly visitors
   - Page views
   - Organic traffic share
   - WoW/MoM growth

3. **`<TechStructureCard />`** - Technical Health
   - Overall technical score (12 components)
   - SEO health
   - Performance metrics
   - Accessibility score

4. **`<ReportCard />`** - Natural Language Report
   - Human-readable analysis summary
   - Key findings
   - Actionable recommendations

### **Key Features**
- **Unified Analysis**: Triggers `/api/analysis/unified` endpoint
  - Parallel execution: GEO + Technical analysis
  - Uses DirectGEO API for AI visibility testing
  - Uses Firecrawl for website scraping
  - Saves results to database with `brandProfileId`

- **Real-time Updates**: Listens for `mudra:website-analyzed` event
- **Auto-refresh**: Results refresh after analysis completion
- **Cooldown System**: 5-minute cooldown between analyses (dashboard can skip)

### **Analysis Flow**
```javascript
1. User enters website URL (or uses profile.companyWebsite)
2. Validates brand profile exists (needs brandProfileId)
3. Sanitizes URL and competitors list
4. Calls /api/analysis/unified with:
   - brandProfileId
   - brandName
   - website
   - industry
   - description
   - competitors
   - skipCooldown: true (dashboard bypass)
   - generateReport: false (no report generation)
5. Displays loading state
6. On success: Refreshes results and triggers UI update event
7. Shows updated metrics cards
```

### **Components Used**
- `<OverviewMetrics />` - Top-level metrics display
- `<NaturalLanguageReport />` - AI-generated insights
- `<GenerateReportButton />` - Manual report generation
- `<FloatingMudraButton />` - AI chat assistant

---

## ✅ 2. Tasks Page (`/dashboard/tasks`)

**Primary Purpose**: Task management and AI visibility recommendations

### **Header Section**
- **Title**: "Tasks"
- **Subtitle**: "Manage and track optimization tasks"
- **Actions**:
  - "Generate Tasks" button - Creates tasks from latest analysis

### **Main Sections**

#### **1. AI Visibility Analysis Results**
**Component**: `<DirectGeoResults />`

**Displays**:
- Latest GEO analysis results
- Recommendations from DirectGEO API
- Prompt performance breakdown
- Provider-specific insights (OpenAI, Anthropic, Google)

**Data Source**: Fetches from `/api/analysis/geo/latest?brandProfileId={id}`

**Features**:
- Shows loading state with spinner
- Auto-refreshes when analysis completes
- Listens for `mudra:website-analyzed` event

#### **2. Tasks List**
**Component**: `<TasksView />`

**Features**:
- Task creation from analysis recommendations
- Task status management (To Do, In Progress, Done)
- Task priority levels
- Due date tracking
- Assignee management

**Task Generation**:
```javascript
1. Fetches latest website snapshot from database
2. Calls /api/tasks/generate with snapshot data
3. AI generates actionable tasks based on:
   - GEO analysis recommendations
   - Technical analysis findings
   - SEO improvements needed
   - Performance optimizations
4. Tasks saved to database
5. UI refreshes via 'mudra:refresh-tasks' event
```

### **Task Types**
- **GEO Optimization**: Improve AI visibility
- **Technical SEO**: Fix technical issues
- **Content**: Create/optimize content
- **Performance**: Speed optimizations
- **Accessibility**: A11y improvements

---

## 🎯 3. Prompts Page (`/dashboard/prompts`)

**Primary Purpose**: Manage AI testing prompts

### **Features**

#### **1. Prompt Categories**
- 🔍 **Organic** (Blue) - Natural search queries
- 👥 **Competitor** (Purple) - Competitive comparison prompts
- 📝 **How-to Guides** (Green) - Tutorial-style queries
- 🎯 **Brand-Specific** (Orange) - Direct brand mentions

#### **2. Prompt Management**
- **View**: Tabbed interface by category
- **Search**: Filter prompts by text
- **Add**: Create custom prompts
- **Edit**: Modify existing prompts (inline editing)
- **Delete**: Remove prompts
- **Toggle**: Activate/deactivate prompts

#### **3. Prompt Generation**
**Button**: "Generate AI Prompts"

**Flow**:
```javascript
1. Calls /api/prompts/generate
2. AI generates 30-100 prompts based on:
   - Brand profile data
   - Industry context
   - Competitors
   - Target audience
3. Distributes across categories:
   - Organic: 40%
   - Competitor: 25%
   - How-to: 20%
   - Brand-Specific: 15%
4. Saves to database with brandProfileId
5. UI refreshes to show new prompts
```

### **Prompt Structure**
```typescript
interface Prompt {
  id: string
  brandProfileId: number
  text: string
  category: 'Organic' | 'Competitor' | 'How-to Guides' | 'Brand-Specific'
  isCustom: boolean      // User-created vs AI-generated
  isActive: boolean      // Used in analysis or not
  createdAt: string
  updatedAt: string
}
```

### **UI Components**
- Filter pills with animated indicator
- Search bar with real-time filtering
- Prompt cards with edit/delete actions
- Add prompt dialog with category selector
- Tag input for keywords

---

## 🤖 4. AI Visibility Page (`/dashboard/ai-visibility`)

**Primary Purpose**: Detailed AI visibility analysis and scoring

### **Header Controls**
- `<TimeRangeSelector />` - 7d, 30d, 90d, 1y
- `<ModelSelector />` - ChatGPT, Claude, Gemini, All

### **Main Feature: AI Visibility Calculator**

**Component**: `<AIVisibilityContext>` provider

**Features**:
1. **Score Calculator Card**
   - Input: Company name
   - Button: "Calculate Score"
   - Process: Queries 10 prompts across ChatGPT
   - Output: Visibility percentage (0-100%)

2. **Calculation Process**
   ```javascript
   1. User enters company name
   2. System generates 10 diverse prompts
   3. Each prompt tested against ChatGPT API
   4. Analyzes if company is mentioned
   5. Calculates position in response
   6. Assigns weighted score based on:
      - Mention presence (yes/no)
      - Position (higher = better)
      - Context relevance
   7. Aggregates to final percentage
   ```

3. **Results Display**
   - Loading state with progress indicators
   - Step-by-step process visualization
   - Individual prompt results
   - Overall score badge
   - Response preview dialog

### **Results Breakdown**
- **Prompt**: The query used
- **Mentioned**: ✅ Yes / ❌ No
- **Position**: Rank in response (1st, 2nd, 3rd, etc.)
- **Response**: Full AI response with highlighting

### **Features**
- View full response in modal
- See mention context
- Track position changes over time
- Compare across AI models

---

## 📝 5. Campaigns Page (`/dashboard/campaigns`)

**Primary Purpose**: Content campaign creation wizard

### **Campaign Types**
1. 📝 **Blog Post** - SEO/GEO optimized articles
2. 📧 **Newsletter** - Email campaigns
3. 📄 **Case Study** - Customer success stories

### **Campaign Modes**
- **GEO Mode** - Optimized for AI visibility
- **SEO Mode** - Optimized for search engines

### **Campaign Creation Flow** (4 Steps)

#### **Step 1: Type Selection**
- Choose campaign type (Blog, Newsletter, Case Study)
- Shows icons and descriptions
- Cards with hover effects

#### **Step 2: Improvement Mode**
- Select GEO or SEO optimization
- Explains difference between modes
- Shows what each mode includes

**GEO Mode Includes**:
- AI-friendly formatting
- Citation-ready sources
- Prompt-optimized content
- ICP targeting
- Statistics inclusion

**SEO Mode Includes**:
- Keyword optimization
- Meta tags
- Schema markup
- Search intent analysis
- On-page SEO

#### **Step 3: Configuration** (GEO-specific)
**Elements**:
1. **Prompt Selection**
   - Dropdown of available prompts
   - "Product launch", "Weekly update", "Case study", etc.

2. **ICP (Ideal Customer Profile)**
   - Target audience selector
   - "Seed-stage founders", "GTM leads", etc.

3. **Keywords**
   - Multi-select tag input
   - Suggestions: "ai visibility", "geo marketing", "prompt engineering"
   - Add custom keywords

#### **Step 4: Generation**
**Progress Indicators**:

**GEO Steps** (8 stages):
1. Starting
2. Gathering information
3. Understanding prompts
4. Including ICP
5. Adding sources and citations
6. Including statistics
7. Drafting AI-ready content
8. Final review

**SEO Steps** (8 stages):
1. Starting
2. Running live queries
3. Analyzing search intent
4. Extracting entities & schema
5. Auditing on-page SEO
6. Selecting sources & citations
7. Drafting optimized brief
8. Final review

**Progress Bar**: Animated step-by-step (1.2s per step)

**On Complete**: Redirects to campaign editor

### **Campaign List View**
- **Filters**: Draft / Published
- **Animated indicator**: Slides to active filter
- **Campaign cards**:
  - Title
  - Type badge (Blog/Newsletter/Case Study)
  - Mode badge (GEO/SEO)
  - Status (Draft/Scheduled/Published)
  - Last updated timestamp
- **Click**: Opens campaign editor

### **Campaign Editor** (`/dashboard/campaigns/[id]`)
**Features**:
- Rich text editor
- Preview mode
- SEO/GEO score checker
- Publish/schedule options
- Metadata editing

---

## 👤 6. Brand Profile Page (`/dashboard/brand-profile`)

**Component**: `<BrandProfileForm />`

**Purpose**: Manage brand information (editable version of onboarding data)

### **Form Sections**

#### **1. Company Information**
- Company name
- Website URL
- Industry
- Description

#### **2. Brand Details**
- Brand positioning
- Value proposition
- Target audience
- Key messaging

#### **3. Competitors**
- List of competitors
- Add/remove functionality
- Competitor URLs

#### **4. Social & Contact**
- Twitter/X handle
- LinkedIn URL
- Contact email

#### **5. AI Preferences**
- Preferred AI models for testing
- Test frequency
- Notification settings

### **Actions**
- **Save Changes** - Updates brand profile in database
- **Regenerate Prompts** - Creates new AI test prompts
- **Run Analysis** - Triggers full analysis with new data

### **Data Storage**
All data saved to `BrandProfile` table with user association

---

## 🎨 Shared UI Components

### **`<FloatingMudraButton />`**
- **Position**: Fixed bottom-right
- **Purpose**: AI chat assistant
- **Features**: Opens chat interface for analysis Q&A

### **`<AppSidebar />`**
**Sections**:
1. **Company Logo/Name** (top)
   - Shows company initials if no logo
   - Company name from brand profile

2. **Navigation**:
   - Core section (Overview, Tasks, Campaigns)
   - Knowledge Base section (Brand Profile)

3. **User Menu** (bottom)
   - User avatar
   - Email
   - Logout button

### **`<SiteHeader />`**
- **Left**: Breadcrumbs / Page title
- **Right**: Search command palette trigger
- **Bottom**: Separator line

### **`<OnboardingStepper />`**
- Shows 7 steps with progress
- Current step highlighted
- Completed steps marked
- Used across all `/welcome/*` pages

### **`<CountdownBadge />`**
- Shows time until next analysis allowed
- Disappears after cooldown expires
- Format: "Next analysis in 4m 32s"

---

## 🔄 Data Flow Architecture

### **1. Brand Profile Flow**
```
User Input → BrandProfileContext → API (/api/brand-profile)
→ Database (BrandProfile table) → Context update → UI re-render
```

### **2. Analysis Flow**
```
Dashboard Input → Unified Analysis API → Parallel execution:
  ├─ DirectGEO API (AI visibility)
  └─ Technical Analysis Service (Firecrawl)
→ Database saves (GeoAnalysisResult + TechnicalStructureAnalysis)
→ Event trigger (mudra:website-analyzed)
→ Results refresh → UI update
```

### **3. Prompt Flow**
```
Brand Profile → Prompt Generation Service → AI generates prompts
→ Database (Prompt table) → Retrieved by brandProfileId
→ Used in GEO analysis → Results displayed
```

### **4. Task Flow**
```
Analysis Results → Task Generation API → AI creates tasks
→ Database (Task table) → TasksView component
→ User updates → Database → UI refresh
```

---

## 🎯 Key Technical Patterns

### **1. Server vs Client Components**
- **Server Components**: All pages by default
- **Client Components**: Forms, interactive UI (`"use client"`)

### **2. Context Providers**
- `<BrandProfileProvider>` - Global brand data
- `<OnboardingProvider>` - Onboarding state
- `<AIVisibilityProvider>` - AI visibility context
- `<SessionProvider>` - NextAuth session

### **3. API Response Format**
```typescript
// Success
{ success: true, data: { ... } }

// Error
{ success: false, error: { message: string, code?: string } }
```

### **4. Event System**
- `mudra:website-analyzed` - Analysis complete
- `mudra:refresh-tasks` - Task list refresh
- Custom events for real-time updates

### **5. Loading States**
- Skeleton loaders for data fetching
- Progress bars for long operations
- Spinner icons for quick actions
- Toast notifications for feedback

---

## 📱 Responsive Design

### **Breakpoints**
- **Mobile**: < 768px (single column, collapsible sidebar)
- **Tablet**: 768px - 1024px (2-column grid)
- **Desktop**: > 1024px (full sidebar, 4-column grid)

### **Sidebar Behavior**
- **Desktop**: Persistent sidebar (--sidebar-width: 52 or 72 spacing units)
- **Mobile**: Collapsible sidebar (hamburger menu)

### **Grid Layouts**
- **Metrics Cards**: `grid-cols-1 @xl/main:grid-cols-2 @3xl/main:grid-cols-4`
- **Campaigns**: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

---

## 🎨 Design Tokens

### **Colors**
- **Background**: `bg-black` (onboarding), `bg-dark-grey` (dashboard)
- **Cards**: `bg-dark-grey border-white/10`
- **Text**: `text-white`, `text-white/60` (muted)
- **Accents**: `bg-white text-black` (primary buttons)

### **Spacing**
- **Container**: `container mx-auto px-4 lg:px-6`
- **Section gaps**: `gap-3 md:gap-4` (small), `gap-5 md:gap-6` (large)
- **Card padding**: `p-4 md:p-6`

### **Typography**
- **Page title**: `text-2xl font-bold`
- **Section title**: `text-xl font-semibold`
- **Body**: `text-base`
- **Muted**: `text-muted-foreground`

---

## 🚀 Performance Optimizations

1. **Server Components**: Fetch data on server, reduce client JS
2. **Parallel Data Fetching**: Multiple API calls simultaneously
3. **Event-driven Updates**: Avoid polling, use custom events
4. **Lazy Loading**: Components loaded on-demand
5. **Image Optimization**: Next.js Image component with priority flag

---

## 🔍 Search & Navigation

### **`<SearchCommand />`** (Cmd+K)
- Global search palette
- Quick navigation to pages
- Command-style interface
- Keyboard shortcuts

### **Navigation Patterns**
- Sidebar for main sections
- Breadcrumbs for deep pages
- Back buttons where needed
- URL-based state (query params)

---

## 📊 Analytics & Tracking

### **Events Tracked** (potential)
- Page views
- Analysis runs
- Task completions
- Campaign creations
- Prompt generations
- Profile updates

### **Metrics Displayed**
- AI Visibility Score (0-100)
- Technical Health Score (0-100)
- Monthly Visitors
- Organic Traffic %
- Task Completion Rate

---

## 🎓 User Education

### **Tooltips**
- Hover info on complex metrics
- Help icons with `<Tooltip>` component

### **Empty States**
- Guidance when no data exists
- Call-to-action to get started
- Example data/previews

### **Loading States**
- Progress indicators during analysis
- Step-by-step process visibility
- Estimated time remaining

---

## 🔐 Security & Auth

### **Protected Routes**
- All `/dashboard/*` routes require authentication
- Redirect to `/login` if not authenticated
- Session validated server-side

### **Data Access**
- All queries filtered by `brandProfileId`
- User can only access their own data
- API routes validate session

---

## 🎯 Next Steps & Future Features

### **Planned Additions**
1. Historical trend charts
2. Competitor comparison dashboard
3. Automated reporting
4. Team collaboration features
5. API integrations (Google Analytics, etc.)
6. White-label options
7. Multi-brand management

---

## 📚 Related Documentation

- **Architecture**: `/docs/architecture/SYSTEM_ARCHITECTURE.md`
- **API Reference**: `/docs/implementation/UNIFIED_ANALYSIS_IMPLEMENTATION.md`
- **Setup Guide**: `/docs/mudra-app/SETUP.md`
- **Troubleshooting**: `/docs/mudra-app/DEV_TROUBLESHOOTING.md`

---

**Document Status**: ✅ Complete  
**Last Updated**: October 16, 2025  
**Maintainer**: Development Team
